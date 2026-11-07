// npm run i18n [-- --check]
//
// Extracts the texts marked for translation (`ng extract-i18n`) into src/locale/messages.json and
// checks that every translation (messages.<locale>.json) has all of them, no leftovers and the same
// placeholders (D-023). With --check it extracts to a temporary folder and also fails if
// messages.json is out of date: `npm run check` uses it.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { compareTranslations, reportProblems } from './i18n/compare.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALE_DIR = path.join(ROOT, 'src', 'locale');
const SOURCE_FILE = 'messages.json';
const TRANSLATION_FILE = /^messages\.([a-z-]+)\.json$/;

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
const outputDir = values.check ? mkdtempSync(path.join(os.tmpdir(), 'tutoria-i18n-')) : LOCALE_DIR;

try {
  // Angular's CLI run with this same Node, without a shell, so it works the same on Windows
  const ng = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');
  const extraction = spawnSync(process.execPath, [ng, 'extract-i18n', '--output-path', outputDir], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (extraction.status !== 0) {
    console.error(extraction.stdout, extraction.stderr);
    process.exit(1);
  }

  // ng writes the file without the final newline that Prettier adds: compared and saved with it
  const extracted = `${readFileSync(path.join(outputDir, SOURCE_FILE), 'utf8').trimEnd()}\n`;
  const problems = [];
  if (!values.check) {
    writeFileSync(path.join(LOCALE_DIR, SOURCE_FILE), extracted);
  } else if (extracted !== readFileSync(path.join(LOCALE_DIR, SOURCE_FILE), 'utf8')) {
    problems.push(`src/locale/${SOURCE_FILE} is out of date: run \`npm run i18n\`.`);
  }

  const source = JSON.parse(extracted).translations;
  const problemsByLocale = Object.fromEntries(
    readdirSync(LOCALE_DIR)
      .map((file) => file.match(TRANSLATION_FILE))
      .filter(Boolean)
      .map(([file, locale]) => {
        const { translations } = JSON.parse(readFileSync(path.join(LOCALE_DIR, file), 'utf8'));
        return [locale, compareTranslations(source, translations)];
      }),
  );
  problems.push(...reportProblems(problemsByLocale));

  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const locales = Object.keys(problemsByLocale).join(', ');
  console.log(`${Object.keys(source).length} messages, translated into ${locales}.`);
} finally {
  if (values.check) {
    rmSync(outputDir, { recursive: true, force: true });
  }
}
