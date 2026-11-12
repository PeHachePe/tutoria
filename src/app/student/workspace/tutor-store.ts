import { computed, inject, linkedSignal, resource, Service } from '@angular/core';

import { LanguageService } from '../../core/i18n/language-service';
import { ToolRegistry } from '../../core/tools/app-tool';
import { AttemptService } from '../../data/attempt-service';
import {
  answerHintLevel,
  type Emotion,
  EMOTION_REACTIONS,
  type HintLevel,
  type Intensity,
  reachedHintLevel,
  type ReactionKind,
  type ToolRequest,
  type ToolResult,
  type TutorInteraction,
  type TutorRequest,
  type TutorTrigger,
} from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import type { LineMark } from '../../shared/code-editor/line-mark';
import type { Reaction } from '../../shared/reactions/reaction';
import { AttemptStore } from './attempt-store';

/** Where an answer is: arriving, complete, or lost on the way. */
export type TurnStatus = 'answering' | 'done' | 'failed';

/**
 * Where an action of the tutor is (2.5e): waiting for the student's button, running, done, failed,
 * undone, or of an earlier visit, which is never run again.
 */
export type ActionStatus = 'pending' | 'running' | 'done' | 'failed' | 'undone' | 'past';

/** What the tutor does with one of its tools in an answer (2.5e). */
export interface TurnAction {
  readonly call: ToolRequest;
  readonly status: ActionStatus;
  /** What the tool gave, once done: what `updateSettings` changed, to undo it. */
  readonly result?: unknown;
}

/** The parts of the screen the tutor can point at (`pointAt`, 2.5e). */
export interface Pointer {
  readonly target: 'example' | 'failingTest' | 'hiddenTests';
  /** The example of the statement, from 1. */
  readonly example?: number;
  /** A new one each time, so pointing twice at the same place shows it again. */
  readonly id: string;
}

/**
 * Whether an action waits for the student's button: opening another page and changing the language,
 * which reloads it. The rest only change what the screen shows, or a setting that can be undone,
 * and run as soon as the answer is whole (2.5e).
 */
export function waitsForStudent(call: ToolRequest): boolean {
  const tool = TUTOR_TOOL[call.name as keyof typeof TUTOR_TOOL];
  return tool?.use !== 'view' || (call.name === 'updateSettings' && 'language' in call.arguments);
}

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
  /** The student asked for the solution: the chat offers what does help (D-044). */
  readonly elusion: boolean;
  readonly createdAt: string;
  readonly status: TurnStatus;
  /** Why it failed, to say so. */
  readonly error?: unknown;
  /** Asked in this visit: its answer is read aloud and counts as new. The past is not. */
  readonly fresh: boolean;
  /** What the tutor does with its tools in this answer (2.5e). */
  readonly actions: readonly TurnAction[];
  /** The queries of the student's data the tutor made before answering (2.5e). */
  readonly queried: readonly string[];
}

/**
 * The conversation with the tutor in the workspace (4.5), shared by the chat, the reactions (1.8), the
 * voice (6.1) and the proactive tutor (6.2). It loads the past turns of the attempt, sends each
 * question or hint with the latest code and writes the answer as its events arrive (2.6). The
 * server decides the hint level; the store only shows it. Since 2.5e, it also runs the tools the
 * tutor asks for: the queries before it answers, and its actions once the answer is whole, or when
 * the student presses their button; and it keeps where the tutor marks the code and points.
 */
@Service({ autoProvided: false }) // provided by the workspace route, with the AttemptStore it follows
export class TutorStore {
  private readonly tutor = inject(TutorService);
  private readonly attempts = inject(AttemptService);
  private readonly attemptStore = inject(AttemptStore);
  private readonly tools = inject(ToolRegistry);
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

  /** The lines of the code the tutor marked (`highlightLines`); none in another exercise. */
  private readonly marksState = linkedSignal<readonly LineMark[]>(() => {
    this.attemptId();
    return [];
  });
  readonly marks = this.marksState.asReadonly();

