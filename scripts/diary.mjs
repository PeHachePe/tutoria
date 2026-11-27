// npm run diary [-- --pdf]
// The project diary: reads docs/ and writes a static site to dist/diary/ (ignored by git), with the
// diary as a board of steps (index.html) and the presentation (laminas.html). With --pdf, also the
// slides as a PDF. It is meant to be run when the project is closed (the PEC deliveries), so it
// gathers everything; nothing here is published by itself (step 7.0d, D-099).
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';
import sharp from 'sharp';

import { selectCaptures, writeImages } from './diary/captures.mjs';
import { MILESTONES, PROMPT_TEXT, SLIDES } from './diary/content.mjs';
import { extract } from './diary/extract.mjs';

const ROOT = process.cwd();
const SITE = join(ROOT, 'scripts', 'diary', 'site');
const OUT = join(ROOT, 'dist', 'diary');
const PDF_NAME = 'tutoria-laminas.pdf';
/** The slides are drawn at this size and printed one per page. */
const SLIDE = { width: 1280, height: 720 };
const withPdf = process.argv.includes('--pdf');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const data = extract(ROOT);
const { screens, skipped } = await selectCaptures(data.screens, sharp);
data.screens = screens;
const images = await writeImages(screens, sharp, OUT);
images.pug = 'favicon.svg';

// `<` is escaped so no text from docs/ can close the script.
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
writeFileSync(
  join(OUT, 'data.js'),
  `window.DIARY = ${json(data)};\nwindow.DIARY_TEXT = ${json({ prompts: PROMPT_TEXT, slides: SLIDES, milestones: MILESTONES })};\nwindow.IMAGES = ${json(images)};\n`,
);
for (const file of readdirSync(SITE)) copyFileSync(join(SITE, file), join(OUT, file));
copyFileSync(join(ROOT, 'public', 'favicon.svg'), join(OUT, 'favicon.svg'));

console.log(
  `Diario en dist/diary/: ${data.steps.length} pasos, ${data.decisions.length} decisiones y ${screens.reduce((n, s) => n + s.versions.length, 0)} versiones de ${screens.length} pantallas.`,
);
if (skipped.length) console.log(`Capturas que no se muestran: ${skipped.join(', ')}.`);

if (withPdf) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: SLIDE, colorScheme: 'light' });
  await page.goto(`${pathToFileURL(join(OUT, 'laminas.html')).href}?print`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: join(OUT, PDF_NAME),
    width: `${SLIDE.width}px`,
    height: `${SLIDE.height}px`,
    printBackground: true,
    tagged: true,
  });
  await browser.close();
  console.log(`Láminas en PDF: dist/diary/${PDF_NAME}.`);
}
