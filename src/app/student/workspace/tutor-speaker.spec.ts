import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { FakeSpeechService, provideFakeSpeech } from '../../core/speech/speech-testing';
import type { Attempt, AttemptHistory } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import type { ToolRequest, TutorEvent, TutorInteraction } from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import { SettingsStore } from '../settings/settings-store';
import { StudentVoice } from '../settings/student-voice';
import { AttemptStore } from './attempt-store';
import { TutorSpeaker } from './tutor-speaker';
import { TutorStore } from './tutor-store';

function attemptOf(id: string): Attempt {
  return {
    id,
    exerciseId: `exercise-${id}`,
    userId: 'student-1',
    assignmentId: null,
    number: 1,
    currentCode: '',
    finalCode: null,
    status: 'in_progress',
    startedAt: '2026-11-09T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-09T10:00:00.000Z',
  };
}

const pastInteraction = {
  id: 'past-1',
  attemptId: 'a1',
  trigger: 'question',
  hintLevel: 1,
  studentMessage: '¿Qué hago?',
  transcript: 'Mira el bucle. Empieza en cero.',
  emotion: 'encouragement',
  intensity: 1,
  elusion: false,
  promptVersion: 'v0',
  createdAt: '2026-11-09T10:05:00.000Z',
} satisfies TutorInteraction;

/** An answer the test delivers chunk by chunk. */
function controlled(actions?: ToolRequest[]) {
  const pending: ((event: IteratorResult<TutorEvent>) => void)[] = [];
  const ready: IteratorResult<TutorEvent>[] = [];
  let failWith: ((error: unknown) => void) | undefined;
  const push = (result: IteratorResult<TutorEvent>) => {
    const take = pending.shift();
    if (take) take(result);
    else ready.push(result);
  };
  const events: AsyncIterable<TutorEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        new Promise((resolve, reject) => {
          failWith = reject;
          const result = ready.shift();
          if (result) resolve(result);
          else pending.push(resolve);
        }),
    }),
  };
  push({
    value: { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 1, actions },
    done: false,
  });
  return {
    events,
    say: (text: string) => push({ value: { type: 'delta', text }, done: false }),
    end: (silent = false) => {
      push({ value: { type: 'done', interactionId: silent ? null : 'i1', silent }, done: false });
      push({ value: undefined, done: true });
    },
    fail: () => failWith?.(new Error('lost')),
  };
}

