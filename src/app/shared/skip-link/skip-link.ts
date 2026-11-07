import { Component, DOCUMENT, inject, input } from '@angular/core';

/**
 * "Saltar al contenido" link, hidden until it gets the focus: the first stop of the keyboard in each
 * shell, so keyboard users skip the navigation (WCAG 2.4.1). It moves the focus itself instead of
 * following the `#` link, which the router would turn into a navigation.
 */
@Component({
  selector: 'app-skip-link',
  template: `
    <a
      [href]="'#' + target()"
      class="sr-only z-50 rounded-md bg-surface px-4 py-3 text-label-large text-on-surface shadow-[var(--mat-sys-level2)] focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      (click)="skip($event)"
      i18n="@@skipLink"
    >
      Saltar al contenido
    </a>
  `,
})
export class SkipLink {
  private readonly document = inject(DOCUMENT);

  /** Id of the element that gets the focus: the shell's `<main>`, with `tabindex="-1"`. */
  readonly target = input('contenido');

  protected skip(event: Event): void {
    event.preventDefault();
    this.document.getElementById(this.target())?.focus();
  }
}
