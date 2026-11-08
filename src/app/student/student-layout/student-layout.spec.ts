import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import { READING_PAGE_CLASS, StudentLayout, WIDE_PAGE_CLASS } from './student-layout';

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
              { path: 'ejercicio/:id', component: Page },
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
    expect(screen.getByRole('button', { name: 'Cambiar el tema' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar el idioma' })).toBeTruthy();
  });

  it('does not mark Ejercicios on the other pages of the area', async () => {
    await renderAt('/alumno/ajustes');

    const link = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
      name: 'Ejercicios',
    });
    expect(link.ariaCurrent).toBeNull();
    expect(link.classList).not.toContain('underline');
  });

  it('keeps Ejercicios highlighted inside an exercise, without saying it is the current page', async () => {
    await renderAt('/alumno/ejercicio/exercise-3');

    const link = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
      name: 'Ejercicios',
    });
    expect(link.classList).toContain('underline');
    expect(link.ariaCurrent).toBeNull();
  });

  it('gives an exercise almost all the width of the window, and the other pages a reading width', async () => {
    await renderAt('/alumno/ejercicio/exercise-3');
    expect(screen.getByRole('main').classList).toContain(WIDE_PAGE_CLASS);

    await TestBed.inject(Router).navigateByUrl('/alumno');
    TestBed.tick();
    expect(screen.getByRole('main').classList).toContain(READING_PAGE_CLASS);
    expect(screen.getByRole('main').classList).not.toContain(WIDE_PAGE_CLASS);
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
