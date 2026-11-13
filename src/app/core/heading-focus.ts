import { afterNextRender, DestroyRef, DOCUMENT, inject, Injector, Service } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * After each navigation, moves the focus to the main heading of the new page (`main h1`), so screen
 * reader and keyboard users start reading the new content instead of staying on the old link
 * (4.8, D-002). The first page load is left alone: the browser already starts at the top. So is a
 * navigation that only changes the query or the fragment, such as a selector of the page (the group
 * of the live session) or a page fixing its own URL (the attempt detail): the focus stays on the
 * control, and the page is the same.
 */
@Service()
export class HeadingFocus {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  constructor() {
    /** The path of the current page, without query nor fragment; null before the first load. */
    let currentPath: string | null = null;
    // Router.events is the only API that reports finished navigations (RxJS only where an API is
    // already an Observable, 4.8).
    const subscription = inject(Router).events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      const path = event.urlAfterRedirects.split(/[?#]/)[0];
      const isNewPage = currentPath !== null && path !== currentPath;
      currentPath = path;
      if (isNewPage) {
        afterNextRender(() => this.focusHeading(), { injector: this.injector });
      }
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
