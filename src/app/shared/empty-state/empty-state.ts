import { Component, input } from '@angular/core';

/**
 * Empty state of a screen or a zone (5.4): a short title and what the user can expect, with an
 * optional illustration projected inside, such as the mascot.
 */
@Component({
  selector: 'app-empty-state',
  template: `
    <ng-content />
    <p class="text-title-medium">{{ heading() }}</p>
    @if (text(); as text) {
      <p class="max-w-prose text-body-medium text-on-surface-variant">{{ text }}</p>
    }
  `,
  host: {
    class: 'flex flex-col items-center gap-2 rounded-xl bg-panel px-6 py-10 text-center',
  },
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly text = input<string>();
}
