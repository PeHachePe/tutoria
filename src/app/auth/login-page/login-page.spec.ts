import { Component, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthService } from '../../data/auth-service';
import { DataError } from '../../data/data-error';
import type { AppUser } from '../../data/user';
import { AuthStore } from '../auth-store';
import { FakeAuthService, userWith } from '../auth-testing';
import { DEMO_ACCOUNTS, DemoAccount } from '../demo-accounts';
import { LoginPage } from './login-page';

@Component({ template: '<h1>Destino</h1>' })
class Target {}

const STUDENT = userWith('student');

const DEMO: DemoAccount = {
  label: 'Alumna',
  detail: 'Lucía Martín Gómez · 1.º DAW A',
  icon: 'school',
  email: 'lucia.martin@tutoria.test',
  password: 'tutoria',
};

describe('LoginPage', () => {
  let service: FakeAuthService;

  async function renderLogin(options: { redirect?: string; providers?: Provider[] } = {}) {
    service = new FakeAuthService();
    service.signIn.mockResolvedValue(STUDENT);
    await render(LoginPage, {
      inputs: options.redirect === undefined ? {} : { redirect: options.redirect },
      providers: [
        { provide: AuthService, useValue: service },
        provideRouter([{ path: '**', component: Target }]),
        ...(options.providers ?? []),
      ],
    });
    return userEvent.setup();
  }

  const emailInput = () => screen.getByLabelText(/^Correo/);
  const passwordInput = () => screen.getByLabelText(/^Contraseña/);
  const submitButton = () => screen.getByRole('button', { name: /^(Entrar|Entrando…)$/ });

  async function fillIn(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
    await user.type(emailInput(), email);
    await user.type(passwordInput(), password);
  }

  const currentUrl = () => TestBed.inject(Router).url;

  it('welcomes with the mascot, which is decorative', async () => {
    await renderLogin();

    const mascot = document.querySelector('app-mascot');
    expect(mascot?.classList).toContain('mascot-joy');
    expect(mascot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows what is missing under each field and focuses the first one, without sending', async () => {
    const user = await renderLogin();

    await user.click(submitButton());

    expect(await screen.findByText('Introduce tu correo')).toBeTruthy();
    expect(screen.getByText('Introduce tu contraseña')).toBeTruthy();
    expect(document.activeElement).toBe(emailInput());
    expect(service.signIn).not.toHaveBeenCalled();
  });

  it('rejects an email that is not valid and focuses it', async () => {
    const user = await renderLogin();

    await fillIn(user, 'lucia', 'tutoria');
    await user.click(submitButton());

    expect(await screen.findByText('El correo no es válido')).toBeTruthy();
    expect(document.activeElement).toBe(emailInput());
    expect(service.signIn).not.toHaveBeenCalled();
  });

  it('says "Entrando…" while signing in, then goes to the root, which leads to the home of the role', async () => {
    let finish!: (user: AppUser) => void;
    const user = await renderLogin();
    service.signIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await fillIn(user, 'lucia.martin@tutoria.test', 'tutoria');
    await user.click(submitButton());

    expect(service.signIn).toHaveBeenCalledWith({
      email: 'lucia.martin@tutoria.test',
      password: 'tutoria',
    });
    await waitFor(() => expect(submitButton().textContent?.trim()).toBe('Entrando…'));
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);

    finish(STUDENT);

    await waitFor(() => expect(currentUrl()).toBe('/'));
  });

  it('goes back to the page asked for without a session', async () => {
    const user = await renderLogin({ redirect: '/alumno/ajustes' });

    await fillIn(user, 'lucia.martin@tutoria.test', 'tutoria');
    await user.click(submitButton());

    await waitFor(() => expect(currentUrl()).toBe('/alumno/ajustes'));
  });

  it('ignores a redirect outside the app', async () => {
    const user = await renderLogin({ redirect: '//evil.example' });

    await fillIn(user, 'lucia.martin@tutoria.test', 'tutoria');
    await user.click(submitButton());

    await waitFor(() => expect(currentUrl()).toBe('/'));
  });

  it('shows the error of the server as an alert of the form and lets the user try again', async () => {
    const user = await renderLogin();
    service.signIn.mockRejectedValueOnce(new DataError('unauthorized'));

    await fillIn(user, 'lucia.martin@tutoria.test', 'mal');
    await user.click(submitButton());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Correo o contraseña incorrectos',
    );
    expect(submitButton().textContent?.trim()).toBe('Entrar');
    expect(currentUrl()).toBe('/');

    await user.clear(passwordInput());
    await user.type(passwordInput(), 'tutoria');
    await user.click(submitButton());

    await waitFor(() => expect(service.signIn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('tells a network failure from wrong credentials', async () => {
    const user = await renderLogin();
    service.signIn.mockRejectedValueOnce(new DataError('network'));

    await fillIn(user, 'lucia.martin@tutoria.test', 'tutoria');
    await user.click(submitButton());

    expect((await screen.findByRole('alert')).textContent).toContain('No hay conexión');
  });

  it('shows and hides the password without losing it', async () => {
    const user = await renderLogin();
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    await user.type(passwordInput(), 'tutoria');

    expect(passwordInput().getAttribute('type')).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    await user.click(toggle);

    expect(passwordInput().getAttribute('type')).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect((passwordInput() as HTMLInputElement).value).toBe('tutoria');

    await user.click(toggle);

    expect(passwordInput().getAttribute('type')).toBe('password');
  });

  it('helps the password managers', async () => {
    await renderLogin();

    expect(emailInput().getAttribute('autocomplete')).toBe('username');
    expect(passwordInput().getAttribute('autocomplete')).toBe('current-password');
  });

  it('offers no demo accounts unless the environment provides them', async () => {
    await renderLogin();

    expect(screen.queryByRole('button', { name: 'Cuentas de demostración' })).toBeNull();
  });

  it('keeps the demo accounts in a menu, so they do not push the login card', async () => {
    const user = await renderLogin({ providers: [{ provide: DEMO_ACCOUNTS, useValue: [DEMO] }] });

    expect(screen.queryByRole('menuitem', { name: /Alumna/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cuentas de demostración' }));

    expect(await screen.findByRole('menuitem', { name: /Lucía Martín Gómez/ })).toBeTruthy();
  });

  it('signs in with a demo account from the menu', async () => {
    const user = await renderLogin({ providers: [{ provide: DEMO_ACCOUNTS, useValue: [DEMO] }] });

    await user.click(screen.getByRole('button', { name: 'Cuentas de demostración' }));
    await user.click(await screen.findByRole('menuitem', { name: /Alumna/ }));

    expect(service.signIn).toHaveBeenCalledWith({ email: DEMO.email, password: DEMO.password });
    await waitFor(() => expect(currentUrl()).toBe('/'));
  });
  it('lets the visitor change the colour mode before signing in', async () => {
    await renderLogin();

    expect(screen.getByRole('button', { name: 'Cambiar el tema' })).toBeTruthy();
  });

  describe('when the session ended without signing out', () => {
    it('says it closed, maybe in another tab, and that signing in brings back the page', async () => {
      await renderLogin();
      service.currentUser.mockResolvedValue(STUDENT);
      await TestBed.inject(AuthStore).restore();

      service.sessionListener?.(null);

      expect((await screen.findByRole('status')).textContent).toContain(
        'Se ha cerrado tu sesión, quizá en otra pestaña. Vuelve a entrar para seguir donde lo dejaste.',
      );
    });

    it('says it expired after «Volver a entrar»', async () => {
      await renderLogin();

      await TestBed.inject(AuthStore).signInAgain();

      expect((await screen.findByRole('status')).textContent).toContain(
        'Tu sesión ha caducado. Vuelve a entrar para seguir donde lo dejaste.',
      );
    });

    it('says nothing after signing out on purpose', async () => {
      await renderLogin();

      await TestBed.inject(AuthStore).signOut();

      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
