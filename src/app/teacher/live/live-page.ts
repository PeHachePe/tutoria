import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';

import { TEACHER_ALL_BLOCKS, TEACHER_PARAMS } from '../../core/app-paths';
import { AppTitleStrategy } from '../../core/app-title-strategy';
import { LanguageService } from '../../core/i18n/language-service';
import type { LiveExercise } from '../../data/live-service';
import { blockTitle, exerciseText, subjectName } from '../../data/localized-text';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { formatCall } from '../../shared/format-value';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { BAR_SEGMENT_OF } from './live-bar';
import { LiveClass } from './live-class';
import {
  type ChartFilter,
  filterRows,
  LIVE_FILTER_PARAMS,
  LIVE_FILTERS,
  type LiveFilter,
  liveFilterOf,
  OFF_CLASS_FILTERS,
  studentsOf,
} from './live-filter';
import { LiveQueue } from './live-queue';
import { LiveRhythm } from './live-rhythm';
import { exercisePosition } from './live-state';
import { LiveStore } from './live-store';
import { LiveTable } from './live-table';

const ALL_BLOCKS_LABEL = $localize`:@@live.block.all:Toda la clase`;
const FILTER_ACTION = $localize`:@@live.figure.filter:Filtrar el alumnado`;

/** The label of each tab of the table, without its count. */
const TAB_LABELS: Record<LiveFilter, string> = {
  all: $localize`:@@live.filter.all:Todos`,
  help: $localize`:@@live.figure.help:Necesitan ayuda`,
  working: $localize`:@@live.figure.working:Trabajando ahora`,
  idle: $localize`:@@live.filter.idle:Parados y sin entrar`,
  finished: $localize`:@@live.figure.finished:Han terminado`,
  started: $localize`:@@live.figure.started:Han empezado`,
};
/** «Han terminado» with the whole class: who submitted something in this class. */
const SUBMITTED_LABEL = $localize`:@@live.filter.submitted:Han entregado`;

/** A tab of the table: its filter, its label and how many students it has. */
interface FilterTab {
  readonly filter: LiveFilter;
  readonly label: string;
  readonly count: number;
  /** Its `?filtro=`: null for «Todos». */
  readonly query: Readonly<Record<string, string | null>>;
}

/**
 * The live session (/docente/en-vivo, ficha 06): what the teacher decides in class (RF-11, CU-04,
 * D-054, D-068, D-070). The group and the block are the title; who to help now (the queue of the
 * whole group) next to where the class is (a strip of the block and its busiest exercises, with
 * «Para explicar a todos»); every student in pages, with a tab for each filter and its count; and
 * the pace of the class.
 * Out of class, what the block has accumulated. It moves by itself.
 *
 * The filter of the table is in the URL (`filtro`): each tab is a link, so it survives a reload or
 * coming back from an attempt, and nothing moves when it changes; the students of the chart («Ver quiénes» or a part of a summary) are not: they belong to
 * the exercises of the block shown.
 */
@Component({
  selector: 'app-live-page',
  imports: [
    DatePipe,
    MatFormField,
    MatLabel,
    MatSelect,
    MatSelectTrigger,
    MatOption,
    MatIcon,
    MatIconButton,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    MatTabNav,
    MatTabLink,
    MatTabNavPanel,
    RouterLink,
    LiveQueue,
    LiveClass,
    LiveRhythm,
    LiveTable,
  ],
  templateUrl: './live-page.html',
  // Its own width decides the layout, not the window's: the side menu takes room (D-054)
  host: { class: '@container block' },
})
export class LivePage {
  protected readonly store = inject(LiveStore);
  private readonly router = inject(Router);
  private readonly locale = inject(LanguageService).locale;
  /** The query parameters, as the store reads them: the page also works outside its route. */
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly filterAction = FILTER_ACTION;
  protected readonly search = signal('');

  /** The data are ready to show: a selection and a state, even one loading again. */
  protected readonly ready = computed(
    () => !!this.store.selection() && !(this.store.isLoading() && this.store.rows().length === 0),
  );
  protected readonly blockId = computed(() => this.store.selection()?.blockId ?? null);
  protected readonly inClass = computed(() => this.store.figures().inClass);

  protected readonly groupOptions = computed(() =>
    this.store.groups().map((group) => ({
      id: group.id,
      label: `${group.name} · ${subjectName(group.subject, this.locale).name}`,
    })),
  );

  protected readonly subject = computed(() => {
    const group = this.store.group();
    if (!group) return null;
    const { name, locale } = subjectName(group.subject, this.locale);
    return { name, lang: locale === this.locale ? null : locale };
  });

  /** «Toda la clase», then every block of the group, hidden ones included, saying which move now. */
  protected readonly blockOptions = computed(() => {
    const active = new Set(
      this.store
        .rows()
        .flatMap((row) => (row.work !== 'absent' && row.exercise ? [row.exercise.blockId] : [])),
    );
    return [
      { id: TEACHER_ALL_BLOCKS, title: ALL_BLOCKS_LABEL, lang: null, hidden: false, active: false },
      ...this.store.blocks().map((block) => {
        const title = blockTitle(block, this.locale);
        return {
          id: block.id,
          title: title.title,
          lang: title.locale === this.locale ? null : title.locale,
          hidden: block.isHidden,
          active: active.has(block.id),
        };
      }),
    ];
  });

  /** The option of the block shown, `todos` with the whole class; none while it is picked. */
  protected readonly blockValue = computed(() => {
    const selection = this.store.selection();
    return selection && (selection.blockId ?? TEACHER_ALL_BLOCKS);
  });

