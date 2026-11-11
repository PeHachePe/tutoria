import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Attempt, AttemptHistory, StoredAttemptStatus } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { DataError } from '../../data/data-error';
import type { HintLevel, TutorEvent, TutorInteraction, TutorRequest } from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import { AttemptStore } from './attempt-store';
import { TutorStore } from './tutor-store';

function attemptOf(id: string, status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id,
    exerciseId: `exercise-${id}`,
    userId: 'student-1',
    assignmentId: null,
    currentCode: 'function suma(v) {}',
    finalCode: null,
    status,
    startedAt: '2026-11-09T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-09T10:00:00.000Z',
  };
}

function interactionOf(
  attemptId: string,
  trigger: TutorInteraction['trigger'],
  hintLevel: HintLevel,
  transcript: string,
): TutorInteraction {
  return {
    id: `${attemptId}-${transcript}`,
    attemptId,
    trigger,
    hintLevel,
    studentMessage: trigger === 'question' ? '¿Qué hago?' : null,
    transcript,
    emotion: 'encouragement',
    intensity: 1,
    elusion: false,
    promptVersion: 'v0',
    createdAt: '2026-11-09T10:05:00.000Z',
  };
}

function historyOf(attempt: Attempt, interactions: TutorInteraction[] = []): AttemptHistory {
  return { attempt, events: [], interactions };
}

/** A promise the test resolves when it wants, to control the order of the answers. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** An answer as the tutor sends it: meta, the text in chunks and done. */
async function* answer(
  text: string[],
  hintLevel: HintLevel = 1,
  { silent = false, waitFor }: { silent?: boolean; waitFor?: Promise<void> } = {},
): AsyncGenerator<TutorEvent> {
  yield { type: 'meta', emotion: 'joy', intensity: 1, hintLevel };
  await waitFor;
  for (const chunk of text) yield { type: 'delta', text: chunk };
  yield { type: 'done', interactionId: silent ? null : 'interaction-1', silent };
}

/** An answer that fails before its first event. */
function failing(error: unknown): AsyncIterable<TutorEvent> {
  return { [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(error) }) };
}

