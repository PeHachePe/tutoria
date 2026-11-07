import { expect, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { startAs, USERS } from './support/session';

test.describe('sin sesión', () => {
  test('la raíz y las pantallas protegidas llevan al acceso', async ({ page }) => {
    await startAs(page, null);

    await page.goto('/');
    await expect(page).toHaveURL('/login');
    await expect(page).toHaveTitle('Acceso · TutorIA');
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto('/docente/en-vivo');
    await expect(page).toHaveURL('/login?redirect=%2Fdocente%2Fen-vivo');
  });
});

test.describe('alumno', () => {
  test.beforeEach(async ({ page }) => startAs(page, USERS.student));

  test('aterriza en su shell, con la barra superior y su menú de usuario', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/alumno');
    await expect(page).toHaveTitle('Ejercicios · TutorIA');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Ejercicios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await expect(page.getByRole('menuitem', { name: 'Mis datos' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole('menuitem', { name: 'Ajustes' }).click();
    await expect(page).toHaveURL('/alumno/ajustes');
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeFocused();
  });

  test('no puede entrar en el panel docente ni en la administración', async ({ page }) => {
    for (const url of ['/docente/en-vivo', '/admin/usuarios']) {
      await page.goto(url);

      await expect(page).toHaveURL(url);
      await expect(page).toHaveTitle('Página no encontrada · TutorIA');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
      ).toBeVisible();
    }
    await expectNoAxeViolations(page);

    await page.getByRole('link', { name: 'Ir a mi inicio' }).click();
    await expect(page).toHaveURL('/alumno');
  });

  test('el enlace «Saltar al contenido» es la primera parada del teclado', async ({ page }) => {
    await page.goto('/alumno');
    await expect(page.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('main')).toBeFocused();
  });

  test('cerrar sesión lleva al acceso', async ({ page }) => {
    await page.goto('/alumno');

    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL('/login');
    await page.goto('/alumno');
    await expect(page).toHaveURL('/login?redirect=%2Falumno');
  });
});

test.describe('docente', () => {
  test.beforeEach(async ({ page }) => startAs(page, USERS.teacher));

  test('aterriza en su shell, con el menú lateral de docencia', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/docente/en-vivo');
    const menu = page.getByRole('navigation', { name: 'Principal' });
    await expect(menu.getByRole('link', { name: 'En vivo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(menu.getByRole('heading', { name: 'Administración' })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await menu.getByRole('link', { name: 'Histórico' }).click();
    await expect(page).toHaveTitle('Histórico · TutorIA');
    await expect(page.getByRole('heading', { level: 1, name: 'Histórico' })).toBeFocused();
  });

  test('no puede entrar en la administración ni en el área del alumno', async ({ page }) => {
    for (const url of ['/admin/usuarios', '/alumno']) {
      await page.goto(url);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
      ).toBeVisible();
    }
  });

  test('en el móvil, el menú lateral se pliega y se abre con un botón', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/docente/en-vivo');
    const button = page.getByRole('button', { name: 'Menú de navegación' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expectNoAxeViolations(page);

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(page);

    await page.getByRole('link', { name: 'Grupos' }).click();
    await expect(page).toHaveURL('/docente/grupos');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('administrador', () => {
  test.beforeEach(async ({ page }) => startAs(page, USERS.admin));

  test('aterriza en la administración y también entra en el panel docente', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/admin/usuarios');
    const menu = page.getByRole('navigation', { name: 'Principal' });
    await expect(menu.getByRole('heading', { name: 'Docencia' })).toBeVisible();
    await expect(menu.getByRole('heading', { name: 'Administración' })).toBeVisible();
    await expectNoAxeViolations(page);

    await menu.getByRole('link', { name: 'Grupos' }).click();
    await expect(page).toHaveURL('/docente/grupos');
    await expect(page.getByRole('heading', { level: 1, name: 'Grupos y matrícula' })).toBeFocused();
  });
});

test.describe('barra de desarrollo', () => {
  test('al cambiar de usuario se va al inicio de su rol, no a la página anterior', async ({
    page,
  }) => {
    await startAs(page, USERS.teacher);
    await page.goto('/docente/historico');

    await page.getByRole('button', { name: 'Herramientas de desarrollo' }).click();
    await page.getByRole('combobox', { name: 'Entrar como' }).click();
    await page.getByRole('option', { name: 'Lucía Martín Gómez' }).click();

    await expect(page).toHaveURL('/alumno');
    await expect(page.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeVisible();
  });
});
