import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';

import { Mascot } from '../../../shared/mascot/mascot';
import { filterTasks, isTaskDone, orderTasks, taskAvailability } from '../guide-progress';
import { GuideStore } from '../guide-store';
import type { GuideTask } from '../guide-task';

/** The id of the title, which names the dialog (`ariaLabelledBy` of HelpButton). */
export const HELP_PANEL_TITLE_ID = 'help-panel-title';

/** A task as a row of the panel: done, or why it is not possible yet. */
interface TaskRow {
  readonly task: GuideTask;
  readonly done: boolean;
  /** Null when it can start. */
  readonly unavailable: string | null;
}

/**
 * The help panel (2.12, ficha 13): the first steps with their progress, «¿Cómo se hace…?» with a
 * filter, the beacons of the screen and the welcome. Choosing anything closes it: the tour or the
 * beacons start once it has closed (TourRunner).
 */
@Component({
  selector: 'app-help-panel',
  imports: [
    NgTemplateOutlet,
    MatButton,
    MatIconButton,
    MatIcon,
    MatDialogContent,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatProgressBar,
    Mascot,
  ],
  templateUrl: './help-panel.html',
})
export class HelpPanel {
  protected readonly guide = inject(GuideStore);
  private readonly dialogRef = inject(MatDialogRef<HelpPanel>);

  protected readonly titleId = HELP_PANEL_TITLE_ID;
  protected readonly query = signal('');

  protected readonly firstSteps = this.guide.firstSteps;
  protected readonly firstStepRows = computed(() =>
    this.guide.firstStepTasks().map((task) => this.row(task)),
  );
  /** All done and not acknowledged yet: the mascot celebrates once, instead of the list. */
  protected readonly celebrating = computed(() => {
    const { total, next } = this.firstSteps();
    return total > 0 && next === undefined && !this.guide.state().firstStepsHidden;
  });
  /** Only drawn while there are first steps to show, so never with a total of zero. */
  protected readonly percent = computed(() => {
    const { done, total } = this.firstSteps();
    return (done / total) * 100;
  });
  /** With a filter, every task matches; without one, the first steps are above already. */
  protected readonly howToRows = computed(() => {
    const query = this.query().trim();
    const tasks = query
      ? orderTasks(filterTasks(this.guide.tasks(), query), this.guide.screen(), [])
      : orderTasks(
          this.guide.tasks(),
          this.guide.screen(),
          this.guide.firstStepsShown() ? this.guide.firstStepTasks() : [],
        );
    return tasks.map((task) => this.row(task));
  });

  constructor() {
    // What the data says may have changed since the area opened
    this.guide.refreshFacts();
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected start(row: TaskRow): void {
    if (row.unavailable !== null) return;
    this.dialogRef.close();
    void this.guide.startTask(row.task);
  }

  /** Every piece of the screen open, one after the other. */
  protected startScreenTour(tour: GuideTask): void {
    this.dialogRef.close();
    void this.guide.startTask(tour);
  }

  protected toggleBeacons(): void {
    this.dialogRef.close();
    if (this.guide.beaconsShown()) {
      this.guide.hideBeacons();
    } else {
      void this.guide.showBeacons();
    }
  }

  protected showWelcome(): void {
    this.dialogRef.close();
    void this.guide.startWelcome();
  }

  protected hideFirstSteps(): void {
    this.guide.hideFirstSteps();
  }

  private row(task: GuideTask): TaskRow {
    return {
      task,
      done: isTaskDone(task, this.guide.state(), this.guide.facts()),
      unavailable: taskAvailability(task, this.guide.facts()),
    };
  }
}