describe('TutorSpeaker', () => {
  let attempt: ReturnType<typeof signal<Attempt | undefined>>;
  let answers: ReturnType<typeof controlled>[];
  let fake: FakeSpeechService;
  let tutor: TutorStore;
  let settings: SettingsStore;
  let speaker: TutorSpeaker;
  let nextActions: ToolRequest[] | undefined;

  beforeEach(async () => {
    localStorage.clear();
    attempt = signal<Attempt | undefined>(attemptOf('a1'));
    answers = [];
    nextActions = undefined;
    fake = new FakeSpeechService();
    fake.voiceList = [{ id: 'jorge', name: 'Jorge', lang: 'es-ES' }];
    TestBed.configureTestingModule({
      providers: [
        TutorStore,
        TutorSpeaker,
        provideFakeSpeech(fake),
        { provide: AuthStore, useValue: { userId: signal('u1') } },
        { provide: AttemptStore, useValue: { attempt, readonly: computed(() => false) } },
        {
          provide: AttemptService,
          useValue: {
            history: (id: string): Promise<AttemptHistory> =>
              Promise.resolve({
                attempt: attemptOf(id),
                events: [],
                interactions: id === 'a1' ? [pastInteraction] : [],
              }),
          },
        },
        {
          provide: TutorService,
          useValue: {
            ask: () => {
              const answer = controlled(nextActions);
              answers.push(answer);
              return answer.events;
            },
          },
        },
      ],
    });
    settings = TestBed.inject(SettingsStore);
    tutor = TestBed.inject(TutorStore);
    speaker = TestBed.inject(TutorSpeaker);
    settings.setVoice(true);
    settings.setTutorVoice('jorge');
    settings.setReadAloud(true);
    const voice = TestBed.inject(StudentVoice);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(voice.tutorVoice()).toBeDefined();
      expect(tutor.loading()).toBe(false);
      expect(tutor.canAsk()).toBe(true);
    });
  });

  /** Asks and waits until the tutor has been asked. */
  async function ask(question = '¿Y ahora?') {
    const asked = answers.length;
    void tutor.ask(question);
    await vi.waitFor(() => expect(answers).toHaveLength(asked + 1));
    return answers[asked];
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function settle() {
    await vi.waitFor(() => TestBed.tick());
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
  }

  it('says each sentence as it is whole, and the closing at the end', async () => {
    const answer = await ask();
    answer.say('Mira el bucle. Emp');
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.']);
    expect(speaker.speakingTurnId()).toBe(tutor.turns().at(-1)?.id);

    answer.say('ieza en cero.\n```js\nlet i = 0;\n```');
    answer.end();
    await settle();
    fake.finish();
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.', 'Empieza en cero.']);
    fake.finish();
    await settle();
    expect(fake.sentences.at(-1)).toBe('Te lo dejo en el chat.');
    expect(fake.spoken[0].options).toEqual({ voiceId: 'jorge', rate: 'normal' });
    fake.finish();
    await settle();
    expect(speaker.speakingTurnId()).toBeNull();
  });

  it('says nothing by itself without reading aloud', async () => {
    settings.setReadAloud(false);
    const answer = await ask();
    answer.say('Mira el bucle. Y más.');
    answer.end();
    await settle();
    expect(fake.spoken).toEqual([]);
  });

  it('never says the history by itself', async () => {
    await settle();
    expect(fake.spoken).toEqual([]);
  });

  it('silences an answer that fails', async () => {
    const answer = await ask();
    answer.say('Mira el bucle. Y');
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.']);
    answer.fail();
    await settle();
    expect(fake.stops).toBeGreaterThan(0);
    expect(speaker.speakingTurnId()).toBeNull();
  });

  it('says a retry again', async () => {
    const first = await ask();
    first.fail();
    await settle();
    const failed = tutor.turns().at(-1)!;
    expect(failed.status).toBe('failed');
    void tutor.retry(failed.id);
    await vi.waitFor(() => expect(answers).toHaveLength(2));
    answers[1].say('Ahora sí. ');
    answers[1].say('Seguro.');
    await settle();
    expect(fake.sentences).toEqual(['Ahora sí.']);
    expect(speaker.speakingTurnId()).toBe(failed.id);
  });

  it('says a retry made in the same millisecond as the failure, with the same key', async () => {
    // Without fake timers, only Date is frozen: the answer still arrives
    vi.setSystemTime(new Date('2026-11-19T10:00:00.000Z'));
    const first = await ask();
    first.fail();
    await settle();
    const failed = tutor.turns().at(-1)!;
    void tutor.retry(failed.id);
    await vi.waitFor(() => expect(answers).toHaveLength(2));
    expect(tutor.turns().at(-1)?.createdAt).toBe(failed.createdAt);
    answers[1].say('Ahora sí. Y');
    await settle();
    expect(fake.sentences).toEqual(['Ahora sí.']);
  });

  it('silences the answer before with a new question', async () => {
    const first = await ask();
    first.say('Mira el bucle. Empieza en cero.');
    first.end();
    await settle();
    const firstId = speaker.speakingTurnId();
    expect(fake.sentences).toEqual(['Mira el bucle.']);

    const stops = fake.stops;
    const second = await ask('Otra');
    await settle();
    expect(fake.stops).toBe(stops + 1);
    expect(speaker.speakingTurnId()).not.toBe(firstId);
    second.say('Vale. Y');
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.', 'Vale.']);
  });

  it('says an answer of the history with «Escuchar», and another replaces it', async () => {
    settings.setReadAloud(false);
    const past = tutor.turns()[0];
    speaker.listen(past.id);
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.']);
    expect(speaker.speakingTurnId()).toBe(past.id);
    fake.finish();
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.', 'Empieza en cero.']);

    speaker.listen(past.id);
    await settle();
    expect(fake.sentences.at(-1)).toBe('Mira el bucle.');
    speaker.listen('nobody');
    expect(speaker.speakingTurnId()).toBe(past.id);
  });

  it('speaks with the most natural voice when the chosen one is gone, and not without voices', async () => {
    settings.setTutorVoice('gone');
    expect(speaker.ready()).toBe(true);
    speaker.listen(tutor.turns()[0].id);
    await settle();
    expect(fake.spoken[0].options.voiceId).toBe('jorge');
    speaker.stop();

    settings.setVoice(false);
    TestBed.tick();
    expect(speaker.ready()).toBe(false);
    speaker.listen(tutor.turns()[0].id);
    const answer = await ask();
    answer.say('Mira el bucle. Y');
    await settle();
    expect(fake.spoken).toHaveLength(1);
  });

  it('stops without more when a sentence is cancelled or fails', async () => {
    speaker.listen(tutor.turns()[0].id);
    await settle();
    fake.stopSpeaking();
    await settle();
    expect(speaker.speakingTurnId()).toBeNull();

    speaker.listen(tutor.turns()[0].id);
    await settle();
    fake.fail();
    await settle();
    expect(speaker.speakingTurnId()).toBeNull();
    expect(fake.sentences).toEqual(['Mira el bucle.', 'Mira el bucle.']);
  });

  it('is silenced by another exercise, by stop() and when destroyed', async () => {
    speaker.listen(tutor.turns()[0].id);
    await settle();
    attempt.set(attemptOf('a2'));
    await vi.waitFor(() => {
      TestBed.tick();
      expect(tutor.turns()).toEqual([]);
    });
    expect(speaker.speakingTurnId()).toBeNull();

    speaker.listen(tutor.turns()[0]?.id ?? '');
    const stop = vi.spyOn(speaker, 'stop');
    TestBed.resetTestingModule();
    expect(stop).toHaveBeenCalled();
  });

  it('does not start with the tab hidden', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const answer = await ask();
    answer.say('Mira el bucle. Y');
    await settle();
    expect(fake.spoken).toEqual([]);
  });

  it('offers «Escuchar» with the voice of the student', () => {
    expect(speaker.available()).toBe(true);
    expect(speaker.ready()).toBe(true);
  });

  it('says an answer that arrived whole before it could follow it', async () => {
    const answer = await ask();
    answer.say('Mira el bucle.');
    answer.end();
    await settle();
    expect(fake.sentences).toEqual(['Mira el bucle.']);
  });

  it('does not say an older answer again when the newest goes away', async () => {
    const first = await ask();
    first.say('Mira el bucle.');
    first.end();
    await settle();
    fake.finish();
    await settle();
    expect(speaker.speakingTurnId()).toBeNull();

    // The tutor chose to stay silent (2.7): its turn goes, and the first is the newest again
    const silent = await ask('Otra');
    silent.end(true);
    await settle();
    expect(tutor.turns().at(-1)?.answer).toBe('Mira el bucle.');
    expect(fake.sentences).toEqual(['Mira el bucle.']);
    expect(speaker.speakingTurnId()).toBeNull();
  });

  it('ends with the closing when the answer leaves a button', async () => {
    nextActions = [{ name: 'openExercise', arguments: { exercise: 'next' } }];
    const answer = await ask();
    answer.say('Te dejo un botón.');
    answer.end();
    await settle();
    fake.finish();
    await settle();
    expect(fake.sentences).toEqual(['Te dejo un botón.', 'Te lo dejo en el chat.']);
  });
});
