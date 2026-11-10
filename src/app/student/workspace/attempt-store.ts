import { computed, DestroyRef, inject, Service, signal } from '@angular/core';

import { AuthStore } from '../../auth/auth-store';
import type { Attempt, RunResult } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { CodeRunnerService } from '../../data/code-runner-service';
import { createDebouncer } from '../../shared/create-debouncer';
import { clearDraft, readDraft, saveDraft } from './code-draft';
import { EditingTab } from './editing-tab';

/** The code is saved once the student stops typing for this long (4.5). */
const AUTOSAVE_DELAY_MS = 800;

/**
 * Where the code stands against the server: `pending` while the autosave waits for the student to
 * stop typing, `saving` while the answer is on its way, `saved` once the latest code is there, and
 * `error` if the last save failed. `idle` before the first change.
 */
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** An action of the student that failed, kept to show its message and retry it. */
export interface ActionError {
  readonly action: 'run' | 'submit';
  readonly error: unknown;
}

/**
 * The attempt the student is working on, shared by the editor, the results, «Entregar» and the
 * tutor (4.5). Provided by the workspace route, so it lives while the student is on an exercise.
 * The runner and the attempt service decide the status (2.4); the store only reflects it.
 */
@Service({ autoProvided: false })
export class AttemptStore {
  private readonly attempts = inject(AttemptService);
  private readonly runner = inject(CodeRunnerService);
  private readonly tabs = inject(EditingTab);
  private readonly autosave = createDebouncer(AUTOSAVE_DELAY_MS);

  private readonly attemptState = signal<Attempt | undefined>(undefined);
  /** Code the server has, to know whether there is anything left to save. */
  private readonly savedCodeState = signal('');
  private readonly savingState = signal(false);
  private readonly saveFailedState = signal(false);
  private readonly changedState = signal(false);
  private readonly lastRunState = signal<RunResult | undefined>(undefined);
  /** Code of the last run, to know whether its results still describe the code. */
  private readonly lastRunCodeState = signal<string | undefined>(undefined);
  /** Attempt with a run or a submission on its way, so a late answer never mixes attempts. */
  private readonly runningIdState = signal<string | undefined>(undefined);
  private readonly submittingIdState = signal<string | undefined>(undefined);
  private readonly actionErrorState = signal<ActionError | undefined>(undefined);
  private readonly draftRestoredState = signal(false);
  /** The save on its way, which a run waits for before sending the code. */
  private saving: Promise<void> = Promise.resolve();
  /** Exercise of the latest `open()`, so an answer that arrives late does not overwrite the new one. */
  private openingId: string | undefined;
  /** Another save was asked for while one was on its way: it goes once that one ends. */
  private saveAgain = false;

  readonly attempt = this.attemptState.asReadonly();
  readonly status = computed(() => this.attemptState()?.status ?? 'not_started');
  /** A submitted attempt only shows its code (2.4). */
  readonly readonly = computed(() => this.status() === 'submitted');
  /** Another tab of this browser took the attempt: this one only shows it (D-041). */
  readonly editingElsewhere = this.tabs.elsewhere;
  /** The student can change the code here: an open attempt, not submitted, not taken elsewhere. */
  readonly editable = computed(
    () => !!this.attemptState() && !this.readonly() && !this.editingElsewhere(),
  );

  readonly hasUnsavedChanges = computed(
    () => (this.attemptState()?.currentCode ?? '') !== this.savedCodeState(),
  );

  readonly saveStatus = computed<SaveStatus>(() => {
    if (this.savingState()) return 'saving';
    if (this.saveFailedState()) return 'error';
    if (this.hasUnsavedChanges()) return 'pending';
    return this.changedState() ? 'saved' : 'idle';
  });

  /** Results of the last run in this visit: they are not stored, so a reload starts without them. */
  readonly lastRun = this.lastRunState.asReadonly();
  readonly actionError = this.actionErrorState.asReadonly();
  /** The code came back from the local draft: the server did not have it (D-041). */
  readonly draftRestored = this.draftRestoredState.asReadonly();
  readonly running = computed(() => this.isCurrent(this.runningIdState()));
  readonly submitting = computed(() => this.isCurrent(this.submittingIdState()));

