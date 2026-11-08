import { Component, DestroyRef, inject, input, signal } from '@angular/core';

/** Loading indicators only appear after this wait, so they do not flicker on a fast network (4.8). */
export const LOADING_INDICATOR_DELAY_MS = 300;

/**
 * Loading state of a zone: shows the skeletons it wraps, and tells screen readers what is loading,
 * only once the wait passes `LOADING_INDICATOR_DELAY_MS` (4.8). Render it only while loading: the wait
 * starts when it is created and stops when it is removed. The zone that loads sets its own `aria-busy`.
 */
@Component({
  selector: 'app-loading-skeleton',
  template: `
    <!-- The live region is there from the start, so screen readers notice when its text arrives -->
    @if (label(); as text) {
      <p role="status" class="sr-only">{{ visible() ? text : '' }}</p>
    }
    @if (visible()) {
      <div aria-hidden="true" class="contents"><ng-content /></div>
    }
  `,
  host: { class: 'block' },
})
export class LoadingSkeleton {
  /**
   * What screen readers hear, such as «Cargando los ejercicios…». Without it, it only shows the
   * skeleton: for a second skeleton of a zone whose wait is already announced elsewhere.
   */
  readonly label = input<string>();

  protected readonly visible = signal(false);

  constructor() {
    // The component lives exactly as long as the wait, so a plain timer is enough (no effect needed).
    const timer = setTimeout(() => this.visible.set(true), LOADING_INDICATOR_DELAY_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
