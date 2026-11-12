import { computed, DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Attempt, AttemptHistory, StoredAttemptStatus } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { DataError } from '../../data/data-error';
import type { HintLevel, TutorEvent, TutorInteraction, TutorRequest } from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import { appTool, ToolError, ToolRegistry } from '../../core/tools/app-tool';
import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import { AttemptStore } from './attempt-store';
import { TutorStore, waitsForStudent } from './tutor-store';

function attemptOf(id: string, status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id,
    exerciseId: `exercise-${id}`,
    userId: 'student-1',
    assignmentId: null,
    number: 1,
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
        actions: [],
        queried: [],
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

  describe('with the tools of the tutor (2.5e)', () => {
    const progress = vi.fn(() => ({ pending: 3 }));
    const settings = vi.fn((changes: object) => ({
      changed: changes,
      previous: { theme: 'light' },
    }));
    const open = vi.fn((): unknown => ({ opened: 'Suma' }));

    beforeEach(() => {
      progress.mockClear();
      settings.mockClear();
      open.mockClear();
      const registry = TestBed.inject(ToolRegistry);
      const destroyRef = TestBed.inject(DestroyRef);
      for (const tool of [
        appTool(TUTOR_TOOL.getMyProgress, progress),
        appTool(TUTOR_TOOL.updateSettings, settings),
        appTool(TUTOR_TOOL.openExercise, open),
        appTool(TUTOR_TOOL.highlightLines, ({ lines }) => store.mark(lines)),
      ]) {
        registry.register(tool, destroyRef);
      }
    });

    /** An answer with actions, as the server sends them. */
    async function* acting(actions: { name: string; arguments: object }[]) {
      yield {
        type: 'meta',
        emotion: 'joy',
        intensity: 1,
        hintLevel: 1,
        actions: actions as { name: string; arguments: Record<string, unknown> }[],
      } satisfies TutorEvent;
      yield { type: 'delta', text: 'Listo.' } satisfies TutorEvent;
      yield { type: 'done', interactionId: 'i1', silent: false } satisfies TutorEvent;
    }

    async function* querying(calls: { name: string; arguments: object }[]) {
      yield {
        type: 'query',
        calls: calls as { name: string; arguments: Record<string, unknown> }[],
      } satisfies TutorEvent;
    }

    it('reads the data the tutor asks for and asks again with them, once', async () => {
      ask
        .mockImplementationOnce(() =>
          querying([
            { name: 'getMyProgress', arguments: {} },
            { name: 'getSettings', arguments: {} },
          ]),
        )
        .mockImplementationOnce(() => answer(['Te quedan 3.']));
      await loaded();

      await store.ask('¿Cuántos me quedan?');

      expect(ask).toHaveBeenCalledTimes(2);
      const [first] = ask.mock.calls[0];
      const [second] = ask.mock.calls[1];
      expect(first.results).toBeUndefined();
      expect(second).toEqual({
        ...first,
        results: [
          { name: 'getMyProgress', arguments: {}, result: { pending: 3 } },
          {
            name: 'getSettings',
            arguments: {},
            result: { error: 'The tool getSettings is not available here' },
          },
        ],
      });
      expect(second.requestId).toBe(first.requestId);
      const [turn] = store.turns();
      expect(turn.queried).toEqual(['getMyProgress', 'getSettings']);
      expect(turn.answer).toBe('Te quedan 3.');
      expect(turn.status).toBe('done');
    });

    it('never asks a third time, even if the answer asks for data again', async () => {
      ask.mockImplementation(() => querying([{ name: 'getMyProgress', arguments: {} }]));
      await loaded();

      await store.ask('¿Cuántos me quedan?');

      expect(ask).toHaveBeenCalledTimes(2);
      expect(store.turns()[0].status).toBe('done');
    });

    it('runs at once what only changes the screen, and waits for the student with the rest', async () => {
      ask.mockImplementationOnce(() =>
        acting([
          { name: 'highlightLines', arguments: { lines: [{ line: 2 }] } },
          { name: 'openExercise', arguments: { exercise: 'next' } },
          { name: 'updateSettings', arguments: { language: 'en' } },
          { name: 'updateSettings', arguments: { theme: 'dark' } },
        ]),
      );
      await loaded();

      await store.ask('Hazlo todo');

      expect(store.marks()).toEqual([{ line: 2 }]);
      expect(store.turns()[0].actions.map((action) => action.status)).toEqual([
        'done',
        'pending',
        'pending',
        'done',
      ]);
      expect(open).not.toHaveBeenCalled();
      expect(settings).toHaveBeenCalledTimes(1);

      await store.runAction(store.turns()[0].id, 1);
      expect(open).toHaveBeenCalledWith({ exercise: 'next' }, expect.anything());
      expect(store.turns()[0].actions[1]).toEqual(
        expect.objectContaining({ status: 'done', result: { opened: 'Suma' } }),
      );

      // Once done, pressing again does nothing; and there is nothing at an index without action
      await store.runAction(store.turns()[0].id, 1);
      await store.runAction(store.turns()[0].id, 9);
      await store.runAction('another-turn', 0);
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('changes only the action of its own answer', async () => {
      ask
        .mockImplementationOnce(() =>
          acting([{ name: 'openExercise', arguments: { exercise: 'next' } }]),
        )
        .mockImplementationOnce(() =>
          acting([{ name: 'openExercise', arguments: { exercise: 'next' } }]),
        );
      await loaded();
      await store.ask('Uno');
      await store.ask('Otro');

      await store.runAction(store.turns()[1].id, 0);

      expect(store.turns().map((turn) => turn.actions[0].status)).toEqual(['pending', 'done']);
    });

    it('says when an action failed, and lets the student try it again', async () => {
      open.mockImplementationOnce(() => {
        throw new ToolError('No such exercise');
      });
      ask.mockImplementationOnce(() =>
        acting([{ name: 'openExercise', arguments: { exercise: 'next' } }]),
      );
      await loaded();
      await store.ask('Ábrelo');
      const turnId = store.turns()[0].id;

      await store.runAction(turnId, 0);
      expect(store.turns()[0].actions[0].status).toBe('failed');

      await store.runAction(turnId, 0);
      expect(store.turns()[0].actions[0].status).toBe('done');
    });

    it('undoes the settings the tutor changed, and only those', async () => {
      ask.mockImplementationOnce(() =>
        acting([
          { name: 'updateSettings', arguments: { theme: 'dark' } },
          { name: 'highlightLines', arguments: { lines: [] } },
        ]),
      );
      await loaded();
      await store.ask('Modo oscuro');
      const turnId = store.turns()[0].id;

      await store.undoAction(turnId, 1);
      expect(settings).toHaveBeenCalledTimes(1);

      await store.undoAction(turnId, 0);
      expect(settings).toHaveBeenLastCalledWith({ theme: 'light' }, expect.anything());
      expect(store.turns()[0].actions[0].status).toBe('undone');

      await store.undoAction(turnId, 0);
      expect(settings).toHaveBeenCalledTimes(2);
    });

    it('keeps the action done if undoing it fails', async () => {
      ask.mockImplementationOnce(() =>
        acting([{ name: 'updateSettings', arguments: { theme: 'dark' } }]),
      );
      await loaded();
      await store.ask('Modo oscuro');
      settings.mockImplementationOnce(() => {
        throw new ToolError('Storage is full');
      });

      await store.undoAction(store.turns()[0].id, 0);

      expect(store.turns()[0].actions[0].status).toBe('done');
    });

    it('drops the actions of an answer that failed', async () => {
      ask.mockImplementationOnce(async function* () {
        yield* acting([{ name: 'highlightLines', arguments: { lines: [{ line: 1 }] } }]);
        throw new DataError('network');
      });
      await loaded();

      await store.ask('Márcalo');

      expect(store.turns()[0]).toEqual(
        expect.objectContaining({ status: 'failed', actions: [], queried: [] }),
      );
      expect(store.marks()).toEqual([]);
    });

    it('shows what the tutor did in an earlier visit, without doing it again', async () => {
      history.mockResolvedValue(
        historyOf(attemptOf('a1'), [
          {
            ...interactionOf('a1', 'question', 1, 'Te dejo el botón'),
            actions: [{ name: 'openExercise', arguments: { exercise: 'next' } }],
          },
        ]),
      );
      await loaded();

      expect(store.turns()[0].actions).toEqual([
        { call: { name: 'openExercise', arguments: { exercise: 'next' } }, status: 'past' },
      ]);
      await store.runAction(store.turns()[0].id, 0);
      expect(open).not.toHaveBeenCalled();
    });
  });

  it('keeps where the tutor marks the code and points, for the exercise open now', async () => {
    await loaded();
    expect(store.marks()).toEqual([]);
    expect(store.pointer()).toBeNull();

    store.clearMarks();
    store.mark([{ line: 3, note: 'Aquí' }]);
    store.pointAt('example', 2);
    expect(store.marks()).toEqual([{ line: 3, note: 'Aquí' }]);
    expect(store.pointer()).toEqual({ target: 'example', example: 2, id: expect.any(String) });

    const first = store.pointer();
    store.pointAt('example', 2);
    expect(store.pointer()).not.toBe(first);
    store.pointAt('hiddenTests');
    expect(store.pointer()).toEqual({ target: 'hiddenTests', id: expect.any(String) });

    store.clearMarks();
    expect(store.marks()).toEqual([]);

    store.mark([{ line: 1 }]);
    attempt.set(attemptOf('a2'));
    expect(store.marks()).toEqual([]);
    expect(store.pointer()).toBeNull();
  });
});

describe('waitsForStudent', () => {
  it('waits for the student to open a page or change the language, never to change the screen', () => {
    const call = (name: string, args: Record<string, unknown> = {}) => ({ name, arguments: args });
    expect(waitsForStudent(call('openExercise', { exercise: 'next' }))).toBe(true);
    expect(waitsForStudent(call('navigate', { to: 'data' }))).toBe(true);
    expect(waitsForStudent(call('updateSettings', { language: 'en' }))).toBe(true);
    expect(waitsForStudent(call('updateSettings', { theme: 'dark' }))).toBe(false);
    expect(waitsForStudent(call('highlightLines', { lines: [] }))).toBe(false);
    expect(waitsForStudent(call('unknown'))).toBe(true);
  });
});
