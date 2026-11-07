import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { LanguageService } from '../../core/language-service';
import { ThemeService } from '../../core/theme-service';
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

  it('marks the current colour mode and changes it', async () => {
    const user = await renderMenu();
    expect(screen.getByRole('menuitemradio', { name: /Tema del sistema/ }).ariaChecked).toBe(
      'true',
    );

    await user.click(screen.getByRole('menuitemradio', { name: /Tema oscuro/ }));

    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('changes the language from its submenu, which marks the current one', async () => {
    const user = await renderMenu();
    const setLocale = vi.spyOn(TestBed.inject(LanguageService), 'setLocale').mockReturnValue();

    await user.click(screen.getByRole('menuitem', { name: /Idioma/ }));
    expect(screen.getByRole('menuitemradio', { name: /Español/ }).ariaChecked).toBe('true');
    const catalan = screen.getByRole('menuitemradio', { name: /Català/ });
    expect(catalan.getAttribute('lang')).toBe('ca');
    await user.click(catalan);

    expect(setLocale).toHaveBeenCalledWith('ca');
  });

  it('signs out and goes to the login', async () => {
    const user = await renderMenu();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await user.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }));

    expect(TestBed.inject(AuthService).signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
