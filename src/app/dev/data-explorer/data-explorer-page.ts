import { DatePipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField, readonly } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';

import type { Attempt, AttemptStatus } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { AuthService } from '../../data/auth-service';
import type { Difficulty, Exercise } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { MockDb } from '../../data/mock/mock-db';
import { MockNetwork } from '../../data/mock/mock-network';
import type { AppUser, Role } from '../../data/user';
import { errorMessage } from './error-message';
import { simulateRun } from './simulate-run';

interface ExerciseEntry {
  readonly key: string;
  readonly exercise: Exercise;
  /** Only for a student's assigned exercises. */
  readonly session: number | null;
  readonly status: AttemptStatus | null;
}

const STATUS_LABELS: Record<AttemptStatus, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En curso',
  tests_failed: 'Con fallos',
  passed: 'Superado',
  submitted: 'Entregado',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  initial: 'Inicial',
  medium: 'Media',
  advanced: 'Avanzada',
  extension: 'Ampliación',
};

const ROLE_LABELS: Record<Role, string> = {
  student: 'alumnado',
  teacher: 'docente',
  admin: 'administración',
};

/**
 * Development-only page (/dev/datos) to try the data services by hand: what each user sees, an
 * exercise with its visible tests, and an attempt with its transitions (2.4). It goes through the
 * abstract services, except for two aids that only exist with mock data: the simulated run (until the
 * code runner of step 1.5) and the list of exercises a student was not assigned.
 */
@Component({
  selector: 'app-data-explorer-page',
  imports: [DatePipe, FormField, MatButton, MatFormField, MatLabel, MatInput, MatProgressBar],
  templateUrl: './data-explorer-page.html',
})
export class DataExplorerPage {
  private readonly auth = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly attemptService = inject(AttemptService);
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly difficultyLabels = DIFFICULTY_LABELS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly errorMessage = errorMessage;

  protected readonly user = resource({ loader: () => this.auth.currentUser() });

  protected readonly entries = resource({
    params: () => (this.user.hasValue() ? (this.user.value() ?? undefined) : undefined),
    loader: ({ params: user }) => this.loadEntries(user),
    defaultValue: [],
  });

  /** Exercises of the bank outside the list: a student can try them and meet the access rule. */
  protected readonly unassigned = computed(() => {
    const listed = new Set(this.entries.value().map((entry) => entry.exercise.id));
    return this.db.tables().exercises.filter((exercise) => !listed.has(exercise.id));
  });

  protected readonly selectedId = signal<string | undefined>(undefined);

  protected readonly detail = resource({
    params: () => this.selectedId(),
    loader: ({ params: exerciseId }) => this.exerciseService.getDetail(exerciseId),
  });

  private readonly attemptState = signal<Attempt | null>(null);
  protected readonly attempt = this.attemptState.asReadonly();
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly code = signal('');
  protected readonly codeForm = form(this.code, (path) => {
    readonly(path, () => this.attemptState()?.status === 'submitted');
  });

  protected select(exerciseId: string): void {
    this.selectedId.set(exerciseId);
    this.attemptState.set(null);
    this.actionError.set(null);
    this.code.set('');
  }

  protected async openAttempt(exerciseId: string): Promise<void> {
    const attempt = await this.perform(() => this.attemptService.openOrCreate(exerciseId));
    if (attempt) {
      this.code.set(attempt.currentCode);
    }
  }

  protected saveCode(attempt: Attempt): Promise<unknown> {
    return this.perform(() => this.attemptService.saveCode(attempt.id, this.code()));
  }

  protected submit(attempt: Attempt): Promise<unknown> {
    return this.perform(() => this.attemptService.submit(attempt.id));
  }

  protected runSimulated(attempt: Attempt, passed: boolean): Promise<unknown> {
    return this.perform(() => this.network.request(() => simulateRun(this.db, attempt.id, passed)));
  }

  /** A test call as the student would write it: `suma([1,2,3])`. */
  protected call(functionName: string, input: readonly unknown[]): string {
    return `${functionName}(${input.map((arg) => JSON.stringify(arg)).join(', ')})`;
  }

  protected json(value: unknown): string {
    return JSON.stringify(value);
  }

  private async loadEntries(user: AppUser): Promise<ExerciseEntry[]> {
    if (user.role === 'student') {
      const assigned = await this.exerciseService.listAssigned(user.id);
      return assigned.map(({ assignmentId, exercise, session, status }) => ({
        key: assignmentId,
        exercise,
        session,
        status,
      }));
    }
    const bank = await this.exerciseService.list();
    return bank.map((exercise) => ({ key: exercise.id, exercise, session: null, status: null }));
  }

  /** Runs an attempt operation, keeps its result and refreshes the list, or shows its error. */
  private async perform(action: () => Promise<Attempt>): Promise<Attempt | undefined> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const attempt = await action();
      this.attemptState.set(attempt);
      this.entries.reload();
      return attempt;
    } catch (error) {
      this.actionError.set(errorMessage(error));
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}
