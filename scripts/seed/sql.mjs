// Turns the mock fixtures into the SQL of supabase/seed.sql.

/**
 * Tables in foreign key order, with the fixture table that fills each one and its jsonb columns.
 * `app_user` rows already exist when inserted (the trigger on `auth.users` creates them), so its
 * insert updates them instead (D-018).
 */
export const SEED_TABLES = [
  { table: 'app_user', source: 'users', jsonb: [], conflictKey: 'id' },
  { table: 'subject', source: 'subjects', jsonb: ['translations'] },
  { table: 'class_group', source: 'groups', jsonb: [] },
  { table: 'enrollment', source: 'enrollments', jsonb: [] },
  { table: 'class_block', source: 'classBlocks', jsonb: ['translations'] },
  { table: 'exercise', source: 'exercises', jsonb: ['translations'] },
  { table: 'exercise_subject', source: 'exerciseSubjects', jsonb: [] },
  { table: 'test', source: 'tests', jsonb: ['input', 'expected_output'] },
  { table: 'exercise_assignment', source: 'assignments', jsonb: [] },
  { table: 'attempt', source: 'attempts', jsonb: [] },
  { table: 'tutor_interaction', source: 'interactions', jsonb: [] },
  { table: 'process_event', source: 'events', jsonb: ['detail'] },
];

/** `expectedOutput` → `expected_output`. */
export function toSnakeCase(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * SQL literal of a value. In a jsonb column every value is JSON, null included: an expected output
 * of `null` is the JSON value null, not a missing one.
 */
export function sqlLiteral(value, jsonb = false) {
  if (jsonb) {
    return `${quote(JSON.stringify(value))}::jsonb`;
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    // A text[] column, such as exercise.topics
    return value.length === 0 ? "'{}'::text[]" : `array[${value.map(quote).join(', ')}]::text[]`;
  }
  throw new TypeError(`Unexpected value for a non-jsonb column: ${JSON.stringify(value)}`);
}

/**
 * One multi-row insert, with the columns of the first row in snake_case. With a conflict key, the
 * rows that already exist get the values of the insert.
 */
export function insertStatement(table, rows, jsonbColumns = [], conflictKey = undefined) {
  if (rows.length === 0) {
    return `-- ${table}: no rows\n`;
  }
  const keys = Object.keys(rows[0]);
  const columns = keys.map(toSnakeCase);
  const values = rows.map(
    (row) =>
      `  (${keys.map((key, i) => sqlLiteral(row[key], jsonbColumns.includes(columns[i]))).join(', ')})`,
  );
  const insert = `insert into ${table} (${columns.join(', ')}) values\n${values.join(',\n')}`;
  if (!conflictKey) {
    return `${insert};\n`;
  }
  const updates = columns
    .filter((column) => column !== conflictKey)
    .map((column) => `${column} = excluded.${column}`);
  return `${insert}\non conflict (${conflictKey}) do update set ${updates.join(', ')};\n`;
}

/** Supabase Auth reads these columns as text and fails on null, so they start empty. */
const EMPTY_AUTH_TOKENS = [
  'confirmation_token',
  'recovery_token',
  'email_change',
  'email_change_token_new',
];

/** A disabled user is banned until a date no school year reaches (2.10). */
const BANNED_UNTIL = '2999-12-31T00:00:00Z';

/**
 * The Supabase Auth accounts of the seed users, all with the test password and their email already
 * confirmed, each with the identity that email sign-in needs. Only the name goes in the metadata:
 * the user can edit it, so the role never does (step 2.1).
 */
export function authUsersStatement(users, password) {
  const values = users.map(
    ({ id, email, name, status, createdAt }) =>
      `  (${[id, email, name, status, createdAt].map((value) => sqlLiteral(value)).join(', ')})`,
  );
  return [
    'with seed_user (id, email, name, status, created_at) as (values',
    `${values.join(',\n')}\n),`,
    'account as (',
    '  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,',
    '    email_confirmed_at, banned_until, raw_app_meta_data, raw_user_meta_data, created_at,',
    `    updated_at, ${EMPTY_AUTH_TOKENS.join(', ')})`,
    "  select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated',",
    `    email, extensions.crypt(${sqlLiteral(password)}, extensions.gen_salt('bf')),`,
    `    created_at::timestamptz, case when status = 'disabled' then ${sqlLiteral(BANNED_UNTIL)}::timestamptz end,`,
    `    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', name),`,
    `    created_at::timestamptz, created_at::timestamptz, ${EMPTY_AUTH_TOKENS.map(() => "''").join(', ')}`,
    '  from seed_user',
    '  returning id, email, created_at',
    ')',
    'insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at,',
    '  updated_at)',
    "select id, id, id::text, 'email',",
    "  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), created_at,",
    '  created_at',
    'from account;',
    '',
  ].join('\n');
}

/** The whole seed.sql for a `MockTables` object, with the test password of every account. */
export function buildSeedSql(seed, password) {
  const statements = SEED_TABLES.map(({ table, source, jsonb, conflictKey }) =>
    insertStatement(table, seed[source], jsonb, conflictKey),
  );
  const setting = insertStatement(
    'app_setting',
    [{ key: 'ai_provider', value: seed.aiProvider }],
    ['value'],
  );
  return [
    '-- Generated by `npm run seed` from src/app/data/mock/fixtures: do not edit it by hand.',
    '-- The accounts of auth.users come first: their trigger creates each app_user, which its insert completes (D-018).',
    '',
    authUsersStatement(seed.users, password),
    ...statements,
    setting,
  ].join('\n');
}

function quote(text) {
  return `'${text.replaceAll("'", "''")}'`;
}
