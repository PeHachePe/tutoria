import { inject, Service } from '@angular/core';

import { AuthStore } from '../../../auth/auth-store';
import type { Attempt, AttemptHistory, RunResult } from '../../../data/attempt';
import { AttemptService } from '../../../data/attempt-service';
import { runEventDetail } from '../../../data/code-runner/run-result';
import { DataError } from '../../../data/data-error';
import type { ProcessEvent, RunDetail } from '../../../data/process-event';
import type { TutorInteraction } from '../../../data/tutor';
import { TRYOUT_ASSIGNMENT_ID, TRYOUT_EXERCISE } from './tryout-exercise';

/**
 * The attempts of a teacher trying an exercise as a student (4.3e, D-061), kept only in memory
 * while the try is open: the workspace works with them as with those of the server, which never
 * hears of them. It follows the rules of the server (2.4): editing takes a run back to in progress,
 * only a passed attempt is submitted, and practising again starts the next one. The runner and the
 * tutor of the try record here their runs and answers, as the server would.
 */
@Service({ autoProvided: false })
export class TryoutAttemptService extends AttemptService {
  private readonly exerciseId = inject(TRYOUT_EXERCISE).content.exercise.id;
  private readonly userId = inject(AuthStore).userId;

  /** Not state: nothing is drawn from them, the stores of the workspace keep what they show. */
  private attempts: readonly Attempt[] = [];
  private events: readonly ProcessEvent[] = [];
  private interactions: readonly TutorInteraction[] = [];

  openOrCreate(_assignmentId: string, number?: number): Promise<Attempt> {
    if (number !== undefined) {
      const attempt = this.attempts.find((each) => each.number === number);
      return attempt ? Promise.resolve(attempt) : Promise.reject(new DataError('not_found'));
    }
    return Promise.resolve(this.attempts.at(-1) ?? this.create(1));
  }

  list(): Promise<Attempt[]> {
    return Promise.resolve([...this.attempts]);
  }

  retry(): Promise<Attempt> {
    const latest = this.attempts.at(-1);
    if (!latest) {
      return Promise.reject(
        new DataError('invalid', 'Only a submitted attempt can be practised again'),
      );
    }
    return Promise.resolve(latest.status === 'submitted' ? this.create(latest.number + 1) : latest);
  }

  async saveCode(attemptId: string, code: string): Promise<Attempt> {
    const attempt = this.find(attemptId);
    if (attempt.status === 'submitted') {
      throw new DataError('invalid', 'A submitted attempt cannot change');
    }
    if (code === attempt.currentCode) return attempt;
    return this.replace({ ...attempt, currentCode: code, status: 'in_progress', updatedAt: now() });
  }

  async submit(attemptId: string): Promise<Attempt> {
    const attempt = this.find(attemptId);
    if (attempt.status !== 'passed') {
      throw new DataError('invalid', 'Only a passed attempt can be submitted');
    }
    const at = now();
    return this.replace({
      ...attempt,
      status: 'submitted',
      finalCode: attempt.currentCode,
      finishedAt: at,
      updatedAt: at,
    });
  }

  async history(attemptId: string): Promise<AttemptHistory> {
    return {
      attempt: this.find(attemptId),
      events: this.events.filter((event) => event.attemptId === attemptId),
      interactions: this.answers(attemptId),
    };
  }

  /** A run of the try: the code and the status it earned, with its `run` event (2.3). */
  recordRun(attemptId: string, code: string, result: RunResult): Attempt {
    const attempt = this.find(attemptId);
    const at = now();
    this.events = [
      ...this.events,
      {
        id: crypto.randomUUID(),
        attemptId,
        type: 'run',
        timestamp: at,
        detail: runEventDetail(result),
      },
    ];
    return this.replace({ ...attempt, currentCode: code, status: result.status, updatedAt: at });
  }

  /** What the last run of the attempt gave, as the tutor needs it; null before the first. */
  lastRun(attemptId: string): RunDetail | null {
    const runs = this.events.filter(
      (event) => event.attemptId === attemptId && event.type === 'run',
    );
    return (runs.at(-1)?.detail as RunDetail | undefined) ?? null;
  }

  /** An answer of the tutor to the try. */
  recordAnswer(interaction: TutorInteraction): void {
    this.interactions = [...this.interactions, interaction];
  }

  /** The answers of the tutor to the attempt, oldest first. */
  answers(attemptId: string): TutorInteraction[] {
    return this.interactions.filter((interaction) => interaction.attemptId === attemptId);
  }

  /** «Empezar de nuevo»: forgets the attempts, so the next one opens empty. */
  reset(): void {
    this.attempts = [];
    this.events = [];
    this.interactions = [];
  }

  /** The attempt, or `not_found` if it is not one of this try. */
  find(attemptId: string): Attempt {
    const attempt = this.attempts.find((each) => each.id === attemptId);
    if (!attempt) throw new DataError('not_found');
    return attempt;
  }

  private create(number: number): Attempt {
    const at = now();
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      exerciseId: this.exerciseId,
      userId: this.userId() ?? '',
      assignmentId: TRYOUT_ASSIGNMENT_ID,
      number,
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
      startedAt: at,
      finishedAt: null,
      updatedAt: at,
    };
    this.attempts = [...this.attempts, attempt];
    return attempt;
  }

  private replace(attempt: Attempt): Attempt {
    this.attempts = this.attempts.map((each) => (each.id === attempt.id ? attempt : each));
    return attempt;
  }
}

function now(): string {
  return new Date().toISOString();
}
