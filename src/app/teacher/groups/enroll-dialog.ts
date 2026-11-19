import { Component, computed, DestroyRef, inject, resource, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatChipRemove, MatChipRow, MatChipSet } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';

import {
  MAX_ENROLLMENT_BATCH,
  MIN_STUDENT_SEARCH_LENGTH,
  type UserRef,
} from '../../data/group-service';
import { createDebouncer } from '../../shared/create-debouncer';
import { groupActionMessage } from './group-action-message';

/** How long the search waits after the last key before asking the server. */
export const SEARCH_DELAY_MS = 300;

export interface EnrollDialogData {
  readonly groupName: string;
  /** Active students who are not in the group yet. */
  readonly search: (text: string) => Promise<UserRef[]>;
  /** Enrolls them; the dialog stays open, with the error, if it fails. */
  readonly enroll: (students: readonly UserRef[]) => Promise<void>;
}

/**
 * Finds students by name or email and enrolls the chosen ones at once (RF-16), up to the batch the
 * server takes. The accounts are created by the administration (5.1b): here they are only found.
 */
@Component({
  selector: 'app-enroll-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatCheckbox,
    MatChipSet,
    MatChipRow,
    MatChipRemove,
    MatFormField,
    MatLabel,
    MatHint,
    MatPrefix,
    MatIcon,
    MatInput,
    MatProgressBar,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@enrollDialog.title">Matricular en {{ data.groupName }}</h2>
    <mat-dialog-content>
      <div class="flex flex-col gap-3 pt-2 sm:min-w-md">
        <mat-form-field>
          <mat-label i18n="@@enrollDialog.search">Buscar alumnos por nombre o correo</mat-label>
          <mat-icon matPrefix aria-hidden="true">search</mat-icon>
          <input
            matInput
            type="search"
            autocomplete="off"
            spellcheck="false"
            (input)="onInput($event)"
          />
          <mat-hint i18n="@@enrollDialog.search.hint">Escribe al menos dos letras</mat-hint>
        </mat-form-field>

        @if (chosen().length > 0) {
          <mat-chip-set aria-label="Elegidos" i18n-aria-label="@@enrollDialog.chosen">
            @for (student of chosen(); track student.id) {
              <mat-chip-row (removed)="toggle(student)">
                {{ student.name }}
                <button matChipRemove [attr.aria-label]="removeLabel(student)">
                  <mat-icon aria-hidden="true">cancel</mat-icon>
                </button>
              </mat-chip-row>
            }
          </mat-chip-set>
        }
        @if (full()) {
          <p class="text-body-medium text-on-surface-variant" i18n="@@enrollDialog.full">
            Como mucho {{ maxBatch }} de una vez: matricula estos y busca los demás después.
          </p>
        }

        <div class="h-1">
          @if (results.isLoading()) {
            <mat-progress-bar mode="indeterminate" class="rounded-full" />
          }
        </div>
        <div aria-live="polite" class="max-h-72 overflow-y-auto">
          @if (results.error()) {
            <p class="text-body-medium text-error" i18n="@@enrollDialog.error">
              No se ha podido buscar. Inténtalo de nuevo.
            </p>
          } @else if (results.hasValue() && results.value().length === 0) {
            <p class="text-body-medium text-on-surface-variant" i18n="@@enrollDialog.none">
              Ningún alumno coincide. Las cuentas las crea la administración.
            </p>
          } @else if (results.hasValue()) {
            <ul class="flex flex-col">
              @for (student of results.value(); track student.id) {
                <li>
                  <mat-checkbox
                    [checked]="isChosen(student)"
                    [disabled]="full() && !isChosen(student)"
                    (change)="toggle(student)"
                  >
                    <span class="flex flex-col">
                      <span>{{ student.name }}</span>
                      <span class="text-body-small text-on-surface-variant">{{
                        student.email
                      }}</span>
                    </span>
                  </mat-checkbox>
                </li>
              }
            </ul>
          }
        </div>
        @if (failure(); as message) {
          <p class="text-body-medium text-error" role="alert">{{ message }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button matButton type="button" mat-dialog-close i18n="@@enrollDialog.cancel">
        Cancelar
      </button>
      <button
        matButton="filled"
        type="button"
        [disabled]="chosen().length === 0 || saving()"
        (click)="submit()"
      >
        @if (saving()) {
          <span i18n="@@enrollDialog.saving">Matriculando…</span>
        } @else {
          <span i18n="@@enrollDialog.submit">Matricular ({{ chosen().length }})</span>
        }
      </button>
    </mat-dialog-actions>
  `,
})
export class EnrollDialog {
  protected readonly data = inject<EnrollDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<EnrollDialog, boolean>>(MatDialogRef);

  protected readonly maxBatch = MAX_ENROLLMENT_BATCH;

  /** The text searched for, once typing stops. */
  private readonly search = signal('');
  private readonly debouncer = createDebouncer(SEARCH_DELAY_MS);

  /** Idle below the minimum: the hint says why nothing is listed. */
  protected readonly results = resource({
    params: () => {
      const text = this.search().trim();
      return text.length >= MIN_STUDENT_SEARCH_LENGTH ? text : undefined;
    },
    loader: ({ params }) => this.data.search(params),
  });

  /** In the order they were chosen. */
  protected readonly chosen = signal<readonly UserRef[]>([]);
  protected readonly full = computed(() => this.chosen().length >= MAX_ENROLLMENT_BATCH);
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.debouncer.cancel());
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.debouncer.schedule(() => this.search.set(text));
  }

  protected isChosen(student: UserRef): boolean {
    return this.chosen().some(({ id }) => id === student.id);
  }

  protected toggle(student: UserRef): void {
    this.chosen.update((chosen) =>
      chosen.some(({ id }) => id === student.id)
        ? chosen.filter(({ id }) => id !== student.id)
        : [...chosen, student],
    );
  }

  protected removeLabel(student: UserRef): string {
    return $localize`:@@enrollDialog.remove:Quitar a ${student.name}:name:`;
  }

  protected async submit(): Promise<void> {
    this.saving.set(true);
    this.failure.set(null);
    try {
      await this.data.enroll(this.chosen());
      this.ref.close(true);
    } catch (error) {
      this.failure.set(groupActionMessage('enroll', error));
    } finally {
      this.saving.set(false);
    }
  }
}
