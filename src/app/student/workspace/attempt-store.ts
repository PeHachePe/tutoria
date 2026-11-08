import { computed, DestroyRef, inject, Service, signal } from '@angular/core';

import type { Attempt } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { createDebouncer } from '../../shared/create-debouncer';

/** The code is saved once the student stops typing for this long (4.5). */
export const AUTOSAVE_DELAY_MS = 800;

/**
 * Where the code stands against the server: `pending` while the autosave waits for the student to
 * stop typing, `saving` while the answer is on its way, `saved` once the latest code is there, and
 * `error` if the last save failed. `idle` before the first change.
 */
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * The attempt the student is working on, shared by the editor, the results, «Entregar» and the
 * tutor (4.5). Provided by the workspace route, so it lives while the student is on an exercise.
 * Running the tests and submitting come in step 1.5.
 */
@Service({ autoProvided: false })
export class AttemptStore {
  private readonly attempts = inject(AttemptService);
  private readonly autosave = createDebouncer(AUTOSAVE_DELAY_MS);

  private readonly attemptState = signal<Attempt | undefined>(undefined);
  /** Code the server has, to know whether there is anything left to save. */
  private readonly savedCodeState = signal('');
  private readonly savingState = signal(false);
  private readonly saveFailedState = signal(false);
  private readonly changedState = signal(false);
  /** Exercise of the latest `open()`, so an answer that arrives late does not overwrite the new one. */
  private openingId: string | undefined;
  /** Another save was asked for while one was on its way: it goes once that one ends. */
  private saveAgain = false;

  readonly attempt = this.attemptState.asReadonly();
  readonly status = computed(() => this.attemptState()?.status ?? 'not_started');
  /** A submitted attempt only shows its code (2.4). */
  readonly readonly = computed(() => this.status() === 'submitted');

  readonly hasUnsavedChanges = computed(
    () => (this.attemptState()?.currentCode ?? '') !== this.savedCodeState(),
  );

  readonly saveStatus = computed<SaveStatus>(() => {
    if (this.savingState()) return 'saving';
    if (this.saveFailedState()) return 'error';
    if (this.hasUnsavedChanges()) return 'pending';
    return this.changedState() ? 'saved' : 'idle';
  });

  constructor() {
    // Leaving the screen does not lose what the student typed in the last 800 ms.
    inject(DestroyRef).onDestroy(() => this.autosave.flush());
  }

  /** Opens the student's attempt at the exercise, or creates it in `in_progress` (2.4). */
  async open(exerciseId: string): Promise<Attempt> {
    this.autosave.flush(); // the previous exercise keeps its last changes
    this.openingId = exerciseId;
    this.attemptState.set(undefined);
    const attempt = await this.attempts.openOrCreate(exerciseId);
    if (this.openingId === exerciseId) {
      this.attemptState.set(attempt);
      this.savedCodeState.set(attempt.currentCode);
      this.saveFailedState.set(false);
      this.changedState.set(false);
    }
    return attempt;
  }

  /** Keeps the code the student types and saves it once they stop typing. */
  updateCode(code: string): void {
    const attempt = this.attemptState();
    if (!attempt || this.readonly() || code === attempt.currentCode) return;
    // Editing invalidates the last run, as the server will do on saving (2.4).
    this.attemptState.set({ ...attempt, currentCode: code, status: 'in_progress' });
    this.saveFailedState.set(false);
    this.changedState.set(true);
    this.autosave.schedule(() => void this.save());
  }

  /** Saves without waiting, for instance when the tab is hidden. */
  saveNow(): void {
    this.autosave.flush();
  }

  /** Tries again after a save failed. */
  retrySave(): Promise<void> {
    this.autosave.cancel();
    return this.save();
  }

  /** Never throws: a failure stays in `saveStatus`, and the code stays in the store. */
  private async save(): Promise<void> {
    if (this.savingState()) {
      this.saveAgain = true;
      return;
    }
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
