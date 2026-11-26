// npm run manual [-- alumno | docente | administracion ...] [-- --reescribir]
// Writes the user manuals of docs/manual from the guided tasks (7.0c, D-080, D-098): Playwright
// (project "manual" of playwright.config.ts) does each task on the simulated data and keeps its
// globes and screenshots in tmp/manual; then each manual is written in Markdown, with its
// screenshots in WebP, and in PDF. With --reescribir, only the manuals are written again, from what
// the last run kept: to change their texts or their layout without doing every task again.
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

import { MANUALS, parseProfiles } from './manual/content.mjs';
import { manualHtml } from './manual/html.mjs';
import { manualMarkdown } from './manual/markdown.mjs';

/** Small and still sharp for the text of the globes. */
const WEBP_QUALITY = 80;
/**
 * The PDF takes JPEG copies: Chromium keeps a JPEG as it is, and would store the screenshots of any
 * other format without loss, several times bigger.
 */
const JPEG_QUALITY = 82;
const TIME_ZONE = 'Europe/Madrid';
const REWRITE = '--reescribir';
/** The margins of the page, as the footer with its number needs room. */
const PDF_MARGIN = { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' };

const args = process.argv.slice(2);
const rewrite = args.includes(REWRITE);
let profiles;
try {
  profiles = parseProfiles(args.filter((arg) => arg !== REWRITE));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const root = process.cwd();
const raw = join(root, 'tmp', 'manual');
const docs = join(root, 'docs', 'manual');

if (rewrite) {
  const missing = profiles.filter((profile) => !existsSync(join(raw, profile, 'index.json')));
  if (missing.length > 0) {
    console.error(`No hay nada recogido de ${missing.join(', ')}: lanza antes «npm run manual».`);
    process.exit(1);
  }
} else {
  for (const profile of profiles) rmSync(join(raw, profile), { recursive: true, force: true });
  // Run Playwright's CLI with this same Node, without a shell, so it works the same on Windows
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const result = spawnSync(process.execPath, [cli, 'test', '--project=manual'], {
    stdio: 'inherit',
    env: { ...process.env, MANUAL_PROFILES: profiles.join(',') },
  });
  if (result.status !== 0) {
    console.error('\nEl manual no se ha escrito: hay tareas que no se completan (detalle arriba).');
    process.exit(result.status ?? 1);
  }
}

const assets = {
  logo: pathToFileURL(join(root, 'public', 'favicon.svg')).href,
  font: pathToFileURL(
    join(
      root,
      'node_modules',
      '@fontsource-variable',
      'roboto',
      'files',
      'roboto-latin-wght-normal.woff2',
    ),
  ).href,
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const profile of profiles) await writeManual(profile, page);
} finally {
  await browser.close();
}

/** The Markdown, with its screenshots in WebP, and the PDF of a profile, from what was kept. */
async function writeManual(profile, page) {
  const { file, title } = MANUALS[profile];
  const folder = join(raw, profile);
  const indexPath = join(folder, 'index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const records = Object.fromEntries(
    readdirSync(folder)
      .filter((name) => name.endsWith('.json') && name !== 'index.json')
      .map((name) => [name.slice(0, -'.json'.length), readJson(join(folder, name))]),
  );
  // The day the tasks were done, also when only the manual is written again
  const date = new Intl.DateTimeFormat('es-ES', { timeZone: TIME_ZONE }).format(
    statSync(indexPath).mtime,
  );
  const shots = readdirSync(folder).filter(
    (name) => name.endsWith('.png') && !name.endsWith('-error.png'),
  );

  const images = join(docs, 'capturas', file);
  const jpegs = join(folder, 'pdf');
  for (const dir of [images, jpegs]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  await Promise.all(
    shots.flatMap((name) => [
      sharp(join(folder, name))
        .webp({ quality: WEBP_QUALITY })
        .toFile(join(images, withExtension(name, 'webp'))),
      sharp(join(folder, name))
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(join(jpegs, withExtension(name, 'jpg'))),
    ]),
  );

  const markdown = manualMarkdown({
    profile,
    index,
    records,
    date,
    image: (name) => `capturas/${file}/${withExtension(name, 'webp')}`,
  });
  // Already formatted, so `npm run check` finds it as `npm run format` would leave it
  const markdownPath = join(docs, `${file}.md`);
  const options = { ...(await resolveConfig(markdownPath)), filepath: markdownPath };
  writeFileSync(markdownPath, await format(markdown, options));

  const html = manualHtml({
    profile,
    index,
    records,
    date,
    image: (name) => pathToFileURL(join(jpegs, withExtension(name, 'jpg'))).href,
    assets,
  });
  const htmlPath = join(folder, `${file}.html`);
  writeFileSync(htmlPath, html);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: join(docs, `${file}.pdf`),
    format: 'A4',
    margin: PDF_MARGIN,
    printBackground: true,
    // Bookmarks from its headings, and tags for screen readers
    outline: true,
    tagged: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer(title),
  });

  console.log(
    `docs/manual/${file}.md y .pdf: ${Object.keys(records).length} tareas, ${shots.length} capturas.`,
  );
}

/** The footer of each page: the manual and its page number, with the colours of the brand. */
function footer(title) {
  return `<div style="width: 100%; margin: 0 16mm; font: 8pt Roboto, sans-serif; color: #4a5551; display: flex; justify-content: space-between;">
    <span>${title} · TutorIA</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

function withExtension(name, extension) {
  return name.replace(/\.png$/, `.${extension}`);
}