  /** The student changed the code after the last run: its results describe the code before. */
  readonly runOutdated = computed(() => {
    const code = this.lastRunCodeState();
    return code !== undefined && code !== this.attemptState()?.currentCode;
  });

  /** Tests passed out of the total in the last run, while it still describes the code. */
  readonly testCount = computed(() => {
    const run = this.lastRunState();
    if (!run || this.runOutdated()) return undefined;
    return {
      passed: run.results.filter((result) => result.passed).length,
      total: run.results.length,
    };
  });

  private readonly busy = computed(() => this.running() || this.submitting());
  readonly canRun = computed(() => this.editable() && !this.busy());
  /** Only a passed attempt can be submitted (2.4). */
  readonly canSubmit = computed(
    () => this.status() === 'passed' && !this.editingElsewhere() && !this.busy(),
  );

  constructor() {
    // Neither leaving the screen nor signing out loses what the student typed in the last 800 ms:
    // signing out waits for the save, as without a session it would fail.
    const removeTask = inject(AuthStore).beforeSignOut(() => this.saveBeforeLeaving());
    inject(DestroyRef).onDestroy(() => {
      removeTask();
      this.autosave.flush();
    });
  }

  /** Opens the student's attempt at the exercise, or creates it in `in_progress` (2.4). */
  async open(exerciseId: string): Promise<Attempt> {
    this.autosave.flush(); // the previous exercise keeps its last changes
    this.openingId = exerciseId;
    this.attemptState.set(undefined);
    const attempt = await this.attempts.openOrCreate(exerciseId);
    if (this.openingId === exerciseId) this.take(attempt);
    return attempt;
  }

  /**
   * «Seguir aquí», after another tab took the attempt: reads it again, as that tab may have saved
   * newer code, and takes it back. On failure it stays read only, and the student can try again.
   */
  async continueHere(): Promise<void> {
    const current = this.attemptState();
    if (!current) return;
    try {
      const attempt = await this.attempts.openOrCreate(current.exerciseId);
      if (this.attemptState()?.id === attempt.id) this.take(attempt);
    } catch {
      // Still taken elsewhere here: the notice and its button stay
    }
  }

  /** Shows the attempt the server returned, with the local draft if newer, and claims this tab. */
  private take(attempt: Attempt): void {
    const draft = this.restorableDraft(attempt);
    this.attemptState.set(
      draft === undefined ? attempt : { ...attempt, currentCode: draft, status: 'in_progress' },
    );
    this.savedCodeState.set(attempt.currentCode);
    this.saveFailedState.set(false);
    this.changedState.set(draft !== undefined);
    this.draftRestoredState.set(draft !== undefined);
    this.lastRunState.set(undefined);
    this.lastRunCodeState.set(undefined);
    this.actionErrorState.set(undefined);
    // What the server missed goes to it as soon as possible
    if (draft !== undefined) this.autosave.schedule(() => void this.startSave());
    // If another tab takes it, what this one still had goes to the server at once
    this.tabs.claim(attempt.id, () => this.autosave.flush());
  }

  /** Keeps the code the student types and saves it once they stop typing. */
  updateCode(code: string): void {
    const attempt = this.attemptState();
    if (!attempt || !this.editable() || code === attempt.currentCode) return;
    // Editing invalidates the last run, as the server will do on saving (2.4).
    this.attemptState.set({ ...attempt, currentCode: code, status: 'in_progress' });
    saveDraft(attempt.id, { code, base: this.savedCodeState() });
    this.saveFailedState.set(false);
    this.changedState.set(true);
    this.draftRestoredState.set(false);
    this.autosave.schedule(() => void this.startSave());
  }

  /** Saves without waiting, for instance when the tab is hidden. */
  saveNow(): void {
    this.autosave.flush();
  }

  /** Tries again after a save failed. */
  retrySave(): Promise<void> {
    this.autosave.cancel();
    return this.startSave();
  }

