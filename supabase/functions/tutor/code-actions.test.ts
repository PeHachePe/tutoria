import { assertEquals } from '@std/assert';

import type { ToolCall } from '../../../src/app/data/tutor/tutor-tools.ts';
import { QuickJsSandbox } from '../_shared/quickjs-sandbox.ts';
import type { TutorAttempt } from './answer-store.ts';
import { checkCodeActions, tryExamples } from './code-actions.ts';

/** The real sandbox: the frontier of `proposeFix` is what the code does in it (D-047). */
const sandbox = new QuickJsSandbox();

const ATTEMPT: TutorAttempt = {
  userId: 'hugo',
  ownerActive: true,
  status: 'in_progress',
  currentCode: '',
  exercise: {
    title: 'Suma',
    statement: 'Escribe una función `suma`.',
    topics: [],
    sourceLocale: 'es',
    translations: {},
    functionName: 'suma',
    tests: [
      { id: 't1', input: [[1, 2, 3]], expectedOutput: 6, isHidden: false },
      { id: 't2', input: [[5]], expectedOutput: 5, isHidden: false },
    ],
  },
  lastRun: null,
  previous: [],
};

const SUM = [
  'function suma(v) {',
  '  let total = 0;',
  '  for (let i = 0; i < v.length; i++) {',
  '    total += v[i];',
  '  }',
  '  return total;',
  '}',
];

function withLine(line: number, text: string): string {
  return SUM.map((each, index) => (index === line - 1 ? text : each)).join('\n');
}

/** Which of the actions hold for this code, as the Edge Function checks them. */
async function kept(
  code: string,
  actions: readonly ToolCall[],
  attempt: TutorAttempt = ATTEMPT,
): Promise<string[]> {
  const tried = await tryExamples(sandbox, attempt, code);
  const checked = await checkCodeActions(actions, { attempt, code, tried, sandbox });
  return checked.map((action) => action.name);
}

const fix = (line: number, code: string, insert?: boolean): ToolCall => ({
  name: 'proposeFix',
  arguments: { line, code, ...(insert ? { insert } : {}) },
});

Deno.test('proposeFix fixes a slip that keeps the code from loading', async () => {
  // retrun → return: a syntax error
  assertEquals(await kept(withLine(6, '  retrun total;'), [fix(6, SUM[5])]), ['proposeFix']);
  // A missing «)»
  const missing = withLine(3, '  for (let i = 0; i < v.length; i++ {');
  assertEquals(await kept(missing, [fix(3, SUM[2])]), ['proposeFix']);
  // A missing «}» at the end, on a line of its own
  assertEquals(await kept(SUM.slice(0, -1).join('\n'), [fix(7, '}', true)]), ['proposeFix']);
});

Deno.test('proposeFix fixes a name that does not exist, even one that throws nothing', async () => {
  // A method that is not a function: TypeError
  const floor = 'function suma(v) {\n  return Math.flor(v[0]);\n}';
  assertEquals(await kept(floor, [fix(2, '  return Math.floor(v[0]);')]), ['proposeFix']);
  // A variable that does not exist: ReferenceError
  assertEquals(await kept(withLine(4, '    totla += v[i];'), [fix(4, SUM[3])]), ['proposeFix']);
  // lenght throws nothing, and the tests fail: still a slip of writing (D-047)
  const length = withLine(3, '  for (let i = 0; i < v.lenght; i++) {');
  assertEquals(await kept(length, [fix(3, SUM[2])]), ['proposeFix']);
});

Deno.test('proposeFix never changes what makes the tests fail', async () => {
  const code = withLine(3, '  for (let i = 1; i < v.length; i++) {');
  // One character, and the solution
  assertEquals(await kept(code, [fix(3, SUM[2])]), []);
  const loop = withLine(3, '  for (let i = 0; i < v.length - 1; i++) {');
  assertEquals(await kept(loop, [fix(3, '  for (let i = 0; i <= v.length - 1; i++) {')]), []);
  // With the code loading and running, not even a semicolon
  const running = withLine(2, '  let total = 0');
  assertEquals(await kept(running, [fix(2, SUM[1])]), []);
});

Deno.test('proposeFix only counts if the error goes away with it', async () => {
  const code = withLine(6, '  retrun total;');
  // A semicolon more leaves the same syntax error
  assertEquals(await kept(code, [fix(6, '  retrun total;;')]), []);
  // A fix of a line that is not the one with the error
  assertEquals(await kept(code, [fix(2, '  let total = 0;;')]), []);
  // Nothing to fix without code
  assertEquals(await kept('', [fix(1, '}', true)]), []);
});

Deno.test('the server finds the fix of a misspelt name the model did not propose', async () => {
  const offered = async (code: string, actions: readonly ToolCall[] = []) => {
    const tried = await tryExamples(sandbox, ATTEMPT, code);
    return await checkCodeActions(
      actions,
      { attempt: ATTEMPT, code, tried, sandbox },
      {
        offerFix: true,
      },
    );
  };
  assertEquals(await offered(withLine(6, '  retrun total;')), [fix(6, SUM[5])]);
  // Not twice, nor for the logic, nor for a slip it cannot find (a missing bracket)
  assertEquals(await offered(withLine(6, '  retrun total;'), [fix(6, SUM[5])]), [fix(6, SUM[5])]);
  assertEquals(await offered(withLine(3, '  for (let i = 1; i < v.length; i++) {')), []);
  assertEquals(await offered(withLine(3, '  for (let i = 0; i < v.length; i++ {')), []);
});

Deno.test('the skeleton, formatting and running need the code as it is', async () => {
  const skeleton: ToolCall = { name: 'insertSkeleton', arguments: { parameters: ['v'] } };
  const format: ToolCall = { name: 'formatCode', arguments: {} };
  const run: ToolCall = { name: 'runTests', arguments: {} };
  assertEquals(await kept('', [skeleton, format, run]), ['insertSkeleton']);
  assertEquals(await kept(SUM.join('\n'), [skeleton, format, run]), ['formatCode', 'runTests']);
  assertEquals(await kept('// suma', [skeleton]), ['insertSkeleton']);
});

Deno.test('submitting needs an attempt that passed, and the rest go through', async () => {
  const submit: ToolCall = { name: 'submitAttempt', arguments: {} };
  const mark: ToolCall = { name: 'highlightLines', arguments: { lines: [] } };
  const code = SUM.join('\n');
  assertEquals(await kept(code, [submit, mark]), ['highlightLines']);
  assertEquals(await kept(code, [submit], { ...ATTEMPT, status: 'passed' }), ['submitAttempt']);
});
