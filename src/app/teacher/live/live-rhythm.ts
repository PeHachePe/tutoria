import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import type { ActivityMinute } from './activity-by-minute';
import { RHYTHM_MINUTES, type RhythmReading } from './rhythm-reading';

/** The drawing box of each sparkline. */
const CHART_WIDTH = 160;
const CHART_HEIGHT = 40;
/** Room over the highest point, so its line is not cut. */
const CHART_TOP = 4;
const MINUTE_MS = 60_000;

/** The height of a value over `max`, from the top of the box. */
function heightOf(value: number, max: number): number {
  return CHART_HEIGHT - (value / max) * (CHART_HEIGHT - CHART_TOP);
}

/** The points of a line over the minutes, scaled to `max`. */
function linePoints(values: readonly number[], max: number): string {
  const step = CHART_WIDTH / Math.max(1, values.length - 1);
  return values
    .map((value, index) => `${round(index * step)},${round(heightOf(value, max))}`)
    .join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** What a sparkline draws: runs or hints. */
type Measure = 'runs' | 'hints';

/**
 * How each measure is drawn. Its colour is not alone: each sparkline has its own name over it, so
 * neither needs a dashed line to tell them apart.
 */
const MEASURE_STYLES: Record<
  Measure,
  { stroke: string; fill: string; dot: string; swatch: string }
> = {
  runs: {
    stroke: 'stroke-chart-progress',
    fill: 'fill-chart-progress/15',
    dot: 'bg-chart-progress',
    swatch: 'bg-chart-progress',
  },
  hints: {
    stroke: 'stroke-chart-fail',
    fill: 'fill-chart-fail/15',
    dot: 'bg-chart-fail',
    swatch: 'bg-chart-fail',
  },
};

/**
 * The pace of the class (D-068, D-070) as one line under the title, always in sight: the sentence
 * that reads it (`rhythmReading()`) and, for runs and for hints, what it compares (the last 10
 * complete minutes, and the 10 before) with a sparkline of the last 30 whose last point beats.
 * Each sparkline has its own scale, side by side and never on one axis: there are always far fewer
 * hints than runs, and on a shared scale the hints were flat; what matters is where each one goes.
 * Hovering a sparkline marks a minute and says its counts. «Se está atascando» comes with the
 * warning colour and its icon. The sparklines are drawing only: the sentence and the counts are
 * text. Their lines end at the last complete minute, which the reading compares too.
 */
@Component({
  selector: 'app-live-rhythm',
  imports: [MatIcon, MatTooltip],
  templateUrl: './live-rhythm.html',
  host: { class: 'block', role: 'region', 'aria-labelledby': 'live-rhythm-title' },
})
export class LiveRhythm {
  /** The runs and hints by minute, the current one last. */
  readonly minutes = input.required<readonly ActivityMinute[]>();
  /** What the chart says, or null without activity. */
  readonly reading = input.required<RhythmReading | null>();

  protected readonly compared = RHYTHM_MINUTES;
  protected readonly chartBox = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;
  protected readonly baseline = CHART_HEIGHT;
  protected readonly chartWidth = CHART_WIDTH;

  /** A sparkline per measure and a hover target per minute, or null without any activity. */
  protected readonly chart = computed(() => {
    const minutes = this.minutes();
    if (sum(minutes.map((minute) => minute.runs + minute.hints)) === 0) return null;
    const complete = minutes.slice(0, -1);
    const earlier = complete.slice(-2 * RHYTHM_MINUTES, -RHYTHM_MINUTES);
    const hasBefore = this.reading() !== 'starting' && earlier.length > 0;
    const last = complete.at(-1)?.start ?? 0;

    const series = (['runs', 'hints'] as const).map((measure) => {
      const values = complete.map((minute) => minute[measure]);
      // At least 1, so a measure without any is a flat line on the floor
      const max = Math.max(...values, 1);
      const line = linePoints(values, max);
      return {
        measure,
        ...MEASURE_STYLES[measure],
        now: sum(complete.slice(-RHYTHM_MINUTES).map((minute) => minute[measure])),
        before: hasBefore ? sum(earlier.map((minute) => minute[measure])) : null,
        line,
        area: `0,${CHART_HEIGHT} ${line} ${CHART_WIDTH},${CHART_HEIGHT}`,
        /** Where the last point is, in % from the top. */
        end: (heightOf(values.at(-1) ?? 0, max) / CHART_HEIGHT) * 100,
      };
    });

    return {
      series,
      /** A hover target per minute, with what it says. */
      minutes: complete.map((minute) => {
        const ago = Math.round((last - minute.start) / MINUTE_MS) + 1;
        return {
          start: minute.start,
          label: $localize`:@@live.rhythm.minute:Hace ${ago}:minutos: min · ejecuciones: ${minute.runs}:runs: · pistas: ${minute.hints}:hints:`,
        };
      }),
    };
  });
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
