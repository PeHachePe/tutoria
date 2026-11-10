import { assert, assertEquals, assertRejects } from '@std/assert';

import type { RunRequest } from '../../../src/app/data/code-runner/run-result.ts';
import { DEFAULT_LIMITS, QuickJsSandbox } from './quickjs-sandbox.ts';

/** Shorter limits, so the tests that run out of time take little. */
const sandbox = new QuickJsSandbox({ ...DEFAULT_LIMITS, testTimeMs: 50, runTimeMs: 200 });

/** Exercise 3 of the seed: `suma` of a vector. */
const SUM_INPUTS = [[[1, 2, 3]], [[5]], [[]], [[-2, 2, 10]], [[7, -3, 1]]];

function run(code: string, inputs: unknown[][] = SUM_INPUTS, functionName = 'suma') {
  const request: RunRequest = { code, functionName, inputs };
  return sandbox.run(request);
}

Deno.test('a correct solution returns the value of every test', async () => {
  const outcome = await run(`function suma(vector) {
    let total = 0;
    for (const n of vector) total += n;
    return total;
  }`);

  assertEquals(outcome, {
    outcomes: [6, 5, 0, 10, 5].map((value) => ({ ok: true as const, value })),
  });
});

Deno.test('the function may be declared with const or as an arrow', async () => {
  const outcome = await run('const suma = (v) => v.reduce((a, b) => a + b, 0);', [[[1, 2]]]);

  assertEquals(outcome.outcomes, [{ ok: true, value: 3 }]);
});

Deno.test('a syntax error is invalid code, with the message of the error', async () => {
  const outcome = await run('function suma(vector) { return vector.length');

  assertEquals(outcome.outcomes, []);
  assertEquals(outcome.loadError?.kind, 'invalid_code');
  assert(outcome.loadError?.message?.startsWith('SyntaxError: '));
});

Deno.test('an error outside the function is invalid code too', async () => {
  const outcome = await run('throw new TypeError("Mal"); function suma() {}');

  assertEquals(outcome.loadError, { kind: 'invalid_code', message: 'TypeError: Mal' });
});

Deno.test(
  'code without the function, or with something else under its name, misses it',
  async () => {
    assertEquals((await run('function sumar() {}')).loadError, { kind: 'missing_function' });
    assertEquals((await run('const suma = 3;')).loadError, { kind: 'missing_function' });
  },
);

Deno.test('an exception in a test is its error, and the other tests still run', async () => {
  const outcome = await run(
    'function suma(v) { if (v.length === 0) throw new RangeError("Vacío"); return v[0]; }',
  );

  assertEquals(outcome.outcomes[2], { ok: false, error: 'RangeError: Vacío' });
  assertEquals(outcome.outcomes[3], { ok: true, value: -2 });
});

Deno.test('anything thrown that is not an error is its text', async () => {
  const outcome = await run('function suma() { throw 42; }', [[[]]]);

  assertEquals(outcome.outcomes, [{ ok: false, error: '42' }]);
});

Deno.test('an endless loop in a test times it out, and the next tests still run', async () => {
  const outcome = await run('function suma(v) { while (v.length === 1) {} return v.length; }');

  assertEquals(outcome.outcomes, [
    { ok: true, value: 3 },
    undefined,
    { ok: true, value: 0 },
    { ok: true, value: 3 },
    { ok: true, value: 3 },
  ]);
});

Deno.test('when the run runs out of time, the pending tests time out', async () => {
  const outcome = await run('function suma() { while (true) {} }');

  // 200 ms for the run and 50 for each test: four start, and the fifth never does
  assertEquals(outcome.outcomes.length, 4);
  assert(outcome.outcomes.every((test) => test === undefined));
  assertEquals(outcome.loadError, undefined);
});

Deno.test('an endless loop while loading times out every test', async () => {
  assertEquals(await run('while (true) {} function suma() {}'), { outcomes: [] });
});

Deno.test('an endless recursion overflows the stack as in the browser', async () => {
  const outcome = await run('function suma(v) { return suma(v); }', [[[]]]);

  assertEquals(outcome.outcomes, [
    { ok: false, error: 'RangeError: Maximum call stack size exceeded' },
  ]);
});

