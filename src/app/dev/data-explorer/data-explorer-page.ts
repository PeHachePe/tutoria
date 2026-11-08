import { DatePipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField, readonly } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTooltip } from '@angular/material/tooltip';

import type { Attempt, AttemptStatus, RunResult } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { AuthService } from '../../data/auth-service';
import { CodeRunnerService } from '../../data/code-runner-service';
import type { Exercise } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { SAMPLE_CODE } from '../../data/mock/fixtures/activity';
import { SEED } from '../../data/mock/fixtures/seed';
import { MockDb } from '../../data/mock/mock-db';
import type { AppUser, Role } from '../../data/user';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { splitInlineCode } from '../../shared/split-inline-code';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { errorMessage } from './error-message';
import { formatCall, formatValue, isMultilineText } from '../../shared/format-value';

interface ExerciseEntry {
  readonly key: string;
  readonly exercise: Exercise;
  /** Only for a student's assigned exercises. */
  readonly session: number | null;
  readonly status: AttemptStatus | null;
}

interface EntryGroup {
  /** «Sesión N», or null for the teacher's bank, which has no sessions. */
  readonly label: string | null;
  readonly entries: ExerciseEntry[];
}

const ROLE_LABELS: Record<Role, string> = {
  student: 'alumnado',
  teacher: 'docente',
  admin: 'administración',
};

/**
 * Development-only page (/dev/datos) to try the data services by hand: what each user sees, an
 * exercise with its examples, and an attempt with its transitions (2.4). It goes through the abstract
 * services, except for two aids that only exist with mock data: the sample code of each seed exercise
 * (its solution and a typical mistake), to run it, and the list of exercises a student was not
 * assigned.
 */
@Component({
  selector: 'app-data-explorer-page',
  imports: [
    DatePipe,
    FormField,
    MatButton,
    MatIconButton,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormField,
    MatLabel,
    MatIcon,
    MatInput,
    MatProgressBar,
    MatTooltip,
    StatusChip,
    DifficultyChip,
  ],
  templateUrl: './data-explorer-page.html',
})
export class DataExplorerPage {
  private readonly auth = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly attemptService = inject(AttemptService);
  private readonly runner = inject(CodeRunnerService);
  private readonly db = inject(MockDb);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly errorMessage = errorMessage;
  protected readonly formatCall = formatCall;
  protected readonly formatValue = formatValue;
  protected readonly isMultilineText = isMultilineText;
  protected readonly splitInlineCode = splitInlineCode;

  protected readonly user = resource({ loader: () => this.auth.currentUser() });

  protected readonly entries = resource({
    params: () => (this.user.hasValue() ? (this.user.value() ?? undefined) : undefined),
    loader: ({ params: user }) => this.loadEntries(user),
    defaultValue: [],
  });

  /** The entries grouped by session, in order; the bank goes in a single group without a label. */
  protected readonly groups = computed(() => {
    const groups: EntryGroup[] = [];
    for (const entry of this.entries.value()) {
      const label = entry.session === null ? null : `Sesión ${entry.session}`;
      const last = groups.at(-1);
      if (last && last.label === label) {
        last.entries.push(entry);
      } else {
        groups.push({ label, entries: [entry] });
      }
    }
    return groups;
  });

  /** Exercises of the bank outside the list: a student can try them and meet the access rule. */
  protected readonly unassigned = computed(() => {
    const listed = new Set(this.entries.value().map((entry) => entry.exercise.id));
    return this.db.tables().exercises.filter((exercise) => !listed.has(exercise.id));
  });

  /** The list can be folded away to give the exercise the whole width. */
  protected readonly listOpen = signal(true);

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
  protected readonly lastRun = signal<RunResult | null>(null);

  /** The solution and the typical mistake of the selected exercise, if it comes from the seed. */
  protected readonly sampleCode = computed(
    (): (typeof SAMPLE_CODE)[number] | undefined =>
      // Exercises are numbered from 1 in the seed: one that is not there finds nothing at 0
      SAMPLE_CODE[SEED.exercises.findIndex((exercise) => exercise.id === this.selectedId()) + 1],
  );

  /** What the last run gave, in one line. */
  protected readonly runSummary = computed(() => {
    const run = this.lastRun();
    if (!run) return null;
    if (run.loadError) return `No se ha ejecutado: ${run.loadError.kind}`;
    const passed = run.results.filter((result) => result.passed).length;
    return `Última ejecución: ${passed} de ${run.results.length} superadas`;
  });
  protected readonly codeForm = form(this.code, (path) => {
    readonly(path, () => this.attemptState()?.status === 'submitted');
  });

  protected toggleList(): void {
    this.listOpen.update((open) => !open);
  }

  protected select(exerciseId: string): void {
    this.selectedId.set(exerciseId);
    this.attemptState.set(null);
    this.actionError.set(null);
    this.code.set('');
    this.lastRun.set(null);
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

  protected loadSample(code: string): void {
    this.code.set(code);
  }

  /** Runs the code in the box with the real (mock) runner, and reads the attempt it left. */
  protected runCode(attempt: Attempt): Promise<unknown> {
    return this.perform(async () => {
      this.lastRun.set(await this.runner.run(attempt.id, this.code()));
      return this.attemptService.openOrCreate(attempt.exerciseId);
    });
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
