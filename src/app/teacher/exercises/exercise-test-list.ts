import { afterNextRender, Component, computed, inject, Injector, input } from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';

import { formatCall, formatValue } from '../../shared/format-value';
import { emptyTest, parseArguments, parseValue, type TestRow } from './exercise-form-model';

/**
 * The tests of an exercise (CU-05, step 3): the arguments of each call and the value it must
 * return, written as JSON, with the call they make as the student will read it under them. Hidden
 * tests only tell the student whether they passed.
 */
@Component({
  selector: 'app-exercise-test-list',
  imports: [
    FormField,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatCheckbox,
    MatButton,
    MatIconButton,
    MatIcon,
  ],
  templateUrl: './exercise-test-list.html',
  host: { class: 'flex flex-col gap-3' },
})
export class ExerciseTestList {
  private readonly injector = inject(Injector);

  readonly tests = input.required<FieldTree<readonly TestRow[]>>();
  /** The function each test calls, to show the call. */
  readonly functionName = input.required<string>();

  protected readonly disabled = computed(() => this.tests()().disabled());
  protected readonly count = computed(() => this.tests()().value().length);
  protected readonly error = computed(() => {
    const field = this.tests()();
    return field.touched() ? field.errors()[0]?.message : undefined;
  });

  /** An interpolated i18n attribute is not set on a Material button: the label goes in code. */
  protected removeLabel(index: number): string {
    return $localize`:@@exerciseTests.remove:Quitar la prueba ${index + 1}:number:`;
  }

  /** «sum([1, 2, 3]) → 6», once both sides are JSON. */
  protected callOf(test: TestRow): string | null {
    const input = parseArguments(test.input);
    const expected = parseValue(test.expected);
    if (!input || !expected) return null;
    const name = this.functionName().trim() || 'f';
    return `${formatCall(name, input)} → ${formatValue(expected.value)}`;
  }

  /** Adds an empty test at the end and takes the focus to its arguments. */
  protected add(): void {
    const tests = this.tests();
    tests().value.update((rows) => [...rows, emptyTest()]);
    afterNextRender(() => tests[tests().value().length - 1].input().focusBoundControl(), {
      injector: this.injector,
    });
  }

  protected remove(index: number): void {
    this.tests()().value.update((rows) => rows.filter((_, i) => i !== index));
  }
}
