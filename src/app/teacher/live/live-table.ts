import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatPaginator, type PageEvent } from '@angular/material/paginator';
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
import type { ClassBlock } from '../../data/exercise';
import { exerciseText } from '../../data/localized-text';
import { pageOf } from '../../shared/page-of';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { type ActivityAge, activityAge } from './activity-age';
import { FlashOnChange } from './flash-on-change';
import { ATTENTION_ORDER } from './live-attention';
import { liveObservations } from './live-observations';
import { LiveChip, type LiveReason } from './live-reason';
import type { LiveRow } from './live-row';
import { otherBlockTitle } from './other-block';

/** Rows of a page of the table: what fits on a screen next to the rest of the panel. */
export const LIVE_TABLE_PAGE = 8;
/** Cards of a page with little room, one or two per row. */
export const LIVE_CARDS_PAGE = 6;

/** Columns of the table, in order: none for times, pastes or absences, which the chips tell. */
const COLUMNS = ['student', 'exercise', 'status', 'hints', 'lastActivity', 'observations'] as const;

type Column = (typeof COLUMNS)[number];

/** Order of the statuses when sorting: from not started to submitted. */
const STATUS_ORDER: Record<AttemptStatus, number> = {
  not_started: 0,
  in_progress: 1,
  tests_failed: 2,
  passed: 3,
  submitted: 4,
};

/** A row with what the table shows of it. */
interface TableItem {
  readonly row: LiveRow;
  readonly exercise: {
    readonly title: string;
    readonly lang: string | null;
    /** The block of the exercise when it is not the one shown. */
    readonly block: string | null;
  } | null;
  readonly age: ActivityAge;
  readonly observations: readonly LiveReason[];
  /** Grey: not in the session while others are. */
  readonly absent: boolean;
}

/** Names of the columns for the screen reader announcement of the sort. */
const COLUMN_NAMES: Record<Column, string> = {
  student: $localize`:@@live.column.student:Alumno`,
  exercise: $localize`:@@live.column.exercise:Ejercicio`,
  status: $localize`:@@live.column.status:Estado`,
  hints: $localize`:@@live.column.hints:Pistas`,
  lastActivity: $localize`:@@live.column.lastActivity:Última actividad`,
  observations: $localize`:@@live.column.signals:Observaciones`,
};

