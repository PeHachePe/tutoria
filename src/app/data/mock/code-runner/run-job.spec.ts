import type { RunRequest } from '../../code-runner/run-result';
import type { RunMessage } from './run-protocol';
import { runJob } from './run-job';

const SUM =
  'function suma(vector) {\n  let total = 0;\n  for (const n of vector) total += n;\n  return total;\n}';

function run(request: Partial<RunRequest> & Pick<RunRequest, 'code'>): RunMessage[] {
  const messages: RunMessage[] = [];
  runJob({ functionName: 'suma', inputs: [[[1, 2, 3]], [[]]], ...request }, (message) =>
    messages.push(message),
  );
  return messages;
}

describe('runJob', () => {
  it('calls the function with each input and reports each value in order', () => {
    expect(run({ code: SUM })).toEqual([
      { type: 'started' },
      { type: 'result', index: 0, outcome: { ok: true, value: 6 } },
      { type: 'result', index: 1, outcome: { ok: true, value: 0 } },
      { type: 'done' },
    ]);
  });

  it('accepts the function written as an arrow function, and code without a final line break', () => {
    const messages = run({ code: 'const suma = (v) => v.length // counts' });

    expect(messages[1]).toEqual({ type: 'result', index: 0, outcome: { ok: true, value: 3 } });
  });

  it('keeps the values JSON would hide', () => {
    const messages = run({
      code: 'function suma(v) { let total; for (const n of v) total += n; return total; }',
    });

    expect(messages.slice(1, 3)).toEqual([
      { type: 'result', index: 0, outcome: { ok: true, value: Number.NaN } },
      { type: 'result', index: 1, outcome: { ok: true, value: undefined } },
    ]);
  });

  it('reports the error of each test without stopping the others', () => {
    const messages = run({
      code: 'function suma(v) { if (v.length === 0) throw new RangeError("vacío"); return 1; }',
    });

    expect(messages.slice(1, 3)).toEqual([
      { type: 'result', index: 0, outcome: { ok: true, value: 1 } },
      { type: 'result', index: 1, outcome: { ok: false, error: 'RangeError: vacío' } },
    ]);
  });

  it('reports a thrown value that is not an error as text', () => {
    const messages = run({ code: 'function suma() { throw "no"; }', inputs: [[]] });

    expect(messages[1]).toEqual({ type: 'result', index: 0, outcome: { ok: false, error: 'no' } });
  });

  it('gives each test its own copy of the input, as the function may change it', () => {
    const input = [[1]];
    const messages = run({
      code: 'function suma(v) { v.push(1); return v.length; }',
      inputs: [input, input],
    });

    expect(messages.slice(1, 3).map((m) => m.type === 'result' && m.outcome)).toEqual([
      { ok: true, value: 2 },
      { ok: true, value: 2 },
    ]);
  });

  it('reports code that does not load once, without running the tests', () => {
    expect(run({ code: 'function suma(v) {' })).toEqual([
      { type: 'started' },
      {
        type: 'load_error',
        error: { kind: 'invalid_code', message: expect.stringMatching(/^SyntaxError: /) },
      },
    ]);
    expect(run({ code: 'missing();\nfunction suma() { return 1; }' })[1]).toEqual({
      type: 'load_error',
      error: { kind: 'invalid_code', message: 'ReferenceError: missing is not defined' },
    });
  });

  it('reports a missing function, also when the name holds something else', () => {
    const missing = { type: 'load_error', error: { kind: 'missing_function' } };

    expect(run({ code: 'function sum(v) { return 0; }' })[1]).toEqual(missing);
    expect(run({ code: 'const suma = 3;' })[1]).toEqual(missing);
  });
});
