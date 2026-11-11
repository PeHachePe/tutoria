// npm run seed [-- --check]
//
// Writes supabase/seed.sql from the same fixtures as the mock data (src/app/data/mock/fixtures),
// so both worlds share their data (4.3). With --check it only compares and fails if the file is
// out of date: `npm run check` uses it.
//
// The TypeScript fixtures are imported directly (scripts/import-app-ts.mjs).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { importAppTs } from './import-app-ts.mjs';
import { buildSeedSql } from './seed/sql.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'src', 'app', 'data', 'mock', 'fixtures');
const OUTPUT = path.join(ROOT, 'supabase', 'seed.sql');

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
const { SEED } = await importAppTs(path.join(FIXTURES, 'seed.ts'));
// The same test password as the mock data: these accounts only exist in local Supabase.
const { MOCK_PASSWORD } = await importAppTs(path.join(FIXTURES, 'users.ts'));
const sql = buildSeedSql(SEED, MOCK_PASSWORD);

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
