import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatListOption, MatSelectionList } from '@angular/material/list';
import { MatSlideToggle } from '@angular/material/slide-toggle';

import type { Exercise } from '../../data/exercise';
import { type BankScope, ExerciseService } from '../../data/exercise-service';
import { type ContentLocale, exerciseText } from '../../data/localized-text';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { filterBank, NO_FILTERS } from '../exercises/bank-filter';
import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';

/** Where the exercises go: the block, the subject of its group and what it already has. */
export interface AddExercisesData {
  readonly blockTitle: string;
  readonly subjectId: string;
  readonly subjectName: string;
  readonly assignedIds: readonly string[];
  /** The other blocks of the group where each exercise is, by the id of the exercise. */
  readonly elsewhere: ReadonlyMap<string, readonly string[]>;
  readonly locale: ContentLocale;
  readonly userId: string | undefined;
}

/** The exercises chosen, in the order they were chosen; undefined if cancelled. */
export type AddExercisesResult = readonly Exercise[] | undefined;

/** Enough rows to choose from at a glance; the search narrows the rest. */
export const MAX_SHOWN = 50;

const SKELETON_ROWS = [1, 2, 3, 4];

/**
 * Chooses exercises of the bank for a block (4.3b): those of the subject of the group, or of every
 * subject, with the same search as the bank. Those already in the block are marked and cannot be
 * chosen again (one exercise is only once in a block, D-046).
 */
