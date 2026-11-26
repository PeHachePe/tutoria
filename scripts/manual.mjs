// npm run manual [-- alumno | docente | administracion ...]
// Writes the user manuals of docs/manual from the guided tasks (7.0c, D-080): Playwright (project
// "manual" of playwright.config.ts) does each task on the simulated data and keeps its globes and
// screenshots in tmp/manual; then each manual is written, with its screenshots in WebP.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

import { MANUALS, manualMarkdown, parseProfiles } from './manual/markdown.mjs';

/** Small and still sharp for the text of the globes. */
const WEBP_QUALITY = 80;
const TIME_ZONE = 'Europe/Madrid';

let profiles;
try {
  profiles = parseProfiles(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const root = process.cwd();
const raw = join(root, 'tmp', 'manual');
const docs = join(root, 'docs', 'manual');
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

const date = new Intl.DateTimeFormat('es-ES', { timeZone: TIME_ZONE }).format(new Date());
for (const profile of profiles) {
  const { file } = MANUALS[profile];
  const folder = join(raw, profile);
  const index = JSON.parse(readFileSync(join(folder, 'index.json'), 'utf8'));
  const records = Object.fromEntries(
    readdirSync(folder)
      .filter((name) => name.endsWith('.json') && name !== 'index.json')
      .map((name) => [name.slice(0, -'.json'.length), readJson(join(folder, name))]),
  );

  const images = join(docs, 'capturas', file);
  rmSync(images, { recursive: true, force: true });
  mkdirSync(images, { recursive: true });
  const shots = readdirSync(folder).filter(
    (name) => name.endsWith('.png') && !name.endsWith('-error.png'),
  );
  await Promise.all(
    shots.map((name) =>
      sharp(join(folder, name))
        .webp({ quality: WEBP_QUALITY })
        .toFile(join(images, webpOf(name))),
    ),
  );

  const markdown = manualMarkdown({
    profile,
    index,
    records,
    date,
    image: (name) => `capturas/${file}/${webpOf(name)}`,
  });
  // Already formatted, so `npm run check` finds it as `npm run format` would leave it
  const path = join(docs, `${file}.md`);
  const options = { ...(await resolveConfig(path)), filepath: path };
  writeFileSync(path, await format(markdown, options));
  console.log(
    `docs/manual/${file}.md: ${Object.keys(records).length} tareas, ${shots.length} capturas.`,
  );
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

function webpOf(name) {
  return name.replace(/\.png$/, '.webp');
}
