import { Component, computed, input } from '@angular/core';

import type { AttemptStatus } from '../../data/attempt';

/** Tests passed out of the total in the last run. */
export interface TestCount {
  readonly passed: number;
  readonly total: number;
}

interface ChipStyle {
  readonly label: string;
  readonly icon: string;
  readonly classes: string;
}

/** Text, icon and colour tokens of each status: the icon repeats the meaning, never only the colour. */
const STYLES: Record<AttemptStatus, ChipStyle> = {
  not_started: {
    label: $localize`:@@status.notStarted:Sin empezar`,
    icon: 'radio_button_unchecked',
    classes: 'bg-surface-container-high text-on-surface-variant',
  },
  in_progress: {
    label: $localize`:@@status.inProgress:En curso`,
    icon: 'edit',
    classes: 'bg-info-container text-on-info-container',
  },
  tests_failed: {
    label: $localize`:@@status.testsFailed:Con fallos`,
    icon: 'error',
    classes: 'bg-warning-container text-on-warning-container',
  },
  passed: {
    label: $localize`:@@status.passed:Superado`,
    icon: 'check_circle',
    classes: 'bg-success-container text-on-success-container',
  },
  submitted: {
    label: $localize`:@@status.submitted:Entregado`,
    icon: 'task_alt',
    classes: 'bg-success text-on-success',
  },
};

/**
 * Status of an attempt as a small coloured pill with an icon (catalog, teacher panel, /dev/datos).
 * The workspace adds how many tests passed in the last run («Con fallos · 3/5»), which a phone also
 * sees from the tabs without the results (figure 17).
 */
@Component({
  selector: 'app-status-chip',
  template: `
    <span class="material-symbols-outlined text-[1.125rem]! leading-none!" aria-hidden="true">
      {{ style().icon }}
    </span>
    {{ style().label }}
    @if (testCount(); as count) {
      <span aria-hidden="true">· {{ count.passed }}/{{ count.total }}</span>
      <span class="sr-only" i18n="@@status.testCount"
        >, {{ count.passed }} de {{ count.total }} pruebas superadas</span
      >
    }
  `,
  host: {
    class:
      'inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 ps-1.5 pe-2.5 text-label-medium',
    '[class]': 'style().classes',
  },
})
export class StatusChip {
  readonly status = input.required<AttemptStatus>();
  readonly testCount = input<TestCount>();

  protected readonly style = computed(() => STYLES[this.status()]);
}
