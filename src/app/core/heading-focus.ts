import { afterNextRender, DestroyRef, DOCUMENT, inject, Injector, Service } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * After each navigation, moves the focus to the main heading of the new page (`main h1`), so screen
 * reader and keyboard users start reading the new content instead of staying on the old link
 * (4.8, D-002). The first page load is left alone: the browser already starts at the top.
 */
@Service()
export class HeadingFocus {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  constructor() {
    let firstNavigation = true;
    // Router.events is the only API that reports finished navigations (RxJS only where an API is
    // already an Observable, 4.8).
    const subscription = inject(Router).events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      if (firstNavigation) {
        firstNavigation = false;
        return;
      }
      afterNextRender(() => this.focusHeading(), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  private focusHeading(): void {
    const heading = this.document.querySelector<HTMLElement>('main h1');
    if (!heading) return;
    // A heading is not focusable by default; -1 makes it focusable from code only, not with Tab.
    if (!heading.hasAttribute('tabindex')) {
      heading.tabIndex = -1;
    }
    heading.focus();
  }
}
