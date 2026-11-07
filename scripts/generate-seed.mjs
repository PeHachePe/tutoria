// npm run seed [-- --check]
//
// Writes supabase/seed.sql from the same fixtures as the mock data (src/app/data/mock/fixtures),
// so both worlds share their data (4.3). With --check it only compares and fails if the file is
// out of date: `npm run check` uses it.
//
// Node runs the TypeScript fixtures directly (type stripping), so they may only use erasable
// syntax (no enums) and must import types with `import type`. Angular imports have no extension,
// so a resolve hook tries `.ts` when a relative import is not found.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { buildSeedSql } from './seed/sql.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'src', 'app', 'data', 'mock', 'fixtures', 'seed.ts');
const OUTPUT = path.join(ROOT, 'supabase', 'seed.sql');

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !path.extname(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
  // The fixtures are ES modules; saying so spares Node from guessing (and warning about it).
  load(url, context, nextLoad) {
    return nextLoad(
      url,
      url.endsWith('.ts') ? { ...context, format: 'module-typescript' } : context,
    );
  },
});

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
const { SEED } = await import(pathToFileURL(FIXTURES).href);
const sql = buildSeedSql(SEED);

if (values.check) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== sql) {
    console.error('supabase/seed.sql is out of date: run `npm run seed`.');
    process.exit(1);
  }
  console.log('supabase/seed.sql is up to date.');
} else {
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, sql);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${sql.split('\n').length} lines).`);
}
