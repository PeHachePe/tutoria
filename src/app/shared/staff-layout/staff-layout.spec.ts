import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, map } from 'rxjs';
import { TestBed } from '@angular/core/testing';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { Role } from '../../data/user';
import { StaffLayout } from './staff-layout';

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

  async function renderAs(role: Role, wide = true, url = '/docente/en-vivo') {
    breakpoints = new FakeBreakpoints();
    breakpoints.wide.next(wide);
    TestBed.configureTestingModule({
      providers: [
        provideSessionOf(role),
        { provide: BreakpointObserver, useValue: breakpoints },
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
  });

  it('keeps the menu open beside the content on wide screens, without a button to fold it', async () => {
    const { user, harness } = await renderAs('teacher');

    expect(screen.queryByRole('button', { name: 'Menú de navegación' })).toBeNull();

    await user.click(within(menu()).getByRole('link', { name: /Histórico/ }));
    await harness.fixture.whenStable();

    expect(menu().closest('mat-sidenav')?.classList).toContain('mat-drawer-opened');
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

    expect(screen.getByRole('button', { name: 'Menú de navegación' })).toBeTruthy();
  });
});