/**
 * «Alumnado» (ficha 06): every student of the group that matches the filters, wherever they work,
 * in pages, inside the card of the section: a sortable table when it has room and a row of text
 * each when it has not, each one with its own page (both are in the DOM and a container query
 * shows one). The observations are chips, only
 * when they exist.
 *
 * Without a sort chosen, who is in the queue comes first, then who is in the session and then who
 * has not come in (greyed out in class), each part by name: a row only moves when its student
 * changes part, so a page does not reshuffle while the class works. The page goes back to the
 * first one when the filters (`pageKey`) or the sort change, not with each live change. A row
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
    MatPaginator,
    StatusChip,
    LiveChip,
    FlashOnChange,
  ],
  templateUrl: './live-table.html',
  // Its own width decides between table and cards, not the window's: the side menu takes room
  // (D-054). It keeps the height of a full page, so filtering does not shorten the page under the
  // teacher and move the scroll (D-070).
  host: { class: '@container block min-h-136' },
})
export class LiveTable {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly locale = inject(LanguageService).locale;

  /** The rows that match the filters. */
  readonly rows = input.required<readonly LiveRow[]>();
  /** «1.º DAW A · Tema 1: Bucles». */
  readonly caption = input.required<string>();
  /** The blocks of the group, to name the one of an exercise. */
  readonly blocks = input.required<readonly ClassBlock[]>();
  /** The block shown, or null with the whole class. */
  readonly blockId = input.required<string | null>();
  /** The clock of the panel, for «hace 5 min». */
  readonly now = input.required<number>();
  /** Somebody works now: whoever has not come in is greyed out. */
  readonly inClass = input.required<boolean>();
  /** The filters as one value: when it changes, both pages go back to the first one. */
  readonly pageKey = input.required<string>();

  protected readonly columns = COLUMNS;
  protected readonly tablePageSize = LIVE_TABLE_PAGE;
  protected readonly cardsPageSize = LIVE_CARDS_PAGE;
  private readonly sort = signal<Sort>({ active: '', direction: '' });

  private readonly tablePageIndex = linkedSignal({
    source: () => [this.pageKey(), this.sort()] as const,
    computation: () => 0,
  });
  private readonly cardsPageIndex = linkedSignal({
    source: () => [this.pageKey(), this.sort()] as const,
    computation: () => 0,
  });

  /** The rows in order, with what the template shows of each one already worked out. */
  protected readonly sorted = computed<readonly TableItem[]>(() => {
    const { active, direction } = this.sort();
    const rows = [...this.rows()];
    const now = this.now();
    if (direction) {
      const value = this.sortValue(active as Column);
      const sign = direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => sign * compare(value(a), value(b)) || compareParts(a, b));
    } else {
      rows.sort(compareParts);
    }
    const inClass = this.inClass();
    return rows.map((row) => ({
      row,
      exercise: this.exerciseOf(row),
      age: activityAge(row.lastActivity, now),
      observations: liveObservations(row),
      absent: inClass && row.work === 'absent',
    }));
  });

  protected readonly tablePage = computed(() =>
    pageOf(this.sorted(), this.tablePageIndex(), LIVE_TABLE_PAGE),
  );
  protected readonly cardsPage = computed(() =>
    pageOf(this.sorted(), this.cardsPageIndex(), LIVE_CARDS_PAGE),
  );

  /** What each sortable column sorts by. */
  private sortValue(column: Column): (row: LiveRow) => number | string {
    const blocks = this.blocks();
    const values: Record<Column, (row: LiveRow) => number | string> = {
      student: (row) => row.student.name,
      // With an exercise, a row has its position in its block
      exercise: (row) =>
        row.exercise
          ? blocks.findIndex((block) => block.id === row.exercise?.blockId) * 1000 +
            (row.position as number)
          : -1,
      status: (row) => STATUS_ORDER[row.status],
      hints: (row) => row.hints * 10 + (row.hintLevel ?? 0),
      lastActivity: (row) => row.lastActivity ?? 0,
      observations: (row) => liveObservations(row).length,
    };
    return values[column];
  }

  private exerciseOf(row: LiveRow): TableItem['exercise'] {
    if (!row.exercise || row.position === null) return null;
    const text = exerciseText(row.exercise.exercise, this.locale);
    return {
      title: `${row.position}. ${text.title}`,
      lang: text.locale === this.locale ? null : text.locale,
      block: otherBlockTitle(this.blocks(), row.exercise, this.blockId(), this.locale),
    };
  }

  protected attemptPath(attemptId: string): string {
    return APP_PATHS.teacher.attempt(attemptId);
  }

  protected trackRow(_index: number, item: TableItem): string {
    return item.row.student.id;
  }

  protected goToTablePage(event: PageEvent): void {
    this.tablePageIndex.set(event.pageIndex);
  }

  protected goToCardsPage(event: PageEvent): void {
    this.cardsPageIndex.set(event.pageIndex);
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

/** The part of a row in the default order: the queue, the session, then who has not come in. */
function part(row: LiveRow): number {
  if (row.reason) return 0;
  return row.work === 'absent' ? 2 : 1;
}

/**
 * The default order: by part and, inside it, the queue as the queue (by reason and who waits
 * longest) and the rest by name.
 */
function compareParts(a: LiveRow, b: LiveRow): number {
  const byPart = part(a) - part(b);
  if (byPart !== 0) return byPart;
  if (a.reason && b.reason) {
    const byReason =
      ATTENTION_ORDER.indexOf(a.reason.kind) - ATTENTION_ORDER.indexOf(b.reason.kind) ||
      a.reason.since - b.reason.since;
    if (byReason !== 0) return byReason;
  }
  return a.student.name.localeCompare(b.student.name, 'es');
}

function compare(a: number | string, b: number | string): number {
  return typeof a === 'string' && typeof b === 'string'
    ? a.localeCompare(b, 'es')
    : Number(a) - Number(b);
}
