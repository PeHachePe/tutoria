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

    await page.goto('/docente/en-vivo');
    await expect(page).toHaveURL('/login?redirect=%2Fdocente%2Fen-vivo');
  });
});

test.describe('alumno', () => {
  test.beforeEach(async ({ page }) => startAs(page, USERS.student));

  test('accesibilidad: pasa axe con la barra, sus menús y en el móvil', async ({ page }) => {
    test.slow();
    await page.goto('/alumno');
    await expect(page.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeVisible();
    await expectNoAxeViolations(page, 'escritorio');

    for (const button of ['Menú de usuario', 'Cambiar el tema', 'Cambiar el idioma']) {
      await page.getByRole('button', { name: button }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expectNoAxeViolations(page, `menú «${button}»`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoAxeViolations(page, 'móvil');
  });

  test('aterriza en su shell, con la barra superior y su menú de usuario', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/alumno');
    await expect(page).toHaveTitle('Ejercicios · TutorIA');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Ejercicios' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await expect(page.getByRole('menuitem', { name: 'Datos registrados' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Ajustes' }).click();
    await expect(page).toHaveURL('/alumno/ajustes');
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeFocused();
  });

  test('la marca de la barra lleva a su inicio', async ({ page }) => {
    await page.goto('/alumno/ajustes');

    await page.getByRole('link', { name: 'TutorIA' }).click();

    await expect(page).toHaveURL('/alumno');
    await expect(page.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeFocused();
  });

  test('el tema y el idioma están en la barra, con el tema activo resaltado', async ({ page }) => {
    await page.goto('/alumno');
    await expect(page.getByRole('button', { name: 'Cambiar el idioma' })).toBeVisible();
    const themeButton = page.getByRole('button', { name: 'Cambiar el tema' });

    await themeButton.click();
    const system = page.getByRole('menuitemradio', { name: 'Tema del sistema' });
    const dark = page.getByRole('menuitemradio', { name: 'Tema oscuro' });
    await expect(system).toHaveAttribute('aria-checked', 'true');
    const background = (item: typeof system) =>
      item.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(await background(system)).not.toBe(await background(dark));

    await dark.click();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await expect(themeButton).toContainText('dark_mode');
  });

  test('en el móvil, la barra cabe sin desbordar', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/alumno');
    await expect(page.getByRole('button', { name: 'Menú de usuario' })).toBeInViewport();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
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

  test('accesibilidad: pasa axe con el menú lateral abierto y plegado, también en el móvil', async ({
    page,
  }) => {
    test.slow();
    await page.goto('/docente/en-vivo');
    const button = page.getByRole('button', { name: 'Menú de navegación' });
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(page, 'escritorio, menú abierto');

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Histórico' })
      .hover();
    await expect(page.getByText('Histórico', { exact: true }).last()).toBeVisible();
    await expectNoAxeViolations(page, 'escritorio, menú plegado con su tooltip');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expectNoAxeViolations(page, 'móvil, menú cerrado');

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(page, 'móvil, menú abierto');
  });

  test('aterriza en su shell, con el menú lateral de docencia', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/docente/en-vivo');
    const menu = page.getByRole('navigation', { name: 'Principal' });
    await expect(menu.getByRole('link', { name: 'En vivo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(menu.getByRole('heading', { name: 'Administración' })).toHaveCount(0);

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

  test('en escritorio, el menú lateral se pliega a sus iconos y lo recuerda', async ({ page }) => {
    await page.goto('/docente/en-vivo');
    const button = page.getByRole('button', { name: 'Menú de navegación' });
    const menu = page.getByRole('navigation', { name: 'Principal' });
    const history = menu.getByRole('link', { name: 'Histórico' });
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const wideMenu = (await menu.boundingBox())?.width ?? 0;

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await menu.boundingBox())?.width).toBeLessThan(wideMenu / 2);
    await history.hover();
    await expect(page.getByText('Histórico', { exact: true }).last()).toBeVisible();

    await page.reload();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await history.click();
    await expect(page).toHaveURL('/docente/historico');
    await expect(page.getByRole('heading', { level: 1, name: 'Histórico' })).toBeFocused();

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  test('en el móvil, el menú lateral se pliega y se abre con un botón', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/docente/en-vivo');
    const button = page.getByRole('button', { name: 'Menú de navegación' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('link', { name: 'Grupos' }).click();
    await expect(page).toHaveURL('/docente/grupos');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('administrador', () => {
  test.beforeEach(async ({ page }) => startAs(page, USERS.admin));

  test('accesibilidad: pasa axe con las dos secciones del menú lateral', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
    await expectNoAxeViolations(page, 'escritorio');
  });

  test('aterriza en la administración y también entra en el panel docente', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/admin/usuarios');
    const menu = page.getByRole('navigation', { name: 'Principal' });
    await expect(menu.getByRole('heading', { name: 'Docencia' })).toBeVisible();
    await expect(menu.getByRole('heading', { name: 'Administración' })).toBeVisible();

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
    // Lucía has not seen the notice on her registered data yet, so it covers her catalog first
    await page
      .getByRole('dialog', { name: 'Antes de empezar: tus datos' })
      .getByRole('button', { name: 'Entendido' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ejercicios' })).toBeVisible();
  });
});
