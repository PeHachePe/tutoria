import { Component, input } from '@angular/core';

/**
 * Stand-in for a screen that is not built yet (step 0.6). The route gives its heading and the step
 * that builds it through `data`, bound to the inputs by `withComponentInputBinding()`. Each screen
 * step replaces it in its route.
 */
@Component({
  selector: 'app-placeholder-page',
  template: `
    <section class="flex flex-col gap-2">
      <h1 class="text-headline-small">{{ heading() }}</h1>
      <p class="text-body-large text-on-surface-variant">
        Esta pantalla se construye en el paso {{ step() }}.
      </p>
    </section>
  `,
})
export class PlaceholderPage {
  readonly heading = input.required<string>();
  readonly step = input.required<string>();
}