  /** Where the tutor points on the screen (`pointAt`); nowhere in another exercise. */
  private readonly pointerState = linkedSignal<Pointer | null>(() => {
    this.attemptId();
    return null;
  });
  readonly pointer = this.pointerState.asReadonly();

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
  readonly hintLevel = computed(() => reachedHintLevel(this.turnsState()));
  /** What the next hint will be: one level more, up to the most concrete, as the server decides. */
  readonly nextHintLevel = computed(() => answerHintLevel('hint', this.turnsState()));

  private readonly freshAnswers = computed(() =>
    this.turnsState().filter((turn) => turn.fresh && turn.status === 'done'),
  );
  /** Answers that arrived in this visit, so a tab can say there is a new one. */
  readonly answerCount = computed(() => this.freshAnswers().length);
  /** The last answer that arrived whole, read aloud once: never the chunks while they arrive. */
  readonly announcement = computed(() => this.freshAnswers().at(-1)?.answer ?? '');
  /**
   * The last answer turned down a request for the solution: the chat offers a hint or the statement
   * under it, so the refusal leads somewhere (D-044). Not once the attempt is submitted.
   */
  readonly offersHelp = computed(() => {
    const last = this.turnsState().at(-1);
    return !this.readonly() && last?.status === 'done' && last.elusion;
  });

  /**
   * The reaction of the answer still arriving, known from its `meta`: the overlay loads its emoji
   * while the text arrives, so it is ready when the answer is complete.
   */
  readonly upcomingReaction = computed<Reaction | null>(
    () => {
      const arriving = this.turnsState().find(
        (turn) => turn.status === 'answering' && turn.reaction && turn.intensity,
      );
      return arriving?.reaction && arriving.intensity
        ? { id: arriving.id, kind: arriving.reaction, intensity: arriving.intensity }
        : null;
    },
    { equal: (a, b) => a?.id === b?.id },
  );
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

  /**
   * Sends again what a failed turn asked, in its place and with its id: if the server had recorded
   * it before the answer was lost, it gives that answer back instead of a new one (2.6).
   */
  async retry(turnId: string): Promise<void> {
    const failed = this.turnsState().find((turn) => turn.id === turnId);
    if (failed?.status !== 'failed') return;
    this.turnsState.update((turns) => turns.filter((turn) => turn.id !== turnId));
    await this.send(failed.trigger, failed.studentMessage ?? undefined, turnId);
  }

  reload(): void {
    this.history.reload();
  }

  /** Marks lines of the code with a note, or clears them with none (2.5e). */
  mark(lines: readonly LineMark[]): void {
    this.marksState.set(lines);
  }

  /** The student edited the code: the marks were about the code as it was. */
  clearMarks(): void {
    if (this.marksState().length > 0) this.marksState.set([]);
  }

  /** Draws attention to a part of the screen (2.5e). */
  pointAt(target: Pointer['target'], example?: number): void {
    this.pointerState.set({
      target,
      ...(example === undefined ? {} : { example }),
      id: crypto.randomUUID(),
    });
  }

  /** The student pressed the button of an action the tutor offered, or tries it again (2.5e). */
  async runAction(turnId: string, index: number): Promise<void> {
    const action = this.actionAt(turnId, index);
    if (action?.status !== 'pending' && action?.status !== 'failed') return;
    await this.run(turnId, index, action.call);
  }

  /** «Deshacer»: the settings the tutor changed go back to how they were (2.5e). */
  async undoAction(turnId: string, index: number): Promise<void> {
    const action = this.actionAt(turnId, index);
    const previous = (action?.result as { readonly previous?: object } | undefined)?.previous;
    if (action?.status !== 'done' || action.call.name !== 'updateSettings' || !previous) return;
    const run = await this.tools.run('updateSettings', previous);
    if (run.ok) this.patchAction(turnId, index, { status: 'undone' });
  }

  private actionAt(turnId: string, index: number): TurnAction | undefined {
    return this.turnsState().find((turn) => turn.id === turnId)?.actions[index];
  }

