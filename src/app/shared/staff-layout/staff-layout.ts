import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS } from '../../core/app-paths';
import { GUIDE_ANCHORS, GuideAnchor, type GuideAnchorId } from '../../core/guide/guide-anchor';
import { GuideStore } from '../../core/guide/guide-store';
import { HelpButton } from '../../core/guide/help-button/help-button';
import { STAFF_GUIDE } from '../../core/guide/staff-guide-token';
import { DEV_PATHS } from '../../dev/dev-paths';
import { Brand } from '../brand/brand';
import { LanguageMenu } from '../language-menu/language-menu';
import type { NavLink } from '../nav-link';
import { SkipLink } from '../skip-link/skip-link';
import { ThemeMenu } from '../theme-menu/theme-menu';
import { UserMenu } from '../user-menu/user-menu';

/** An entry of the menu, with the id the guided help points it at. */
interface StaffLink extends NavLink {
  readonly anchor?: GuideAnchorId;
}

interface NavSection {
  readonly label: string;
  readonly links: readonly StaffLink[];
  /** The whole section, for the guided help of the administration (7.0b2). */
  readonly anchor: GuideAnchorId;
}

const A = GUIDE_ANCHORS;

const TEACHING: NavSection = {
  label: $localize`:@@staff.teaching:Docencia`,
  anchor: A.navTeaching,
  links: [
    {
      path: APP_PATHS.teacher.live,
      label: $localize`:@@nav.live:En vivo`,
      icon: 'sensors',
      anchor: A.navLive,
    },
    {
      path: APP_PATHS.teacher.history,
      label: $localize`:@@nav.history:Histórico`,
      icon: 'insights',
      anchor: A.navHistory,
    },
    {
      path: APP_PATHS.teacher.exercises,
      label: $localize`:@@nav.exercises:Ejercicios`,
      icon: 'assignment',
      anchor: A.navBank,
    },
    {
      path: APP_PATHS.teacher.blocks,
      label: $localize`:@@nav.blocks:Bloques`,
      icon: 'view_agenda',
      anchor: A.navBlocks,
    },
    {
      path: APP_PATHS.teacher.groups,
      label: $localize`:@@nav.groups:Grupos`,
      icon: 'groups',
      anchor: A.navGroups,
    },
  ],
};

const ADMINISTRATION: NavSection = {
  label: $localize`:@@staff.administration:Administración`,
  anchor: A.navAdministration,
  links: [
    {
      path: APP_PATHS.admin.users,
      label: $localize`:@@nav.users:Usuarios`,
      icon: 'manage_accounts',
      anchor: A.navUsers,
    },
    {
      path: APP_PATHS.admin.system,
      label: $localize`:@@nav.system:Sistema`,
      icon: 'tune',
      anchor: A.navSystem,
    },
    // Every build serves the showcase to the administration, production included (D-053)
    {
      path: DEV_PATHS.showcase,
      label: $localize`:@@nav.showcase:Muestrario`,
      icon: 'palette',
      anchor: A.navShowcase,
    },
  ],
};

const CURRENT_PAGE_LINK = '[aria-current="page"]';

/** From this width the side menu stays open beside the content; below it, it slides over it. */
const WIDE_LAYOUT = '(min-width: 1024px)';

/** Whether the docked menu was left folded to icons, so it stays so on the next visit. */
export const SIDE_MENU_FOLDED_KEY = 'tutoria.side-menu-folded';

/**
 * Shell of the teacher and admin areas (2.2): one layout for both, because the admin also works in
 * every teacher screen and sees the same menu wherever they are. Brand top bar and a side menu that
 * slides away on small screens and, on wide ones, folds to its icons with tooltips (step 1.1d).
 */
@Component({
  selector: 'app-staff-layout',
  imports: [
    MatToolbar,
    MatTooltip,
    MatDivider,
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
    Brand,
    GuideAnchor,
    HelpButton,
    LanguageMenu,
    ThemeMenu,
    SkipLink,
    UserMenu,
  ],
  templateUrl: './staff-layout.html',
})
export class StaffLayout {
  private readonly auth = inject(AuthStore);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly anchors = GUIDE_ANCHORS;
  private readonly sidenav = viewChild.required<MatSidenav>('sidenav');

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

  /** Wide screens: the docked menu folded to its icons. */
  private readonly folded = signal(readFolded());
  /** Small screens: the menu open over the content. */
  protected readonly openOver = signal(false);

  protected readonly rail = computed(() => this.wide() && this.folded());
  /** Whether the menu shows its names, for the button that folds it or opens it. */
  protected readonly expanded = computed(() => (this.wide() ? !this.folded() : this.openOver()));

  /**
   * The guided help of the role, if it has one yet (2.12, D-093): its tours open the menu over the
   * content to point at an entry, and close it after (D-094).
   */
  protected readonly guided = this.useGuide();

  protected toggleMenu(): void {
    if (this.wide()) {
      this.folded.update((folded) => !folded);
      saveFolded(this.folded());
    } else {
      this.openOver.update((open) => !open);
    }
  }

  /**
   * Over the content, Material also closes the menu with its backdrop and with Escape. Only closing
   * is followed: opening always comes from the button, and the docked menu reports it is open.
   */
  protected syncOpenOver(open: boolean): void {
    if (!open) {
      this.openOver.set(false);
    }
  }

  /** On small screens the menu covers the content, so it closes once a page is chosen. */
  protected closeIfOver(): void {
    this.openOver.set(false);
  }

  private useGuide(): boolean {
    const profile = inject(STAFF_GUIDE, { optional: true })?.({
      open: () => this.openForGuide(),
      close: () => this.closeIfOver(),
      closed: () => firstValueFrom(this.sidenav().openedChange.pipe(filter((open) => !open))),
    });
    if (profile) inject(GuideStore).use(profile);
    return !!profile;
  }

  /**
   * For a tour, over the content: once it has slid in, so the globe measures the entry where it
   * stays. Docked it is open already, and a folded menu shows its icons, which the globe names.
   */
  private openForGuide(): Promise<unknown> | undefined {
    const sidenav = this.sidenav();
    if (this.wide() || sidenav.opened) return undefined;
    // Opened by hand: right after Esc closed it, the binding would not see the flag change back
    this.openOver.set(true);
    return sidenav.open();
  }
}

function readFolded(): boolean {
  try {
    return localStorage.getItem(SIDE_MENU_FOLDED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveFolded(folded: boolean): void {
  try {
    localStorage.setItem(SIDE_MENU_FOLDED_KEY, String(folded));
  } catch {
    // Storage unavailable (blocked or full): the menu keeps its state until the page is closed.
  }
}