describe('TutorStore', () => {
  let attempt: ReturnType<typeof signal<Attempt | undefined>>;
  let history: ReturnType<typeof vi.fn<AttemptService['history']>>;
  let ask: ReturnType<typeof vi.fn<TutorService['ask']>>;
  let store: TutorStore;

  beforeEach(() => {
    attempt = signal<Attempt | undefined>(attemptOf('a1'));
    history = vi.fn<AttemptService['history']>((id) =>
      Promise.resolve(historyOf(attemptOf(id), [])),
    );
    ask = vi.fn<TutorService['ask']>(() => answer(['Hola, ', '¿qué tal?']));
    TestBed.configureTestingModule({
      providers: [
        TutorStore,
        {
          provide: AttemptStore,
          useValue: { attempt, readonly: computed(() => attempt()?.status === 'submitted') },
        },
        { provide: AttemptService, useValue: { history } },
        { provide: TutorService, useValue: { ask } },
      ],
    });
    store = TestBed.inject(TutorStore);
  });

  /** Lets the resource of the conversation load for the current attempt. */
  async function loaded(): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(history).toHaveBeenLastCalledWith(attempt()?.id);
      expect(store.loading()).toBe(false);
    });
  }

  it('loads the conversation of the attempt, with the level it reached', async () => {
    history.mockResolvedValue(
      historyOf(attemptOf('a1'), [
        interactionOf('a1', 'hint', 1, 'Pista uno'),
        interactionOf('a1', 'question', 1, 'Respuesta'),
        interactionOf('a1', 'hint', 2, 'Pista dos'),
      ]),
    );

    await loaded();

    expect(history).toHaveBeenCalledWith('a1');
    expect(store.turns().map((turn) => [turn.trigger, turn.answer, turn.status])).toEqual([
      ['hint', 'Pista uno', 'done'],
      ['question', 'Respuesta', 'done'],
      ['hint', 'Pista dos', 'done'],
    ]);
    expect(store.turns()[1].studentMessage).toBe('¿Qué hago?');
    expect(store.hintLevel()).toBe(2);
    expect(store.nextHintLevel()).toBe(3);
    expect(store.canAsk()).toBe(true);
    // The past is not read aloud again, nor counted as new
    expect(store.announcement()).toBe('');
    expect(store.answerCount()).toBe(0);
    expect(store.reaction()).toBeNull();
  });

  it('starts without hints, and stays at the most concrete level', async () => {
    await loaded();
    expect(store.hintLevel()).toBe(0);
    expect(store.nextHintLevel()).toBe(1);

    history.mockResolvedValue(
      historyOf(
        attemptOf('a2'),
        [1, 2, 3].map((level) => interactionOf('a2', 'hint', level as HintLevel, `P${level}`)),
      ),
    );
    attempt.set(attemptOf('a2'));
    await loaded();

    expect(store.hintLevel()).toBe(3);
    expect(store.nextHintLevel()).toBe(3);
  });

  it('asks a question with the current code and the language, and writes the answer as it arrives', async () => {
    await loaded();

    await store.ask('  ¿Por dónde empiezo?  ');

    const request: TutorRequest = {
      requestId: store.turns()[0].id,
      attemptId: 'a1',
      kind: 'question',
      message: '¿Por dónde empiezo?',
      code: 'function suma(v) {}',
      language: 'es',
    };
    expect(ask).toHaveBeenCalledWith(request);
    expect(store.turns()).toEqual([
      {
        id: expect.any(String),
        trigger: 'question',
        studentMessage: '¿Por dónde empiezo?',
        answer: 'Hola, ¿qué tal?',
        hintLevel: 1,
        emotion: 'joy',
        intensity: 1,
        reaction: 'hearts',
        elusion: false,
        createdAt: expect.any(String),
        status: 'done',
        fresh: true,
      },
    ]);
    expect(store.announcement()).toBe('Hola, ¿qué tal?');
    expect(store.answerCount()).toBe(1);
  });

  it('reacts with each new answer once it is complete, as the tutor chose', async () => {
    await loaded();
    const rest = deferred<void>();
    ask.mockImplementationOnce(async function* () {
      yield {
        type: 'meta',
        emotion: 'celebration',
        intensity: 3,
        hintLevel: 1,
        reaction: 'fire',
      };
      await rest.promise;
      yield { type: 'delta', text: '¡Bien!' };
    });

    const asking = store.ask('¿Está bien?');
    await vi.waitFor(() => expect(store.turns()[0]?.reaction).toBe('fire'));
    expect(store.reaction()).toBeNull();

    rest.resolve();
    await asking;
    const [turn] = store.turns();
    expect(store.reaction()).toEqual({ id: turn.id, kind: 'fire', intensity: 3 });
  });

  it('knows the reaction of the answer still arriving, so its emoji can load ahead', async () => {
    await loaded();
    const rest = deferred<void>();
    ask.mockImplementationOnce(async function* () {
      yield { type: 'meta', emotion: 'joy', intensity: 2, hintLevel: 1, reaction: 'rocket' };
      await rest.promise;
      yield { type: 'delta', text: '¡Despega!' };
    });
    expect(store.upcomingReaction()).toBeNull();

    const asking = store.ask('¿Y ahora?');
    await vi.waitFor(() => expect(store.turns()[0]?.reaction).toBe('rocket'));
    expect(store.upcomingReaction()).toEqual({
      id: store.turns()[0].id,
      kind: 'rocket',
      intensity: 2,
    });

    rest.resolve();
    await asking;
    expect(store.upcomingReaction()).toBeNull();
  });

  it('offers help under a complete answer that turned down a request for the solution', async () => {
    await loaded();
    const rest = deferred<void>();
    ask.mockImplementationOnce(async function* () {
      yield { type: 'meta', emotion: 'surprise', intensity: 2, hintLevel: 1, elusion: true };
      await rest.promise;
      yield { type: 'delta', text: '¿Qué crees que hace falta?' };
    });

    const asking = store.ask('Dame la solución');
    await vi.waitFor(() => expect(store.turns()[0]?.elusion).toBe(true));
    // Not while the answer is still arriving
    expect(store.offersHelp()).toBe(false);

    rest.resolve();
    await asking;
    expect(store.offersHelp()).toBe(true);

    // The next answer, an ordinary one, takes the offer away
    await store.ask('Vale, ¿por dónde empiezo?');
    expect(store.turns().at(-1)?.elusion).toBe(false);
    expect(store.offersHelp()).toBe(false);
  });

  it('offers help after a past refusal, but not in a submitted attempt', async () => {
    const refusal = { ...interactionOf('a1', 'question', 1, 'No te la doy'), elusion: true };
    history.mockResolvedValue(historyOf(attemptOf('a1'), [refusal]));
    await loaded();
    expect(store.offersHelp()).toBe(true);

    attempt.set(attemptOf('a1', 'submitted'));
    expect(store.offersHelp()).toBe(false);
  });

  it('reacts as its emotion when the tutor chose no reaction', async () => {
    await loaded();

    await store.ask('¿Y ahora?');

    expect(store.reaction()).toEqual({ id: store.turns()[0].id, kind: 'hearts', intensity: 1 });
  });

  it('keeps the same reaction while the conversation goes on, so it plays once', async () => {
    await loaded();
    await store.ask('Primera');
    const first = store.reaction();
    const rest = deferred<void>();
    ask.mockImplementationOnce(() => answer(['Segunda'], 1, { waitFor: rest.promise }));

    const asking = store.ask('Segunda');
    await vi.waitFor(() => expect(store.answering()).toBe(true));

    expect(store.reaction()).toBe(first);
    rest.resolve();
    await asking;
  });

  it('does not react to an answer that failed', async () => {
    await loaded();
    ask.mockImplementationOnce(() => failing(new DataError('network')));

    await store.ask('¿Qué falla?');

    expect(store.reaction()).toBeNull();
  });

  it('ignores an empty question', async () => {
    await loaded();

    await store.ask('   ');

    expect(ask).not.toHaveBeenCalled();
  });

  it('asks for a hint, and the server raises the level', async () => {
    await loaded();
    ask.mockImplementation(() => answer(['Mira el bucle.'], 1));

    await store.requestHint();

    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ kind: 'hint', message: undefined }));
    expect(store.turns()[0]).toMatchObject({ trigger: 'hint', studentMessage: null, hintLevel: 1 });
    expect(store.hintLevel()).toBe(1);
  });

  it('shows the answer while it arrives, and one at a time', async () => {
    await loaded();
    const rest = deferred<void>();
    ask.mockImplementation(() => answer(['Ya ', 'está.'], 1, { waitFor: rest.promise }));

    const asking = store.requestHint();
    await vi.waitFor(() => expect(store.turns()[0]?.hintLevel).toBe(1));

    expect(store.answering()).toBe(true);
    expect(store.turns()[0]).toMatchObject({ status: 'answering', answer: '' });
    expect(store.canAsk()).toBe(false);
    await store.ask('¿Y otra?');
    expect(ask).toHaveBeenCalledTimes(1);

    rest.resolve();
    await asking;
    expect(store.answering()).toBe(false);
    expect(store.turns()[0]).toMatchObject({ status: 'done', answer: 'Ya está.' });
  });

  it('keeps what the student asked when the answer fails halfway, and asks again on retry', async () => {
    await loaded();
    ask.mockImplementationOnce(async function* () {
      yield { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 1 };
      yield { type: 'delta', text: 'A medias' };
      throw new DataError('network');
    });

    await store.ask('¿Qué falla?');

    const [failed] = store.turns();
    expect(failed).toMatchObject({
      studentMessage: '¿Qué falla?',
      status: 'failed',
      answer: '',
      error: new DataError('network'),
    });
    expect(store.canAsk()).toBe(true);
    expect(store.announcement()).toBe('');

    await store.retry(failed.id);

    // The same request again, so the server can give back an answer it had already recorded
    expect(ask).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: failed.id, kind: 'question', message: '¿Qué falla?' }),
    );
    expect(store.turns()).toHaveLength(1);
    expect(store.turns()[0].id).toBe(failed.id);
    expect(store.turns()[0]).toMatchObject({ status: 'done', answer: 'Hola, ¿qué tal?' });
  });

  it('asks again for a hint that failed', async () => {
    await loaded();
    ask.mockImplementationOnce(() => failing(new DataError('network')));

    await store.requestHint();
    await store.retry(store.turns()[0].id);

    expect(ask).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'hint', message: undefined }),
    );
    expect(store.turns()[0]).toMatchObject({ trigger: 'hint', status: 'done' });
  });

  it('retries only a turn that failed', async () => {
    await loaded();
    await store.ask('¿Qué falla?');

    await store.retry(store.turns()[0].id);
    await store.retry('unknown');

    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when the tutor chooses to keep quiet', async () => {
    await loaded();
    ask.mockImplementation(() => answer([], 1, { silent: true }));

    await store.ask('…');

    expect(store.turns()).toEqual([]);
    expect(store.reaction()).toBeNull();
  });

  it('counts an answer that ends without done as finished', async () => {
    await loaded();
    ask.mockImplementation(async function* () {
      yield { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 1 };
      yield { type: 'delta', text: 'Sin final' };
    });

    await store.ask('¿Y?');

    expect(store.turns()[0]).toMatchObject({ status: 'done', answer: 'Sin final' });
  });

  it('starts the conversation of the next exercise, ignoring a late answer of the previous one', async () => {
    await loaded();
    const rest = deferred<void>();
    ask.mockImplementation(() => answer(['Tarde'], 1, { waitFor: rest.promise }));
    const asking = store.ask('¿Y esto?');
    await vi.waitFor(() => expect(store.turns()).toHaveLength(1));

    attempt.set(attemptOf('a2'));
    await loaded();
    rest.resolve();
    await asking;

    expect(history).toHaveBeenLastCalledWith('a2');
    expect(store.turns()).toEqual([]);
  });

  it('only reads the conversation of a submitted attempt', async () => {
    attempt.set(attemptOf('a1', 'submitted'));
    await loaded();

    expect(store.readonly()).toBe(true);
    expect(store.canAsk()).toBe(false);
    await store.requestHint();
    expect(ask).not.toHaveBeenCalled();
  });

  it('waits for an attempt, and says when the conversation could not load', async () => {
    attempt.set(undefined);
    expect(store.canAsk()).toBe(false);
    await store.ask('¿Hola?');
    expect(ask).not.toHaveBeenCalled();

    history.mockRejectedValueOnce(new DataError('network'));
    attempt.set(attemptOf('a1'));
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.loadError()).toEqual(new DataError('network'));
    });
    expect(store.turns()).toEqual([]);
    expect(store.canAsk()).toBe(false);

    store.reload();
    await loaded();
    expect(store.loadError()).toBeUndefined();
    expect(store.canAsk()).toBe(true);
  });
});