  private async run(turnId: string, index: number, call: ToolRequest): Promise<void> {
    this.patchAction(turnId, index, { status: 'running' });
    const run = await this.tools.run(call.name, call.arguments);
    this.patchAction(
      turnId,
      index,
      run.ok ? { status: 'done', result: run.result } : { status: 'failed' },
    );
  }

  private patchAction(turnId: string, index: number, change: Partial<TurnAction>): void {
    this.turnsState.update((turns) =>
      turns.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              actions: turn.actions.map((action, at) =>
                at === index ? { ...action, ...change } : action,
              ),
            }
          : turn,
      ),
    );
  }

  /** The queries the tutor asked for, run here: what each one gave, or why it could not (2.5e). */
  private query(calls: readonly ToolRequest[]): Promise<ToolResult[]> {
    return Promise.all(
      calls.map(async (call) => {
        const run = await this.tools.run(call.name, call.arguments);
        return { ...call, result: run.ok ? run.result : { error: run.error } };
      }),
    );
  }

  /**
   * Sends the request with the code as it is now, unsaved changes included, and writes the answer as
   * it arrives. Another exercise opened meanwhile has a conversation of its own, where this turn no
   * longer exists, so its late events change nothing. The id of the turn is the id of the request.
   */
  private async send(
    kind: TutorTrigger,
    message?: string,
    id: string = crypto.randomUUID(),
  ): Promise<void> {
    const attempt = this.attemptStore.attempt();
    if (!attempt || !this.canAsk()) return;
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
        elusion: false,
        createdAt: new Date().toISOString(),
        status: 'answering',
        fresh: true,
        actions: [],
        queried: [],
      },
    ]);
    const patch = (change: (turn: TutorTurn) => Partial<TutorTurn>) =>
      this.turnsState.update((turns) =>
        turns.map((turn) => (turn.id === id ? { ...turn, ...change(turn) } : turn)),
      );

    try {
      const request: TutorRequest = {
        requestId: id,
        attemptId: attempt.id,
        kind,
        message,
        code: attempt.currentCode,
        language: this.language,
      };
      // The tutor may ask for data of the student first: they are read here and the same request
      // goes again with them, once (2.5e)
      let asked = request;
      for (;;) {
        let queries: readonly ToolRequest[] = [];
        for await (const event of this.tutor.ask(asked)) {
          switch (event.type) {
            case 'query':
              queries = event.calls;
              break;
            case 'meta':
              patch(() => ({
                hintLevel: event.hintLevel,
                emotion: event.emotion,
                intensity: event.intensity,
                reaction: event.reaction ?? EMOTION_REACTIONS[event.emotion],
                elusion: event.elusion ?? false,
                actions: (event.actions ?? []).map((call) => ({
                  call,
                  status: 'pending' as const,
                })),
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
        if (queries.length === 0 || asked.results) break;
        const names = queries.map((call) => call.name);
        patch(() => ({ queried: names }));
        asked = { ...request, results: await this.query(queries) };
      }
      patch(() => ({ status: 'done' }));
    } catch (error) {
      // What arrived of the answer is dropped: retrying asks again from the start
      patch(() => ({ status: 'failed', answer: '', error, actions: [], queried: [] }));
      return;
    }
    await this.runWithoutWaiting(id);
  }

  /** Once the answer is whole, the actions that only change the screen run by themselves (2.5e). */
  private async runWithoutWaiting(turnId: string): Promise<void> {
    const actions = this.turnsState().find((turn) => turn.id === turnId)?.actions ?? [];
    for (const [index, action] of actions.entries()) {
      if (!waitsForStudent(action.call)) await this.run(turnId, index, action.call);
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
    elusion: interaction.elusion,
    createdAt: interaction.createdAt,
    status: 'done',
    fresh: false,
    // What it did then is not done again
    actions: (interaction.actions ?? []).map((call) => ({ call, status: 'past' })),
    queried: [],
  };
}
