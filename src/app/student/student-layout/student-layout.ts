import { Component } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import type { NavLink } from '../../shared/nav-link';
import { SkipLink } from '../../shared/skip-link/skip-link';
import { UserMenu } from '../../shared/user-menu/user-menu';

/** Settings and registered data live in the user menu: the bar keeps room for the exercise. */
const ACCOUNT_LINKS: readonly NavLink[] = [
  { path: APP_PATHS.student.settings, label: 'Ajustes', icon: 'settings' },
  { path: APP_PATHS.student.data, label: 'Mis datos', icon: 'shield_person' },
];

/** Shell of the student area (2.2): brand top bar, as in the prototypes (figures 7–10). */
@Component({
  selector: 'app-student-layout',
  imports: [MatToolbar, RouterLink, RouterLinkActive, RouterOutlet, SkipLink, UserMenu],
  templateUrl: './student-layout.html',
})
export class StudentLayout {
  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly accountLinks = ACCOUNT_LINKS;
}
