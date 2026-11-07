import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { StudentLayout } from './student-layout';

@Component({ template: '<h1>Página</h1>' })
class Page {}

describe('StudentLayout', () => {
  async function renderAt(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideSessionOf('student'),
        provideRouter([
          {
            path: 'alumno',
            component: StudentLayout,
            children: [
              { path: '', component: Page },
              { path: 'ajustes', component: Page },
            ],
          },
        ]),
      ],
    });
    await restoreSession();
    await RouterTestingHarness.create(url);
  }

  it('has a top bar with the main navigation, and the page inside the main landmark', async () => {
    await renderAt('/alumno');

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Ejercicios' }).ariaCurrent).toBe('page');
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Página' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toBeTruthy();
  });

  it('does not mark Ejercicios on the other pages of the area', async () => {
    await renderAt('/alumno/ajustes');

    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Ejercicios' }).ariaCurrent).toBeNull();
  });

  it('puts settings and registered data in the user menu', async () => {
    await renderAt('/alumno');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Menú de usuario' }));

    expect(screen.getByRole('menuitem', { name: /Ajustes/ }).getAttribute('href')).toBe(
      '/alumno/ajustes',
    );
    expect(screen.getByRole('menuitem', { name: /Mis datos/ }).getAttribute('href')).toBe(
      '/alumno/datos',
    );
  });
});
