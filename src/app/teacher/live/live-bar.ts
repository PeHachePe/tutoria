import { Component, computed, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

import type { AttemptStatus } from '../../data/attempt';

/**
 * The segments of each bar, in the order of the work, with their colour token and name. The
 * colours are those of the charts (D-070); «Sin empezar» is the empty track of the bar.
 */
export const BAR_SEGMENTS: readonly {
  readonly status: AttemptStatus;
  readonly tone: string;
  readonly label: string;
}[] = [
  {
    status: 'not_started',
    tone: 'bg-surface-container-highest',
    label: $localize`:@@status.notStarted:Sin empezar`,
  },
  {
    status: 'in_progress',
    tone: 'bg-chart-progress',
    label: $localize`:@@status.inProgress:En curso`,
  },
  {
    status: 'tests_failed',
    tone: 'bg-chart-fail',
    label: $localize`:@@status.testsFailed:Con fallos`,
  },
  { status: 'passed', tone: 'bg-chart-pass', label: $localize`:@@status.passed:Superado` },
  { status: 'submitted', tone: 'bg-chart-done', label: $localize`:@@status.submitted:Entregado` },
];

/** Each segment by its status: its colour and its name. */
export const BAR_SEGMENT_OF = Object.fromEntries(
  BAR_SEGMENTS.map((segment) => [segment.status, segment]),
) as Record<AttemptStatus, (typeof BAR_SEGMENTS)[number]>;

/** A segment of a bar: how many students are in a status and who they are, as a tooltip. */
export interface BarSegment {
  readonly status: AttemptStatus;
  readonly count: number;
  /** «Con fallos: Aya, Hugo y 3 más». */
  readonly names: string;
}

/**
 * A stacked bar of «Dónde está la clase»: a segment per status with students, as wide as their
 * share of the class, that grows and shrinks as the class works; who has not started is the empty
 * track. A 2px gap keeps the segments apart. Hovering a segment says who is in it.
 *
 * It is a drawing (`aria-hidden`): the summary under it says the same in text, and each part of
 * the summary is the button that says the names and filters the table. Segments as buttons would
 * be targets smaller than 24 px (WCAG 2.5.8) as soon as a status has one student out of many.
 */
@Component({
  selector: 'app-live-bar',
  imports: [MatTooltip],
  template: `
    @for (segment of shown(); track segment.status) {
      <span
        class="h-full rounded-xs transition-[width] duration-500 ease-out motion-reduce:transition-none"
        [class]="segment.tone"
        [style.width.%]="segment.percent"
        [matTooltip]="segment.names"
      ></span>
    }
  `,
  host: {
    class: 'flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-container-high',
    'aria-hidden': 'true',
  },
})
export class LiveBar {
  readonly segments = input.required<readonly BarSegment[]>();

  /** The segments with students, in the order of the work, with their colour and width. */
  protected readonly shown = computed(() => {
    const segments = this.segments();
    const total = segments.reduce((sum, segment) => sum + segment.count, 0);
    return BAR_SEGMENTS.flatMap(({ status, tone }) => {
      const segment = segments.find((candidate) => candidate.status === status);
      return status !== 'not_started' && segment && segment.count > 0
        ? [{ ...segment, tone, percent: (segment.count / total) * 100 }]
        : [];
    });
  });
}