  /**
   * Runs every test with the current code, which the runner also saves, as the server does (2.3):
   * the pending autosave is dropped. Never throws: a failure stays in `actionError`.
   */
  async run(): Promise<void> {
    const attempt = this.attemptState();
    if (!attempt || !this.canRun()) return;
    this.autosave.cancel();
    this.actionErrorState.set(undefined);
    this.runningIdState.set(attempt.id);
    try {
      // A save on its way could land after the run and leave the code out of step with its status
      await this.saving;
      const before = this.attemptState();
      if (before?.id !== attempt.id) return;
      const code = before.currentCode;
      const result = await this.runner.run(attempt.id, code);
      const current = this.attemptState();
      if (current?.id !== attempt.id) return;
      this.lastRunState.set(result);
      this.lastRunCodeState.set(code);
      this.savedCodeState.set(code);
      if (current.currentCode === code) clearDraft(attempt.id);
      // Code typed while it ran is newer than the run: the attempt stays in progress until saved
      this.attemptState.set({
        ...current,
        status: current.currentCode === code ? result.status : 'in_progress',
      });
    } catch (error) {
      if (this.attemptState()?.id !== attempt.id) return;
      this.actionErrorState.set({ action: 'run', error });
      // The autosave was dropped for the run: the code still has to reach the server
      if (this.hasUnsavedChanges()) this.autosave.schedule(() => void this.startSave());
    } finally {
      if (this.runningIdState() === attempt.id) this.runningIdState.set(undefined);
    }
  }

  /**
   * From `passed` to `submitted`, which freezes the code (2.4). True once submitted; a failure
   * stays in `actionError`.
   */
  async submit(): Promise<boolean> {
    const attempt = this.attemptState();
    if (!attempt || !this.canSubmit()) return false;
    this.actionErrorState.set(undefined);
    this.submittingIdState.set(attempt.id);
    try {
      const submitted = await this.attempts.submit(attempt.id);
      if (this.attemptState()?.id !== attempt.id) return false;
      this.attemptState.set(submitted);
      this.savedCodeState.set(submitted.currentCode);
      clearDraft(attempt.id);
      return true;
    } catch (error) {
      if (this.attemptState()?.id === attempt.id) {
        this.actionErrorState.set({ action: 'submit', error });
      }
      return false;
    } finally {
      if (this.submittingIdState() === attempt.id) this.submittingIdState.set(undefined);
    }
  }

  /** Sends the pending code now and waits for every save on its way. */
  private saveBeforeLeaving(): Promise<void> {
    this.autosave.flush();
    return this.saving;
  }

  /**
   * The code of the local draft, if it is newer than the server's: the attempt is open for changes
   * and the server has not changed it since the draft began (another device). Any other is dropped.
   */
  private restorableDraft(attempt: Attempt): string | undefined {
    const draft = readDraft(attempt.id);
    const usable =
      draft &&
      attempt.status !== 'submitted' &&
      draft.base === attempt.currentCode &&
      draft.code !== attempt.currentCode;
    if (usable) return draft.code;
    if (draft) clearDraft(attempt.id);
    return undefined;
  }

  private isCurrent(attemptId: string | undefined): boolean {
    return attemptId !== undefined && attemptId === this.attemptState()?.id;
  }

  /** One save at a time: another one asked for meanwhile goes once that one ends. */
  private startSave(): Promise<void> {
    if (this.savingState()) {
      this.saveAgain = true;
    } else {
      this.saving = this.save();
    }
    return this.saving;
  }

  /** Never throws: a failure stays in `saveStatus`, and the code stays in the store. */
  private async save(): Promise<void> {
    const attempt = this.attemptState();
    if (!attempt || attempt.currentCode === this.savedCodeState()) return;
    const code = attempt.currentCode;
    this.savingState.set(true);
    try {
      const saved = await this.attempts.saveCode(attempt.id, code);
      // Only the attempt still open takes the answer, keeping what was typed meanwhile.
      const current = this.attemptState();
      if (current?.id === saved.id) {
        this.savedCodeState.set(code);
        this.saveFailedState.set(false);
        this.attemptState.set({
          ...saved,
          currentCode: current.currentCode,
          status: current.status,
        });
        // The draft now starts from what the server has, or is no longer needed
        if (current.currentCode === code) {
          clearDraft(saved.id);
        } else {
          saveDraft(saved.id, { code: current.currentCode, base: code });
        }
      }
    } catch {
      if (this.attemptState()?.id === attempt.id) this.saveFailedState.set(true);
    } finally {
      this.savingState.set(false);
    }
    if (this.saveAgain) {
      this.saveAgain = false;
      await this.save();
    }
  }
}
