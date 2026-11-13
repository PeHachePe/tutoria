import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort';
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
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import type { AttemptStatus } from '../../data/attempt';
import { exerciseText } from '../../data/localized-text';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { type ActivityAge, activityAge } from './activity-age';
import { FlashOnChange } from './flash-on-change';
import { LiveChip, type LiveReason, reasonsOf } from './live-reason';
import type { LiveRow } from './live-row';

/** Columns of the table, in order. */
const COLUMNS = [
  'student',
  'exercise',
  'status',
  'minutes',
  'hints',
  'pastes',
  'focusLosses',
  'tests',
  'lastActivity',
  'signals',
] as const;

type Column = (typeof COLUMNS)[number];

/** Order of the statuses when sorting: from not started to submitted. */
const STATUS_ORDER: Record<AttemptStatus, number> = {
  not_started: 0,
  in_progress: 1,
  tests_failed: 2,
  passed: 3,
  submitted: 4,
};

/** What each sortable column sorts by. */
const SORT_VALUES: Record<Column, (row: LiveRow) => number | string> = {
  student: (row) => row.student.name,
  exercise: (row) => row.position ?? 0,
  status: (row) => STATUS_ORDER[row.status],
  minutes: (row) => row.minutes ?? -1,
  hints: (row) => row.hints * 10 + (row.hintLevel ?? 0),
  pastes: (row) => row.pastes,
  focusLosses: (row) => row.focusLosses,
  tests: (row) => (row.tests ? row.tests.passed / Math.max(row.tests.total, 1) : -1),
  lastActivity: (row) => row.lastActivity ?? 0,
  signals: (row) => attention(row),
};

/** A row with what the table shows of it. */
interface TableItem {
  readonly row: LiveRow;
  readonly exercise: { readonly title: string; readonly lang: string | null } | null;
  readonly age: ActivityAge;
  readonly reasons: readonly LiveReason[];
}

/** Names of the columns for the screen reader announcement of the sort. */
const COLUMN_NAMES: Record<Column, string> = {
  student: $localize`:@@live.column.student:Alumno`,
  exercise: $localize`:@@live.column.exercise:Ejercicio`,
  status: $localize`:@@live.column.status:Estado`,
  minutes: $localize`:@@live.column.minutes:Tiempo`,
  hints: $localize`:@@live.column.hints:Pistas`,
  pastes: $localize`:@@live.column.pastes:Pegados`,
  focusLosses: $localize`:@@live.column.focusLosses:Salidas de la ventana`,
  tests: $localize`:@@live.column.tests:Pruebas`,
  lastActivity: $localize`:@@live.column.lastActivity:Última actividad`,
  signals: $localize`:@@live.column.signals:Observaciones`,
};

/**
 * Every student of the block: a sortable table when it has room and a card each when it has not
 * (ficha 06). With less room, the table leaves out the times, pastes and absences.
 * Without a sort chosen, what needs attention comes first and then whoever moved last. A row
 * flashes when its student does something.
 */
@Component({
  selector: 'app-live-table',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
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
    MatSort,
    MatSortHeader,
    StatusChip,
    LiveChip,
    FlashOnChange,
  ],
  templateUrl: './live-table.html',
  // Its own width decides between table and cards, not the window's: the side menu takes room (D-054)
  host: { class: '@container block' },
})
export class LiveTable {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly locale = inject(LanguageService).locale;

  readonly rows = input.required<readonly LiveRow[]>();
  /** «1.º DAW A · Tema 1: Bucles». */
  readonly caption = input.required<string>();
  /** The clock of the panel, for «hace 5 min». */
  readonly now = input.required<number>();

  protected readonly columns = COLUMNS;
  private readonly sort = signal<Sort>({ active: '', direction: '' });

  /** The rows in order, with what the template shows of each one already worked out. */
  protected readonly sorted = computed<readonly TableItem[]>(() => {
    const { active, direction } = this.sort();
    const rows = [...this.rows()];
    if (direction) {
      const value = SORT_VALUES[active as Column];
      const sign = direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => sign * compare(value(a), value(b)) || byAttention(a, b));
    } else {
      rows.sort(byAttention);
    }
    const now = this.now();
    return rows.map((row) => ({
      row,
      exercise: this.exerciseOf(row),
      age: activityAge(row.lastActivity, now),
      // Not starting is already in the status
      reasons: reasonsOf(row).filter((reason) => reason.kind !== 'not_started'),
    }));
  });

  private exerciseOf(row: LiveRow): TableItem['exercise'] {
    if (!row.exercise || row.position === null) return null;
    const text = exerciseText(row.exercise.exercise, this.locale);
    return {
      title: `${row.position}. ${text.title}`,
      lang: text.locale === this.locale ? null : text.locale,
    };
  }

  protected attemptPath(attemptId: string): string {
    return APP_PATHS.teacher.attempt(attemptId);
  }

  protected trackRow(_index: number, item: TableItem): string {
    return item.row.student.id;
  }

  protected sortBy(sort: Sort): void {
    this.sort.set(sort);
    const column = COLUMN_NAMES[sort.active as Column];
    void this.announcer.announce(
      sort.direction === 'asc'
        ? $localize`:@@live.sorted.asc:Ordenado por ${column}:column:, de menor a mayor`
        : sort.direction === 'desc'
          ? $localize`:@@live.sorted.desc:Ordenado por ${column}:column:, de mayor a menor`
          : $localize`:@@live.sorted.attention:Ordenado por quién necesita atención`,
    );
  }
}

/** Patterns of whoever is not working: they go with the rest, after those who work. */
const QUIET_PATTERNS: ReadonlySet<string> = new Set(['not_started', 'inactive']);

/** Lower first: a signal, then something to review, then working now, then the rest. */
function attention(row: LiveRow): number {
  if (row.signal) return 0;
  if (row.patterns.some((pattern) => !QUIET_PATTERNS.has(pattern.kind))) return 1;
  return row.active ? 2 : 3;
}

/** What needs attention first, then whoever moved last, then by name. */
function byAttention(a: LiveRow, b: LiveRow): number {
  return (
    attention(a) - attention(b) ||
    (b.lastActivity ?? 0) - (a.lastActivity ?? 0) ||
    a.student.name.localeCompare(b.student.name, 'es')
  );
}

function compare(a: number | string, b: number | string): number {
  return typeof a === 'string' && typeof b === 'string'
    ? a.localeCompare(b, 'es')
    : Number(a) - Number(b);
}
