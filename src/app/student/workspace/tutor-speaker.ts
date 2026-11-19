import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Service,
  signal,
  untracked,
} from '@angular/core';

import { LanguageService } from '../../core/i18n/language-service';
import { speakableSentences } from '../../core/speech/speakable-sentences';
import { SettingsStore } from '../settings/settings-store';
import { StudentVoice } from '../settings/student-voice';
import { type TutorTurn, TutorStore, waitsForStudent } from './tutor-store';

/** Said last when the answer had code or leaves a button: it is only in the chat (2.11). */
const CLOSING = $localize`:@@tutor.voice.closing:Te lo dejo en el chat.`;

/** A turn as it was asked: a retry keeps the id, so its time tells it apart. */
function keyOf(turn: TutorTurn | undefined): string | undefined {
  return turn && `${turn.id}@${turn.createdAt}`;
}

/**
 * The tutor's voice in the workspace (2.11, 6.1a): it says the new answers sentence by sentence as
 * they arrive, with «Leer las respuestas en voz alta», and the one the student asks for with
 * «Escuchar». One sentence at a time, from its own queue: so it can be cut between sentences and no
 * utterance is long. Screen scoped (the workspace route); not in the teacher's preview, who has no
 * voice settings (D-061).
 */
@Service({ autoProvided: false })
export class TutorSpeaker {
  private readonly tutor = inject(TutorStore);
  private readonly voice = inject(StudentVoice);
  private readonly settings = inject(SettingsStore);
  private readonly locale = inject(LanguageService).locale;
  private readonly document = inject(DOCUMENT);

  private readonly speakingState = signal<string | null>(null);
  /** The answer being said, from its first sentence to its last; null in silence. */
  readonly speakingTurnId = this.speakingState.asReadonly();
  /** «Escuchar» is offered (StudentVoice.canSpeak). */
  readonly available = this.voice.canSpeak;
  /** A voice is chosen: without it, «Escuchar» leads to the settings. */
  readonly ready = computed(() => this.voice.tutorVoice() !== undefined);

  /** Every fresh turn seen: a turn is new once, even if it arrived whole before the effect ran. */
  private readonly seen = new Set<string>();
  private queue: string[] = [];
  /** How many sentences of the answer are already queued or said. */
  private taken = 0;
  private whole = false;
  private playing = false;
  /** Grows with each stop, so a sentence that ends late belongs to an answer no longer said. */
  private generation = 0;

  constructor() {
    // Boundary with Web Speech (4.8): the answer grows in a signal, and the synthesis is imperative
    effect(() => {
      const turns = this.tutor.turns();
      untracked(() => this.follow(turns));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** «Escuchar»: says that answer from its start; whatever sounded stops. */
  listen(turnId: string): void {
    const turn = this.tutor.turns().find((each) => each.id === turnId);
    if (!this.ready() || !turn) return;
    this.start(turn);
  }

  /** «Parar», and everything that silences the tutor. */
  stop(): void {
    this.generation++;
    this.queue = [];
    this.taken = 0;
    this.whole = false;
    this.playing = false;
    this.speakingState.set(null);
    this.voice.stop();
  }

  private follow(turns: readonly TutorTurn[]): void {
    const fresh = turns.filter((turn) => turn.fresh).at(-1);
    const key = keyOf(fresh);
    if (fresh && key && !this.seen.has(key)) {
      this.seen.add(key);
      // A new turn silences whatever sounded, read aloud or not
      this.stop();
      if (
        fresh.status !== 'failed' &&
        this.settings.readAloud() &&
        this.ready() &&
        this.document.visibilityState !== 'hidden'
      )
        this.start(fresh);
      return;
    }
    const speaking = this.speakingState();
    if (!speaking) return;
    const turn = turns.find((each) => each.id === speaking);
    if (!turn || turn.status === 'failed') this.stop();
    else this.feed(turn);
  }

  private start(turn: TutorTurn): void {
    this.stop();
    this.speakingState.set(turn.id);
    this.feed(turn);
  }

  /** Queues the sentences of the answer that are whole and not yet queued. */
  private feed(turn: TutorTurn): void {
    const sentences = speakableSentences(turn.answer, {
      locale: this.locale,
      closing: CLOSING,
      leavesButton: turn.actions.some((action) => waitsForStudent(action.call)),
      partial: turn.status === 'answering',
    });
    this.queue.push(...sentences.slice(this.taken));
    this.taken = Math.max(this.taken, sentences.length);
    this.whole = turn.status === 'done';
    this.next();
  }

  private next(): void {
    if (this.playing) return;
    const sentence = this.queue.shift();
    if (sentence === undefined) {
      if (this.whole) this.speakingState.set(null);
      return;
    }
    this.playing = true;
    const generation = this.generation;
    this.voice.say(sentence).then(
      (outcome) => this.said(generation, outcome),
      // A synthesis that fails is only silence: everything is written
      () => this.said(generation, 'failed'),
    );
  }

  /** The sentence ended: the next one, unless the answer was silenced meanwhile. */
  private said(generation: number, outcome: 'ended' | 'cancelled' | 'failed'): void {
    if (generation !== this.generation) return;
    this.playing = false;
    if (outcome === 'ended') this.next();
    else this.stop();
  }
}
