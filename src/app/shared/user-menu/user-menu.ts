import { Component, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS } from '../../core/app-paths';
import type { NavLink } from '../nav-link';

/**
 * Account menu of the shells: who is signed in and "Cerrar sesión", and each shell may add its own
 * links on top. The colour mode and the language have their own buttons in the bar, as in the login
 * (ThemeMenu and LanguageMenu, step 1.1d).
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
  private readonly router = inject(Router);

  readonly links = input<readonly NavLink[]>([]);

  protected readonly user = this.auth.user;

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl(APP_PATHS.login);
  }
}
