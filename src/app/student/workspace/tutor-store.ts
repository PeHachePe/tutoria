import { computed, inject, linkedSignal, resource, Service } from '@angular/core';

import { LanguageService } from '../../core/language-service';
import { AttemptService } from '../../data/attempt-service';
import {
  type Emotion,
  EMOTION_REACTIONS,
  type HintLevel,
  type Intensity,
  MAX_HINT_LEVEL,
  type ReactionKind,
  type TutorInteraction,
  type TutorTrigger,
} from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import type { Reaction } from '../../shared/reactions/reaction';
import { AttemptStore } from './attempt-store';

/** Where an answer is: arriving, complete, or lost on the way. */
export type TurnStatus = 'answering' | 'done' | 'failed';

/** One exchange with the tutor: what the student asked, if anything, and the tutor's answer. */
export interface TutorTurn {
  readonly id: string;
  readonly trigger: TutorTrigger;
  /** What the student wrote; null for a hint or an intervention of the tutor. */
  readonly studentMessage: string | null;
  /** The answer, which grows while it arrives. */
  readonly answer: string;
  /** Decided by the server (2.6): null until its `meta` arrives. */
  readonly hintLevel: HintLevel | null;
  readonly emotion: Emotion | null;
  readonly intensity: Intensity | null;
  /** The reaction the tutor chose, or the one of its emotion. */
  readonly reaction: ReactionKind | null;
  readonly createdAt: string;
  readonly status: TurnStatus;
  /** Why it failed, to say so. */
  readonly error?: unknown;
  /** Asked in this visit: its answer is read aloud and counts as new. The past is not. */
  readonly fresh: boolean;
}

/**
 * The conversation with the tutor in the workspace (4.5), shared by the chat, the reactions (1.8), the
 * voice (6.1) and the proactive tutor (6.2). It loads the past turns of the attempt, sends each
 * question or hint with the latest code and writes the answer as its events arrive (2.6). The
 * server decides the hint level; the store only shows it.
 */
@Service({ autoProvided: false }) // provided by the workspace route, with the AttemptStore it follows
export class TutorStore {
  private readonly tutor = inject(TutorService);
  private readonly attempts = inject(AttemptService);
  private readonly attemptStore = inject(AttemptStore);
  private readonly language = inject(LanguageService).locale;

  private readonly attemptId = computed(() => this.attemptStore.attempt()?.id);

  /** The past turns of the attempt; it loads again for each exercise. */
  private readonly history = resource({
    params: () => this.attemptId(),
    loader: ({ params: attemptId }) => this.attempts.history(attemptId),
  });

  /** The loaded turns and those asked since: a new attempt starts from its own history. */
  private readonly turnsState = linkedSignal<TutorTurn[]>(() =>
    this.history.hasValue() ? this.history.value().interactions.map(pastTurn) : [],
  );

  readonly turns = this.turnsState.asReadonly();
  readonly loading = this.history.isLoading;
  readonly loadError = computed(() => this.history.error());
  /** A submitted attempt keeps its conversation, but gets no more help (2.4). */
  readonly readonly = this.attemptStore.readonly;
  readonly answering = computed(() =>
    this.turnsState().some((turn) => turn.status === 'answering'),
  );
  readonly canAsk = computed(
    () => this.history.hasValue() && !this.readonly() && !this.answering(),
  );

  /** The level «Pedir pista» has reached in this attempt: 0 before the first hint. */
  readonly hintLevel = computed(() =>
    this.turnsState().reduce<HintLevel | 0>(
      (level, turn) =>
        turn.trigger === 'hint' && turn.hintLevel !== null && turn.hintLevel > level
          ? turn.hintLevel
          : level,
      0,
    ),
  );
  /** What the next hint will be: one level more, up to the most concrete. */
  readonly nextHintLevel = computed(
    () => Math.min(this.hintLevel() + 1, MAX_HINT_LEVEL) as HintLevel,
  );

