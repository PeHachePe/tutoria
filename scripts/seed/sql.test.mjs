import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  authUsersStatement,
  buildSeedSql,
  insertStatement,
  SEED_TABLES,
  sqlLiteral,
  toSnakeCase,
} from './sql.mjs';

describe('toSnakeCase', () => {
  it('turns camelCase keys into column names', () => {
    assert.equal(toSnakeCase('expectedOutput'), 'expected_output');
    assert.equal(toSnakeCase('maxRepeatedFailures'), 'max_repeated_failures');
    assert.equal(toSnakeCase('id'), 'id');
  });
});

describe('sqlLiteral', () => {
  it('writes scalars and null', () => {
    assert.equal(sqlLiteral(null), 'null');
    assert.equal(sqlLiteral(-3), '-3');
    assert.equal(sqlLiteral(false), 'false');
    assert.equal(sqlLiteral('1.º DAW A'), "'1.º DAW A'");
  });

  it('doubles single quotes', () => {
    assert.equal(sqlLiteral("let texto = '';"), "'let texto = '''';'");
  });

  it('writes any value of a jsonb column as JSON, null included', () => {
    assert.equal(sqlLiteral([[1, 2]], true), "'[[1,2]]'::jsonb");
    assert.equal(sqlLiteral('2.50', true), `'"2.50"'::jsonb`);
    assert.equal(sqlLiteral(null, true), "'null'::jsonb");
    assert.equal(sqlLiteral({ text: "it's" }, true), `'{"text":"it''s"}'::jsonb`);
  });

  it('writes a list of texts as a text array', () => {
    assert.equal(sqlLiteral(['Vectores', "it's"]), "array['Vectores', 'it''s']::text[]");
    assert.equal(sqlLiteral([]), "'{}'::text[]");
  });

  it('refuses lists of other values outside a jsonb column', () => {
    assert.throws(() => sqlLiteral([1, 2]), TypeError);
  });

  it('refuses objects outside a jsonb column', () => {
    assert.throws(() => sqlLiteral({ a: 1 }), TypeError);
  });
});

describe('insertStatement', () => {
  it('writes one multi-row insert with snake_case columns', () => {
    const sql = insertStatement(
      'test',
      [
        { id: 't1', exerciseId: 'e1', input: [[1]], isHidden: false },
        { id: 't2', exerciseId: 'e1', input: [[]], isHidden: true },
      ],
      ['input'],
    );

    assert.equal(
      sql,
      'insert into test (id, exercise_id, input, is_hidden) values\n' +
        "  ('t1', 'e1', '[[1]]'::jsonb, false),\n" +
        "  ('t2', 'e1', '[[]]'::jsonb, true);\n",
    );
  });

  it('writes a comment for a table without rows', () => {
    assert.equal(insertStatement('attempt', []), '-- attempt: no rows\n');
  });

  it('updates the rows that already exist when given a conflict key', () => {
    const sql = insertStatement('app_user', [{ id: 'u1', name: 'Ana', role: 'admin' }], [], 'id');

    assert.equal(
      sql,
      'insert into app_user (id, name, role) values\n' +
        "  ('u1', 'Ana', 'admin')\n" +
        'on conflict (id) do update set name = excluded.name, role = excluded.role;\n',
    );
  });
});

describe('authUsersStatement', () => {
  const users = [
    {
      id: 'u1',
      name: "Ana O'Neil",
      email: 'ana@tutoria.test',
      role: 'admin',
      status: 'active',
      createdAt: 'd1',
    },
    {
      id: 'u2',
      name: 'Raúl',
      email: 'raul@tutoria.test',
      role: 'student',
      status: 'disabled',
      createdAt: 'd2',
    },
  ];

  it('creates each account with its identity and the hashed test password', () => {
    const sql = authUsersStatement(users, "pass'word");

    assert.match(sql, /insert into auth\.users \(/);
    assert.match(sql, /insert into auth\.identities \(/);
    assert.match(sql, /extensions\.crypt\('pass''word', extensions\.gen_salt\('bf'\)\)/);
    assert.match(sql, /\('u1', 'ana@tutoria\.test', 'Ana O''Neil', 'active', 'd1'\)/);
    assert.match(sql, /\('u2', 'raul@tutoria\.test', 'Raúl', 'disabled', 'd2'\)/);
  });

  it('bans the disabled accounts in Supabase Auth too', () => {
    assert.match(authUsersStatement(users, 'p'), /case when status = 'disabled' then/);
  });

  it('never puts the role in the metadata, which users can edit', () => {
    const sql = authUsersStatement(users, 'p');

    assert.doesNotMatch(sql, /'admin'/);
    assert.match(sql, /jsonb_build_object\('name', name\)/);
  });
});

describe('buildSeedSql', () => {
  it('fills every table in foreign key order and ends with the AI provider setting', () => {
    const seed = Object.fromEntries(SEED_TABLES.map(({ source }) => [source, []]));
    seed.users = [{ id: 'u1', name: 'Ana' }];
    seed.aiProvider = { baseUrl: 'https://example.test', model: 'm' };

    const sql = buildSeedSql(seed, 'p');

    const order = [...sql.matchAll(/^(?:insert into (?:auth\.)?|with |-- )(\w+)/gm)].map(
      (match) => match[1],
    );
    assert.deepEqual(order, [
      'Generated',
      'The',
      'seed_user',
      'identities',
      'app_user',
      'class_group',
      'enrollment',
      'class_session',
      'exercise',
      'test',
      'exercise_assignment',
      'attempt',
      'tutor_interaction',
      'process_event',
      'app_setting',
    ]);
    assert.match(sql, /on conflict \(id\) do update set name = excluded\.name;/);
    assert.match(
      sql,
      /\('ai_provider', '\{"baseUrl":"https:\/\/example.test","model":"m"\}'::jsonb\)/,
    );
  });
});
