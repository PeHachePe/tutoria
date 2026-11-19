import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';

import type { PlannedGroup } from '../../data/block-service';
import { datesNote } from '../../shared/dates-note';

/** A group whose blocks can be copied, as the selector names it. */
export interface CopySource {
  readonly group: PlannedGroup;
  readonly label: string;
}

export interface CopyBlocksDialogData {
  /** The group the blocks go into, and how many it has: the copies go after them. */
  readonly target: CopySource;
  readonly blockCount: number;
  /** The other groups of the user, those of the same subject first. */
  readonly sources: readonly CopySource[];
  /** Copies them; the dialog stays open, with the error, if it fails. */
  readonly copy: (sourceGroupId: string, withDates: boolean) => Promise<void>;
}

interface CopyBlocksModel {
  readonly sourceId: string;
  readonly withDates: boolean;
}

/**
 * «Copiar de otro grupo» (5.2c, D-079): the blocks of another group of the user after those of this
 * one, with their exercises, order and visibility and, if wanted, their dates moved to the year of
 * this group. For the same class of last year or a parallel group.
 */
@Component({
  selector: 'app-copy-blocks-dialog',
  imports: [
    FormRoot,
    FormField,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatError,
    MatSelect,
    MatOption,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@copyBlocks.title">Copiar bloques en {{ data.target.label }}</h2>
    <form [formRoot]="copyForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md">
          <p class="mb-2 text-body-medium text-on-surface-variant">
            <span i18n="@@copyBlocks.intro">{data.blockCount, plural,
              =0 {Con sus ejercicios, su orden y su visibilidad, como los primeros de este grupo.}
              =1 {Con sus ejercicios, su orden y su visibilidad, después del bloque que ya tiene.}
              other {
                Con sus ejercicios, su orden y su visibilidad, después de los {{ data.blockCount }}
                bloques que ya tiene.
              }
            }</span>
          </p>
          <mat-form-field>
            <mat-label i18n="@@copyBlocks.source">Copiar de</mat-label>
            <mat-select [formField]="copyForm.sourceId">
              @for (source of data.sources; track source.group.id) {
                <mat-option [value]="source.group.id">{{ source.label }}</mat-option>
              }
            </mat-select>
            @if (copyForm.sourceId().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          <mat-checkbox
            [formField]="copyForm.withDates"
            aria-describedby="copy-dates-note"
            i18n="@@copyBlocks.dates"
            >Con sus fechas</mat-checkbox
          >
          <p id="copy-dates-note" class="ms-10 text-body-small text-on-surface-variant">
            @if (!copyForm.withDates().value()) {
              <span i18n="@@copyBlocks.dates.none"
                >Los bloques llegan sin fechas de apertura ni de entrega.</span
              >
            } @else if (note(); as note) {
              {{ note }}
            } @else {
              <span i18n="@@copyBlocks.dates.choose">Elige el grupo para ver dónde caen.</span>
            }
          </p>
          @if (failure()) {
            <p class="mt-2 text-body-medium text-error" role="alert" i18n="@@copyBlocks.failed">
              No se han podido copiar los bloques. Inténtalo de nuevo.
            </p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@copyBlocks.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="copyForm().submitting()">
          @if (copyForm().submitting()) {
            <span i18n="@@copyBlocks.copying">Copiando…</span>
          } @else {
            <span i18n="@@copyBlocks.submit">Copiar los bloques</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CopyBlocksDialog {
  protected readonly data = inject<CopyBlocksDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CopyBlocksDialog, boolean>>(MatDialogRef);

  protected readonly failure = signal(false);

  private readonly model = signal<CopyBlocksModel>({ sourceId: '', withDates: true });

  protected readonly copyForm = form(
    this.model,
    (path) => {
      required(path.sourceId, {
        message: $localize`:@@copyBlocks.error.source:Elige el grupo`,
      });
    },
    {
      submission: {
        action: async (field) => {
          this.failure.set(false);
          const { sourceId, withDates } = field().value();
          try {
            await this.data.copy(sourceId, withDates);
            this.ref.close(true);
          } catch {
            this.failure.set(true);
          }
          return undefined;
        },
      },
    },
  );

  /** Where the dates fall in this group, once a group is chosen. */
  protected readonly note = computed(() => {
    const source = this.data.sources.find(({ group }) => group.id === this.model().sourceId);
    return source ? datesNote(source.group.schoolYear, this.data.target.group.schoolYear) : null;
  });
}
