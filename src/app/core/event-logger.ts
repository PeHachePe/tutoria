import { DestroyRef, DOCUMENT, inject, Service } from '@angular/core';

import { AuthStore } from '../auth/auth-store';
import { DataError, type DataErrorKind } from '../data/data-error';
import { EventService } from '../data/event-service';
import type { NewProcessEvent } from '../data/process-event';

/** The queued events are sent this long after the first of them (step 1.6). */
export const EVENT_BATCH_DELAY_MS = 5000;

/** A batch this big goes at once, without waiting for the delay. */
export const EVENT_BATCH_SIZE = 20;

/** Failures that pass on their own: the batch waits for the next send instead of being dropped. */
const PASSING_FAILURES: readonly DataErrorKind[] = ['network', 'rate_limited'];

/**
 * Queues the events only the browser knows (2.8) and sends them in batches through EventService:
 * once EVENT_BATCH_DELAY_MS have passed since the first, as soon as there are EVENT_BATCH_SIZE, when
 * the tab is hidden (the last moment a phone surely gives) and before signing out. One batch at a
 * time; a batch that fails for a passing reason goes back to the queue, any other is dropped.
 */
@Service()
export class EventLogger {
  private readonly events = inject(EventService);
  private readonly document = inject(DOCUMENT);

  /** Not state: nothing is drawn from the queue, so plain fields instead of signals. */
  private queue: readonly NewProcessEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sending: Promise<void> | undefined;

  constructor() {
    const sendIfHidden = () => {
      if (this.document.visibilityState === 'hidden') void this.flush();
    };
    this.document.addEventListener('visibilitychange', sendIfHidden);
    const removeTask = inject(AuthStore).beforeSignOut(() => this.flush());
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', sendIfHidden);
      clearTimeout(this.timer);
      removeTask();
    });
  }

  log(event: NewProcessEvent): void {
    this.queue = [...this.queue, event];
    if (this.queue.length >= EVENT_BATCH_SIZE) {
      void this.flush();
    } else {
      this.timer ??= setTimeout(() => void this.flush(), EVENT_BATCH_DELAY_MS);
    }
  }

  /** Sends what is queued now, after the batch on its way, and waits for both. Never throws. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    while (this.sending) await this.sending;
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    this.sending = this.send(batch).finally(() => (this.sending = undefined));
    await this.sending;
  }

  private async send(batch: readonly NewProcessEvent[]): Promise<void> {
    try {
      await this.events.send(batch);
    } catch (error) {
      if (error instanceof DataError && PASSING_FAILURES.includes(error.kind)) {
        // In front of what arrived meanwhile, so the events keep their order
        this.queue = [...batch, ...this.queue];
        this.timer ??= setTimeout(() => void this.flush(), EVENT_BATCH_DELAY_MS);
      }
    }
  }
}
