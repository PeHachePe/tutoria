import { DOCUMENT, inject, Service } from '@angular/core';

/**
 * Reloads the page, so every screen reads the data again after a change of user or a reset.
 * A class of its own so the dev toolbar tests can replace it: jsdom cannot navigate.
 */
@Service()
export class PageReloader {
  private readonly location = inject(DOCUMENT).location;

  reload(): void {
    this.location.reload();
  }
}
