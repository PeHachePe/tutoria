import { Component, computed, input } from '@angular/core';

import type { AttemptStatus } from '../../data/attempt';

interface ChipStyle {
  readonly label: string;
  readonly icon: string;
  readonly classes: string;
}

/** Text, icon and colour tokens of each status: the icon repeats the meaning, never only the colour. */
const STYLES: Record<AttemptStatus, ChipStyle> = {
  not_started: {
    label: 'Sin empezar',
    icon: 'radio_button_unchecked',
    classes: 'bg-surface-container-high text-on-surface-variant',
  },
  in_progress: {
    label: 'En curso',
    icon: 'edit',
    classes: 'bg-info-container text-on-info-container',
  },
  tests_failed: {
    label: 'Con fallos',
    icon: 'error',
    classes: 'bg-warning-container text-on-warning-container',
  },
  passed: {
    label: 'Superado',
    icon: 'check_circle',
    classes: 'bg-success-container text-on-success-container',
  },
  submitted: { label: 'Entregado', icon: 'task_alt', classes: 'bg-success text-on-success' },
};

/** Status of an attempt as a small coloured pill with an icon (catalog, teacher panel, /dev/datos). */
@Component({
  selector: 'app-status-chip',
  template: `
    <span class="material-symbols-outlined text-[1.125rem]! leading-none!" aria-hidden="true">
      {{ style().icon }}
    </span>
    {{ style().label }}
  `,
  host: {
    class:
      'inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 ps-1.5 pe-2.5 text-label-medium',
    '[class]': 'style().classes',
  },
})
export class StatusChip {
  readonly status = input.required<AttemptStatus>();

  protected readonly style = computed(() => STYLES[this.status()]);
}
