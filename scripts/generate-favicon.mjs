// npm run favicon
// Generates public/favicon.ico, the fallback for browsers without SVG favicons, from
// public/favicon.svg (step 1.1b). It renders the SVG with the Chromium that Playwright already
// installs, so it needs no image library.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

import { encodeIco } from './favicon/ico.mjs';

/** The sizes browsers and Windows ask for: tab, taskbar and shortcut. */
const SIZES = [16, 32, 48];

const publicDir = join(process.cwd(), 'public');
const svg = readFileSync(join(publicDir, 'favicon.svg'));
const source = `data:image/svg+xml;base64,${svg.toString('base64')}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const images = [];
  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;background:transparent">` +
        `<img src="${source}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.locator('img').evaluate((img) => img.decode());
    const png = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    images.push({ size, png });
  }
  const output = join(publicDir, 'favicon.ico');
  writeFileSync(output, encodeIco(images));
  console.log(`favicon.ico generado (${SIZES.join(', ')} px)`);
} finally {
  await browser.close();
}
