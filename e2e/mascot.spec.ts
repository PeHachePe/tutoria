import { expect, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { startAs } from './support/session';

// The mascot is decorative (aria-hidden), so the tests find it by its element and its parts by
// data-testid (4.8); the controls of the showcase are found by role
test.describe('mascota', () => {
  test.beforeEach(async ({ page }) => startAs(page, null));

  test('el muestrario la enseña en cada estado y con sus accesorios', async ({ page }) => {
    await page.goto('/dev/ui');
    const section = page.getByRole('region', { name: 'Mascota' });
    const mascots = section.locator('app-mascot');
    await expect(mascots).toHaveCount(2);
    await expect(section.getByTestId('mascot-headset')).toHaveCount(2);
    await expect(section.getByTestId('mascot-bow-tie')).toHaveCount(0);

    await section.getByRole('radio', { name: 'Chat abierto' }).click();
    await expect(mascots.first()).toHaveClass(/mascot-chat/);
    await section.getByRole('switch', { name: 'Pajarita' }).click();
    await expect(section.getByTestId('mascot-bow-tie')).toHaveCount(2);
    await section.getByRole('switch', { name: 'Auriculares' }).click();
    await expect(section.getByTestId('mascot-headset')).toHaveCount(0);

    await expectNoAxeViolations(page);
  });

  test('da la bienvenida en el acceso, oculta a los lectores de pantalla', async ({ page }) => {
    await page.goto('/login');

    const mascot = page.locator('app-mascot');
    await expect(mascot).toHaveClass(/mascot-joy/);
    await expect(mascot).toHaveAttribute('aria-hidden', 'true');
  });

  test('el puntero se convierte en un hueso al pasar por encima', async ({ page }) => {
    await page.goto('/login');

    const cursor = await page
      .locator('app-mascot')
      .evaluate((host) => getComputedStyle(host).cursor);
    expect(cursor).toMatch(/^url\("data:image\/svg\+xml,.+"\) 7 7, pointer$/);
  });

  test('es el favicon, en SVG y con un .ico de respaldo', async ({ page, request }) => {
    await page.goto('/login');
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
      'href',
      'favicon.svg',
    );

    const svg = await request.get('/favicon.svg');
    expect(svg.ok()).toBe(true);
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    expect(await svg.text()).toContain('#EAD5B2');

    const ico = await request.get('/favicon.ico');
    expect(ico.ok()).toBe(true);
    // Icon file header: reserved 0, type 1 and the three sizes (16, 32 and 48 px)
    expect([...(await ico.body()).subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
  });
});
