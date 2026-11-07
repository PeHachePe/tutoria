import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS } from '../../core/app-paths';
import { APP_NAME } from '../../core/app-title-strategy';
import type { NavLink } from '../nav-link';
import { SkipLink } from '../skip-link/skip-link';
import { UserMenu } from '../user-menu/user-menu';

interface NavSection {
  readonly label: string;
  readonly links: readonly NavLink[];
}

const TEACHING: NavSection = {
  label: $localize`:@@staff.teaching:Docencia`,
  links: [
    { path: APP_PATHS.teacher.live, label: $localize`:@@nav.live:En vivo`, icon: 'sensors' },
    {
      path: APP_PATHS.teacher.history,
      label: $localize`:@@nav.history:Histórico`,
      icon: 'insights',
    },
    {
      path: APP_PATHS.teacher.exercises,
      label: $localize`:@@nav.exercises:Ejercicios`,
      icon: 'assignment',
    },
    { path: APP_PATHS.teacher.groups, label: $localize`:@@nav.groups:Grupos`, icon: 'groups' },
  ],
};

const ADMINISTRATION: NavSection = {
  label: $localize`:@@staff.administration:Administración`,
  links: [
    {
      path: APP_PATHS.admin.users,
      label: $localize`:@@nav.users:Usuarios`,
      icon: 'manage_accounts',
    },
    { path: APP_PATHS.admin.system, label: $localize`:@@nav.system:Sistema`, icon: 'tune' },
  ],
};

const CURRENT_PAGE_LINK = '[aria-current="page"]';

/** From this width the side menu stays open beside the content; below it, it slides over it. */
export const WIDE_LAYOUT = '(min-width: 1024px)';

/**
 * Shell of the teacher and admin areas (2.2): one layout for both, because the admin also works in
 * every teacher screen and sees the same menu wherever they are. Brand top bar and a side menu
 * that folds away on small screens.
 */
@Component({
  selector: 'app-staff-layout',
  imports: [
    MatToolbar,
    MatIconButton,
    MatIcon,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatNavList,
    MatListItem,
    MatListItemIcon,
    MatListItemTitle,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SkipLink,
    UserMenu,
  ],
  templateUrl: './staff-layout.html',
})
export class StaffLayout {
  private readonly auth = inject(AuthStore);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly sidenav = viewChild.required<MatSidenav>('sidenav');

  protected readonly appName = APP_NAME;

  /** BreakpointObserver only offers an Observable: it is turned into a signal at once. */
  protected readonly wide = toSignal(
    this.breakpoints.observe(WIDE_LAYOUT).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(WIDE_LAYOUT) },
  );

  /**
   * Where the focus goes when the menu opens. Over the content, to the current page, which is
   * already highlighted, instead of Material's first link. Docked beside the content it is part of
   * the page and must not take the focus from the page heading (HeadingFocus).
   */
  protected readonly menuFocus = computed(() => (this.wide() ? false : CURRENT_PAGE_LINK));

  protected readonly sections = computed(() =>
    this.auth.role() === 'admin' ? [TEACHING, ADMINISTRATION] : [TEACHING],
  );

  /** On small screens the menu covers the content, so it closes once a page is chosen. */
  protected closeIfOver(): void {
    if (!this.wide()) {
      void this.sidenav().close();
    }
  }

  protected toggleMenu(): void {
    void this.sidenav().toggle();
  }
}
