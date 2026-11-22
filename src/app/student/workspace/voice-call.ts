import { computed, DestroyRef, DOCUMENT, inject, Service, signal } from '@angular/core';

import type {
  Listening,
  ListeningEnd,
  ListenError,
  Transcript,
} from '../../core/speech/speech-service';
import { createDebouncer, type Debouncer } from '../../shared/create-debouncer';
import { SettingsStore } from '../settings/settings-store';
import { StudentVoice } from '../settings/student-voice';
import { isEcho } from './is-echo';
import { appendDictation } from './tutor/append-dictation';
import { callFailurePhrase } from './tutor/call-failure-phrase';
import { MAX_QUESTION_LENGTH } from './tutor/question-limit';
import { type AnswerEnd, type AnswerFollower, TutorSpeaker } from './tutor-speaker';
import { type TutorTurn, TutorStore } from './tutor-store';

/** Where a call is (2.11): listening, hearing the student, the tutor thinking or speaking, on hold. */
export type CallState = 'listening' | 'hearing' | 'thinking' | 'speaking' | 'standby';

/** Why a call ended by itself: the microphone failed, or it kept closing by itself. */
export type CallNotice = ListenError | 'unstable';

/** The times of a call (2.11), to adjust once tried. */
export const CALL_TIMES = {
  /** Silence that ends the turn of the student and sends it. */
  turnSilenceMs: 1_500,
  /** Without a voice, the call goes on hold: in a classroom, an open microphone hears the others. */
  standbyMs: 90_000,
  /** To answer the tutor when its answer came with the call on hold. */
  replyWindowMs: 10_000,
  /** A microphone that closes by itself this soon after opening is not listening. */
  quickCloseMs: 1_000,
} as const;

/** Quick closes in a row that end the call: the microphone does not stay open. */
export const MAX_QUICK_CLOSES = 3;

/**
 * The marks of a turn (`performance.mark`), to measure the pause before the tutor is heard (2.11):
 * the last word of the student, the sending, the first text and the first sound of the answer.
 */
export const CALL_MARKS = {
  lastWord: 'tutoria-call-last-word',
  sent: 'tutoria-call-sent',
  firstText: 'tutoria-call-first-text',
  firstSound: 'tutoria-call-first-sound',
} as const;

/** What the call says first: a fixed sentence, not a turn. */
const GREETING = $localize`:@@call.greeting:Te escucho.`;

/**
 * Where the call is inside: the tutor's answer is thinking until it sounds, and a fixed sentence
 * (the failure of an answer) is the tutor speaking.
 */
type Phase = 'listening' | 'hearing' | 'answer' | 'phrase' | 'standby';

/**
 * The call with the tutor (2.11, 6.1c): a conversation by turns and hands-free, over the same
 * TutorStore, which does not change. The student speaks, and 1.5 s of silence sends what the browser
 * understood; the tutor's answer is said, with the microphone closed, and then it listens again.
 * The keyboard is still a whole channel: a written question or a hint is said too. It needs no
 * watcher of its own: TutorSpeaker, which already follows the conversation, tells it how each answer
 * goes; the rest are its methods and its times. Screen scoped (the workspace route); not in the
 * teacher's preview, who has no voice (D-061).
 */
@Service({ autoProvided: false })
export class VoiceCall {
  private readonly tutor = inject(TutorStore);
  private readonly speaker = inject(TutorSpeaker);
  private readonly voice = inject(StudentVoice);
  private readonly settings = inject(SettingsStore);
  private readonly document = inject(DOCUMENT);

  private readonly phase = signal<Phase | null>(null);
  /** The answer the call follows, once it has arrived. */
  private readonly answerId = signal<string | null>(null);
  private readonly heardState = signal('');
  private readonly microphoneState = signal(false);
  private readonly noticeState = signal<CallNotice | null>(null);

  /** Where the call is; null without one. Thinking until the first sentence of the answer sounds. */
  readonly state = computed<CallState | null>(() => {
    const phase = this.phase();
    if (phase === 'answer') {
      const id = this.answerId();
      return id !== null && this.speaker.speakingTurnId() === id ? 'speaking' : 'thinking';
    }
    return phase === 'phrase' ? 'speaking' : phase;
  });
  readonly active = computed(() => this.phase() !== null);
  /** What the browser has understood of the turn of the student. */
  readonly heard = this.heardState.asReadonly();
  /** Always in sight while it is open (2.11). */
  readonly microphoneOpen = this.microphoneState.asReadonly();
  /** Why the last call ended by itself; null once another starts. */
  readonly notice = this.noticeState.asReadonly();
  /** A voice to speak with, the recognition of the browser and a conversation that takes questions. */
  readonly canCall = computed(
    () =>
      this.voice.tutorVoice() !== undefined &&
      this.voice.canDictate() &&
      !this.tutor.readonly() &&
      !this.tutor.loading() &&
      !this.tutor.loadError(),
  );