Deno.test('a memory bomb fails its test without hurting the function', async () => {
  const outcome = await run('function suma() { let s = "x"; while (true) s += s; }', [[[]]]);

  assertEquals(outcome.outcomes, [{ ok: false, error: 'InternalError: out of memory' }]);
  assertEquals((await run('const suma = () => 1;', [[[]]])).outcomes, [{ ok: true, value: 1 }]);
});

Deno.test('a value too large to return fails its test', async () => {
  const outcome = await run('function suma() { return "x".repeat(200000); }', [[[]]]);

  assertEquals(outcome.outcomes, [
    { ok: false, error: 'RangeError: The value returned is too large' },
  ]);
});

Deno.test('the values JSON lacks come out as they are', async () => {
  const outcome = await run(
    'function suma(i) { return [undefined, 0 / 0, 1 / 0, -1 / 0, { a: undefined, b: [NaN] }][i]; }',
    [[0], [1], [2], [3], [4]],
  );

  assertEquals(outcome.outcomes, [
    { ok: true, value: undefined },
    { ok: true, value: Number.NaN },
    { ok: true, value: Infinity },
    { ok: true, value: -Infinity },
    { ok: true, value: { b: [Number.NaN] } },
  ]);
});

Deno.test('what JSON cannot carry is normalized as in the mock runner', async () => {
  const outcome = await run(
    `function suma(i) {
      const loop = [];
      loop.push(loop);
      return [() => 1, 10n, new Date(0), { f() {}, k: 1 }, loop][i];
    }`,
    [[0], [1], [2], [3], [4]],
  );

  assertEquals(outcome.outcomes, [
    { ok: true, value: undefined },
    { ok: true, value: '10' },
    { ok: true, value: '1970-01-01T00:00:00.000Z' },
    { ok: true, value: { k: 1 } },
    { ok: false, error: 'TypeError: The value contains itself' },
  ]);
});

Deno.test('a key called __proto__ stays a key of the value', async () => {
  const outcome = await run('const suma = () => JSON.parse(\'{"__proto__": 1}\');', [[[]]]);
  const value = outcome.outcomes[0]?.ok ? (outcome.outcomes[0].value as object) : null;

  assertEquals(Object.keys(value ?? {}), ['__proto__']);
});

Deno.test('each test gets its own copy of the arguments', async () => {
  const outcome = await run('function suma(v) { v.push(1); return v.length; }', [[[]], [[]]]);

  assertEquals(outcome.outcomes, [
    { ok: true, value: 1 },
    { ok: true, value: 1 },
  ]);
});

Deno.test('nothing outside plain JavaScript is reachable', async () => {
  const outcome = await run(
    `function suma() {
      return [typeof fetch, typeof Deno, typeof process, typeof require, typeof setTimeout,
        typeof WebAssembly, typeof importScripts];
    }`,
    [[[]]],
  );

  assertEquals(outcome.outcomes, [{ ok: true, value: Array(7).fill('undefined') }]);
});

Deno.test('nothing passes from one run to the next', async () => {
  await run('globalThis.leftover = 1; const suma = () => 0;', [[[]]]);

  const outcome = await run('const suma = () => typeof leftover;', [[[]]]);

  assertEquals(outcome.outcomes, [{ ok: true, value: 'undefined' }]);
});

Deno.test('tampering with JSON only breaks or fakes its own values', async () => {
  const broken = await run('JSON.stringify = () => "{"; const suma = () => 1;', [[[]]]);
  const faked = await run(
    'JSON.stringify = () => \'{"ok":true,"value":6}\'; const suma = () => 0;',
    [[[1, 2, 3]]],
  );

  assertEquals(broken.outcomes, [
    { ok: false, error: 'Error: The value returned could not be read' },
  ]);
  // The same as returning 6: the sandbox never had the expected value to fake
  assertEquals(faked.outcomes, [{ ok: true, value: 6 }]);
});

Deno.test('a function name that is not an identifier is rejected', async () => {
  await assertRejects(() => run('', [], 'suma; fetch()'), Error, 'Not a function name');
});
