import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, map } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { Role } from '../../data/user';
import { SIDE_MENU_FOLDED_KEY, StaffLayout } from './staff-layout';

@Component({ template: '<h1>Página</h1>' })
class Page {}

/** Replaces the media queries of the browser: `wide` decides the layout. */
class FakeBreakpoints {
  readonly wide = new BehaviorSubject(true);
  isMatched = () => this.wide.value;
  observe = () => this.wide.pipe(map((matches): BreakpointState => ({ matches, breakpoints: {} })));
}

describe('StaffLayout', () => {
  let breakpoints: FakeBreakpoints;

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  async function renderAs(role: Role, wide = true, url = '/docente/en-vivo') {
    breakpoints = new FakeBreakpoints();
    breakpoints.wide.next(wide);
    TestBed.configureTestingModule({
      providers: [
        provideSessionOf(role),
        { provide: BreakpointObserver, useValue: breakpoints },
        // Material reports a closed menu when its animation ends, which jsdom never plays
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideRouter([
          {
            path: '',
            component: StaffLayout,
            children: [
              { path: 'docente/en-vivo', component: Page },
              { path: 'docente/historico', component: Page },
            ],
          },
        ]),
      ],
    });
    await restoreSession();
    const harness = await RouterTestingHarness.create(url);
    return { harness, user: userEvent.setup() };
  }

  function menu() {
    return screen.getByRole('navigation', { name: 'Principal' });
  }

  it('shows the teacher sections to a teacher, marking the current page', async () => {
    await renderAs('teacher');

    expect(within(menu()).getByRole('heading', { name: 'Docencia' })).toBeTruthy();
    expect(within(menu()).queryByRole('heading', { name: 'Administración' })).toBeNull();
    expect(within(menu()).getByRole('link', { name: /En vivo/ }).ariaCurrent).toBe('page');
    expect(within(menu()).getByRole('link', { name: /Histórico/ }).ariaCurrent).toBeNull();
  });

  it('adds the administration section for an admin', async () => {
    await renderAs('admin');

    expect(
      within(menu())
        .getByRole('link', { name: /Usuarios/ })
        .getAttribute('href'),
    ).toBe('/admin/usuarios');
    expect(within(menu()).getByRole('link', { name: /Sistema/ })).toBeTruthy();
  });

  it('draws the page inside the main landmark, after a skip link', async () => {
    await renderAs('teacher');

    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Página' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Menú de usuario' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar el tema' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar el idioma' })).toBeTruthy();
  });

  it('keeps the menu open beside the content on wide screens, with its names', async () => {
    const { user, harness } = await renderAs('teacher');

    expect(screen.getByRole('button', { name: 'Menú de navegación' }).ariaExpanded).toBe('true');
    await user.click(within(menu()).getByRole('link', { name: /Histórico/ }));
    await harness.fixture.whenStable();

    expect(menu().closest('mat-sidenav')?.classList).toContain('mat-drawer-opened');
    expect(within(menu()).getByText('Histórico').classList).not.toContain('sr-only');
  });

  it('has a brand that leads to the home of the role', async () => {
    await renderAs('admin');

    expect(screen.getByRole('link', { name: 'TutorIA' }).getAttribute('href')).toBe(
      '/admin/usuarios',
    );
  });

  it('on wide screens, folds the menu to its icons, with a tooltip each, and unfolds it', async () => {
    const { user, harness } = await renderAs('teacher');
    const button = screen.getByRole('button', { name: 'Menú de navegación' });

    await user.click(button);
    await harness.fixture.whenStable();

    expect(button.ariaExpanded).toBe('false');
    expect(menu().closest('mat-sidenav')?.classList).toContain('app-side-menu-rail');
    const history = within(menu()).getByRole('link', { name: 'Histórico' });
    expect(within(history).getByText('Histórico').classList).toContain('sr-only');
    expect(within(menu()).getByRole('heading', { name: 'Docencia' }).classList).toContain(
      'sr-only',
    );
    await user.hover(history);
    // The tooltip has no role: it is the second "Histórico", outside the link
    await waitFor(() => expect(screen.getAllByText('Histórico')).toHaveLength(2));
    expect(localStorage.getItem(SIDE_MENU_FOLDED_KEY)).toBe('true');

    await user.click(button);
    await harness.fixture.whenStable();

    expect(button.ariaExpanded).toBe('true');
    expect(menu().closest('mat-sidenav')?.classList).not.toContain('app-side-menu-rail');
    expect(localStorage.getItem(SIDE_MENU_FOLDED_KEY)).toBe('false');
  });

  it('does not repeat the name of a link as its description', async () => {
    const { user, harness } = await renderAs('teacher');

    await user.click(screen.getByRole('button', { name: 'Menú de navegación' }));
    await harness.fixture.whenStable();

    const live = within(menu()).getByRole('link', { name: 'En vivo' });
    expect(live.getAttribute('aria-describedby')).toBeNull();
  });

  it('keeps the menu folded on the next visit, with a line between the sections', async () => {
    localStorage.setItem(SIDE_MENU_FOLDED_KEY, 'true');
    await renderAs('admin');

    expect(screen.getByRole('button', { name: 'Menú de navegación' }).ariaExpanded).toBe('false');
    expect(within(menu()).getAllByRole('separator')).toHaveLength(1);
  });

  it('only folds on wide screens: on small ones the menu slides over the content', async () => {
    localStorage.setItem(SIDE_MENU_FOLDED_KEY, 'true');
    const { user, harness } = await renderAs('teacher', false);

    await user.click(screen.getByRole('button', { name: 'Menú de navegación' }));
    await harness.fixture.whenStable();

    expect(menu().closest('mat-sidenav')?.classList).not.toContain('app-side-menu-rail');
    expect(within(menu()).getByText('Histórico').classList).not.toContain('sr-only');
  });

  it('works without storage: starts unfolded and folds until the page is closed', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { user, harness } = await renderAs('teacher');
    const button = screen.getByRole('button', { name: 'Menú de navegación' });
    expect(button.ariaExpanded).toBe('true');

    await user.click(button);
    await harness.fixture.whenStable();

    expect(button.ariaExpanded).toBe('false');
  });

  it('folds the menu on small screens: the button opens it and choosing a page closes it', async () => {
    const { user, harness } = await renderAs('teacher', false);
    const button = screen.getByRole('button', { name: 'Menú de navegación' });
    expect(button.ariaExpanded).toBe('false');

    await user.click(button);
    await harness.fixture.whenStable();
    expect(button.ariaExpanded).toBe('true');

    await user.click(within(menu()).getByRole('link', { name: /Histórico/ }));
    await harness.fixture.whenStable();
    expect(button.ariaExpanded).toBe('false');
  });

  it('on small screens, Escape also closes the menu', async () => {
    const { user, harness } = await renderAs('teacher', false);
    const button = screen.getByRole('button', { name: 'Menú de navegación' });
    await user.click(button);
    await harness.fixture.whenStable();

    // Material reads the old keyCode, which user-event does not set
    fireEvent.keyDown(within(menu()).getByRole('link', { name: /En vivo/ }), {
      key: 'Escape',
      keyCode: 27,
    });

    await waitFor(() => expect(button.ariaExpanded).toBe('false'));
  });

  it('on small screens, opening the menu focuses the link of the current page, not the first one', async () => {
    const { user, harness } = await renderAs('teacher', false, '/docente/historico');

    await user.click(screen.getByRole('button', { name: 'Menú de navegación' }));
    await harness.fixture.whenStable();

    expect(document.activeElement).toBe(within(menu()).getByRole('link', { name: /Histórico/ }));
  });

  it('on wide screens the docked menu leaves the focus alone, for the page heading', async () => {
    const { harness } = await renderAs('teacher', true, '/docente/historico');
    await harness.fixture.whenStable();

    expect(menu().contains(document.activeElement)).toBe(false);
  });

  it('switches between both layouts when the screen width changes', async () => {
    const { harness } = await renderAs('teacher');

    breakpoints.wide.next(false);
    await harness.fixture.whenStable();

    expect(screen.getByRole('button', { name: 'Menú de navegación' }).ariaExpanded).toBe('false');
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
  });
});