  private readonly freshAnswers = computed(() =>
    this.turnsState().filter((turn) => turn.fresh && turn.status === 'done'),
  );
  /** Answers that arrived in this visit, so a tab can say there is a new one. */
  readonly answerCount = computed(() => this.freshAnswers().length);
  /** The last answer that arrived whole, read aloud once: never the chunks while they arrive. */
  readonly announcement = computed(() => this.freshAnswers().at(-1)?.answer ?? '');
  /**
   * The emotion of the last answer that arrived whole, for the floating reactions (1.8). Its `meta`
   * comes first, but it plays at the end: an answer lost halfway or an intervention the tutor keeps
   * to itself must not react. The past turns never do.
   */
  readonly reaction = computed<Reaction | null>(
    () => {
      const last = this.freshAnswers().at(-1);
      return last?.reaction && last.intensity
        ? { id: last.id, kind: last.reaction, intensity: last.intensity }
        : null;
    },
    // The same answer is the same reaction: a new object for it would play it again
    { equal: (a, b) => a?.id === b?.id },
  );

  /** Asks a question in the student's words. */
  ask(message: string): Promise<void> {
    const question = message.trim();
    return question ? this.send('question', question) : Promise.resolve();
  }

  /** Asks for a hint: the server raises the level (2.6). */
  requestHint(): Promise<void> {
    return this.send('hint');
  }

  /** Sends again what a failed turn asked, in its place. */
  async retry(turnId: string): Promise<void> {
    const failed = this.turnsState().find((turn) => turn.id === turnId);
    if (failed?.status !== 'failed') return;
    this.turnsState.update((turns) => turns.filter((turn) => turn.id !== turnId));
    await this.send(failed.trigger, failed.studentMessage ?? undefined);
  }

  reload(): void {
    this.history.reload();
  }

  /**
   * Sends the request with the code as it is now, unsaved changes included, and writes the answer as
   * it arrives. Another exercise opened meanwhile has a conversation of its own, where this turn no
   * longer exists, so its late events change nothing.
   */
  private async send(kind: TutorTrigger, message?: string): Promise<void> {
    const attempt = this.attemptStore.attempt();
    if (!attempt || !this.canAsk()) return;
    const id = crypto.randomUUID();
    this.turnsState.update((turns) => [
      ...turns,
      {
        id,
        trigger: kind,
        studentMessage: message ?? null,
        answer: '',
        hintLevel: null,
        emotion: null,
        intensity: null,
        reaction: null,
        createdAt: new Date().toISOString(),
        status: 'answering',
        fresh: true,
      },
    ]);
    const patch = (change: (turn: TutorTurn) => Partial<TutorTurn>) =>
      this.turnsState.update((turns) =>
        turns.map((turn) => (turn.id === id ? { ...turn, ...change(turn) } : turn)),
      );

    try {
      const events = this.tutor.ask({
        attemptId: attempt.id,
        kind,
        message,
        code: attempt.currentCode,
        language: this.language,
      });
      for await (const event of events) {
        switch (event.type) {
          case 'meta':
            patch(() => ({
              hintLevel: event.hintLevel,
              emotion: event.emotion,
              intensity: event.intensity,
              reaction: event.reaction ?? EMOTION_REACTIONS[event.emotion],
            }));
            break;
          case 'delta':
            patch((turn) => ({ answer: turn.answer + event.text }));
            break;
          case 'done':
            if (event.silent) {
              // The tutor chose not to step in: nothing to show (2.7)
              this.turnsState.update((turns) => turns.filter((turn) => turn.id !== id));
            }
            break;
        }
      }
      patch(() => ({ status: 'done' }));
    } catch (error) {
      // What arrived of the answer is dropped: retrying asks again from the start
      patch(() => ({ status: 'failed', answer: '', error }));
    }
  }
}

function pastTurn(interaction: TutorInteraction): TutorTurn {
  return {
    id: interaction.id,
    trigger: interaction.trigger,
    studentMessage: interaction.studentMessage,
    answer: interaction.transcript,
    hintLevel: interaction.hintLevel,
    emotion: interaction.emotion,
    intensity: interaction.intensity,
    // The past never reacts, so it does not need to know how
    reaction: null,
    createdAt: interaction.createdAt,
    status: 'done',
    fresh: false,
  };
}
