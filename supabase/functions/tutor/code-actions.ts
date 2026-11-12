import { buildRunResult, type RunResult } from '../../../src/app/data/code-runner/run-result.ts';
import { checkFix, type CodeFix, declaresFunction } from '../../../src/app/data/tutor/code-fix.ts';
import type { ToolCall } from '../../../src/app/data/tutor/tutor-tools.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import type { TutorAttempt } from './answer-store.ts';

/** What the actions on the code are checked against: the attempt and its code as it is now. */
export interface CodeContext {
  readonly attempt: TutorAttempt;
  readonly code: string;
  /** What the code does now with the examples (`tryExamples`). */
  readonly tried: RunResult | null;
  readonly sandbox: CodeSandbox;
}

/**
 * The code as it is now with the examples, in the sandbox of `execute` (D-042): what it returns or
 * the error it throws, even if the student did not run it. Only the visible tests: the values of the
 * hidden ones must not reach the model. Nothing to try without code.
 */
export async function tryExamples(
  sandbox: CodeSandbox,
  { exercise }: TutorAttempt,
  code: string,
): Promise<RunResult | null> {
  if (!code.trim()) return null;
  const examples = exercise.tests.filter((test) => !test.isHidden);
  const outcome = await sandbox.run({
    code,
    functionName: exercise.functionName,
    inputs: examples.map((test) => test.input),
  });
  return buildRunResult(examples, outcome);
}

/**
 * The actions that touch the code or the submission (2.5f, D-047), checked here and not by the model:
 * the skeleton only if the function is not there yet, formatting and running only with code,
 * submitting only a passed attempt, and a fix only of a slip of writing that the sandbox confirms.
 * The rest go through as they came. What is dropped is said, never run.
 */
export async function checkCodeActions(
  actions: readonly ToolCall[],
  context: CodeContext,
): Promise<ToolCall[]> {
  const kept: ToolCall[] = [];
  for (const action of actions) {
    if (await holds(action, context)) {
      kept.push(action);
    } else {
      console.warn(`Action dropped: ${action.name}`);
    }
  }
  return kept;
}

async function holds({ name, arguments: args }: ToolCall, context: CodeContext): Promise<boolean> {
  const { attempt, code } = context;
  switch (name) {
    case 'insertSkeleton':
      return !declaresFunction(code, attempt.exercise.functionName);
    case 'formatCode':
    case 'runTests':
      return code.trim() !== '';
    case 'submitAttempt':
      return attempt.status === 'passed';
    case 'proposeFix':
      return await fixHolds(args as unknown as CodeFix, context);
    default:
      return true;
  }
}

/**
 * The frontier of `proposeFix` (D-047): a slip of writing (`checkFix`) that keeps the code from
 * running, which the change takes away. The code must not load, or throw because of a name, and with
 * the fix in the sandbox that error is gone. A misspelt name of the language (`lenght`) may throw
 * nothing at all: then it is enough that the fixed code throws nothing either. With the code loading
 * and the tests failing, the tutor only points and gives hints.
 */
async function fixHolds(fix: CodeFix, { attempt, code, tried, sandbox }: CodeContext) {
  const check = checkFix(code, fix, { functionName: attempt.exercise.functionName });
  if (!check.ok) return false;
  const before = problemOf(tried);
  if (before === null && !check.namesOnly) return false;
  const after = problemOf(await tryExamples(sandbox, attempt, check.code));
  return after === null || (before !== null && after !== before);
}

/** An error of a name: a variable or a method that does not exist. */
const NAME_ERROR = /ReferenceError|is not defined|is not a function/;

/**
 * What keeps the code from running, said the same way each time to compare it: it does not load, it
 * lacks the function, or a test throws because of a name. Null if it runs, right or wrong.
 */
function problemOf(run: RunResult | null): string | null {
  if (!run) return null;
  if (run.loadError) {
    const { kind, message = '', line = 0 } = run.loadError;
    return `${kind}:${message}:${line}`;
  }
  const failure = run.results.find((result) => result.error && NAME_ERROR.test(result.error));
  return failure ? `run:${failure.error}:${failure.line ?? 0}` : null;
}
