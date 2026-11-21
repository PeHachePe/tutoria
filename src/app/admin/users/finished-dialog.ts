import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import type { DisableResult, FinishedStudent } from '../../data/admin-service';
import { outcomeLook, previousClassLine } from '../../shared/class-outcome';
import { userActionMessage } from './user-action-message';

/** Who is left to disable, and how to disable them. */
export interface FinishedDialogData {
  readonly students: readonly FinishedStudent[];
  /** Disables them; the dialog stays open, with the error, if it fails. */
  readonly disable: (userIds: readonly string[]) => Promise<DisableResult>;
}

/**
 * The accounts of the students who finished the cycle or left the school, after the final
 * evaluation of their teachers (5.2g, D-084): all chosen, each with the class that says so, to
 * disable them at once. The teachers do not disable accounts (D-072): the administration does,
 * here. It closes with what was done.
 */
@Component({
  selector: 'app-finished-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatCheckbox,
    MatIcon,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@finishedDialog.title">Cuentas de quien ya terminó</h2>
    <mat-dialog-content>
      <div class="flex flex-col gap-3 sm:min-w-md">
        <p class="text-body-medium" i18n="@@finishedDialog.text">
          Según la evaluación final de sus docentes, han titulado o causado baja. Al desactivarlas
          dejan de poder entrar; su trabajo se conserva y cada cuenta se puede volver a activar.
        </p>
        <ul class="flex max-h-80 flex-col overflow-y-auto border-y border-outline-variant py-1">
          @for (row of rows; track row.finished.student.id) {
            <li>
              <mat-checkbox [checked]="isChosen(row.finished)" (change)="toggle(row.finished)">
                <span class="flex flex-col">
                  <span>{{ row.finished.student.name }}</span>
                  <span class="flex items-center gap-1 text-body-small text-on-surface-variant">
                    <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">{{
                      row.look.icon
                    }}</mat-icon>
                    {{ row.line }}
                  </span>
                </span>
              </mat-checkbox>
            </li>
          }
        </ul>
        @if (failure(); as message) {
          <p class="text-body-medium text-error" role="alert">{{ message }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button matButton type="button" mat-dialog-close i18n="@@finishedDialog.cancel">
        Cancelar
      </button>
      <button
        matButton="filled"
        type="button"
        [disabled]="chosen().size === 0 || saving()"
        (click)="disable()"
      >
        @if (saving()) {
          <span i18n="@@finishedDialog.disabling">Desactivando…</span>
        } @else {
          <span i18n="@@finishedDialog.disable">Desactivar {{ chosen().size }}</span>
        }
      </button>
    </mat-dialog-actions>
  `,
})
export class FinishedDialog {
  protected readonly data = inject<FinishedDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<FinishedDialog, DisableResult>>(MatDialogRef);

  /** «Titula · 2.º DAW A · 2025/26», under each name. */
  protected readonly rows = this.data.students.map((finished) => {
    const { outcome, className: name, schoolYear } = finished;
    return {
      finished,
      look: outcomeLook(outcome),
      line: previousClassLine({ name, schoolYear, outcome }),
    };
  });

  /** All of them, at first. */
  protected readonly chosen = signal<ReadonlySet<string>>(
    new Set(this.data.students.map(({ student }) => student.id)),
  );
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected isChosen({ student }: FinishedStudent): boolean {
    return this.chosen().has(student.id);
  }

  protected toggle({ student }: FinishedStudent): void {
    this.chosen.update((chosen) => {
      const next = new Set(chosen);
      if (!next.delete(student.id)) next.add(student.id);
      return next;
    });
  }

  protected async disable(): Promise<void> {
    this.saving.set(true);
    this.failure.set(null);
    try {
      // In the order of the list
      const ids = this.data.students
        .map(({ student }) => student.id)
        .filter((id) => this.chosen().has(id));
      this.ref.close(await this.data.disable(ids));
    } catch (error) {
      this.failure.set(userActionMessage('status', error));
    } finally {
      this.saving.set(false);
    }
  }
}
