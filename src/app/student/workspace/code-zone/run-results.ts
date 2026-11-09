import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import type { RunResult, TestResult } from '../../../data/attempt';
import { formatCall, formatValue, isMultilineText } from '../../../shared/format-value';

/**
 * How a test ended: passed, a wrong value, an error thrown, out of time, or never started because
 * an earlier one ran out of time (all the tests run in one program, here and on the server).
 */
export type TestState = 'passed' | 'failed' | 'error' | 'timeout' | 'notRun';

interface StateStyle {
  readonly label: string;
  readonly icon: string;
  readonly colour: string;
}

/** The icon tells the state too, never only the colour; the label is for screen readers. */
const STATES: Record<TestState, StateStyle> = {
  passed: {
    label: $localize`:@@runResults.passed:Superada`,
    icon: 'check_circle',
    colour: 'text-success',
  },
  failed: {
    label: $localize`:@@runResults.failed:No superada`,
    icon: 'cancel',
    colour: 'text-error',
  },
  error: {
    label: $localize`:@@runResults.error:Error`,
    icon: 'report',
    colour: 'text-error',
  },
  timeout: {
    label: $localize`:@@runResults.timeout:Tiempo agotado`,
    icon: 'timer_off',
    colour: 'text-error',
  },
  notRun: {
    label: $localize`:@@runResults.state.notRun:Sin ejecutar`,
    icon: 'pending',
    colour: 'text-on-surface-variant',
  },
};

/**
 * The state of each test, in order. Only the first one out of time is the one that did not end:
 * the ones after it never started, so «Tiempo agotado» would point at the wrong test.
 */
let nextId = 0;

export function testStates(results: readonly TestResult[]): TestState[] {
  let timedOut = false;
  return results.map((result) => {
    if (result.passed) return 'passed';
    if (result.timeout) {
      const state = timedOut ? 'notRun' : 'timeout';
      timedOut = true;
      return state;
    }
    return result.error === undefined ? 'failed' : 'error';
  });
}

/** A value as the student would write it; a text with line breaks, as a block (exercise 2). */
function shown(value: unknown): { readonly text: string; readonly block: boolean } {
  return isMultilineText(value)
    ? { text: value, block: true }
    : { text: formatValue(value), block: false };
}

/**
 * The results of the last run (2.5, figure 17): the summary, and then each example with its call,
 * the expected value and what the code returned, the error it threw or that it ran out of time;
 * the hidden checks, only whether they passed. If the code did not load, only why. It folds to the
 * summary.
 */
@Component({
  selector: 'app-run-results',
  imports: [NgTemplateOutlet, MatIcon],
  templateUrl: './run-results.html',
  host: { class: 'flex flex-col gap-3' },
})
export class RunResults {
  readonly result = input.required<RunResult>();
  /** Name of the function of the exercise, to write each call. */
  readonly functionName = input.required<string>();
  /** The student changed the code after this run. */
  readonly outdated = input(false);

  protected readonly states = STATES;
  protected readonly bodyId = `app-run-results-body-${nextId++}`;

  /**
   * Folded, only the summary shows and the editor gets the room. Each new run unfolds it, so the
   * student sees what changed: derived from the result, it needs no effect.
   */
  protected readonly open = linkedSignal({ source: this.result, computation: () => true });

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected readonly summary = computed(() => {
    const { results, loadError } = this.result();
    const passed = results.filter((result) => result.passed).length;
    return {
      passed,
      total: results.length,
      allPassed: !loadError && passed === results.length,
      anyTimeout: results.some((result) => result.timeout),
    };
  });

  /** Each test with its state, in order. */
  private readonly entries = computed(() => {
    const { results } = this.result();
    const states = testStates(results);
    return results.map((result, index) => ({ result, state: states[index] }));
  });

  /** Visible tests carry their input; hidden ones only say whether they passed. */
  protected readonly examples = computed(() =>
    this.entries().flatMap(({ result, state }) =>
      result.input === undefined
        ? []
        : [
            {
              key: result.testId,
              state,
              call: formatCall(this.functionName(), result.input),
              expected: shown(result.expected),
              actual: shown(result.actual),
              error: result.error,
            },
          ],
    ),
  );

  protected readonly hiddenChecks = computed(() =>
    this.entries()
      .filter(({ result }) => result.input === undefined)
      .map(({ result, state }, index) => ({ key: result.testId, number: index + 1, state })),
  );
}
