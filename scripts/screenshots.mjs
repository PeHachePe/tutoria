// npm run screenshots -- <pec3|pec4> | <step> <screen> [iteracion-N]
// Saves the screenshots of the report or of the evolution of a screen in docs/capturas (PLAN 5.6),
// with Playwright (project "screenshots" of playwright.config.ts) against the simulated data.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { parseTarget } from './screenshots/target.mjs';

let target;
try {
  target = parseTarget(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const { clean, ...captureTarget } = target;
if (clean) {
  rmSync(join(process.cwd(), 'docs', 'capturas', ...clean.split('/')), {
    recursive: true,
    force: true,
  });
}

// Run Playwright's CLI with this same Node, without a shell, so it works the same on Windows
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const result = spawnSync(process.execPath, [cli, 'test', '--project=screenshots'], {
  stdio: 'inherit',
  env: { ...process.env, SCREENSHOTS_TARGET: JSON.stringify(captureTarget) },
});
process.exit(result.status ?? 1);
