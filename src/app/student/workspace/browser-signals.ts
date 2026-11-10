import { DestroyRef, inject, Service } from '@angular/core';

import { EventLogger } from '../../core/event-logger';
import { AttemptStore } from './attempt-store';

/**
 * An absence shorter than this is not recorded: clicking the address bar, opening the developer
 * tools or a notification take the focus for a moment, and would only add noise for the teacher.
 */
export const MIN_AWAY_MS = 2000;

/** An absence from the window, from the moment it started. */
interface Absence {
  readonly attemptId: string;
  readonly since: number;
  /** Whether its `focus_lost` was recorded: only then is the return recorded. */
  recorded: boolean;
}

/**
 * The signals only the browser knows (2.8), for the attempt open for changes: pastes from outside the
 * code and absences from the window, which the memory calls «cambios de ventana» (RF-20): another
 * tab or another app. Provided by the workspace route with AttemptStore; the page passes on the
 * events of the window and the editor, and EventLogger sends what is recorded.
 */
@Service({ autoProvided: false })
export class BrowserSignals {
  private readonly store = inject(AttemptStore);
  private readonly logger = inject(EventLogger);

  /** Not state: nothing is drawn from it, so plain fields instead of signals. */
  private absence: Absence | undefined;
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.leaveTimer));
  }

  /** The student pasted text from outside the code into the editor. */
  pasted(length: number): void {
    const attemptId = this.openAttemptId();
    if (!attemptId) return;
    this.logger.log({
      attemptId,
      type: 'paste',
      timestamp: isoTime(Date.now()),
      detail: { length },
    });
  }

  /** The window lost the focus: it becomes an absence if it lasts MIN_AWAY_MS. */
  left(): void {
    if (this.absence) return;
    const attemptId = this.openAttemptId();
    if (!attemptId) return;
    const absence: Absence = { attemptId, since: Date.now(), recorded: false };
    this.absence = absence;
    this.leaveTimer = setTimeout(() => this.recordLeave(absence), MIN_AWAY_MS);
  }

  /**
   * The tab was hidden: an absence for sure, recorded and sent now, as the page may not get another
   * chance (a phone can close it without warning).
   */
  hidden(): void {
    this.left();
    if (this.absence && !this.absence.recorded) {
      this.recordLeave(this.absence);
      void this.logger.flush();
    }
  }

  /** The window has the focus again: the return of a recorded absence, with the time away. */
  returned(): void {
    const absence = this.absence;
    if (!absence) return;
    clearTimeout(this.leaveTimer);
    this.absence = undefined;
    if (!absence.recorded) return;
    const now = Date.now();
    this.logger.log({
      attemptId: absence.attemptId,
      type: 'focus_gained',
      timestamp: isoTime(now),
      detail: { awayMs: now - absence.since },
    });
  }

  private recordLeave(absence: Absence): void {
    clearTimeout(this.leaveTimer);
    absence.recorded = true;
    this.logger.log({
      attemptId: absence.attemptId,
      type: 'focus_lost',
      timestamp: isoTime(absence.since),
      detail: null,
    });
  }

  /** A submitted attempt is only read: nothing the student does there is a signal. */
  private openAttemptId(): string | undefined {
    return this.store.editable() ? this.store.attempt()?.id : undefined;
  }
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}
