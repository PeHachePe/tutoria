import { expect, test } from '@playwright/test';

import { startAs, USERS } from './support/session';

test.describe('idioma', () => {
  test('en el acceso se cambia a inglés, la página se traduce entera y lo recuerda', async ({
    page,
  }) => {
    await startAs(page, null);
    await page.goto('/login');

    await page.getByRole('button', { name: 'Cambiar el idioma' }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Español' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('menuitemradio', { name: 'English' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Sign in · TutorIA');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your email')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('dentro de la app se cambia desde el botón de la barra, también al catalán y de vuelta', async ({
    page,
  }) => {
    await startAs(page, USERS.teacher);
    await page.goto('/docente/en-vivo');

    await page.getByRole('button', { name: 'Cambiar el idioma' }).click();
    await page.getByRole('menuitemradio', { name: 'Català' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Sessió en directe' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
    await expect(page.getByRole('link', { name: 'Exercicis' })).toBeVisible();

    await page.getByRole('button', { name: "Canvia l'idioma" }).click();
    await page.getByRole('menuitemradio', { name: 'Español' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Sesión en vivo' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test.describe('la primera vez', () => {
    test.use({ locale: 'ca-ES' });

    test('toma el idioma del navegador si la app lo habla', async ({ page }) => {
      await startAs(page, null);
      await page.goto('/login');

      await expect(page.getByRole('heading', { level: 1, name: 'Accés' })).toBeVisible();
    });
  });
});
