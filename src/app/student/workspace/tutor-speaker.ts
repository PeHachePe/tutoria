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
import { hasCodeBlock, speakableSentences } from '../../core/speech/speakable-sentences';
import { SettingsStore } from '../settings/settings-store';
import { StudentVoice } from '../settings/student-voice';
import { closingSentence } from './closing-sentence';
import { actionView } from './tutor/action-labels';
import { type TutorTurn, TutorStore, waitsForStudent } from './tutor-store';

/** A turn as it was asked: a retry keeps the id, so its time tells it apart. */
function keyOf(turn: TutorTurn): string {
  return `${turn.id}@${turn.createdAt}`;
}

/** How an answer the voice followed is over. */
export type AnswerEnd = 'said' | 'silenced' | 'failed';

/**
 * What a call hears from the tutor's voice (6.1c): while it follows, every new answer is said,
 * whatever «Leer las respuestas en voz alta» says, and the call learns how each one goes. So the call
 * needs no watcher of its own over the same conversation.
 */
export interface AnswerFollower {
  /** It starts saying an answer: a new one, or one asked for with «Escuchar». */
  following(turn: TutorTurn): void;
  /** The first text of that answer arrived. */
  wrote(): void;
  /** The sound of its first sentence started. */
  sounded(): void;
  /** That answer is over: said whole, silenced (or gone), or failed, with its turn. */
  ended(how: AnswerEnd, turn?: TutorTurn): void;
  /** The conversation closed: another exercise, or a submitted attempt. */
  closed(): void;
  /** The conversation takes a question again: the answer that was arriving is whole. */
  free(): void;
}

