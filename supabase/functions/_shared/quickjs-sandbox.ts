import variant from '@jitl/quickjs-singlefile-mjs-release-sync';
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
} from 'quickjs-emscripten-core';

import {
  decodeRunValue,
  type EncodedValue,
  type RunLoadError,
  type RunOutcome,
  type RunRequest,
  type TestOutcome,
} from '../../../src/app/data/code-runner/run-result.ts';
import type { CodeSandbox } from './code-sandbox.ts';

/** How far the student's code may go in one run. */
export interface SandboxLimits {
  /** Time of each test; then it times out and the next one starts. */
  readonly testTimeMs: number;
  /**
   * Time of the whole run, loading the code included; then the pending tests time out. Well below
   * the CPU time Supabase gives a request (2 s), so the platform never ends the function.
   */
  readonly runTimeMs: number;
  readonly memoryBytes: number;
  /** Below what the Edge Runtime can take: a deeper stack overflows the function itself. */
  readonly stackBytes: number;
  /** Size of the value a test returns, as it comes out of the sandbox. */
  readonly resultChars: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  testTimeMs: 250,
  runTimeMs: 1000,
  memoryBytes: 32 * 1024 * 1024,
  stackBytes: 256 * 1024,
  resultChars: 100_000,
};

/** Error messages as the browser writes them, for those QuickJS writes differently. */
const BROWSER_MESSAGES: Readonly<Record<string, string>> = {
  'InternalError: stack overflow': 'RangeError: Maximum call stack size exceeded',
};

const INTERRUPTED = 'InternalError: interrupted';
const UNREADABLE = 'Error: The value returned could not be read';
const TOO_LARGE = 'RangeError: The value returned is too large';

/** Function names are identifiers: they go into the code that looks the function up. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Loaded before the student's code, which then cannot replace it: the host keeps its handle. It
 * calls the function with a fresh copy of the arguments and returns the outcome as JSON, with the
 * value encoded as `encodeRunValue()` does (`EncodedValue`) and normalized as the mock runner does
 * (`normalizeOutput()`): functions and symbols are `undefined`, a `bigint` is its text, a date its
 * JSON, and a value that contains itself is a `TypeError`.
 */
const HELPERS = `(() => {
  const skipped = (value) => ['undefined', 'function', 'symbol'].includes(typeof value);
  const encode = (value, ancestors) => {
    if (skipped(value)) return { t: 'undefined' };
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number') return Number.isFinite(value) ? value : { t: 'number', v: String(value) };
    if (typeof value !== 'object' || value === null) return value;
    if (value instanceof Date) return value.toJSON();
    if (ancestors.includes(value)) throw new TypeError('The value contains itself');
    ancestors.push(value);
    let encoded;
    if (Array.isArray(value)) {
      encoded = value.map((item) => encode(item, ancestors));
    } else {
      const fields = {};
      for (const [key, item] of Object.entries(value)) {
        if (skipped(item)) continue;
        // Defined, not assigned, so a key called __proto__ stays a key
        Object.defineProperty(fields, key, { value: encode(item, ancestors), enumerable: true });
      }
      encoded = { t: 'object', v: fields };
    }
    ancestors.pop();
    return encoded;
  };
  const describe = (error) => (error instanceof Error ? error.name + ': ' + error.message : String(error));
  // The line of the student's code (solution.js) where it was thrown; JSON leaves it out if unknown
  const lineOf = (error) => {
    // Backslashes doubled: this is the text of a template literal
    const match = /solution\\.js:(\\d+)/.exec(error instanceof Error ? String(error.stack) : '');
    return match ? Number(match[1]) : undefined;
  };
  return (fn, argsJson) => {
    let outcome;
    try {
      outcome = { ok: true, value: encode(fn(...JSON.parse(argsJson)), []) };
    } catch (error) {
      outcome = { ok: false, error: describe(error), line: lineOf(error) };
    }
    return JSON.stringify(outcome);
  };
})()`;

type Loaded =
  | { readonly fn: QuickJSHandle }
  | { readonly loadError: RunLoadError }
  | { readonly timedOut: true };

/**
 * Runs the student's code in QuickJS compiled to WebAssembly, inside the function (D-042): no
 * network, files, timers or secrets, only plain JavaScript, with limits of time per test and per
 * run, memory and stack. Each run gets its own runtime, so nothing passes from one to the next.
 */
export class QuickJsSandbox implements CodeSandbox {
  private module: Promise<QuickJSWASMModule> | undefined;

  constructor(
    private readonly limits: SandboxLimits = DEFAULT_LIMITS,
    private readonly clock: () => number = Date.now,
  ) {}

  async run(request: RunRequest): Promise<RunOutcome> {
    if (!IDENTIFIER.test(request.functionName)) {
      throw new Error(`Not a function name: ${request.functionName}`);
    }
    const module = await (this.module ??= newQuickJSWASMModuleFromVariant(variant));
    try {
      return this.runIn(module, request);
    } catch (error) {
      // The engine itself failed: the next run loads it again, in case its memory is damaged
      this.module = undefined;
      throw error;
    }
  }

