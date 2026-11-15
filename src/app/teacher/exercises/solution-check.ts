import { Component, computed, inject, input, model, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import type { RunResult } from '../../data/attempt';
import type { SolutionCheck as Check } from '../../data/code-runner/run-result';
import { CodeRunnerService } from '../../data/code-runner-service';
import { CodeEditor } from '../../shared/code-editor/code-editor';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { RunResults } from '../../student/workspace/code-zone/run-results';
import { formActionMessage } from './form-action-message';

/** The tests a solution was checked against, and what it got. */
export interface CheckRun {
  readonly check: Check;
  readonly result: RunResult;
}

/** What the form asks to check: its function and its tests, without the code yet. */
export type CheckTarget = Omit<Check, 'code'>;

let nextId = 0;

/**
 * «Probar mi solución» (4.3c, D-059): the teacher writes a solution and runs it against the tests
 * of the form as they are, saved or not, on the server, as the student's code runs. It sees every
 * result in detail, hidden tests too, and nothing is kept: the solution never reaches a student or
 * the tutor. The code lives here while the form is open.
 */
@Component({
  selector: 'app-solution-check',
  imports: [MatButton, MatIcon, CodeEditor, Skeleton, RunResults],
  templateUrl: './solution-check.html',
  host: { class: 'flex flex-col gap-3' },
})
export class SolutionCheck {
  private readonly runner = inject(CodeRunnerService);

  /** The function and the tests to check against; `null` while either has errors. */
  readonly target = input.required<CheckTarget | null>();
  /** The empty function the solution starts from. */
  readonly skeleton = input.required<string>();
  /** The last check, shared with the form, which marks each test with its result. */
  readonly lastRun = model<CheckRun | null>(null);

  protected readonly panelId = `app-solution-check-${nextId++}`;
  protected readonly editorLabel = $localize`:@@solutionCheck.editor:Tu solución`;

  protected readonly open = signal(false);
  /** The solution; empty until the panel first opens, when it takes the skeleton. */
  protected readonly code = signal('');
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The solution or the tests changed after the last check: its results are of the ones before. */
  protected readonly outdated = computed(() => {
    const run = this.lastRun();
    const target = this.target();
    return !!run && (!target || !sameCheck(run.check, { ...target, code: this.code() }));
  });

  /** Said to a screen reader when a check ends: the results are long to go through. */
  protected readonly announcement = computed(() => {
    const run = this.lastRun();
    if (!run) return '';
    if (run.result.loadError) {
      return $localize`:@@solutionCheck.announce.notRun:El código no se ha podido ejecutar`;
    }
    const passed = run.result.results.filter((result) => result.passed).length;
    const total = run.result.results.length;
    return $localize`:@@solutionCheck.announce.count:${passed}:passed: de ${total}:total: pruebas superadas`;
  });

  protected toggle(): void {
    if (!this.open() && this.code() === '') this.code.set(this.skeleton());
    this.open.update((open) => !open);
  }

  /** Runs the solution on the server and keeps what it got. */
  protected async run(): Promise<void> {
    const target = this.target();
    if (!target || this.checking()) return;
    const check: Check = { ...target, code: this.code() };
    this.checking.set(true);
    this.error.set(null);
    try {
      this.lastRun.set({ check, result: await this.runner.check(check) });
    } catch (error) {
      this.error.set(formActionMessage('check', error));
    } finally {
      this.checking.set(false);
    }
  }
}

/** Two checks are the same if they run the same code against the same tests: plain data. */
export function sameCheck(a: Check, b: Check): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
