import { TestBed } from '@angular/core/testing';

import { DataError } from '../../../data/data-error';
import type { TutorEvent, TutorPreviewRequest, TutorRequest } from '../../../data/tutor';
import { TutorService } from '../../../data/tutor-service';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_ASSIGNMENT_ID } from './tryout-exercise';
import { TRYOUT_SUM, tryoutInjector } from './tryout-testing';
import { TryoutTutorService } from './tryout-tutor-service';

const ANSWER: TutorEvent[] = [
  {
    type: 'meta',
    emotion: 'encouragement',
    intensity: 2,
    hintLevel: 1,
    reaction: 'thinking',
    actions: [{ name: 'pointAt', arguments: { target: 'hiddenTests' } }],
  },
  { type: 'delta', text: 'Mira ' },
  { type: 'delta', text: 'el bucle.' },
  { type: 'done', interactionId: null, silent: false },
];

async function collect(events: AsyncIterable<TutorEvent>): Promise<TutorEvent[]> {
  const collected: TutorEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('TryoutTutorService', () => {
  let answers: TutorEvent[][];
  let asked: TutorPreviewRequest[];
  let service: TryoutTutorService;
  let attempts: TryoutAttemptService;

  function request(attemptId: string, overrides: Partial<TutorRequest> = {}): TutorRequest {
    return { requestId: 'r1', attemptId, kind: 'hint', code: 'code', language: 'es', ...overrides };
  }

  beforeEach(() => {
    answers = [ANSWER];
    asked = [];
    const tutor = {
      async *tryOut(preview: TutorPreviewRequest) {
        asked.push(preview);
        yield* answers.shift() ?? [];
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: TutorService, useValue: tutor }] });
    const injector = tryoutInjector([TryoutTutorService]);
    service = injector.get(TryoutTutorService);
    attempts = injector.get(TryoutAttemptService);
  });

  it('asks the tutor in preview mode with the exercise of the form and the try', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    attempts.recordRun(id, 'code', {
      status: 'tests_failed',
      results: [{ testId: 'test-2', passed: false, timeout: false }],
    });

    const events = await collect(service.ask(request(id)));

    expect(asked).toEqual([
      {
        requestId: 'r1',
        kind: 'hint',
        code: 'code',
        language: 'es',
        preview: {
          exercise: {
            title: 'Suma',
            statement: 'Escribe `sum`.',
            topics: ['Bucles'],
            sourceLocale: 'es',
            translations: {},
            functionName: 'sum',
            parameters: ['values'],
            tests: TRYOUT_SUM.tests,
          },
          status: 'tests_failed',
          lastRun: { passed: 0, failed: 1, failedTestIds: ['test-2'] },
          previous: [],
        },
      },
    ]);
    // The answer kept in the try takes the id of the request
    expect(events).toEqual([...ANSWER.slice(0, 3), { ...ANSWER[3], interactionId: 'r1' }]);
  });

  it('keeps each whole answer in the try, so the next turn knows it', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    answers = [ANSWER, ANSWER];

    await collect(service.ask(request(id)));
    await collect(service.ask(request(id, { requestId: 'r2', kind: 'question', message: '¿Y?' })));

    expect(attempts.answers(id)).toEqual([
      expect.objectContaining({
        id: 'r1',
        trigger: 'hint',
        studentMessage: null,
        transcript: 'Mira el bucle.',
        hintLevel: 1,
        elusion: false,
        actions: ANSWER[0].type === 'meta' ? ANSWER[0].actions : [],
      }),
      expect.objectContaining({ id: 'r2', trigger: 'question', studentMessage: '¿Y?' }),
    ]);
    expect(asked[1].preview.previous).toEqual([
      {
        trigger: 'hint',
        hintLevel: 1,
        studentMessage: null,
        transcript: 'Mira el bucle.',
        emotion: 'encouragement',
        intensity: 2,
        elusion: false,
        actions: [{ name: 'pointAt', arguments: { target: 'hiddenTests' } }],
      },
    ]);
  });

  it('keeps nothing of a silence or of a query, and passes them on', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    const silence: TutorEvent[] = [{ type: 'done', interactionId: null, silent: true }];
    const query: TutorEvent[] = [
      { type: 'query', calls: [{ name: 'getExerciseStats', arguments: {} }] },
    ];
    const bare: TutorEvent[] = [
      { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 1 },
      { type: 'done', interactionId: null, silent: false },
    ];
    answers = [silence, query, bare];

    expect(await collect(service.ask(request(id, { kind: 'proactive' })))).toEqual(silence);
    expect(await collect(service.ask(request(id)))).toEqual(query);
    await collect(service.ask(request(id)));

    expect(attempts.answers(id)).toEqual([
      expect.objectContaining({ transcript: '', elusion: false, actions: [] }),
    ]);
  });

  it('sends an earlier answer without actions with none', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    attempts.recordAnswer({
      id: 'i0',
      attemptId: id,
      trigger: 'question',
      hintLevel: 1,
      studentMessage: '¿Y?',
      transcript: 'Mira.',
      emotion: 'joy',
      intensity: 1,
      elusion: false,
      promptVersion: 'tryout',
      createdAt: '',
    });

    await collect(service.ask(request(id)));

    expect(asked[0].preview.previous[0].actions).toEqual([]);
  });

  it('gives a submitted attempt no more help', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    attempts.recordRun(id, 'done', { status: 'passed', results: [] });
    await attempts.submit(id);

    await expect(collect(service.ask(request(id)))).rejects.toEqual(
      new DataError('invalid', 'A submitted attempt gets no more help'),
    );
  });

  it('passes a turn already in preview mode to the tutor of the app', async () => {
    const preview = {
      requestId: 'r9',
      kind: 'hint',
      code: '',
      language: 'es',
    } as TutorPreviewRequest;

    expect(await collect(service.tryOut(preview))).toEqual(ANSWER);
    expect(asked).toEqual([preview]);
  });
});
