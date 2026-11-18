import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { activityAge } from '../live/activity-age';
import { type AttemptNow, NOW_TESTS_SHOWN } from './attempt-now';
import type { TestCount } from '../../shared/status-chip/status-chip';
import type { AttemptSummary } from './attempt-summary';
import { formatDuration } from '../../shared/format-duration';

const MINUTE_MS = 60_000;

/** Material Symbols of each kind of help, so none says it only with its words. */
const HELP_ICONS = { hint: 'lightbulb', question: 'chat', proactive: 'campaign' } as const;

/** The parts of the summary line that say something: none is zero. */
type SummaryPart = 'work' | 'runs' | 'hints';
type SummaryChip = 'questions' | 'pasted' | 'away';

/**
 * Where an attempt stands (ficha 07): the tests that fail, with what they expect and since when, and
 * the latest help of the tutor, with a line and chips under them that leave out what is zero. Its
 * title says whether the student is on it («Ahora»), left it («Dónde lo dejó») or submitted it
 * («Cómo lo resolvió»), and then it speaks in the past.
 */
@Component({
  selector: 'app-attempt-now-card',
  imports: [DatePipe, MatButton, MatIcon, MatTooltip],
  templateUrl: './attempt-now-card.html',
  host: {
    role: 'region',
    '[attr.aria-labelledby]': 'headingId',
    class: '@container flex flex-col gap-4 rounded-2xl bg-panel p-4',
  },
})
export class AttemptNowCard {
  readonly now = input.required<AttemptNow>();
  readonly summary = input.required<AttemptSummary>();
  /** Milliseconds: how long ago the latest help was. */
  readonly clock = input.required<number>();
  /** The entry or event of the timeline to go to: the latest help, or the run with every failing test. */
  readonly chosen = output<string>();

  protected readonly headingId = 'detail-now-title';
  protected readonly helpIcons = HELP_ICONS;

  /** The tests the card lists; the rest, the timeline tells them. */
  protected readonly shownTests = computed(() => this.now().tests.slice(0, NOW_TESTS_SHOWN));
  protected readonly hiddenTests = computed(() => this.now().tests.length - NOW_TESTS_SHOWN);

  protected readonly allPassed = computed(() => {
    const run = this.now().lastRun;
    return run !== null && run.passed === run.total;
  });

  /** The share of the latest run that passed; an exercise without tests draws an empty bar. */
  protected percent(run: TestCount): number {
    return (run.passed / Math.max(run.total, 1)) * 100;
  }

  protected readonly helpAge = computed(() => {
    const help = this.now().help;
    return help && activityAge(help.at, this.clock());
  });

  protected readonly parts = computed(() => {
    const { workMs, runs, hints } = this.summary();
    const parts: SummaryPart[] = [];
    if (workMs >= MINUTE_MS) parts.push('work');
    if (runs > 0) parts.push('runs');
    if (hints > 0) parts.push('hints');
    return parts;
  });

  protected readonly chips = computed(() => {
    const { questions, pastedChars, awayMs } = this.summary();
    const chips: SummaryChip[] = [];
    if (questions > 0) chips.push('questions');
    if (pastedChars > 0) chips.push('pasted');
    if (awayMs > 0) chips.push('away');
    return chips;
  });

  protected duration(ms: number): string {
    return formatDuration(ms);
  }
}
