import { Component, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/language-service';
import { AppLocale, LANGUAGE_OPTIONS } from '../../core/locale';
import { THEME_OPTIONS, ThemeMode, ThemeService } from '../../core/theme-service';
import type { NavLink } from '../nav-link';

/**
 * Account menu of the shells: who is signed in, the colour mode and the language (the only place
 * where they can be changed once signed in) and "Cerrar sesión". Each shell may add its own links on top.
 */
@Component({
  selector: 'app-user-menu',
  imports: [
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatDivider,
    MatTooltip,
    RouterLink,
  ],
  templateUrl: './user-menu.html',
})
export class UserMenu {
  private readonly auth = inject(AuthStore);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  readonly links = input<readonly NavLink[]>([]);

  protected readonly user = this.auth.user;
  protected readonly mode = this.theme.mode;
  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly locale = this.language.locale;
  protected readonly languageOptions = LANGUAGE_OPTIONS;

  protected setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected setLocale(locale: AppLocale): void {
    this.language.setLocale(locale);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl(APP_PATHS.login);
  }
}
