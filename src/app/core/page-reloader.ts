import { DOCUMENT, inject, Service } from '@angular/core';

import { APP_PATHS } from './app-paths';

/**
 * Loads the page again, so every screen reads the data again after a change of user or a reset.
 * A class of its own so the tests of the dev toolbar and the language menu can replace it: jsdom
 * cannot navigate.
 */
@Service()
export class PageReloader {
  private readonly location = inject(DOCUMENT).location;

  /** Same page, same user: after resetting the data. */
  reload(): void {
    this.location.reload();
  }

  /**
   * The root, which leads to the home of the role (or to the login): after a change of user, whose
   * role may not have the current page.
   */
  openHome(): void {
    this.location.assign(APP_PATHS.root);
  }

  /** Any page, from scratch: with the code of the latest deployment (reloadOnStaleChunk). */
  open(url: string): void {
    this.location.assign(url);
  }
}
