import { Component, computed, input } from '@angular/core';

import type { Difficulty } from '../../data/exercise';

const STYLES: Record<Difficulty, { readonly label: string; readonly icon: string }> = {
  initial: { label: $localize`:@@difficulty.initial:Inicial`, icon: 'stat_1' },
  medium: { label: $localize`:@@difficulty.medium:Media`, icon: 'stat_2' },
  advanced: { label: $localize`:@@difficulty.advanced:Avanzada`, icon: 'stat_3' },
  extension: { label: $localize`:@@difficulty.extension:Ampliación`, icon: 'add_circle' },
};

/**
 * Difficulty of an exercise as an outlined, neutral pill: colours are kept for the status of the
 * attempt, so the two never look alike.
 */
@Component({
  selector: 'app-difficulty-chip',
  template: `
    <span class="material-symbols-outlined text-[1.125rem]! leading-none!" aria-hidden="true">
      {{ style().icon }}
    </span>
    {{ style().label }}
  `,
  host: {
    class:
      'inline-flex shrink-0 items-center gap-1 rounded-full border border-outline-variant py-0.5 ps-1.5 pe-2.5 text-label-medium text-on-surface-variant',
  },
})
export class DifficultyChip {
  readonly difficulty = input.required<Difficulty>();

  protected readonly style = computed(() => STYLES[this.difficulty()]);
}
