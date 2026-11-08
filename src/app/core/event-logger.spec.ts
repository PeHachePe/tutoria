import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../auth/auth-store';
import { FakeAuthService } from '../auth/auth-testing';
import { AuthService } from '../data/auth-service';
import { DataError } from '../data/data-error';
import { EventService } from '../data/event-service';
import type { NewProcessEvent } from '../data/process-event';
import { EVENT_BATCH_DELAY_MS, EVENT_BATCH_SIZE, EventLogger } from './event-logger';

function paste(length: number): NewProcessEvent {
  return {
    attemptId: 'attempt-1',
    type: 'paste',
    timestamp: '2026-11-08T10:00:00.000Z',
    detail: { length },
  };
}

/** A promise the test resolves when it wants, to control when a send ends. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('EventLogger', () => {
  let send: ReturnType<typeof vi.fn<EventService['send']>>;
  let logger: EventLogger;

  /** Sets document.visibilityState and fires its event, as the browser does. */
  function setVisibility(state: DocumentVisibilityState): void {
    const document = TestBed.inject(DOCUMENT);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    send = vi.fn<EventService['send']>(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        { provide: EventService, useValue: { send } },
        { provide: AuthService, useValue: new FakeAuthService() },
      ],
    });
    logger = TestBed.inject(EventLogger);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(TestBed.inject(DOCUMENT), 'visibilityState');
  });

  it('sends the queued events together once the batch delay has passed since the first', async () => {
    logger.log(paste(1));
    await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS - 1000);
    logger.log(paste(2));
    await vi.advanceTimersByTimeAsync(999);
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(send).toHaveBeenCalledExactlyOnceWith([paste(1), paste(2)]);
  });

  it('sends at once when the batch is full, without waiting', async () => {
    for (let i = 1; i <= EVENT_BATCH_SIZE; i++) logger.log(paste(i));
    await vi.advanceTimersByTimeAsync(0);

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toHaveLength(EVENT_BATCH_SIZE);

    // The timer of the full batch does not send an empty one later
    await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS);
    expect(send).toHaveBeenCalledOnce();
  });

  it('sends when the tab is hidden, the last moment a phone surely gives', async () => {
    logger.log(paste(1));
    setVisibility('visible');
    expect(send).not.toHaveBeenCalled();

    setVisibility('hidden');

    expect(send).toHaveBeenCalledExactlyOnceWith([paste(1)]);
  });

  it('sends nothing while there is nothing queued', async () => {
    await logger.flush();
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS);

    expect(send).not.toHaveBeenCalled();
  });

  it('sends one batch at a time: what arrives meanwhile goes in the next one', async () => {
    const first = deferred();
    send.mockReturnValueOnce(first.promise);
    logger.log(paste(1));
    const flushing = logger.flush();
    logger.log(paste(2));
    const flushingAgain = logger.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledOnce();

    first.resolve();
    await Promise.all([flushing, flushingAgain]);

    expect(send.mock.calls).toEqual([[[paste(1)]], [[paste(2)]]]);
  });

  it('waits for the batch on its way even when there is nothing new to send', async () => {
    const first = deferred();
    send.mockReturnValueOnce(first.promise);
    logger.log(paste(1));
    void logger.flush();
    let done = false;
    const flushing = logger.flush().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);

    first.resolve();
    await flushing;

    expect(done).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it.each(['network', 'rate_limited'] as const)(
    'keeps the batch for the next send after a passing failure (%s)',
    async (kind) => {
      send.mockRejectedValueOnce(new DataError(kind));
      logger.log(paste(1));
      await logger.flush();
      logger.log(paste(2));

      await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS);

      expect(send).toHaveBeenLastCalledWith([paste(1), paste(2)]);
    },
  );

  it('tries again on its own after a passing failure, even if nothing else happens', async () => {
    send.mockRejectedValueOnce(new DataError('network'));
    logger.log(paste(1));
    await logger.flush();

    await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith([paste(1)]);
  });

  it.each([new DataError('forbidden'), new DataError('unauthorized'), new Error('bug')])(
    'drops the batch when trying again cannot help (%s)',
    async (error) => {
      send.mockRejectedValueOnce(error);
      logger.log(paste(1));
      await logger.flush();

      await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS);

      expect(send).toHaveBeenCalledOnce();
    },
  );

  it('sends what is queued before signing out, while the session still exists', async () => {
    const auth = TestBed.inject(AuthService) as FakeAuthService;
    auth.signOut.mockImplementation(() => {
      expect(send).toHaveBeenCalledWith([paste(1)]);
      return Promise.resolve();
    });
    logger.log(paste(1));

    await TestBed.inject(AuthStore).signOut();

    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('stops listening and drops its timer when the app is destroyed', async () => {
    logger.log(paste(1));
    TestBed.resetTestingModule();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(EVENT_BATCH_DELAY_MS);

    expect(send).not.toHaveBeenCalled();
  });
});