  private listening: Listening | null = null;
  private openedAt = 0;
  private quickCloses = 0;
  /** What the browser fixed of the turn; what it is still understanding goes after it. */
  private fixed = '';
  private lastWordAt = 0;
  /** A question said while the tutor still writes an answer: it goes once it is whole. */
  private waiting: string | null = null;
  /** The answer came with the call on hold: after it, only a moment to reply. */
  private fromStandby = false;
  /** The call asked, and the next answer is its own: only that one is measured. */
  private asked = false;
  private measuring = false;

  private readonly turnSilence = createDebouncer(CALL_TIMES.turnSilenceMs);
  private readonly standbyTimer = createDebouncer(CALL_TIMES.standbyMs);
  private readonly replyTimer = createDebouncer(CALL_TIMES.replyWindowMs);

  private readonly follower: AnswerFollower = {
    following: (turn) => this.answering(turn),
    wrote: () => this.mark(CALL_MARKS.firstText),
    sounded: () => {
      this.mark(CALL_MARKS.firstSound);
      this.measuring = false;
    },
    ended: (how, turn) => this.answerEnded(how, turn),
    closed: () => this.hangUp(),
    free: () => this.sendWaiting(),
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hangUp());
  }

  /** «Llamar al tutor»: says «Te escucho» and, once said, listens. */
  start(): void {
    if (!this.canCall() || this.phase()) return;
    this.noticeState.set(null);
    this.quickCloses = 0;
    this.speaker.follow(this.follower);
    this.phase.set('listening');
    // Said with the microphone closed: it would hear the tutor
    void this.speaker.say(GREETING).then(() => {
      if (this.phase() === 'listening' && !this.listening) this.openMicrophone(this.standbyTimer);
    });
  }

  /** «Colgar», and another exercise, a submitted attempt or leaving the screen. */
  hangUp(): void {
    if (!this.phase()) return;
    this.speaker.follow(null);
    this.quiet();
    this.phase.set(null);
    this.speaker.stop();
  }

  /** «Interrumpir», and Control alone: silences the tutor at once, and listens. */
  interrupt(): void {
    if (this.state() === 'speaking') this.speaker.stop();
  }

  /** Esc: drops what was being said, and listens again from nothing. */
  discard(): void {
    if (this.phase() !== 'hearing') return;
    this.quiet();
    this.phase.set('listening');
    this.openMicrophone(this.standbyTimer);
  }

  /** «Corregir»: the call waits on hold and gives what was said, for the field. */
  correct(): string {
    if (this.phase() !== 'hearing') return '';
    const heard = this.heardState();
    this.toStandby();
    return heard;
  }

  /** «Seguir hablando». */
  resume(): void {
    if (this.phase() !== 'standby') return;
    this.quickCloses = 0;
    this.phase.set('listening');
    this.openMicrophone(this.standbyTimer);
  }

  /** «Pausar», and the tab hidden: on hold, with the microphone closed and the tutor silent. */
  hold(): void {
    const phase = this.phase();
    if (phase && phase !== 'standby') this.toStandby();
  }

  /**
   * Ctrl + .: pauses the call, whatever it is doing, or resumes it on hold. Only on purpose, with a
   * combination, does the microphone open.
   */
  toggleHold(): void {
    if (this.phase() === 'standby') this.resume();
    else this.hold();
  }

  /** Opens a new microphone; with a timer, hearing nothing in that time puts the call on hold. */
  private openMicrophone(onHoldAfter?: Debouncer): void {
    this.closeMicrophone();
    onHoldAfter?.schedule(() => this.toStandby());
    this.listen();
  }

  /** Listens, without touching the state, what was heard or the times. */
  private listen(): void {
    // A closed microphone gives nothing more (SpeechService), so what it hears is always this one's
    const listening = this.voice.listen((transcript) => this.hear(transcript));
    if (!listening) {
      this.hangUp();
      return;
    }
    this.listening = listening;
    this.openedAt = Date.now();
    this.microphoneState.set(true);
    void listening.ended.then((end) => this.microphoneEnded(listening, end));
  }

  private closeMicrophone(): void {
    const listening = this.listening;
    this.listening = null;
    this.microphoneState.set(false);
    listening?.stop();
  }

  private hear({ text, final }: Transcript): void {
    const phase = this.phase();
    if (phase === 'answer') {
      // Only with «Interrumpir al tutor hablando»: the tutor heard through the speakers is not the
      // student. The recognition comes late, so the sentence before counts too
      if (isEcho(text, this.speaker.said().slice(-2).join(' '))) return;
      this.phase.set('hearing');
      this.answerId.set(null);
      this.speaker.stop();
    } else if (phase === 'listening') {
      if (!text.trim()) return;
      this.phase.set('hearing');
      this.standbyTimer.cancel();
      this.replyTimer.cancel();
    }
    const heard = appendDictation(this.fixed, text, MAX_QUESTION_LENGTH);
    if (final) this.fixed = heard;
    this.heardState.set(heard);
    this.lastWordAt = performance.now();
    this.turnSilence.schedule(() => this.endTurn());
  }

  /** The student was silent: the question goes, and the tutor thinks it with the microphone closed. */
  private endTurn(): void {
    const question = this.heardState();
    this.quiet();
    this.phase.set('answer');
    performance.mark(CALL_MARKS.lastWord, { startTime: this.lastWordAt });
    this.waiting = question;
    this.sendWaiting();
  }

  /** Sends the question said, unless the tutor still writes an answer: then, once it is whole. */
  private sendWaiting(): void {
    const question = this.waiting;
    if (question === null || !this.tutor.canAsk()) return;
    this.waiting = null;
    this.asked = true;
    performance.mark(CALL_MARKS.sent);
    void this.tutor.ask(question);
  }

  /** A new answer is said: the one the call asked, or a written question, a hint, «Escuchar». */
  private answering(turn: TutorTurn): void {
    const phase = this.phase();
    const fromStandby = phase === 'standby' || (phase === 'answer' && this.fromStandby);
    this.measuring = this.asked;
    this.asked = false;
    this.quiet();
    this.fromStandby = fromStandby;
    this.phase.set('answer');
    this.answerId.set(turn.id);
    // Only with «Interrumpir al tutor hablando» does the microphone stay open while it speaks
    if (this.settings.interruptBySpeaking()) this.openMicrophone();
  }

  private answerEnded(how: AnswerEnd, turn?: TutorTurn): void {
    if (this.phase() !== 'answer') return;
    this.measuring = false;
    if (how === 'failed') this.sayFailure(turn?.error);
    else this.afterTutor();
  }

  /** The tutor says the answer failed; with too many questions, the call waits on hold. */
  private sayFailure(error: unknown): void {
    const { text, hold } = callFailurePhrase(error, Date.now());
    this.quiet();
    this.phase.set('phrase');
    void this.speaker.say(text).then(() => {
      if (this.phase() !== 'phrase') return;
      if (hold) this.toStandby();
      else this.afterTutor();
    });
  }

  /** The tutor is done: the turn of the student, or on hold with the tab hidden. */
  private afterTutor(): void {
    if (this.document.visibilityState === 'hidden') {
      this.toStandby();
      return;
    }
    const onHoldAfter = this.fromStandby ? this.replyTimer : this.standbyTimer;
    this.quiet();
    this.phase.set('listening');
    // A microphone of its own: one left open would still give what it heard of the tutor
    this.openMicrophone(onHoldAfter);
  }

  private toStandby(): void {
    this.quiet();
    this.phase.set('standby');
    this.speaker.stop();
  }

  /** Closes the microphone, stops the times and forgets the turn. */
  private quiet(): void {
    this.closeMicrophone();
    this.turnSilence.cancel();
    this.standbyTimer.cancel();
    this.replyTimer.cancel();
    this.fixed = '';
    this.heardState.set('');
    this.waiting = null;
    this.fromStandby = false;
    this.answerId.set(null);
  }

  /** The microphone ended by itself: an error ends the call; silence opens it again, as it was. */
  private microphoneEnded(listening: Listening, end: ListeningEnd): void {
    if (listening !== this.listening) return;
    this.listening = null;
    this.microphoneState.set(false);
    if (end !== 'silence' && end !== 'stopped') {
      this.hangUp();
      this.noticeState.set(end);
      return;
    }
    const quick = Date.now() - this.openedAt < CALL_TIMES.quickCloseMs;
    this.quickCloses = quick ? this.quickCloses + 1 : 0;
    if (this.quickCloses >= MAX_QUICK_CLOSES) {
      this.hangUp();
      this.noticeState.set('unstable');
      return;
    }
    // The browser stops listening when it hears nothing for a while: what it gave stays
    this.fixed = this.heardState();
    this.listen();
  }

  private mark(name: string): void {
    if (this.measuring) performance.mark(name);
  }
}
