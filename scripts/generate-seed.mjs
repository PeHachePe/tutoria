// npm run seed [-- --check | --cloud]
//
// Writes supabase/seed.sql from the same fixtures as the mock data (src/app/data/mock/fixtures),
// so both worlds share their data (4.3). With --check it only compares and fails if the file is
// out of date: `npm run check` uses it.
//
// With --cloud it writes the seed of the project in the cloud (step 3.1, docs/DESPLIEGUE.md) to
// tmp/cloud/, which git ignores: the same data, but a strong random password for each account,
// and accounts.csv with them, to keep in a password manager and delete.
//
// The TypeScript fixtures are imported directly (scripts/import-app-ts.mjs).
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { importAppTs } from './import-app-ts.mjs';
import { buildSeedSql } from './seed/sql.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'src', 'app', 'data', 'mock', 'fixtures');
const OUTPUT = path.join(ROOT, 'supabase', 'seed.sql');
const CLOUD_OUTPUT = path.join(ROOT, 'tmp', 'cloud');
/** 18 random bytes: 24 characters in base64url, far beyond what a guess or a dictionary reaches. */
const PASSWORD_BYTES = 18;

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    cloud: { type: 'boolean', default: false },
  },
});
const { SEED } = await importAppTs(path.join(FIXTURES, 'seed.ts'));
// The same test password as the mock data: these accounts only exist in local Supabase.
const { MOCK_PASSWORD } = await importAppTs(path.join(FIXTURES, 'users.ts'));

if (values.cloud) {
  const passwords = new Map(
    SEED.users.map((user) => [user.id, randomBytes(PASSWORD_BYTES).toString('base64url')]),
  );
  const csv = [
    'email,password,role,name',
    ...SEED.users.map(({ id, email, role, name }) =>
      [email, passwords.get(id), role, `"${name}"`].join(','),
    ),
  ];
  mkdirSync(CLOUD_OUTPUT, { recursive: true });
  writeFileSync(
    path.join(CLOUD_OUTPUT, 'seed.sql'),
    buildSeedSql(SEED, (user) => passwords.get(user.id)),
  );
  writeFileSync(path.join(CLOUD_OUTPUT, 'accounts.csv'), `${csv.join('\n')}\n`);
  console.log(
    `Escritos seed.sql y accounts.csv en ${path.relative(ROOT, CLOUD_OUTPUT)} (${passwords.size} cuentas).`,
  );
  console.log(
    'Guarda las contraseñas en tu gestor y borra la carpeta cuando el seed esté aplicado.',
  );
  process.exit(0);
}

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
