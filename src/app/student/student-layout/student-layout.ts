import { afterNextRender, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbar } from '@angular/material/toolbar';
import { isActive, Router, RouterLink, RouterOutlet } from '@angular/router';

import { APP_PATHS, SEGMENTS } from '../../core/app-paths';
import { Brand } from '../../shared/brand/brand';
import { LanguageMenu } from '../../shared/language-menu/language-menu';
import type { NavLink } from '../../shared/nav-link';
import { SkipLink } from '../../shared/skip-link/skip-link';
import { ThemeMenu } from '../../shared/theme-menu/theme-menu';
import { UserMenu } from '../../shared/user-menu/user-menu';
import { DataNoticeDialog } from '../registered-data/data-notice-dialog';
import { SettingsStore } from '../settings/settings-store';

/** Settings and registered data live in the user menu: the bar keeps room for the exercise. */
const ACCOUNT_LINKS: readonly NavLink[] = [
  { path: APP_PATHS.student.settings, label: $localize`:@@nav.settings:Ajustes`, icon: 'settings' },
  {
    path: APP_PATHS.student.data,
    label: $localize`:@@nav.myData:Mis datos`,
    icon: 'shield_person',
  },
];

/** Pages to read (catalog, settings): a comfortable line length. */
export const READING_PAGE_CLASS = 'max-w-6xl';

/** The workspace: the editor needs the room of wide screens, as in the prototype (figure 17). */
export const WIDE_PAGE_CLASS = 'max-w-[100rem]';

/** Shell of the student area (2.2): brand top bar, as in the prototypes (figures 7–10). */
@Component({
  selector: 'app-student-layout',
  imports: [
    MatToolbar,
    RouterLink,
    RouterOutlet,
    Brand,
    LanguageMenu,
    ThemeMenu,
    SkipLink,
    UserMenu,
  ],
  templateUrl: './student-layout.html',
})
export class StudentLayout {
  private readonly router = inject(Router);

  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly readingPageClass = READING_PAGE_CLASS;
  protected readonly widePageClass = WIDE_PAGE_CLASS;

  /** Only the catalog is the current page of the link (`aria-current`). */
  protected readonly onCatalog = isActive(this.catalogPath, this.router, {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  });

  /** An exercise belongs to «Ejercicios»: the link stays highlighted, so the student knows where they are. */
  protected readonly onExercise = isActive(
    `${this.catalogPath}/${SEGMENTS.student.exercise}`,
    this.router,
    {
      paths: 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    },
  );

  protected readonly inExercises = computed(() => this.onCatalog() || this.onExercise());
  protected readonly accountLinks = ACCOUNT_LINKS;

  constructor() {
    const settings = inject(SettingsStore);
    const dialog = inject(MatDialog);
    // The notice on the registered data, before working (RF-07): on any page of the area, so a link
    // straight to an exercise shows it too. The data page counts as seen, so it does not cover it.
    afterNextRender(() => {
      if (!settings.dataNoticeSeen()) {
        dialog.open(DataNoticeDialog, { disableClose: true, autoFocus: 'dialog' });
      }
    });
  }
}
