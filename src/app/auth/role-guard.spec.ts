import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { Role } from '../data/user';
import { provideSessionOf, restoreSession } from './auth-testing';
import { guestGuard } from './guest-guard';
import { homeRedirect } from './home-path';
import { roleGuard } from './role-guard';

@Component({ template: '<h1>Destino</h1>' })
class Target {}

describe('route guards', () => {
  async function navigateAs(role: Role | null, url: string): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        provideSessionOf(role),
        provideRouter([
          { path: '', pathMatch: 'full', redirectTo: homeRedirect },
          { path: 'login', canMatch: [guestGuard], component: Target },
          { path: 'alumno', canMatch: [roleGuard('student')], component: Target },
          { path: 'docente/en-vivo', canMatch: [roleGuard('teacher', 'admin')], component: Target },
          { path: 'admin/usuarios', canMatch: [roleGuard('admin')], component: Target },
          { path: '**', component: Target, title: '404' },
        ]),
      ],
    });
    await restoreSession();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it.each<[Role, string]>([
    ['student', '/alumno'],
    ['teacher', '/docente/en-vivo'],
    ['admin', '/admin/usuarios'],
  ])('lands a %s on %s from the root', async (role, home) => {
    expect(await navigateAs(role, '/')).toBe(home);
  });

  it('sends the root to the login without a session', async () => {
    expect(await navigateAs(null, '/')).toBe('/login');
  });

  it('sends a protected page to the login without a session, to come back after signing in', async () => {
    expect(await navigateAs(null, '/docente/en-vivo')).toBe('/login?redirect=%2Fdocente%2Fen-vivo');
  });

  it('keeps the query of the page asked for', async () => {
    expect(await navigateAs(null, '/alumno?sesion=2')).toBe(
      '/login?redirect=%2Falumno%3Fsesion%3D2',
    );
  });

  it('lets each role into its own pages', async () => {
    expect(await navigateAs('student', '/alumno')).toBe('/alumno');
  });

  it('lets the admin into the teacher pages', async () => {
    expect(await navigateAs('admin', '/docente/en-vivo')).toBe('/docente/en-vivo');
  });

  it('does not match the pages of another role, so they end in the not found page', async () => {
    await navigateAs('student', '/docente/en-vivo');

    expect(TestBed.inject(Router).url).toBe('/docente/en-vivo');
    expect(document.title).toBe('404');
  });

  it('keeps the teacher out of the admin pages', async () => {
    await navigateAs('teacher', '/admin/usuarios');

    expect(document.title).toBe('404');
  });

  it('opens the login without a session', async () => {
    expect(await navigateAs(null, '/login')).toBe('/login');
  });

  it('sends a signed-in user from the login to their home', async () => {
    expect(await navigateAs('teacher', '/login')).toBe('/docente/en-vivo');
  });
});