  private runIn(module: QuickJSWASMModule, request: RunRequest): RunOutcome {
    const runEnd = this.clock() + this.limits.runTimeMs;
    let deadline = runEnd;
    const runtime = module.newRuntime();
    runtime.setMemoryLimit(this.limits.memoryBytes);
    runtime.setMaxStackSize(this.limits.stackBytes);
    runtime.setInterruptHandler(() => this.clock() > deadline);
    const context = runtime.newContext();
    let call: QuickJSHandle | undefined;
    try {
      call = context.unwrapResult(context.evalCode(HELPERS));
      const loaded = load(context, request);
      if ('loadError' in loaded) return { outcomes: [], loadError: loaded.loadError };
      if ('timedOut' in loaded) return { outcomes: [] };
      try {
        const outcomes: (TestOutcome | undefined)[] = [];
        for (const input of request.inputs) {
          const start = this.clock();
          if (start >= runEnd) break;
          deadline = Math.min(start + this.limits.testTimeMs, runEnd);
          outcomes.push(this.callTest(context, call, loaded.fn, input));
        }
        return { outcomes };
      } finally {
        loaded.fn.dispose();
      }
    } finally {
      call?.dispose();
      context.dispose();
      runtime.dispose();
    }
  }

  /** The outcome of a test, or `undefined` if it ran out of time. */
  private callTest(
    context: QuickJSContext,
    call: QuickJSHandle,
    fn: QuickJSHandle,
    input: readonly unknown[],
  ): TestOutcome | undefined {
    const args = context.newString(JSON.stringify(input));
    const result = context.callFunction(call, context.undefined, fn, args);
    args.dispose();
    if (result.error) {
      const { message } = takeError(context, result.error);
      return message === INTERRUPTED ? undefined : { ok: false, error: message };
    }
    const text: unknown = context.dump(result.value);
    result.value.dispose();
    return readOutcome(text, this.limits.resultChars);
  }
}

/** Runs the code and looks the function up by its name, as the mock runner does. */
function load(context: QuickJSContext, request: RunRequest): Loaded {
  const evaluated = context.evalCode(request.code, 'solution.js');
  if (evaluated.error) {
    const { message, line } = takeError(context, evaluated.error);
    if (message === INTERRUPTED) return { timedOut: true };
    return {
      loadError:
        line === undefined
          ? { kind: 'invalid_code', message }
          : { kind: 'invalid_code', message, line },
    };
  }
  evaluated.value.dispose();
  const name = request.functionName;
  const found = context.evalCode(`typeof ${name} === 'function' ? ${name} : undefined`);
  if (found.error) {
    found.error.dispose();
    return { loadError: { kind: 'missing_function' } };
  }
  if (context.typeof(found.value) !== 'function') {
    found.value.dispose();
    return { loadError: { kind: 'missing_function' } };
  }
  return { fn: found.value };
}

/**
 * `TypeError: …`, as the browser console writes it, anything else thrown as text, and the line of
 * the student's code where it happened: QuickJS gives it as `lineNumber` for a syntax error and in
 * the stack (`solution.js:3`) for the rest.
 */
function takeError(
  context: QuickJSContext,
  handle: QuickJSHandle,
): { readonly message: string; readonly line?: number } {
  const error: unknown = context.dump(handle);
  handle.dispose();
  if (typeof error !== 'object' || error === null || !('name' in error) || !('message' in error)) {
    return { message: String(error) };
  }
  const text = `${String(error.name)}: ${String(error.message)}`;
  const message = BROWSER_MESSAGES[text] ?? text;
  const line =
    'lineNumber' in error && typeof error.lineNumber === 'number'
      ? error.lineNumber
      : Number(/solution\.js:(\d+)/.exec('stack' in error ? String(error.stack) : '')?.[1]);
  return Number.isInteger(line) && line > 0 ? { message, line } : { message };
}

/**
 * The outcome the helpers wrote. The student's code could have changed `JSON` or `Array` before:
 * what does not read as an outcome is an error of that test. Whatever it writes, it can only pass
 * for values it returns itself: the expected ones are never in the sandbox.
 */
function readOutcome(text: unknown, maxChars: number): TestOutcome {
  if (typeof text !== 'string') return { ok: false, error: UNREADABLE };
  if (text.length > maxChars) return { ok: false, error: TOO_LARGE };
  try {
    const outcome = JSON.parse(text) as {
      ok?: unknown;
      value?: EncodedValue;
      error?: unknown;
      line?: unknown;
    };
    if (outcome.ok === true && 'value' in outcome) {
      return { ok: true, value: decodeRunValue(outcome.value as EncodedValue) };
    }
    if (outcome.ok === false && typeof outcome.error === 'string') {
      const error = BROWSER_MESSAGES[outcome.error] ?? outcome.error;
      return typeof outcome.line === 'number'
        ? { ok: false, error, line: outcome.line }
        : { ok: false, error };
    }
  } catch {
    // Not JSON: below
  }
  return { ok: false, error: UNREADABLE };
}
