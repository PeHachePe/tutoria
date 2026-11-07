import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSeedSql, insertStatement, SEED_TABLES, sqlLiteral, toSnakeCase } from './sql.mjs';

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
});

describe('buildSeedSql', () => {
  it('fills every table in foreign key order and ends with the AI provider setting', () => {
    const seed = Object.fromEntries(SEED_TABLES.map(({ source }) => [source, []]));
    seed.users = [{ id: 'u1', name: 'Ana' }];
    seed.aiProvider = { baseUrl: 'https://example.test', model: 'm' };

    const sql = buildSeedSql(seed);

    const order = [...sql.matchAll(/^(?:insert into |-- )(\w+)/gm)].map((match) => match[1]);
    assert.deepEqual(order, [
      'Generated',
      'The',
      'app_user',
      'class_group',
      'enrollment',
      'exercise',
      'test',
      'exercise_assignment',
      'attempt',
      'tutor_interaction',
      'process_event',
      'app_setting',
    ]);
    assert.match(
      sql,
      /\('ai_provider', '\{"baseUrl":"https:\/\/example.test","model":"m"\}'::jsonb\)/,
    );
  });
});
