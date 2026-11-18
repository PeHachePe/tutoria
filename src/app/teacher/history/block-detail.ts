import { Component, computed, inject, input } from '@angular/core';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';

import { LanguageService } from '../../core/i18n/language-service';
import { blockTitle, exerciseText } from '../../data/localized-text';
import type { BlockStats, DeadlineStats, WorkStats } from '../../data/stats-service';
import { formatDuration } from '../../shared/format-duration';
import { BlockDeadlines } from './block-deadlines';
import { averageHints, formatAverage, formatPercent, solvedPercent } from './history-figures';

const SECOND_MS = 1000;
const PERCENT = 100;
const COLUMNS = ['exercise', 'solved', 'hints', 'time'];
/** Only when somebody got stuck in some exercise: an empty column says nothing. */
const STUCK_COLUMN = 'stuck';

/**
 * The block chosen in the history (ficha 09, D-073): its three figures, its due date with who missed
 * it (D-054) and a row per exercise, which says what to go over in class. The heading is announced when
 * another block is picked: the focus stays on its bar.
 */
@Component({
  selector: 'app-block-detail',
  imports: [
    BlockDeadlines,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
  ],
  template: `
    <div class="flex flex-col gap-1" aria-live="polite">
      <h2 id="history-block-heading" class="text-title-large" [attr.lang]="title().lang">
        {{ title().title }}
      </h2>
      <p class="text-body-medium text-on-surface-variant" ngPreserveWhitespaces>
        <span i18n="@@history.block.exercises">{stats().assignments, plural,
          =1 {1 ejercicio}
          other {{{ stats().assignments }} ejercicios}
        }</span>
        <span aria-hidden="true">·</span>
        <span i18n="@@history.block.worked"
          >lo han trabajado {{ stats().activeStudents }} de {{ students() }} alumnos</span
        >
      </p>
    </div>

    <dl class="grid gap-3 @xl:grid-cols-3">
      <div class="flex flex-col rounded-xl bg-surface-container px-4 py-3">
        <dt class="text-label-large text-on-surface-variant" i18n="@@history.figure.solved">
          Ejercicios superados
        </dt>
        <dd class="text-headline-small">{{ figures().solved }}</dd>
        <dd class="text-body-small text-on-surface-variant" i18n="@@history.of">
          {{ stats().solved }} de {{ figures().expected }}
        </dd>
      </div>
      <div class="flex flex-col rounded-xl bg-surface-container px-4 py-3">
        <dt class="text-label-large text-on-surface-variant" i18n="@@history.figure.time">
          Tiempo por ejercicio
        </dt>
        @if (figures().time; as time) {
          <dd class="text-headline-small">{{ time }}</dd>
        } @else {
          <dd class="text-headline-small" i18n="@@history.figure.time.none">Sin entregas</dd>
        }
        <dd class="text-body-small text-on-surface-variant" i18n="@@history.figure.time.help">
          la mediana entre abrirlo y entregarlo
        </dd>
      </div>
      <div class="flex flex-col rounded-xl bg-surface-container px-4 py-3">
        <dt class="text-label-large text-on-surface-variant" i18n="@@history.figure.stuck">
          Se atascaron en alguna prueba
        </dt>
        @if (stats().stuckStudents) {
          <dd class="text-headline-small" i18n="@@history.of">
            {{ stats().stuckStudents }} de {{ students() }}
          </dd>
        } @else {
          <dd class="text-headline-small" i18n="@@history.figure.stuck.none">Nadie</dd>
        }
        <dd class="text-body-small text-on-surface-variant" i18n="@@history.figure.stuck.help">
          fallaron la misma prueba varias veces seguidas
        </dd>
      </div>
    </dl>

    @if (deadlines().length) {
      <app-block-deadlines [deadlines]="deadlines()" [students]="students()" />
    }

    <!-- Focusable, as it scrolls sideways on a phone and the keyboard has to reach it -->
    <div
      tabindex="0"
      role="region"
      aria-label="Ejercicios del bloque"
      i18n-aria-label="@@history.exercises.region"
      class="overflow-x-auto rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <table mat-table class="w-full" [dataSource]="rows()">
        <caption class="sr-only" i18n="@@history.exercises.caption">
          Cifras de cada ejercicio de
          {{
            title().title
          }}
        </caption>

        <ng-container matColumnDef="exercise">
          <th mat-header-cell *matHeaderCellDef i18n="@@history.column.exercise">Ejercicio</th>
          <td mat-cell *matCellDef="let row" class="min-w-48" [attr.lang]="row.lang">
            {{ row.title }}
          </td>
        </ng-container>

        <ng-container matColumnDef="solved">
          <th mat-header-cell *matHeaderCellDef i18n="@@history.column.solved">Superado</th>
          <td mat-cell *matCellDef="let row" class="whitespace-nowrap">{{ row.solved }}</td>
        </ng-container>

        <ng-container matColumnDef="hints">
          <th mat-header-cell *matHeaderCellDef i18n="@@history.column.hints">Pistas por alumno</th>
          <td mat-cell *matCellDef="let row">{{ row.hints }}</td>
        </ng-container>

        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef i18n="@@history.column.time">Tiempo</th>
          <td mat-cell *matCellDef="let row" class="whitespace-nowrap">{{ row.time }}</td>
        </ng-container>

        <ng-container matColumnDef="stuck">
          <th mat-header-cell *matHeaderCellDef i18n="@@history.column.stuck">Se atascaron</th>
          <td mat-cell *matCellDef="let row">
            @if (row.stuck) {
              {{ row.stuck }}
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns()"></tr>
        <tr mat-row *matRowDef="let row; columns: columns()"></tr>
      </table>
    </div>
  `,
  host: { class: '@container flex flex-col gap-4 rounded-2xl bg-panel p-4' },
})
export class BlockDetail {
  private readonly locale = inject(LanguageService).locale;

  readonly stats = input.required<BlockStats>();
  /** Its due dates, by date; none without one. */
  readonly deadlines = input<readonly DeadlineStats[]>([]);
  /** Students enrolled now. */
  readonly students = input.required<number>();

  protected readonly columns = computed(() =>
    this.stats().stuckStudents ? [...COLUMNS, STUCK_COLUMN] : COLUMNS,
  );

  protected readonly title = computed(() => {
    const { title, locale } = blockTitle(this.stats().block, this.locale);
    return { title, lang: locale === this.locale ? null : locale };
  });

  protected readonly figures = computed(() => {
    const stats = this.stats();
    return {
      solved: formatPercent(solvedPercent(stats, this.students()), this.locale),
      expected: this.students() * stats.assignments,
      time: this.time(stats),
    };
  });

  /** A row per exercise: its share of the class that solved it, and the rest of its figures. */
  protected readonly rows = computed(() => {
    const students = this.students();
    return this.stats().exercises.map((stats) => {
      const { title, locale } = exerciseText(stats.exercise, this.locale);
      return {
        title,
        lang: locale === this.locale ? null : locale,
        solved: formatPercent(
          students ? Math.round((stats.solved / students) * PERCENT) : 0,
          this.locale,
        ),
        hints: formatAverage(averageHints(stats), this.locale),
        time: this.time(stats) ?? '',
        stuck: stats.stuckStudents,
      };
    });
  });

  private time(stats: WorkStats): string | null {
    return stats.medianSeconds === null ? null : formatDuration(stats.medianSeconds * SECOND_MS);
  }
}
