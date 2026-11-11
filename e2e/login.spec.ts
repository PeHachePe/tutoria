import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { startAs } from './support/session';

/** Test password of every seed user (data/mock/fixtures/users.ts). */
const PASSWORD = 'tutoria';

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('acceso', () => {
  test.beforeEach(async ({ page }) => {
    await startAs(page, null);
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso' })).toBeVisible();
  });

  test('accesibilidad: pasa axe en cada estado de su ficha', async ({ page }) => {
    // «Enviando» only disables the button and changes its text: axe exempts disabled controls
    test.slow();
    await expectNoAxeViolations(page, 'inicial');

    // The theme and language menus are the shared ones of the bar: the shells test checks them
    await page.getByRole('button', { name: 'Cuentas de demostración' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expectNoAxeViolations(page, 'menú de cuentas de demostración');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Introduce tu correo')).toBeVisible();
    await expectNoAxeViolations(page, 'errores de los campos');

    await signIn(page, 'lucia.martin@tutoria.test', 'otra');
    await expect(page.getByRole('alert')).toHaveText(/Correo o contraseña incorrectos/);
    await expectNoAxeViolations(page, 'error del servidor');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso' })).toBeVisible();
    await expectNoAxeViolations(page, 'móvil');
  });

  for (const [role, email, home] of [
    ['alumna', 'lucia.martin@tutoria.test', '/alumno'],
    ['docente', 'marta.ibanez@tutoria.test', '/docente/en-vivo'],
    ['administración', 'admin@tutoria.test', '/admin/usuarios'],
  ] as const) {
    test(`la cuenta de ${role} entra y llega a su inicio`, async ({ page }) => {
      await signIn(page, email, PASSWORD);

      await expect(page).toHaveURL(home);
    });
  }

  test('sin datos no envía y dice qué falta en cada campo', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Introduce tu correo')).toBeVisible();
    await expect(page.getByText('Introduce tu contraseña')).toBeVisible();
    await expect(page.getByLabel('Correo')).toBeFocused();
  });

  test('una contraseña incorrecta no dice si la cuenta existe; una desactivada, sí (D-041)', async ({
    page,
  }) => {
    await signIn(page, 'lucia.martin@tutoria.test', 'otra');
    await expect(page.getByRole('alert')).toHaveText(/Correo o contraseña incorrectos/);

    await page.getByLabel('Correo').fill('raul.medina@tutoria.test');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      /Tu cuenta está desactivada. Si crees que es un error, habla con tu docente/,
    );
    await expect(page).toHaveURL('/login');
  });

  test('se usa con el teclado: Intro envía el formulario', async ({ page }) => {
    await page.getByLabel('Correo').fill('lucia.martin@tutoria.test');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Contraseña', { exact: true }).press('Enter');

    await expect(page).toHaveURL('/alumno');
  });

  test('las cuentas de demostración están en un menú y entran con un clic', async ({ page }) => {
    await page.getByRole('button', { name: 'Cuentas de demostración' }).click();
    // One student per class, as their classes study different subjects (2.5c)
    await expect(page.getByRole('menuitem', { name: /Alumna/ })).toHaveCount(2);

    await page.getByRole('menuitem', { name: /Docente/ }).click();

    await expect(page).toHaveURL('/docente/en-vivo');
  });

  test('cabe en la pantalla sin scroll en móvil, tablet y escritorio', async ({ page }) => {
    for (const { width, height } of [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          x: root.scrollWidth - root.clientWidth,
          y: root.scrollHeight - root.clientHeight,
        };
      });
      expect(overflow, `scroll a ${width}×${height} px`).toEqual({ x: 0, y: 0 });
    }
  });
});

test('tras entrar, vuelve a la página que se pidió sin sesión', async ({ page }) => {
  await startAs(page, null);
  await page.goto('/docente/historico');
  await expect(page).toHaveURL('/login?redirect=%2Fdocente%2Fhistorico');

  await signIn(page, 'marta.ibanez@tutoria.test', PASSWORD);

  await expect(page).toHaveURL('/docente/historico');
  await expect(page.getByRole('heading', { level: 1, name: 'Histórico' })).toBeFocused();
});
