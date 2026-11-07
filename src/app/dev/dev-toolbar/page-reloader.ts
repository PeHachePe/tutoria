import { DOCUMENT, inject, Service } from '@angular/core';

/**
 * Loads the page again, so every screen reads the data again after a change of user or a reset.
 * A class of its own so the dev toolbar tests can replace it: jsdom cannot navigate.
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
    this.location.assign('/');
  }
}
