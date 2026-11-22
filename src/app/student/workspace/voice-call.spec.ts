import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { FakeSpeechService, provideFakeSpeech } from '../../core/speech/speech-testing';
import type { Attempt, AttemptHistory } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { DataError } from '../../data/data-error';
import type { TutorEvent } from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import { SettingsStore } from '../settings/settings-store';
import { StudentVoice } from '../settings/student-voice';
import { AttemptStore } from './attempt-store';
import { TutorSpeaker } from './tutor-speaker';
import { TutorStore } from './tutor-store';
import { CALL_MARKS, CALL_TIMES, MAX_QUICK_CLOSES, VoiceCall } from './voice-call';

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
    startedAt: '2026-11-22T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-22T10:00:00.000Z',
  };
}

/** An answer the test delivers chunk by chunk. */
function controlled() {
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
  push({ value: { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 1 }, done: false });
  return {
    events,
    say: (text: string) => push({ value: { type: 'delta', text }, done: false }),
    end: () => {
      push({ value: { type: 'done', interactionId: 'i1', silent: false }, done: false });
      push({ value: undefined, done: true });
    },
    fail: (error: unknown = new Error('lost')) => failWith?.(error),
  };
}

describe('VoiceCall', () => {
  let attempt: ReturnType<typeof signal<Attempt | undefined>>;
  let submitted: ReturnType<typeof signal<boolean>>;
  let answers: ReturnType<typeof controlled>[];
  let asked: string[];
  let fake: FakeSpeechService;
  let tutor: TutorStore;
  let settings: SettingsStore;
  let speaker: TutorSpeaker;
  let call: VoiceCall;
  let mark: ReturnType<typeof vi.fn<Performance['mark']>>;

  beforeEach(async () => {
    localStorage.clear();
    attempt = signal<Attempt | undefined>(attemptOf('a1'));
    submitted = signal(false);
    answers = [];
    asked = [];
    fake = new FakeSpeechService();
    fake.voiceList = [{ id: 'jorge', name: 'Jorge', lang: 'es-ES' }];
    TestBed.configureTestingModule({
      providers: [
        TutorStore,
        TutorSpeaker,
        VoiceCall,
        provideFakeSpeech(fake),
        { provide: AuthStore, useValue: { userId: signal('u1') } },
        { provide: AttemptStore, useValue: { attempt, readonly: computed(() => submitted()) } },
        {
          provide: AttemptService,
          useValue: {
            history: (id: string): Promise<AttemptHistory> =>
              Promise.resolve({ attempt: attemptOf(id), events: [], interactions: [] }),
          },
        },
        {
          provide: TutorService,
          useValue: {
            ask: (request: { message?: string; kind: string }) => {
              asked.push(request.message ?? request.kind);
              const answer = controlled();
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
    call = TestBed.inject(VoiceCall);
    settings.setVoice(true);
    const voice = TestBed.inject(StudentVoice);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(voice.tutorVoice()).toBeDefined();
      expect(voice.canDictate()).toBe(true);
      expect(tutor.canAsk()).toBe(true);
    });
    vi.useFakeTimers();
    // After the fake timers, which replace `performance` too
    mark = vi.fn<Performance['mark']>();
    vi.spyOn(performance, 'mark').mockImplementation(mark);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Lets the promises settle and the screen follow, without moving the clock. */
  async function flush() {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
  }

  /** Calls and lets the greeting end: the microphone opens. */
  async function startCall() {
    call.start();
    await flush();
    fake.finish();
    await flush();
  }

  /** The student says a question and is silent: it is sent. */
  async function sayQuestion(question = '¿por qué falla?') {
    fake.hear(question);
    await flush();
    await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs);
    await flush();
    return answers.at(-1)!;
  }

  /** The marks of the call, without those Angular makes of its own. */
  function callMarks(): string[] {
    const names: readonly string[] = Object.values(CALL_MARKS);
    return mark.mock.calls.map(([name]) => name).filter((name) => names.includes(name));
  }

  /** The tutor answers with one sentence, and says it to the end. */
  async function answerWhole(answer: ReturnType<typeof controlled>, text = 'Mira el bucle.') {
    answer.say(text);
    answer.end();
    await flush();
    fake.finish();
    await flush();
  }

  it('can call with a voice, the recognition and an attempt that takes questions', () => {
    expect(call.canCall()).toBe(true);
    submitted.set(true);
    expect(call.canCall()).toBe(false);
    submitted.set(false);
    settings.setVoice(false);
    TestBed.tick();
    expect(call.canCall()).toBe(false);
  });

  it('does not start without canCall(), nor twice', async () => {
    submitted.set(true);
    call.start();
    expect(call.state()).toBeNull();
    expect(call.active()).toBe(false);

    submitted.set(false);
    await startCall();
    call.start();
    await flush();
    expect(fake.sentences).toEqual(['Te escucho.']);
  });

  it('does not open the microphone if the call ended or waits before «Te escucho» ends', async () => {
    call.start();
    call.hangUp();
    await flush();
    expect(fake.listening).toBe(false);

    call.start();
    call.hold();
    await flush();
    expect(call.state()).toBe('standby');
    expect(fake.listening).toBe(false);
  });

  it('says «Te escucho» before opening the microphone', async () => {
    call.start();
    await flush();
    expect(call.state()).toBe('listening');
    expect(fake.sentences).toEqual(['Te escucho.']);
    expect(fake.listening).toBe(false);
    fake.finish();
    await flush();
    expect(fake.listening).toBe(true);
    expect(call.microphoneOpen()).toBe(true);
    expect(fake.listens).toEqual(['es']);
  });

  it('sends what was said after 1.5 s of silence, and more words make the turn longer', async () => {
    await startCall();
    fake.hear('por qué', false);
    await flush();
    expect(call.state()).toBe('hearing');
    expect(call.heard()).toBe('Por qué');
    fake.hear('por qué falla');
    await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs - 1);
    fake.hear('el bucle', false);
    expect(call.heard()).toBe('Por qué falla el bucle');
    await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs - 1);
    expect(asked).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(asked).toEqual(['Por qué falla el bucle']);
    expect(call.state()).toBe('thinking');
    expect(call.heard()).toBe('');
  });

  it('keeps listening, and sends nothing, for words with nothing in them', async () => {
    await startCall();
    fake.hear('  ', false);
    await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs);
    expect(call.state()).toBe('listening');
    expect(asked).toEqual([]);
  });

  it('drops what was being said with Esc, and listens again from nothing', async () => {
    await startCall();
    fake.hear('no, espera');
    await flush();
    call.discard();
    expect(call.state()).toBe('listening');
    expect(call.heard()).toBe('');
    expect(fake.listens).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs);
    expect(asked).toEqual([]);
    call.discard();
    expect(call.state()).toBe('listening');
  });

  it('gives what was said for the field with «Corregir», and waits on hold', async () => {
    await startCall();
    expect(call.correct()).toBe('');
    fake.hear('por qué falla');
    await flush();
    expect(call.correct()).toBe('Por qué falla');
    expect(call.state()).toBe('standby');
    expect(fake.listening).toBe(false);
    await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs);
    expect(asked).toEqual([]);
  });

  it('closes the microphone while the tutor thinks and speaks, and listens again after', async () => {
    await startCall();
    const answer = await sayQuestion();
    expect(fake.listening).toBe(false);
    expect(call.state()).toBe('thinking');
    answer.say('Mira el bucle. Y');
    await flush();
    expect(call.state()).toBe('speaking');
    expect(fake.listening).toBe(false);
    answer.say(' cuenta.');
    answer.end();
    await flush();
    fake.finish();
    await flush();
    expect(call.state()).toBe('speaking');
    fake.finish();
    await flush();
    expect(call.state()).toBe('listening');
    expect(fake.listening).toBe(true);
  });

  it('marks the last word, the sending, the first text and the first sound of its own answer', async () => {
    await startCall();
    const answer = await sayQuestion();
    expect(mark).toHaveBeenCalledWith(CALL_MARKS.lastWord, { startTime: expect.any(Number) });
    expect(mark).toHaveBeenCalledWith(CALL_MARKS.sent);
    answer.say('Mira el bucle. Y');
    await flush();
    fake.startSound();
    expect(callMarks()).toEqual(Object.values(CALL_MARKS));

    // A question written in the call is not measured
    await answerWhole(answer, ' más.');
    fake.finish();
    await flush();
    void tutor.ask('Escrita');
    await flush();
    answers.at(-1)!.say('Vale. Y');
    await flush();
    fake.startSound();
    expect(callMarks()).toHaveLength(4);
  });

  it('is silenced at once with «Interrumpir», and the answer stays whole in the chat', async () => {
    await startCall();
    const answer = await sayQuestion();
    answer.say('Mira el bucle. Y');
    await flush();
    call.interrupt();
    await flush();
    expect(call.state()).toBe('listening');
    expect(fake.listening).toBe(true);
    answer.say(' más.');
    answer.end();
    await flush();
    expect(tutor.turns().at(-1)?.answer).toBe('Mira el bucle. Y más.');
    expect(call.state()).toBe('listening');
    call.interrupt();
    expect(call.state()).toBe('listening');
  });

  it('is silenced by a written question or a hint, which it says instead', async () => {
    await startCall();
    const first = await sayQuestion();
    await answerWhole(first, 'Mira el bucle. Y más cosas.');
    expect(call.state()).toBe('speaking');
    void tutor.requestHint();
    await flush();
    expect(asked.at(-1)).toBe('hint');
    expect(call.state()).toBe('thinking');
    answers.at(-1)!.say('Una pista. Y');
    await flush();
    expect(call.state()).toBe('speaking');
    expect(fake.sentences.at(-1)).toBe('Una pista.');
  });

  it('waits to send a question said while the tutor still writes', async () => {
    await startCall();
    const first = await sayQuestion();
    first.say('Mira el bucle. Y');
    await flush();
    call.interrupt();
    await flush();
    await sayQuestion('y ahora qué');
    expect(asked).toEqual(['¿Por qué falla?']);
    expect(call.state()).toBe('thinking');
    first.end();
    await flush();
    expect(asked).toEqual(['¿Por qué falla?', 'Y ahora qué']);
  });

  describe('interrupting by speaking', () => {
    beforeEach(() => settings.setInterruptBySpeaking(true));

    it('keeps the microphone open while the tutor speaks, and the echo does not interrupt', async () => {
      await startCall();
      const answer = await sayQuestion();
      expect(fake.listening).toBe(true);
      answer.say('Fíjate en qué devuelve la función. Y');
      await flush();
      fake.hear('fijate en que devuelve', false);
      await flush();
      expect(call.state()).toBe('speaking');
      await vi.advanceTimersByTimeAsync(CALL_TIMES.standbyMs);
      expect(call.state()).toBe('speaking');
    });

    it('is interrupted by two words of the student, which start the turn', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.say('Fíjate en qué devuelve la función. Y');
      await flush();
      fake.hear('espera no entiendo', false);
      await flush();
      expect(call.state()).toBe('hearing');
      expect(call.heard()).toBe('Espera no entiendo');
      expect(speaker.speakingTurnId()).toBeNull();
      await vi.advanceTimersByTimeAsync(CALL_TIMES.turnSilenceMs);
      await flush();
      answer.end();
      await flush();
      expect(asked.at(-1)).toBe('Espera no entiendo');
    });

    it('listens again with a microphone of its own once the tutor is done', async () => {
      await startCall();
      const answer = await sayQuestion();
      const listens = fake.listens.length;
      await answerWhole(answer);
      expect(call.state()).toBe('listening');
      expect(fake.listens).toHaveLength(listens + 1);
    });
  });

  describe('when the microphone closes by itself', () => {
    it('opens it again, keeping what was being said', async () => {
      await startCall();
      fake.hear('por qué', false);
      await vi.advanceTimersByTimeAsync(CALL_TIMES.quickCloseMs);
      fake.endListening('silence');
      await flush();
      expect(fake.listening).toBe(true);
      fake.hear('falla');
      expect(call.heard()).toBe('Por qué falla');
      fake.endListening('stopped');
      await flush();
      expect(fake.listening).toBe(true);
    });

    it(`ends the call after ${MAX_QUICK_CLOSES} quick closes in a row`, async () => {
      await startCall();
      for (let close = 1; close < MAX_QUICK_CLOSES; close++) {
        fake.endListening('silence');
        await flush();
        expect(call.active()).toBe(true);
      }
      fake.endListening('silence');
      await flush();
      expect(call.active()).toBe(false);
      expect(call.notice()).toBe('unstable');
      expect(fake.listening).toBe(false);
    });

    it('counts again from nothing after a late close', async () => {
      await startCall();
      for (let close = 1; close < MAX_QUICK_CLOSES; close++) {
        fake.endListening('silence');
        await flush();
      }
      await vi.advanceTimersByTimeAsync(CALL_TIMES.quickCloseMs);
      fake.endListening('silence');
      await flush();
      fake.endListening('silence');
      await flush();
      expect(call.active()).toBe(true);
    });

    it('hangs up with an error of the microphone, said until another call', async () => {
      await startCall();
      fake.endListening('not-allowed');
      await flush();
      expect(call.active()).toBe(false);
      expect(call.notice()).toBe('not-allowed');
      await startCall();
      expect(call.notice()).toBeNull();
    });
  });

  describe('on hold', () => {
    it('waits after 90 s without a voice, and «Seguir hablando» listens again', async () => {
      await startCall();
      await vi.advanceTimersByTimeAsync(CALL_TIMES.standbyMs - 1);
      expect(call.state()).toBe('listening');
      await vi.advanceTimersByTimeAsync(1);
      expect(call.state()).toBe('standby');
      expect(fake.listening).toBe(false);
      call.resume();
      expect(call.state()).toBe('listening');
      expect(fake.listening).toBe(true);
      const listens = fake.listens.length;
      call.resume();
      expect(fake.listens).toHaveLength(listens);
    });

    it('waits at once with the tab hidden, and the tutor stops speaking', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.say('Mira el bucle. Y');
      await flush();
      call.hold();
      expect(call.state()).toBe('standby');
      expect(speaker.speakingTurnId()).toBeNull();
      call.hold();
      call.resume();
      call.hold();
      expect(call.state()).toBe('standby');
    });

    it('waits when the answer ends with the tab hidden', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.say('Mira el bucle.');
      answer.end();
      await flush();
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      fake.finish();
      await flush();
      expect(call.state()).toBe('standby');
      expect(fake.listening).toBe(false);
    });

    it('says a written question and gives 10 s to answer it', async () => {
      await startCall();
      call.hold();
      void tutor.ask('Escrita');
      await flush();
      expect(call.state()).toBe('thinking');
      await answerWhole(answers.at(-1)!);
      expect(call.state()).toBe('listening');
      await vi.advanceTimersByTimeAsync(CALL_TIMES.replyWindowMs);
      expect(call.state()).toBe('standby');
    });
  });

  describe('when the answer fails', () => {
    it('says so aloud and listens again', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.fail();
      await flush();
      expect(call.state()).toBe('speaking');
      expect(fake.sentences.at(-1)).toBe('No he podido responder.');
      expect(fake.listening).toBe(false);
      fake.finish();
      await flush();
      expect(call.state()).toBe('listening');
    });

    it('says the answer of a retry instead, if it comes while saying the failure', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.fail();
      await flush();
      void tutor.retry(tutor.turns().at(-1)!.id);
      await flush();
      expect(call.state()).toBe('thinking');
      answers.at(-1)!.say('Ahora sí. Y');
      await flush();
      expect(call.state()).toBe('speaking');
      expect(fake.sentences.at(-1)).toBe('Ahora sí.');
    });

    it('says how long to wait with too many questions, and waits on hold', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.fail(new DataError('rate_limited', 'Too many', { retryAfterSeconds: 20 }));
      await flush();
      expect(fake.sentences.at(-1)).toBe(
        'Has preguntado muchas veces seguidas. Espera 20 segundos y seguimos.',
      );
      call.interrupt();
      await flush();
      expect(call.state()).toBe('standby');
    });
  });

  describe('Ctrl + .', () => {
    it('pauses the call in any state, and resumes it on hold', async () => {
      call.toggleHold();
      expect(call.state()).toBeNull();
      await startCall();
      call.toggleHold();
      expect(call.state()).toBe('standby');
      expect(fake.listening).toBe(false);
      call.toggleHold();
      expect(call.state()).toBe('listening');
      expect(fake.listening).toBe(true);
      fake.hear('a ver');
      await flush();
      call.toggleHold();
      expect(call.state()).toBe('standby');
      call.toggleHold();
      const answer = await sayQuestion();
      call.toggleHold();
      expect(call.state()).toBe('standby');
      // The answer arrives on hold: written, not said
      answer.say('Vale.');
      answer.end();
      await flush();
      expect(call.state()).toBe('standby');
      call.toggleHold();
      void tutor.ask('Escrita');
      await flush();
      answers.at(-1)!.say('Mira el bucle. Y');
      await flush();
      expect(call.state()).toBe('speaking');
      call.toggleHold();
      expect(call.state()).toBe('standby');
      expect(speaker.speakingTurnId()).toBeNull();
    });
  });

  describe('hanging up', () => {
    async function expectHungUp() {
      await flush();
      expect(call.active()).toBe(false);
      expect(fake.listening).toBe(false);
      expect(speaker.speakingTurnId()).toBeNull();
    }

    it('closes the microphone and silences the tutor with «Colgar»', async () => {
      await startCall();
      const answer = await sayQuestion();
      answer.say('Mira el bucle. Y');
      await flush();
      call.hangUp();
      await expectHungUp();
      // The answers that follow are no longer said
      answer.say(' Otra.');
      answer.end();
      await flush();
      expect(fake.sentences.at(-1)).toBe('Mira el bucle.');
      call.hangUp();
    });

    it('with another exercise', async () => {
      await startCall();
      attempt.set(attemptOf('a2'));
      await expectHungUp();
    });

    it('with the attempt submitted', async () => {
      await startCall();
      submitted.set(true);
      await expectHungUp();
    });

    it('on leaving the screen', async () => {
      await startCall();
      TestBed.resetTestingModule();
      expect(fake.listening).toBe(false);
    });
  });
});
