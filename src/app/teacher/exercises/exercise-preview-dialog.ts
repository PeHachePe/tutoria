import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';

import { exerciseText, type ContentLocale } from '../../data/localized-text';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import {
  type StatementContent,
  StatementZone,
} from '../../student/workspace/statement-zone/statement-zone';

/** What the preview shows: the exercise as it is in the form, in one language. */
export interface ExercisePreviewData {
  readonly content: StatementContent;
  readonly locale: ContentLocale;
}

/**
 * The exercise as the student will read it (CU-05, 5b): its title, difficulty and topics, and the
 * statement zone of the workspace itself, with the examples and the hidden checks, before saving.
 */
@Component({
  selector: 'app-exercise-preview-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    DifficultyChip,
    StatementZone,
  ],
  template: `
    <h2 mat-dialog-title [attr.lang]="text.locale">{{ text.title }}</h2>
    <mat-dialog-content>
      <!-- Material styles the content itself, so the layout goes in a box of our own (4.8) -->
      <div class="flex flex-col gap-3">
        <p class="flex flex-wrap items-center gap-2 text-body-medium text-on-surface-variant">
          <app-difficulty-chip [difficulty]="data.content.exercise.difficulty" />
          <span [attr.lang]="text.locale">{{ text.topics.join(', ') }}</span>
        </p>
        <app-statement-zone
          [detail]="data.content"
          [contentLocale]="data.locale"
          [compact]="true"
        />
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button matButton mat-dialog-close type="button" i18n="@@preview.close">Cerrar</button>
    </mat-dialog-actions>
  `,
})
export class ExercisePreviewDialog {
  protected readonly data = inject<ExercisePreviewData>(MAT_DIALOG_DATA);
  protected readonly text = exerciseText(this.data.content.exercise, this.data.locale);
}
