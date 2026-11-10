import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';

import { LanguageService } from '../../core/i18n/language-service';
import { AppLocale, LANGUAGE_OPTIONS } from '../../core/i18n/locale';

/**
 * Language of the interface, in the bar of the login and of the shells: an icon button that opens
 * the languages, the current one highlighted and checked (theme.scss). Each is written in its own
 * language and with its `lang`, so a screen reader pronounces it right (WCAG 3.1.2). Choosing one
 * loads the page again in it (D-023).
 */
@Component({
  selector: 'app-language-menu',
  imports: [MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip],
  template: `
    <button
      matIconButton
      type="button"
      aria-label="Cambiar el idioma"
      i18n-aria-label="@@language.button"
      matTooltip="Idioma"
      i18n-matTooltip="@@language.group"
      [matMenuTriggerFor]="menu"
    >
      <mat-icon>translate</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @for (option of options; track option.locale) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          [attr.lang]="option.locale"
          [attr.aria-checked]="locale === option.locale"
          (click)="setLocale(option.locale)"
        >
          <mat-icon>language</mat-icon>
          <span class="flex w-full items-center justify-between gap-4">
            {{ option.label }}
            @if (locale === option.locale) {
              <mat-icon>check</mat-icon>
            }
          </span>
        </button>
      }
    </mat-menu>
  `,
})
export class LanguageMenu {
  private readonly language = inject(LanguageService);

  protected readonly options = LANGUAGE_OPTIONS;
  protected readonly locale = this.language.locale;

  protected setLocale(locale: AppLocale): void {
    this.language.setLocale(locale);
  }
}
