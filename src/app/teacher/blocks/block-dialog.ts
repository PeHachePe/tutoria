import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MatDatepicker,
  MatDatepickerInput,
  MatDatepickerToggle,
} from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import {
  MatTimepicker,
  MatTimepickerInput,
  MatTimepickerToggle,
} from '@angular/material/timepicker';

import { LANGUAGE_OPTIONS } from '../../core/i18n/locale';
import { LOCALE_NAMES } from '../../core/i18n/locale-names';
import { provideLocalizedDateAdapter } from '../../core/i18n/localized-date-adapter';
import type { BlockDraft } from '../../data/block-service';
import type { ClassBlock } from '../../data/exercise';
import type { ContentLocale } from '../../data/localized-text';
import { DEFAULT_OPENING_TIME } from '../../shared/due-date';
import { blockSchema, toBlockDraft, toBlockFormModel } from './block-form';

/** The block to edit, or null for a new one, and the language of the interface. */
export interface BlockDialogData {
  readonly block: ClassBlock | null;
  readonly locale: ContentLocale;
  /** Saves the block; the dialog stays open, with the error, if it fails. */
  readonly save: (draft: BlockDraft) => Promise<void>;
}

/**
 * Creates a block or changes its title, its translations, whether the students see it (4.3b, D-046)
 * and the day it opens to them (4.3d, D-060): «Tema 1: Bucles», «Recuperación del tema 2». The
 * title is required in the language it is written in; the others are optional translations (D-045).
 */
@Component({
  selector: 'app-block-dialog',
  // The adapter takes the language of the build (LOCALE_ID)
  providers: [provideLocalizedDateAdapter()],
  imports: [
    FormRoot,
    FormField,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatSuffix,
    MatDatepicker,
    MatDatepickerInput,
    MatDatepickerToggle,
    MatTimepicker,
    MatTimepickerInput,
    MatTimepickerToggle,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.block) {
        <span i18n="@@blockDialog.edit">Editar el bloque</span>
      } @else {
        <span i18n="@@blockDialog.new">Nuevo bloque</span>
      }
    </h2>
    <form [formRoot]="blockForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 app-form-dialog">
          <!-- The title first: it is what the dialog is for, and it takes the focus. The limit of
               length reaches the inputs as maxlength, so only a missing title is an error -->
          @let title = source();
          <mat-form-field>
            <mat-label i18n="@@blockDialog.title">Título</mat-label>
            <input matInput [formField]="title.field" [attr.lang]="title.locale" />
            <mat-hint i18n="@@blockDialog.title.hint"
              >Como «Tema 1: Bucles» o «Recuperación del tema 2»</mat-hint
            >
            @if (title.field().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label i18n="@@blockDialog.source">Idioma en que lo escribes</mat-label>
            <mat-select [formField]="blockForm.sourceLocale">
              @for (language of languages; track language.locale) {
                <mat-option [value]="language.locale" [attr.lang]="language.locale">{{
                  language.label
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @for (language of translations(); track language.locale) {
            <mat-form-field>
              <mat-label i18n="@@blockDialog.translation">Título en {{ language.label }}</mat-label>
              <input matInput [formField]="language.field" [attr.lang]="language.locale" />
              <mat-hint i18n="@@blockDialog.translation.hint"
                >Opcional: sin él, se ve el original</mat-hint
              >
            </mat-form-field>
          }
          <mat-slide-toggle [formField]="blockForm.isHidden" i18n="@@blockDialog.hidden"
            >Oculto para los alumnos mientras lo preparas</mat-slide-toggle
          >
          <!-- A resit or an exam appears by itself on its day: until then, as if hidden -->
          <div class="mt-4 flex flex-col gap-x-4 sm:flex-row">
            <mat-form-field class="sm:flex-3">
              <mat-label i18n="@@blockDialog.opensDay">Se abre a los alumnos el día</mat-label>
              <input matInput [matDatepicker]="dayPicker" [formField]="blockForm.opensDay" />
              <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
              <mat-datepicker #dayPicker />
              <mat-hint i18n="@@blockDialog.opensDay.hint"
                >Opcional: hasta ese día no lo ven</mat-hint
              >
              @if (blockForm.opensDay().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field class="sm:flex-2">
              <mat-label i18n="@@blockDialog.opensTime">Hora</mat-label>
              <input matInput [matTimepicker]="timePicker" [formField]="blockForm.opensTime" />
              <mat-timepicker-toggle matIconSuffix [for]="timePicker" />
              <mat-timepicker #timePicker />
              <mat-hint i18n="@@blockDialog.opensTime.hint"
                >Sin hora, a las {{ openingTime }}</mat-hint
              >
            </mat-form-field>
          </div>
          @if (failed()) {
            <p class="text-body-medium text-error" role="alert" i18n="@@blockDialog.failed">
              No se ha podido guardar. Inténtalo de nuevo.
            </p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@blockDialog.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="blockForm().submitting()">
          @if (blockForm().submitting()) {
            <span i18n="@@blockDialog.saving">Guardando…</span>
          } @else if (data.block) {
            <span i18n="@@blockDialog.save">Guardar</span>
          } @else {
            <span i18n="@@blockDialog.create">Crear el bloque</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class BlockDialog {
  protected readonly data = inject<BlockDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<BlockDialog, boolean>>(MatDialogRef);

  protected readonly languages = LANGUAGE_OPTIONS;
  protected readonly failed = signal(false);
  protected readonly openingTime = `${DEFAULT_OPENING_TIME.hours}:${String(DEFAULT_OPENING_TIME.minutes).padStart(2, '0')}`;

  private readonly model = signal(toBlockFormModel(this.data.block, this.data.locale));

  protected readonly blockForm = form(this.model, blockSchema, {
    submission: {
      action: async (field) => {
        this.failed.set(false);
        try {
          await this.data.save(toBlockDraft(field().value()));
          this.ref.close(true);
        } catch {
          this.failed.set(true);
        }
        return undefined;
      },
    },
  });

  /** The title in the language it is written in. */
  protected readonly source = computed(() => {
    const locale = this.blockForm.sourceLocale().value();
    return { locale, field: this.blockForm.titles[locale] };
  });

  /** The titles in the other languages, optional. */
  protected readonly translations = computed(() =>
    LANGUAGE_OPTIONS.filter(({ locale }) => locale !== this.source().locale).map(({ locale }) => ({
      locale,
      label: LOCALE_NAMES[locale],
      field: this.blockForm.titles[locale],
    })),
  );
}
