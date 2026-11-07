import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { AuthService } from '../../data/auth-service';
import type { NavLink } from '../nav-link';
import { UserMenu } from './user-menu';

const LINKS: readonly NavLink[] = [{ path: '/alumno/ajustes', label: 'Ajustes', icon: 'settings' }];

describe('UserMenu', () => {
  async function renderMenu(links: readonly NavLink[] = []) {
    localStorage.clear();
    await render(UserMenu, {
      inputs: { links },
      providers: [provideSessionOf('student'), provideRouter([])],
    });
    await restoreSession();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    return user;
  }

  afterEach(() => localStorage.clear());

  it('shows who is signed in', async () => {
    await renderMenu();

    expect(screen.getByText('Usuario student')).toBeTruthy();
    expect(screen.getByText('student@tutoria.test')).toBeTruthy();
  });

  it('adds the links of the shell', async () => {
    await renderMenu(LINKS);

    expect(screen.getByRole('menuitem', { name: /Ajustes/ }).getAttribute('href')).toBe(
      '/alumno/ajustes',
    );
  });

  it('has no extra links by default', async () => {
    await renderMenu();

    expect(screen.queryByRole('menuitem', { name: /Ajustes/ })).toBeNull();
  });

  it('signs out and goes to the login', async () => {
    const user = await renderMenu();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await user.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }));

    expect(TestBed.inject(AuthService).signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