@Component({
  selector: 'app-add-exercises-dialog',
  imports: [
    GuideAnchor,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatIcon,
    MatInput,
    MatSelectionList,
    MatListOption,
    MatSlideToggle,
    DifficultyChip,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@addExercises.title">Añadir ejercicios</h2>
    <mat-dialog-content>
      <div class="flex flex-col gap-3 sm:min-w-xl" [attr.aria-busy]="bank.isLoading()">
        <p class="text-body-medium text-on-surface-variant" i18n="@@addExercises.to">
          A «{{ data.blockTitle }}», al final del bloque.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <mat-form-field subscriptSizing="dynamic" class="w-full sm:w-72">
            <mat-label i18n="@@addExercises.search">Buscar</mat-label>
            <mat-icon matPrefix aria-hidden="true">search</mat-icon>
            <input
              matInput
              type="search"
              placeholder="Título, contenido o función"
              i18n-placeholder="@@bank.search.placeholder"
              [value]="search()"
              (input)="onSearch($event)"
            />
          </mat-form-field>
          <mat-slide-toggle
            [checked]="everySubject()"
            (change)="everySubject.set($event.checked)"
            i18n="@@addExercises.everySubject"
            >Todas las asignaturas, no solo {{ data.subjectName }}</mat-slide-toggle
          >
        </div>

        @if (bank.error(); as error) {
          <app-load-error [error]="error" (retry)="bank.reload()" />
        } @else if (bank.status() === 'loading') {
          <app-loading-skeleton label="Cargando los ejercicios…" i18n-label="@@bank.loading">
            <div class="flex flex-col gap-2">
              @for (row of skeletonRows; track row) {
                <app-skeleton class="h-14 w-full rounded-xl" />
              }
            </div>
          </app-loading-skeleton>
        } @else {
          <p class="text-body-small text-on-surface-variant" aria-live="polite">
            <span i18n="@@addExercises.count">{matching().length, plural,
              =0 {Ningún ejercicio}
              =1 {1 ejercicio}
              other {{{ matching().length }} ejercicios}
            }</span>
            @if (matching().length > maxShown) {
              <span i18n="@@addExercises.more">
                · se ven {{ maxShown }}: busca para encontrar el resto</span
              >
            }
          </p>
          <mat-selection-list
            aria-label="Ejercicios del banco"
            i18n-aria-label="@@addExercises.list"
            (selectionChange)="onSelection($event.source.selectedOptions.selected)"
          >
            @for (row of rows(); track row.id) {
              <mat-list-option
                [value]="row.exercise"
                [selected]="row.assigned || chosen().has(row.id)"
                [disabled]="row.assigned"
                [togglePosition]="'before'"
              >
                <span matListItemTitle [attr.lang]="row.lang">{{ row.title }}</span>
                <span matListItemLine class="flex items-center gap-2">
                  <app-difficulty-chip [difficulty]="row.difficulty" />
                  @if (row.assigned) {
                    <span i18n="@@addExercises.assigned">Ya está en el bloque</span>
                  } @else {
                    <code class="font-mono">{{ row.functionName }}()</code>
                    @if (row.elsewhere) {
                      <span i18n="@@addExercises.elsewhere">También en {{ row.elsewhere }}</span>
                    }
                  }
                </span>
              </mat-list-option>
            }
          </mat-selection-list>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button matButton type="button" mat-dialog-close i18n="@@addExercises.cancel">
        Cancelar
      </button>
      <button
        matButton="filled"
        type="button"
        [appGuideAnchor]="anchors.addExercisesSave"
        [disabled]="chosen().size === 0"
        (click)="add()"
      >
        <span i18n="@@addExercises.add">{chosen().size, plural,
          =0 {Añadir}
          =1 {Añadir 1 ejercicio}
          other {Añadir {{ chosen().size }} ejercicios}
        }</span>
      </button>
    </mat-dialog-actions>
  `,
})
export class AddExercisesDialog {
  protected readonly anchors = GUIDE_ANCHORS;
  protected readonly data = inject<AddExercisesData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AddExercisesDialog, AddExercisesResult>>(MatDialogRef);
  private readonly exercises = inject(ExerciseService);

  protected readonly maxShown = MAX_SHOWN;
  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly search = signal('');
  protected readonly everySubject = signal(false);
  /**
   * Chosen in this dialog, by id; those already in the block are not. The exercises themselves, so
   * one chosen among all the subjects stays chosen when the dialog goes back to one subject.
   */
  protected readonly chosen = signal<ReadonlyMap<string, Exercise>>(new Map());

  /** Empty while it loads, which the template tells by the status. */
  protected readonly bank = resource({
    params: (): BankScope =>
      this.everySubject() ? { kind: 'all' } : { kind: 'subject', subjectId: this.data.subjectId },
    loader: ({ params }) => this.exercises.listBank(params),
    defaultValue: { exercises: [], subjects: [], mySubjectIds: [] },
  });

  protected readonly matching = computed(() =>
    filterBank(
      this.bank.value().exercises,
      { ...NO_FILTERS, search: this.search() },
      { locale: this.data.locale, userId: this.data.userId },
    ),
  );

  protected readonly rows = computed(() => {
    const assigned = new Set(this.data.assignedIds);
    return this.matching()
      .slice(0, MAX_SHOWN)
      .map(({ exercise }) => {
        const text = exerciseText(exercise, this.data.locale);
        return {
          exercise,
          id: exercise.id,
          title: text.title,
          lang: text.locale === this.data.locale ? null : text.locale,
          difficulty: exercise.difficulty,
          functionName: exercise.functionName,
          assigned: assigned.has(exercise.id),
          elsewhere: this.data.elsewhere.get(exercise.id)?.join(', ') ?? null,
        };
      });
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** What the list has selected, without what was already in the block, which stays selected. */
  protected onSelection(options: readonly MatListOption[]): void {
    const assigned = new Set(this.data.assignedIds);
    const visible = new Set(this.rows().map((row) => row.id));
    // A search hides rows: what was chosen among them stays chosen
    const kept = [...this.chosen().values()].filter((exercise) => !visible.has(exercise.id));
    const selected = options
      .map((option) => option.value as Exercise)
      .filter((exercise) => !assigned.has(exercise.id));
    this.chosen.set(new Map([...kept, ...selected].map((exercise) => [exercise.id, exercise])));
  }

  protected add(): void {
    this.ref.close([...this.chosen().values()]);
  }
}
