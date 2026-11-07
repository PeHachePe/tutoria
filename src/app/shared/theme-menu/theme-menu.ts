import { Component, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';

import { THEME_OPTIONS, ThemeMode, ThemeService } from '../../core/theme-service';

const ICON_BY_MODE = new Map(THEME_OPTIONS.map((option) => [option.mode, option.icon]));

/**
 * Light, dark or system mode for the pages without a user menu, such as the login: an icon button
 * that shows the current mode and opens a menu with the three options, the current one checked.
 */
@Component({
  selector: 'app-theme-menu',
  imports: [MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip],
  template: `
    <button
      matIconButton
      type="button"
      aria-label="Cambiar el tema"
      i18n-aria-label="@@theme.button"
      matTooltip="Tema"
      i18n-matTooltip="@@theme.group"
      [matMenuTriggerFor]="menu"
    >
      <mat-icon>{{ currentIcon() }}</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @for (option of options; track option.mode) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          [attr.aria-checked]="mode() === option.mode"
          (click)="setMode(option.mode)"
        >
          <mat-icon>{{ mode() === option.mode ? 'check' : option.icon }}</mat-icon>
          <span>{{ option.label }}</span>
        </button>
      }
    </mat-menu>
  `,
})
export class ThemeMenu {
  private readonly theme = inject(ThemeService);

  protected readonly options = THEME_OPTIONS;
  protected readonly mode = this.theme.mode;
  protected readonly currentIcon = computed(() => ICON_BY_MODE.get(this.mode()));

  protected setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }
}
