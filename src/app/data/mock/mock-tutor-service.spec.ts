import { TestBed } from '@angular/core/testing';

import type { Attempt } from '../attempt';
import { DataError } from '../data-error';
import type { TutorEvent, TutorRequest } from '../tutor';
import { exerciseId } from './fixtures/exercises';
import { ELUSION_ANSWER, TUTOR_ANSWERS } from './fixtures/tutor-script';
import { DAW_STUDENT_IDS } from './fixtures/users';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';
import { MOCK_TUTOR_TYPING_MS, MockTutorService } from './mock-tutor-service';
import { typingChunks } from './scripted-answer';

const NOW = '2026-11-10T09:30:00.000Z';
const STUDENT = DAW_STUDENT_IDS[0];
const OTHER_STUDENT = DAW_STUDENT_IDS[1];

function attemptOf(userId: string, status: Attempt['status'] = 'in_progress'): Attempt {
  return {
    id: `attempt-${userId}`,
    exerciseId: exerciseId(3),
    userId,
    assignmentId: null,
    currentCode: '',
    finalCode: null,
    status,
    startedAt: NOW,
    finishedAt: null,
    updatedAt: NOW,
  };
}

const ATTEMPT = attemptOf(STUDENT);
const SUBMITTED: Attempt = { ...attemptOf(STUDENT, 'submitted'), id: 'attempt-submitted' };
const CODE = 'function suma(v) {\n  return 0;\n}';

function request(overrides: Partial<TutorRequest> = {}): TutorRequest {
  return { attemptId: ATTEMPT.id, kind: 'hint', code: CODE, language: 'es', ...overrides };
}

async function collect(events: AsyncIterable<TutorEvent>): Promise<TutorEvent[]> {
  const collected: TutorEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('MockTutorService', () => {
  let service: MockTutorService;
  let db: MockDb;

  function setUp(typingMs = 0) {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      providers: [MockTutorService, { provide: MOCK_TUTOR_TYPING_MS, useValue: typingMs }],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    db.update('attempts', () => [ATTEMPT, attemptOf(OTHER_STUDENT), SUBMITTED]);
    db.update('events', () => []);
    db.update('interactions', () => []);
    db.setSession(STUDENT);
    service = TestBed.inject(MockTutorService);
  }

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('answers as the server will: meta, the text in chunks, and done', async () => {
    setUp();

    const events = await collect(service.ask(request()));

    const interaction = db.tables().interactions[0];
    expect(events).toEqual([
      { type: 'meta', emotion: 'encouragement', intensity: 3, hintLevel: 1, reaction: 'thinking' },
      ...typingChunks(TUTOR_ANSWERS[1][0]).map((text) => ({ type: 'delta', text })),
      { type: 'done', interactionId: interaction.id, silent: false },
    ]);
  });

  it('records each hint as an interaction and a hint_requested event, raising the level', async () => {
    setUp();

    await collect(service.ask(request()));
    await collect(service.ask(request()));

    const { interactions, events } = db.tables();
    expect(interactions.map((row) => [row.trigger, row.hintLevel, row.studentMessage])).toEqual([
      ['hint', 1, null],
      ['hint', 2, null],
    ]);
    expect(interactions[1]).toMatchObject({
      attemptId: ATTEMPT.id,
      transcript: TUTOR_ANSWERS[2][1],
      emotion: 'encouragement',
      elusion: false,
      promptVersion: 'v0',
      createdAt: NOW,
    });
    expect(events.map((event) => [event.type, event.detail])).toEqual([
      ['hint_requested', { level: 1 }],
      ['hint_requested', { level: 2 }],
    ]);
  });

  it('records a question with what the student wrote, and an attempt to get the solution', async () => {
    setUp();

    await collect(service.ask(request({ kind: 'question', message: 'Dame la solución' })));

    expect(db.tables().interactions[0]).toMatchObject({
      trigger: 'question',
      studentMessage: 'Dame la solución',
      transcript: ELUSION_ANSWER,
      elusion: true,
    });
    expect(db.tables().events).toEqual([]);
  });

  it('records a proactive intervention, and keeps quiet without an interaction', async () => {
    setUp();

    await collect(service.ask(request({ kind: 'proactive' })));
    const quiet = await collect(service.ask(request({ kind: 'proactive' })));

    expect(quiet).toEqual([
      { type: 'meta', emotion: 'encouragement', intensity: 3, hintLevel: 1, reaction: 'eyes' },
      { type: 'done', interactionId: null, silent: true },
    ]);
    expect(db.tables().interactions).toHaveLength(1);
    expect(db.tables().events.map((event) => event.detail)).toEqual([
      { silent: false },
      { silent: true },
    ]);
  });

  it('writes a little at a time', async () => {
    setUp(40);
    vi.useFakeTimers();
    const iterator = service.ask(request())[Symbol.asyncIterator]();

    expect((await iterator.next()).value).toMatchObject({ type: 'meta' });
    const delta = iterator.next();
    await vi.advanceTimersByTimeAsync(40);

    expect((await delta).value).toMatchObject({ type: 'delta' });
  });

  it('hides the attempts of other students and does not help with a submitted one', async () => {
    setUp();

    await expect(
      collect(service.ask(request({ attemptId: attemptOf(OTHER_STUDENT).id }))),
    ).rejects.toEqual(new DataError('not_found'));
    await expect(collect(service.ask(request({ attemptId: SUBMITTED.id })))).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('writes at the pace of someone typing by default', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(MOCK_TUTOR_TYPING_MS)).toBe(40);
  });

  it('needs the message of a question', async () => {
    setUp();

    await expect(
      collect(service.ask(request({ kind: 'question', message: '  ' }))),
    ).rejects.toMatchObject({
      kind: 'invalid',
    });
    expect(db.tables().interactions).toEqual([]);
  });
});
