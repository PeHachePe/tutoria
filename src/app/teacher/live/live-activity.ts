import { Component, computed, input } from '@angular/core';

import { type ActivityMinute, LIVE_ACTIVITY_MINUTES } from './activity-by-minute';

const MINUTE_MS = 60_000;

/** The drawing box of the chart: it stretches to the width of the card. */
const CHART_WIDTH = 300;
const CHART_HEIGHT = 100;
/** Room over the highest point, so its line is not cut. */
const CHART_TOP = 6;

/** The points of a line over the minutes, scaled to `max`. */
function linePoints(values: readonly number[], max: number): string {
  const step = CHART_WIDTH / Math.max(1, values.length - 1);
  return values
    .map((value, index) => {
      const y = CHART_HEIGHT - (value / max) * (CHART_HEIGHT - CHART_TOP);
      return `${round(index * step)},${round(y)}`;
    })
    .join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * «Actividad» (4.1b): how busy the class has been in the last minutes, as two lines (runs and
 * hints) with their totals in text. It tells the teacher at a glance whether the class works, gets
 * stuck (the hints climb) or stops. The chart is drawing only: the text says what it shows.
 */
@Component({
  selector: 'app-live-activity',
  templateUrl: './live-activity.html',
  host: {
    role: 'region',
    'aria-labelledby': 'live-activity-title',
    class: 'flex flex-col overflow-hidden rounded-2xl bg-panel',
  },
})
export class LiveActivity {
  /** The runs and hints by minute, the current one last. */
  readonly minutes = input.required<readonly ActivityMinute[]>();

  protected readonly windowMinutes = LIVE_ACTIVITY_MINUTES;
  protected readonly chartBox = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;
  protected readonly baseline = CHART_HEIGHT;
  protected readonly chartWidth = CHART_WIDTH;

  /** The lines and their figures, or null without any activity to draw. */
  protected readonly chart = computed(() => {
    const minutes = this.minutes();
    const runs = minutes.map((minute) => minute.runs);
    const hints = minutes.map((minute) => minute.hints);
    const max = Math.max(...runs, ...hints, 0);
    if (max === 0) return null;
    const peak = minutes.reduce((best, minute) =>
      minute.runs + minute.hints > best.runs + best.hints ? minute : best,
    );
    const runsLine = linePoints(runs, max);
    return {
      max,
      runs: sum(runs),
      hints: sum(hints),
      runsLine,
      runsArea: `0,${CHART_HEIGHT} ${runsLine} ${CHART_WIDTH},${CHART_HEIGHT}`,
      hintsLine: linePoints(hints, max),
      peakMinutesAgo: Math.round((minutes[minutes.length - 1].start - peak.start) / MINUTE_MS),
    };
  });
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
