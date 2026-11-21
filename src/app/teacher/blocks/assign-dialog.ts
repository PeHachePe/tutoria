import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { BlockService } from '../../data/block-service';
import { blockTitle, type ContentLocale, subjectName } from '../../data/localized-text';
import { groupTitle } from '../../data/group-name';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';

/** The exercise of the bank to assign, with the subjects it is meant for. */
export interface AssignDialogData {
  readonly exerciseId: string;
  readonly title: string;
  /** In the language of the title, if it is not that of the interface. */
  readonly lang: string | null;
  readonly subjectIds: readonly string[];
  readonly locale: ContentLocale;
}

/** Where it went, to say it; undefined if cancelled. */
export type AssignDialogResult = { readonly group: string; readonly block: string } | undefined;

interface AssignModel {
  readonly groupId: string;
  readonly blockId: string;
}

/**
 * Assigns an exercise of the bank to a block of one of the teacher's groups (4.3b), without leaving
 * the bank: the groups of its subjects come first, and the blocks where it already is are marked.
 */
@Component({
  selector: 'app-assign-dialog',
  imports: [
    RouterLink,
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
    MatSelect,
    MatOption,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@assign.title">Asignar a un bloque</h2>
    <form [formRoot]="assignForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md" [attr.aria-busy]="groups.isLoading()">
          <p class="mb-2 text-body-medium text-on-surface-variant" [attr.lang]="data.lang">
            {{ data.title }}
          </p>
          @if (groups.error(); as error) {
            <app-load-error [error]="error" (retry)="groups.reload()" />
          } @else if (!groups.hasValue()) {
            <app-loading-skeleton label="Cargando tus grupos…" i18n-label="@@assign.loading">
              <app-skeleton class="h-14 w-full rounded-xl" />
            </app-loading-skeleton>
          } @else if (groupOptions().length === 0) {
            <p i18n="@@assign.noGroups">Todavía no tienes grupos a los que asignarlo.</p>
          } @else {
            <mat-form-field>
              <mat-label i18n="@@assign.group">Grupo</mat-label>
              <!-- Another group has other blocks: the one chosen is not among them -->
              <mat-select
                [formField]="assignForm.groupId"
                (selectionChange)="assignForm.blockId().value.set('')"
              >
                @for (option of groupOptions(); track option.id) {
                  <mat-option [value]="option.id">{{ option.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field>
              <mat-label i18n="@@assign.block">Bloque</mat-label>
              <mat-select [formField]="assignForm.blockId">
                @for (option of blockOptions(); track option.id) {
                  <mat-option [value]="option.id" [disabled]="option.assigned">
                    <span [attr.lang]="option.lang">{{ option.title }}</span>
                    @if (option.assigned) {
                      <span i18n="@@assign.already"> (ya está)</span>
                    }
                  </mat-option>
                }
              </mat-select>
              @if (assignForm.blockId().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              } @else {
                <mat-hint i18n="@@assign.block.hint">Va al final del bloque</mat-hint>
              }
            </mat-form-field>
            @if (blocks.hasValue() && blockOptions().length === 0) {
              <p class="text-body-medium" i18n="@@assign.noBlocks">
                Este grupo no tiene bloques todavía:
                <a
                  class="text-primary underline"
                  [routerLink]="blocksPath"
                  [queryParams]="blocksQuery()"
                  mat-dialog-close
                  >créalos en Bloques</a
                >.
              </p>
            }
            @if (failed()) {
              <p class="text-body-medium text-error" role="alert" i18n="@@assign.failed">
                No se ha podido asignar. Inténtalo de nuevo.
              </p>
            }
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@assign.cancel">Cancelar</button>
        <button
          matButton="filled"
          type="submit"
          [disabled]="
            !groups.hasValue() || groupOptions().length === 0 || assignForm().submitting()
          "
        >
          @if (assignForm().submitting()) {
            <span i18n="@@assign.saving">Asignando…</span>
          } @else {
            <span i18n="@@assign.submit">Asignar</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class AssignDialog {
  protected readonly data = inject<AssignDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AssignDialog, AssignDialogResult>>(MatDialogRef);
  private readonly service = inject(BlockService);

  protected readonly blocksPath = APP_PATHS.teacher.blocks;
  protected readonly failed = signal(false);

  protected readonly groups = resource({ loader: () => this.service.listGroups() });

  /**
   * The groups of the subjects of the exercise first: those are where it is meant to go. Only those
   * of an open class (5.2e, 5.2f): nobody assigns work to a class that is over, unless reopened.
   */
  protected readonly groupOptions = computed(() => {
    if (!this.groups.hasValue()) return [];
    const subjects = new Set(this.data.subjectIds);
    return this.groups
      .value()
      .filter(({ open }) => open)
      .map((group) => ({
        id: group.id,
        label: groupTitle(
          group.name,
          subjectName(group.subject, this.data.locale).name,
          group.label,
        ),
        fits: subjects.has(group.subject.id),
      }))
      .sort((a, b) => Number(b.fits) - Number(a.fits));
  });

  /** Starts in the first group of the subjects of the exercise, once the groups arrive. */
  private readonly model = linkedSignal<string, AssignModel>({
    source: () => this.groupOptions()[0]?.id ?? '',
    computation: (first, previous) =>
      previous?.value.groupId ? previous.value : { groupId: first, blockId: '' },
  });

  protected readonly assignForm = form(
    this.model,
    (path) => {
      // The first group comes chosen: there is always one while the select is shown
      required(path.groupId);
      required(path.blockId, { message: $localize`:@@assign.error.block:Elige el bloque` });
    },
    {
      submission: {
        action: async (field) => {
          this.failed.set(false);
          const { groupId, blockId } = field().value();
          try {
            await this.service.assign(blockId, [this.data.exerciseId]);
          } catch {
            this.failed.set(true);
            return undefined;
          }
          this.ref.close({
            group: labelOf(this.groupOptions(), groupId),
            block: labelOf(
              this.blockOptions().map(({ id, title }) => ({ id, label: title })),
              blockId,
            ),
          });
          return undefined;
        },
      },
    },
  );

  protected readonly blocks = resource({
    params: () => this.assignForm.groupId().value() || undefined,
    loader: ({ params }) => this.service.listBlocks(params),
  });

  protected readonly blockOptions = computed(() =>
    (this.blocks.hasValue() ? this.blocks.value() : []).map(({ block, assignments }) => {
      const title = blockTitle(block, this.data.locale);
      return {
        id: block.id,
        title: title.title,
        lang: title.locale === this.data.locale ? null : title.locale,
        assigned: assignments.some((entry) => entry.exercise.id === this.data.exerciseId),
      };
    }),
  );

  protected readonly blocksQuery = computed(() => ({
    [TEACHER_PARAMS.group]: this.assignForm.groupId().value(),
  }));
}

/** The label of the option chosen in a select, which is always one of its options. */
function labelOf(options: readonly { id: string; label: string }[], id: string): string {
  return options
    .filter((option) => option.id === id)
    .map((option) => option.label)
    .join('');
}