  /** The block shown, with its language: «Toda la clase» with the whole class. */
  protected readonly shownBlock = computed(() => {
    const value = this.blockValue();
    return this.blockOptions().find((option) => option.id === value);
  });

  /** «1.º DAW A · Tema 1: Bucles», for the caption of the table. */
  protected readonly caption = computed(
    () => `${this.store.group()?.name} · ${this.shownBlock()?.title}`,
  );

  /** The filters of the table now: those of the figures, in class or out of it. */
  protected readonly filters = computed(() => (this.inClass() ? LIVE_FILTERS : OFF_CLASS_FILTERS));
  /** The filter of the URL, if the table has it now; `all` otherwise. */
  protected readonly shownFilter = computed(() => {
    const filter = liveFilterOf(this.query()?.get(TEACHER_PARAMS.filter) ?? undefined);
    return this.filters().includes(filter) ? filter : 'all';
  });

  /** «Ver quiénes» or a part of a summary; it goes with another group or block. */
  protected readonly chartFilter = linkedSignal<unknown, ChartFilter | null>({
    source: () => this.store.selection(),
    computation: () => null,
  });

  /** The chip of `chartFilter`: «Fallan `isStrongPassword("abc")`» or «Con fallos en 2. Título». */
  protected readonly chartChip = computed(() => {
    const filter = this.chartFilter();
    if (!filter) return null;
    const exercises = this.store.exercises();
    // The filter comes from an exercise of the chart, which is one of the group
    const exercise = exercises.find(
      (entry) => entry.assignmentId === filter.assignmentId,
    ) as LiveExercise;
    const test = exercise.tests.find((candidate) => candidate.id === filter.testId);
    if (test) {
      const call = formatCall(exercise.exercise.functionName, test.input);
      return $localize`:@@live.filter.test:Fallan ${call}:llamada:`;
    }
    const status = BAR_SEGMENT_OF[filter.status].label;
    const position = exercisePosition(exercises, exercise.assignmentId);
    const title = `${position}. ${exerciseText(exercise.exercise, this.locale).title}`;
    return $localize`:@@live.filter.segment:${status}:estado: en ${title}:ejercicio:`;
  });

  protected readonly tableRows = computed(() => {
    const figures = this.store.figures();
    const chart = this.chartFilter();
    return filterRows(this.store.rows(), {
      filter: this.shownFilter(),
      search: this.search(),
      queuedIds: new Set(this.store.queue().map((row) => row.student.id)),
      finishedIds: figures.finishedIds,
      startedIds: figures.startedIds,
      studentIds: chart && studentsOf(this.store.overview(), chart),
    });
  });

  /** The filters as one value: the table goes back to its first page when it changes. */
  protected readonly pageKey = computed(() => {
    const chart = this.chartFilter();
    const chartKey = chart ? `${chart.assignmentId}/${chart.status}/${chart.testId}` : '';
    return `${this.shownFilter()}|${this.search()}|${chartKey}`;
  });

  /** The tabs of the table: in class, or what the block accumulated out of it. */
  protected readonly tabs = computed<readonly FilterTab[]>(() => {
    const figures = this.store.figures();
    const filters = this.filters();
    const counts: Record<LiveFilter, number> = {
      all: figures.students,
      help: figures.needHelp,
      working: figures.working,
      idle: figures.stopped + figures.absent,
      finished: figures.finishedIds.size,
      started: figures.startedIds.size,
    };
    return filters.map((filter) => ({
      filter,
      label:
        filter === 'finished' && this.blockId() === null ? SUBMITTED_LABEL : TAB_LABELS[filter],
      count: counts[filter],
      query: {
        [TEACHER_PARAMS.filter]: filter === 'all' ? null : LIVE_FILTER_PARAMS[filter],
      },
    }));
  });

  /** What the counts say to screen readers when they change: who works and who needs help. */
  protected readonly announcement = computed(() => {
    const figures = this.store.figures();
    return figures.inClass
      ? $localize`:@@live.figures.announce:Trabajando ahora: ${figures.working}:n: de ${figures.students}:total:. Necesitan ayuda: ${figures.needHelp}:cola:.`
      : '';
  });

  constructor() {
    // effect(): the boundary with the title of the document, which the router writes too (4.8).
    // The group loads after the navigation; the strategy keeps this title while only the query
    // changes (another block, another filter), so it follows the group alone.
    const titles = inject(AppTitleStrategy);
    effect(() => {
      const group = this.store.group();
      if (group) {
        titles.setScreenTitle($localize`:@@live.title:${group.name}:grupo: · En vivo`);
      }
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Every student: the filter of the URL goes, as with «Todos». */
  private clearFilter(): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.filter]: null },
      queryParamsHandling: 'merge',
    });
  }

  /** «Ver quiénes» or a part of a summary: those students, with every filter. */
  protected showChart(filter: ChartFilter): void {
    this.clearFilter();
    this.chartFilter.set(filter);
  }

  /** A new group starts at the block the store picks: the block of the previous one is not in it. */
  protected selectGroup(groupId: string): void {
    void this.router.navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: groupId, [TEACHER_PARAMS.block]: null },
      queryParamsHandling: 'merge',
    });
  }

  /** A block of the group, or `todos` for the whole class. */
  protected selectBlock(blockId: string): void {
    void this.router.navigate([], {
      queryParams: {
        [TEACHER_PARAMS.group]: this.store.group()?.id,
        [TEACHER_PARAMS.block]: blockId,
      },
      queryParamsHandling: 'merge',
    });
  }
}
