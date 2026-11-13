import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import type { FeedEntry } from './live-feed';

const MINUTE_MS = 60_000;

/** The icon and its colour for each kind of entry. */
const FEED_ICONS: Record<FeedEntry['kind'], { readonly icon: string; readonly tone: string }> = {
  started: { icon: 'play_circle', tone: 'text-primary' },
  recovered: { icon: 'trending_up', tone: 'text-tertiary' },
  all_passed: { icon: 'check_circle', tone: 'text-success' },
  submitted: { icon: 'task_alt', tone: 'text-success' },
};

/**
 * «Lo último» (4.1b): a short feed of the progress of the class, the latest first, each entry with
 * the student as a link to the attempt. It is not a live region: its times change every minute and
 * a screen reader would read them all the time; the header already announces the figures.
 */
@Component({
  selector: 'app-live-feed-list',
  imports: [MatIcon, RouterLink],
  templateUrl: './live-feed-list.html',
  host: {
    role: 'region',
    'aria-labelledby': 'live-feed-title',
    class: 'flex flex-col overflow-hidden rounded-2xl bg-panel',
  },
})
export class LiveFeedList {
  readonly feed = input.required<readonly FeedEntry[]>();
  /** The clock of the panel, for «Hace N min». */
  readonly now = input.required<number>();

  protected readonly entries = computed(() =>
    this.feed().map((entry) => ({
      entry,
      ...FEED_ICONS[entry.kind],
      path: APP_PATHS.teacher.attempt(entry.attemptId),
      minutesAgo: Math.max(0, Math.floor((this.now() - entry.at) / MINUTE_MS)),
    })),
  );
}
