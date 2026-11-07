import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen } from '@testing-library/angular';

import { adminRoutes } from './admin/admin.routes';
import { routes } from './app.routes';
import { provideSessionOf, restoreSession } from './auth/auth-testing';
import { AppTitleStrategy } from './core/app-title-strategy';
import { provideFormFieldDefaults } from './core/form-field-defaults';
import { provideLocalizedPaginator } from './core/localized-paginator-intl';
import type { Role } from './data/user';
import { studentRoutes } from './student/student.routes';
import { teacherRoutes } from './teacher/teacher.routes';

describe('app routes', () => {
  async function visit(role: Role | null, url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideSessionOf(role),
        provideRouter(routes, withComponentInputBinding()),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
      ],
    });
    await restoreSession();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    return TestBed.inject(Router).url;
  }

  it('opens the login without a session', async () => {
    expect(await visit(null, '/')).toBe('/login');
    expect(screen.getByRole('heading', { level: 1, name: 'Acceso' })).toBeTruthy();
    expect(document.title).toBe('Acceso · TutorIA');
  });

  it.each<[Role, string, string]>([
    ['student', '/alumno', 'Ejercicios'],
    ['teacher', '/docente/en-vivo', 'Sesión en vivo'],
    ['admin', '/admin/usuarios', 'Usuarios'],
  ])('lands a %s in the shell of their role, on %s', async (role, home, heading) => {
    expect(await visit(role, '/')).toBe(home);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it.each<[Role, string, string, string]>([
    ['student', '/alumno/ejercicio/abc', 'Ejercicio', 'Ejercicio · TutorIA'],
    ['student', '/alumno/ajustes', 'Ajustes', 'Ajustes · TutorIA'],
    ['student', '/alumno/datos', 'Datos registrados', 'Mis datos · TutorIA'],
    ['teacher', '/docente', 'Sesión en vivo', 'Sesión en vivo · TutorIA'],
    ['teacher', '/docente/en-vivo/abc', 'Detalle del intento', 'Detalle del intento · TutorIA'],
    ['teacher', '/docente/historico', 'Histórico', 'Histórico · TutorIA'],
    ['teacher', '/docente/ejercicios', 'Ejercicios y asignaciones', 'Ejercicios · TutorIA'],
    ['teacher', '/docente/grupos', 'Grupos y matrícula', 'Grupos · TutorIA'],
    ['admin', '/docente/grupos', 'Grupos y matrícula', 'Grupos · TutorIA'],
    ['admin', '/admin', 'Usuarios', 'Usuarios · TutorIA'],
    ['admin', '/admin/sistema', 'Ajustes del sistema', 'Sistema · TutorIA'],
  ])('as %s, %s shows "%s" with its tab title', async (role, url, heading, title) => {
    await visit(role, url);

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(document.title).toBe(title);
  });

  it('tells which step builds each placeholder screen', async () => {
    await visit('student', '/alumno');

    expect(screen.getByText('Esta pantalla se construye en el paso 1.2.')).toBeTruthy();
  });

  it.each<[Role, string]>([
    ['student', '/docente/en-vivo'],
    ['teacher', '/admin/usuarios'],
    ['teacher', '/alumno'],
    ['student', '/no-existe'],
  ])('shows the not found page to a %s at %s', async (role, url) => {
    expect(await visit(role, url)).toBe(url);
    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a mi inicio' }).getAttribute('href')).toBe('/');
    expect(document.title).toBe('Página no encontrada · TutorIA');
  });

  // The Material defaults live in each lazy area, not in app.config.ts, to keep them out of the
  // initial bundle (D-021): an area that forgets them would show filled fields or English texts.
  it.each([
    ['student', studentRoutes],
    ['teacher', teacherRoutes],
    ['admin', adminRoutes],
  ])('the %s area brings the outlined form fields', (_, areaRoutes) => {
    expect(areaRoutes[0].providers).toContainEqual(provideFormFieldDefaults());
  });

  it.each([
    ['teacher', teacherRoutes],
    ['admin', adminRoutes],
  ])('the %s area shows its paginators in the language of the interface', (_, areaRoutes) => {
    expect(areaRoutes[0].providers).toContainEqual(provideLocalizedPaginator());
  });
});
