import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { Role } from '../../data/user';
import { Brand } from './brand';

describe('Brand', () => {
  async function renderAs(role: Role | null) {
    const { fixture } = await render(Brand, {
      providers: [provideSessionOf(role), provideRouter([])],
    });
    await restoreSession();
    await fixture.whenStable();
  }

  it.each<[Role, string]>([
    ['student', '/alumno'],
    ['teacher', '/docente/en-vivo'],
    ['admin', '/admin/usuarios'],
  ])('takes a %s to their home', async (role, path) => {
    await renderAs(role);

    expect(screen.getByRole('link', { name: 'TutorIA' }).getAttribute('href')).toBe(path);
  });

  it('takes to the login without a session', async () => {
    await renderAs(null);

    expect(screen.getByRole('link', { name: 'TutorIA' }).getAttribute('href')).toBe('/login');
  });

  it('shows the mascot, hidden from assistive technology', async () => {
    await renderAs('student');

    const mascot = screen.getByRole('link', { name: 'TutorIA' }).querySelector('app-mascot');
    expect(mascot?.getAttribute('aria-hidden')).toBe('true');
  });
});
