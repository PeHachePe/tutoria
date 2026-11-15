import { inject, Service } from '@angular/core';

import { DataError } from '../../../data/data-error';
import type {
  Emotion,
  HintLevel,
  Intensity,
  PreviewTurn,
  ToolRequest,
  TutorEvent,
  TutorInteraction,
  TutorPreview,
  TutorPreviewRequest,
  TutorRequest,
} from '../../../data/tutor';
import { TutorService } from '../../../data/tutor-service';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_EXERCISE } from './tryout-exercise';

/** What the answers of a try record as their prompt: none of them is kept anywhere. */
const TRYOUT_PROMPT_VERSION = 'tryout';

/** What `meta` says of an answer, kept until it arrives whole. */
interface AnswerMeta {
  readonly hintLevel: HintLevel;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  readonly elusion: boolean;
  readonly actions: readonly ToolRequest[];
}

/**
 * The tutor in a try (4.3e, D-061): each turn goes to the tutor in preview mode (`tryOut`) with the
 * exercise of the form and the try so far, instead of the attempt the server does not have. The
 * answers that arrive whole are kept in the try, so the next hint goes one level up, as with a
 * student; the server keeps nothing.
 */
@Service({ autoProvided: false })
export class TryoutTutorService extends TutorService {
  /** The tutor of the app: this one takes its place only inside the try. */
  private readonly tutor = inject(TutorService, { skipSelf: true });
  private readonly exercise = inject(TRYOUT_EXERCISE);
  private readonly attempts = inject(TryoutAttemptService);

  ask(request: TutorRequest): AsyncIterable<TutorEvent> {
    return this.answer(request);
  }

  tryOut(request: TutorPreviewRequest): AsyncIterable<TutorEvent> {
    return this.tutor.tryOut(request);
  }

  private async *answer({ attemptId, ...ask }: TutorRequest): AsyncGenerator<TutorEvent> {
    const preview = this.previewOf(attemptId);
    let meta: AnswerMeta | undefined;
    let transcript = '';
    for await (const event of this.tutor.tryOut({ ...ask, preview })) {
      switch (event.type) {
        case 'meta':
          meta = {
            hintLevel: event.hintLevel,
            emotion: event.emotion,
            intensity: event.intensity,
            elusion: event.elusion ?? false,
            actions: event.actions ?? [],
          };
          break;
        case 'delta':
          transcript += event.text;
          break;
        case 'done':
          if (!event.silent && meta) {
            // The id of the request, as the server gives the id of what it kept
            this.attempts.recordAnswer({
              id: ask.requestId,
              attemptId,
              trigger: ask.kind,
              // Only a question carries a message (2.6)
              studentMessage: ask.message ?? null,
              transcript,
              ...meta,
              promptVersion: TRYOUT_PROMPT_VERSION,
              createdAt: new Date().toISOString(),
            });
            yield { ...event, interactionId: ask.requestId };
            continue;
          }
          break;
        case 'query':
          break;
      }
      yield event;
    }
  }

  /** What the tutor needs to know of the try, as it would read it from the attempt. */
  private previewOf(attemptId: string): TutorPreview {
    const attempt = this.attempts.find(attemptId);
    if (attempt.status === 'submitted') {
      throw new DataError('invalid', 'A submitted attempt gets no more help');
    }
    const { title, statement, topics, sourceLocale, translations, functionName, parameters } =
      this.exercise.content.exercise;
    return {
      exercise: {
        title,
        statement,
        topics,
        sourceLocale,
        translations,
        functionName,
        parameters,
        tests: this.exercise.tests,
      },
      status: attempt.status,
      lastRun: this.attempts.lastRun(attemptId),
      previous: this.attempts.answers(attemptId).map(previewTurn),
    };
  }
}

function previewTurn(interaction: TutorInteraction): PreviewTurn {
  const { trigger, hintLevel, studentMessage, transcript, emotion, intensity, elusion } =
    interaction;
  return {
    trigger,
    hintLevel,
    studentMessage,
    transcript,
    emotion,
    intensity,
    elusion,
    actions: interaction.actions ?? [],
  };
}
