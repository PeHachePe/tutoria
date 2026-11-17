import { Component, computed, inject, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import type { AttemptStatus } from '../../data/attempt';
import type { ClassBlock } from '../../data/exercise';
import { blockTitle, exerciseText } from '../../data/localized-text';
import { formatCall, formatValue } from '../../shared/format-value';
import type { ClassStrip, StripStatus } from './class-strip';
import { CommonFailure } from './common-failure';
import { BAR_SEGMENT_OF, BAR_SEGMENTS, LiveBar } from './live-bar';
import type { ChartFilter } from './live-filter';
import { type ClassOverview, COMMON_FAILURE_STUDENTS, OVERVIEW_TOP } from './live-overview';
import { otherBlockTitle } from './other-block';
import { segmentNames } from './segment-names';

/** The order of the summary of each exercise: what calls for the teacher first. */
const SUMMARY_ORDER: readonly AttemptStatus[] = [
  'tests_failed',
  'in_progress',
  'passed',
  'submitted',
  'not_started',
];

/** The segments of a column of the strip, from the bottom. */
const STRIP_ORDER: readonly StripStatus[] = ['submitted', 'passed', 'in_progress', 'tests_failed'];

/** Students out of class from whom the test failed most is worth a line: one is the queue's. */
export const TOP_FAILURE_STUDENTS = 2;

/**
 * «Dónde está la clase» (D-054, D-068, D-070). With a block, a strip with a column per exercise
 * and who is at it now, by status, read in a sentence that also names whoever is alone far from
 * the bulk; it takes the same room with 6 exercises or 200. Under it, every exercise in the card's
 * own scroll, the busiest first, each with its bar and its summary, whose parts say who and filter
 * the table; «Para explicar a todos» when several students fail the same
 * test now. With the whole class, the exercises in progress of any block. The colours are those
 * of the charts.
 */
@Component({
  selector: 'app-live-class',
  imports: [RouterLink, MatButton, MatTooltip, LiveBar, CommonFailure],
  templateUrl: './live-class.html',
  host: {
    role: 'region',
    'aria-labelledby': 'live-class-title',
    // Never taller than the queue's maximum: the exercises scroll inside, under a fixed header
    class: '@container flex max-h-112 flex-col overflow-hidden rounded-2xl bg-panel',
  },
})
export class LiveClass {
  private readonly locale = inject(LanguageService).locale;

  readonly overview = input.required<ClassOverview>();
  /** Where each student is in the block; null with the whole class. */
  readonly strip = input<ClassStrip | null>(null);
  /** «Avance del bloque», from 0 to 100; null with the whole class. */
  readonly progress = input<number | null>(null);
  /** The blocks of the group, to name the one of an exercise or of the line at the foot. */
  readonly blocks = input.required<readonly ClassBlock[]>();
  /** The block shown, or null with the whole class. */
  readonly blockId = input.required<string | null>();
  /** Somebody works now: «Para explicar a todos», or the test failed most out of class. */
  readonly inClass = input.required<boolean>();
  /** A part of a summary or «Ver quiénes»: the table keeps those students. */
  readonly filter = output<ChartFilter>();
  /** Another block of the line at the foot: its link goes away while the block loads. */
  readonly blockChosen = output<void>();

  protected readonly legend = BAR_SEGMENTS.filter(({ status }) => status !== 'not_started');
  protected readonly notStarted = BAR_SEGMENT_OF.not_started;

  /** Every exercise with its bar and its summary, in the order of the strip or of the overview. */
  protected readonly items = computed(() => {
    const blocks = this.blocks();
    const blockId = this.blockId();
    return this.overview().exercises.map(({ exercise, position, students, topFailure }) => {
      const text = exerciseText(exercise.exercise, this.locale);
      const names = (status: AttemptStatus) =>
        segmentNames(BAR_SEGMENT_OF[status].label, students[status], this.locale);
      const failing = topFailure?.students.length ?? 0;
      const common = this.inClass() && failing >= COMMON_FAILURE_STUDENTS;
      const showFailure = common || (!this.inClass() && failing >= TOP_FAILURE_STUDENTS);
      return {
        id: exercise.assignmentId,
        position,
        title: `${position}. ${text.title}`,
        lang: text.locale === this.locale ? null : text.locale,
        block: blockId === null ? otherBlockTitle(blocks, exercise, blockId, this.locale) : null,
        segments: BAR_SEGMENTS.map(({ status }) => ({
          status,
          count: students[status].length,
          names: names(status),
        })),
        summary: SUMMARY_ORDER.filter((status) => students[status].length > 0).map((status) => ({
          status,
          count: students[status].length,
          tone: BAR_SEGMENT_OF[status].tone,
          names: names(status),
        })),
        failure:
          topFailure && showFailure
            ? {
                testId: topFailure.test.id,
                call: formatCall(exercise.exercise.functionName, topFailure.test.input),
                expected: formatValue(topFailure.test.expectedOutput),
                hidden: topFailure.test.isHidden,
                students: failing,
                common,
              }
            : null,
      };
    });
  });

  /**
   * Every exercise, in the card's own scroll (D-070): with a strip, those with somebody at them now
   * first, the most crowded first, and then the rest in order; otherwise, as the overview gives
   * them (a block in order, or the whole class with the busiest exercise first).
   */
  protected readonly shown = computed(() => {
    const items = this.items();
    if (!this.drawStrip()) return items;
    const strip = this.strip() as ClassStrip;
    const here = new Map(
      strip.columns.map((column) => [column.exercise.assignmentId, column.total]),
    );
    // Every exercise of the block has its column
    const now = (id: string) => here.get(id) as number;
    return [...items].sort((a, b) => now(b.id) - now(a.id) || a.position - b.position);
  });

  /**
   * The strip only pays off with more exercises than rows: with up to `OVERVIEW_TOP`, every
   * exercise has its row and the sentence says the rest.
   */
  protected readonly drawStrip = computed(() => (this.strip()?.columns.length ?? 0) > OVERVIEW_TOP);

  /** The columns of the strip, with each segment as a share of the tallest one, and its names. */
  protected readonly columns = computed(() => {
    // Only drawn with a strip
    const strip = this.strip() as ClassStrip;
    const tallest = Math.max(1, ...strip.columns.map((column) => column.total));
    const tags = this.tags();
    return strip.columns.map((column) => {
      const text = exerciseText(column.exercise.exercise, this.locale).title;
      const parts = STRIP_ORDER.filter((status) => column.counts[status] > 0);
      return {
        id: column.exercise.assignmentId,
        tooltip: `${column.position}. ${text}: ${column.total}`,
        tag: tags.find((tag) => tag.position === column.position)?.label ?? null,
        segments: parts.map((status) => ({
          status,
          tone: BAR_SEGMENT_OF[status].tone,
          percent: (column.counts[status] / tallest) * 100,
        })),
      };
    });
  });

  /** Who is alone far from the bulk, with their names joined: over their column and in the sentence. */
  protected readonly tags = computed(() => {
    const list = new Intl.ListFormat(this.locale, { type: 'conjunction' });
    // Only read with a strip: over its columns and in its sentence
    return (this.strip() as ClassStrip).outliers.map((outlier) => ({
      ...outlier,
      label: list.format(outlier.names),
    }));
  });

  /** Every block of the group, to choose one when nobody works with the whole class. */
  protected readonly blockLinks = computed(() =>
    this.blocks().map((block) => {
      const title = blockTitle(block, this.locale);
      return {
        id: block.id,
        title: title.title,
        lang: title.locale === this.locale ? null : title.locale,
        query: { [TEACHER_PARAMS.block]: block.id },
      };
    }),
  );

  /** «4 trabajan en otros bloques: Tema 2 (3) · Repaso (1)», or null with nobody elsewhere. */
  protected readonly elsewhere = computed(() => {
    const entries = this.overview().elsewhere.flatMap(({ blockId, students }) => {
      const block = this.blocks().find((candidate) => candidate.id === blockId);
      return block
        ? [
            {
              id: blockId,
              title: blockTitle(block, this.locale).title,
              students,
              query: { [TEACHER_PARAMS.block]: blockId },
            },
          ]
        : [];
    });
    return entries.length === 0
      ? null
      : { students: entries.reduce((sum, entry) => sum + entry.students, 0), blocks: entries };
  });
}