/**
 * The tutor's voice in the workspace (2.11, 6.1a): it says the new answers sentence by sentence as
 * they arrive, with «Leer las respuestas en voz alta», and the one the student asks for with
 * «Escuchar», and every new one in a call, which it tells how each goes (6.1c). One sentence at a
 * time, from its own queue: so it can be cut between sentences and no utterance is long. Screen scoped (the workspace route); not in the teacher's preview, who has no
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
  private readonly sayingState = signal<string | null>(null);
  /**
   * The sentence being said, also a fixed one; it stays between the sentences of an answer, as a
   * subtitle would. Null in silence.
   */
  readonly saying = this.sayingState.asReadonly();
  private readonly saidState = signal<readonly string[]>([]);
  /** The sentences of the answer said so far, the one that sounds included. */
  readonly said = this.saidState.asReadonly();
  /** «Escuchar» is offered (StudentVoice.canSpeak). */
  readonly available = this.voice.canSpeak;
  /** There is a voice to speak with: the chosen one or the most natural (D-078). */
  readonly ready = computed(() => this.voice.tutorVoice() !== undefined);

  /**
   * Every fresh turn seen, with whether it had failed: a turn is new once, even if it arrived whole
   * before the effect ran, and again when a retry answers it.
   */
  private readonly seen = new Map<string, boolean>();
  /** The answer followed, from start() until its last sentence ends or it is silenced. */
  private turnId: string | null = null;
  private queue: string[] = [];
  /** How many sentences of the answer are already queued or said. */
  private taken = 0;
  private whole = false;
  private playing = false;
  /** Grows with each stop, so a sentence that ends late belongs to an answer no longer said. */
  private generation = 0;
  /** The call that follows the answers; null without one. */
  private follower: AnswerFollower | null = null;
  /** Whether the follower was told of the first text and the first sound of the answer. */
  private wroteTold = false;
  private soundTold = false;
  /** The closing of the answer followed, worked out once it is whole; undefined until then. */
  private closing: string | null | undefined;
  /** How many closings about code alone were said in this visit, so the next one changes. */
  private codeClosings = 0;
  /** Whether the conversation was closed, and took questions, the last time it was looked at. */
  private closed = false;
  private couldAsk = false;

  constructor() {
    // Boundary with Web Speech (4.8): the answer grows in a signal, and the synthesis is imperative.
    // It follows ready() too: a new answer waits for the voices if they are still on their way
    // For a call, it also follows when the conversation closes, which ends the call, and when it
    // takes a question again
    effect(() => {
      const turns = this.tutor.turns();
      this.ready();
      const closed = this.tutor.loading() || this.tutor.readonly();
      const canAsk = this.tutor.canAsk();
      untracked(() => {
        if (closed && !this.closed) this.follower?.closed();
        this.closed = closed;
        if (canAsk && !this.couldAsk) this.follower?.free();
        this.couldAsk = canAsk;
        this.track(turns);
      });
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
    const followed = this.turnId;
    this.reset();
    this.voice.stop();
    if (followed) this.follower?.ended('silenced');
  }

  /**
   * A call follows the answers (6.1c): each new one is said and the call learns how it goes; null
   * when it ends.
   */
  follow(follower: AnswerFollower | null): void {
    this.follower = follower;
  }

  /** Says a fixed sentence that is not an answer («Te escucho»), after silencing what sounded. */
  async say(sentence: string): Promise<'ended' | 'cancelled'> {
    this.stop();
    const generation = this.generation;
    this.sayingState.set(sentence);
    try {
      return await this.voice.say(sentence);
    } catch {
      // A synthesis that fails is only silence
      return 'cancelled';
    } finally {
      if (generation === this.generation) this.sayingState.set(null);
    }
  }

  /** Back to silence, without telling anyone. */
  private reset(): void {
    this.generation++;
    this.turnId = null;
    this.queue = [];
    this.taken = 0;
    this.whole = false;
    this.playing = false;
    this.speakingState.set(null);
    this.sayingState.set(null);
    this.saidState.set([]);
    this.closing = undefined;
  }

  private track(turns: readonly TutorTurn[]): void {
    const fresh = turns.filter((turn) => turn.fresh).at(-1);
    // Read aloud, but the voices are still on their way: it is not seen until they arrive
    if (fresh && this.settings.readAloud() && !this.ready() && !this.seen.has(keyOf(fresh))) return;
    if (fresh && this.isNew(fresh)) {
      // A new turn silences whatever sounded (start() too), read aloud or not
      if (this.readsAloud(fresh)) this.start(fresh);
      else this.stop();
      return;
    }
    const followed = this.turnId;
    if (!followed) return;
    const turn = turns.find((each) => each.id === followed);
    if (turn?.status === 'failed') {
      this.reset();
      this.voice.stop();
      this.follower?.ended('failed', turn);
    } else if (!turn) {
      this.stop();
    } else {
      this.feed(turn);
    }
  }

  /**
   * A new answer is said by itself: in a call or with «Leer en voz alta», with a voice and the tab
   * in sight.
   */
  private readsAloud(turn: TutorTurn): boolean {
    return (
      turn.status !== 'failed' &&
      (this.follower !== null || this.settings.readAloud()) &&
      this.ready() &&
      this.document.visibilityState !== 'hidden'
    );
  }

  /** Seen for the first time, or answered again by a retry after failing. */
  private isNew(turn: TutorTurn): boolean {
    const key = keyOf(turn);
    const failed = turn.status === 'failed';
    const before = this.seen.get(key);
    if (before === failed) return false;
    this.seen.set(key, failed);
    // Unseen, or a failed turn answering again; one that has just failed is not new
    return before === undefined || !failed;
  }

  /** Follows the answer from its start; the one before is replaced, not ended. */
  private start(turn: TutorTurn): void {
    this.reset();
    this.voice.stop();
    this.turnId = turn.id;
    this.wroteTold = false;
    this.soundTold = false;
    this.follower?.following(turn);
    this.feed(turn);
  }

  /** Queues the sentences of the answer that are whole and not yet queued. */
  private feed(turn: TutorTurn): void {
    const sentences = speakableSentences(turn.answer, {
      locale: this.locale,
      closing: turn.status === 'done' ? this.closingOf(turn) : null,
      partial: turn.status === 'answering',
    });
    this.queue.push(...sentences.slice(this.taken));
    this.taken = Math.max(this.taken, sentences.length);
    this.whole = turn.status === 'done';
    if (turn.answer && !this.wroteTold) {
      this.wroteTold = true;
      this.follower?.wrote();
    }
    this.next();
  }

  /**
   * What the answer leaves only in the chat, said last (iteration 2 of 6.1c): the buttons still
   * waiting for the student, by their names, or that there is code. Worked out once per answer, so
   * the phrasing about code changes from one answer to the next and not while one grows.
   */
  private closingOf(turn: TutorTurn): string | null {
    if (this.closing === undefined) {
      const buttons = turn.actions
        .filter((action) => action.status === 'pending' && waitsForStudent(action.call))
        .map((action) => actionView(action).text);
      const code = hasCodeBlock(turn.answer);
      this.closing = closingSentence({ code, buttons, said: this.codeClosings }, this.locale);
      if (code && buttons.length === 0) this.codeClosings++;
    }
    return this.closing;
  }

  private next(): void {
    if (this.playing) return;
    const sentence = this.queue.shift();
    if (sentence === undefined) {
      if (this.whole) {
        this.reset();
        this.follower?.ended('said');
      }
      return;
    }
    this.playing = true;
    // Speaking from its first sentence, not while the tutor still thinks it
    this.speakingState.set(this.turnId);
    this.sayingState.set(sentence);
    this.saidState.update((said) => [...said, sentence]);
    const generation = this.generation;
    this.voice
      .say(sentence, () => this.sounded(generation))
      .then(
        (outcome) => this.sentenceEnded(generation, outcome),
        // A synthesis that fails is only silence: everything is written
        () => this.sentenceEnded(generation, 'failed'),
      );
  }

  /** The first sound of the answer, for the call; that of a silenced answer is not its own. */
  private sounded(generation: number): void {
    if (generation !== this.generation || this.soundTold) return;
    this.soundTold = true;
    this.follower?.sounded();
  }

  /** The sentence ended: the next one, unless the answer was silenced meanwhile. */
  private sentenceEnded(generation: number, outcome: 'ended' | 'cancelled' | 'failed'): void {
    if (generation !== this.generation) return;
    this.playing = false;
    if (outcome === 'ended') this.next();
    else this.stop();
  }
}
