import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EventLogger } from '../../core/event-logger';
import type { Attempt } from '../../data/attempt';
import { AttemptStore } from './attempt-store';
import { BrowserSignals, MIN_AWAY_MS } from './browser-signals';

const START = Date.parse('2026-11-08T10:00:00.000Z');

function attemptOf(id: string): Attempt {
  return {
    id,
    exerciseId: 'exercise-3',
    userId: 'student-1',
    assignmentId: 'assignment-3',
    currentCode: '',
    finalCode: null,
    status: 'in_progress',
    startedAt: '2026-11-08T09:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-08T09:00:00.000Z',
  };
}

/** ISO time `ms` milliseconds after START. */
function at(ms: number): string {
  return new Date(START + ms).toISOString();
}

describe('BrowserSignals', () => {
  let attempt: ReturnType<typeof signal<Attempt | undefined>>;
  let editable: ReturnType<typeof signal<boolean>>;
  let log: ReturnType<typeof vi.fn<EventLogger['log']>>;
  let flush: ReturnType<typeof vi.fn<EventLogger['flush']>>;
  let signals: BrowserSignals;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    attempt = signal<Attempt | undefined>(attemptOf('attempt-1'));
    editable = signal(true);
    log = vi.fn<EventLogger['log']>();
    flush = vi.fn<EventLogger['flush']>(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        BrowserSignals,
        { provide: AttemptStore, useValue: { attempt, editable } },
        { provide: EventLogger, useValue: { log, flush } },
      ],
    });
    signals = TestBed.inject(BrowserSignals);
  });

  afterEach(() => vi.useRealTimers());

  describe('pastes', () => {
    it('records the length of the pasted text', () => {
      signals.pasted(120);

      expect(log).toHaveBeenCalledExactlyOnceWith({
        attemptId: 'attempt-1',
        type: 'paste',
        timestamp: at(0),
        detail: { length: 120 },
      });
    });

    it('records nothing without an attempt open for changes', () => {
      attempt.set(undefined);
      signals.pasted(120);
      attempt.set(attemptOf('attempt-1'));
      editable.set(false);
      signals.pasted(120);

      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('absences', () => {
    it('records an absence that lasts, with the time of leaving, and the time away on return', async () => {
      signals.left();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS);

      expect(log).toHaveBeenCalledExactlyOnceWith({
        attemptId: 'attempt-1',
        type: 'focus_lost',
        timestamp: at(0),
        detail: null,
      });

      await vi.advanceTimersByTimeAsync(78_000);
      signals.returned();

      expect(log).toHaveBeenLastCalledWith({
        attemptId: 'attempt-1',
        type: 'focus_gained',
        timestamp: at(80_000),
        detail: { awayMs: 80_000 },
      });
    });

    it('ignores a short absence, such as a click on the address bar', async () => {
      signals.left();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS - 1);
      signals.returned();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS);

      expect(log).not.toHaveBeenCalled();
    });

    it('records a hidden tab at once and sends it, as the page may not get another chance', () => {
      signals.left();
      signals.hidden();

      expect(log).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: 'focus_lost', timestamp: at(0) }),
      );
      expect(flush).toHaveBeenCalled();
    });

    it('records the absence only once, however the browser reports it', async () => {
      signals.left();
      signals.left();
      signals.hidden();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS);
      signals.hidden();

      expect(log).toHaveBeenCalledOnce();
    });

    it('takes a hidden tab without a blur as leaving, as some phones do', () => {
      signals.hidden();
      signals.returned();

      expect(log.mock.calls.map(([event]) => event.type)).toEqual(['focus_lost', 'focus_gained']);
    });

    it('records no return without a recorded leave, such as a page opened in the background', () => {
      signals.returned();

      expect(log).not.toHaveBeenCalled();
    });

    it('keeps the attempt of the leave, even if another one opens meanwhile', async () => {
      signals.left();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS);
      attempt.set(attemptOf('attempt-2'));
      signals.returned();

      expect(log).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'focus_gained', attemptId: 'attempt-1' }),
      );
    });

    it('records nothing without an attempt open for changes', async () => {
      editable.set(false);
      signals.left();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS);
      signals.hidden();
      signals.returned();

      expect(log).not.toHaveBeenCalled();
    });

    it('drops a pending leave when the student leaves the screen', async () => {
      signals.left();
      TestBed.resetTestingModule();
      await vi.advanceTimersByTimeAsync(MIN_AWAY_MS);

      expect(log).not.toHaveBeenCalled();
    });
  });
});
