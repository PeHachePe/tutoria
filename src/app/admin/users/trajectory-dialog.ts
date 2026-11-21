import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import type { PreviousClass } from '../../data/group-service';
import { outcomeLook } from '../../shared/class-outcome';

/** Whose classes, and which, the latest first. */
export interface TrajectoryDialogData {
  readonly name: string;
  readonly classes: readonly PreviousClass[];
}

/**
 * The classes of a student year by year, with the final evaluation of each (5.2g, D-084): what the
 * administration looks at before reactivating an account, or to know whether somebody was here
 * already. Only to read: each evaluation is changed by the teachers of its class.
 */
@Component({
  selector: 'app-trajectory-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton, MatIcon],
  template: `
    <h2 mat-dialog-title i18n="@@trajectoryDialog.title">Trayectoria de {{ data.name }}</h2>
    <mat-dialog-content>
      <ol class="flex flex-col gap-2 sm:min-w-md">
        @for (row of rows; track $index) {
          <li
            class="flex items-center justify-between gap-4 rounded-xl bg-surface-container px-4 py-2"
          >
            <span class="flex flex-col">
              <span class="text-body-large">{{ row.name }}</span>
              <span class="text-body-small text-on-surface-variant">{{ row.schoolYear }}</span>
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full py-1 ps-2 pe-3 text-label-large"
              [class]="row.look.chip"
            >
              <mat-icon class="size-5! text-[1.25rem]!" aria-hidden="true">{{
                row.look.icon
              }}</mat-icon>
              {{ row.look.label }}
            </span>
          </li>
        }
      </ol>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button matButton type="button" mat-dialog-close i18n="@@trajectoryDialog.close">
        Cerrar
      </button>
    </mat-dialog-actions>
  `,
})
export class TrajectoryDialog {
  protected readonly data = inject<TrajectoryDialogData>(MAT_DIALOG_DATA);

  protected readonly rows = this.data.classes.map((row) => ({
    ...row,
    look: outcomeLook(row.outcome),
  }));
}
