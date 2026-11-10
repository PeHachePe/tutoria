import type { Provider } from '@angular/core';

import { EDITING_TAB_CHANNEL, EditingTab } from './editing-tab';

/**
 * Test helpers: a BroadcastChannel in memory. `fromOtherTab()` delivers a message as another tab
 * of the browser would; `sent` keeps what this tab posted.
 */
export class FakeTabChannel extends EventTarget {
  readonly sent: unknown[] = [];
  closed = false;

  postMessage(data: unknown): void {
    this.sent.push(data);
  }

  fromOtherTab(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  close(): void {
    this.closed = true;
  }
}

/** EditingTab on a fake channel, for the stores and pages that need it. */
export function provideTestEditingTab(channel = new FakeTabChannel()): Provider[] {
  return [EditingTab, { provide: EDITING_TAB_CHANNEL, useValue: channel }];
}

/** What another tab posts when it takes the attempt. */
export function takenByOtherTab(attemptId: string) {
  return { attemptId, tabId: 'other-tab' };
}
