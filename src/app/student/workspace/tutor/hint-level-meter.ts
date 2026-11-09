import { Component, computed, input } from '@angular/core';

import { type HintLevel, MAX_HINT_LEVEL } from '../../../data/tutor';

/** What each level of hint gives (2.6): its name, and what asking for it promises. */
export const HINT_LEVELS: Record<HintLevel, { readonly name: string; readonly promise: string }> = {
  1: {
    name: $localize`:@@tutor.level1.name:Pregunta guía`,
    promise: $localize`:@@tutor.level1.promise:Te haré una pregunta que te oriente.`,
  },
  2: {
    name: $localize`:@@tutor.level2.name:Concepto`,
    promise: $localize`:@@tutor.level2.promise:Te señalaré el concepto o la zona del código.`,
  },
  3: {
    name: $localize`:@@tutor.level3.name:Paso concreto`,
    promise: $localize`:@@tutor.level3.promise:Te orientaré en el paso concreto, sin darte el código.`,
  },
};

const STEPS = Array.from({ length: MAX_HINT_LEVEL }, (_, index) => index + 1);

/**
 * The level the hints have reached, as steps that fill up, with its name in words: the student sees
 * that each «Pedir pista» gets more concrete (2.6), and the colour is never the only cue.
 */
@Component({
  selector: 'app-hint-level-meter',
  template: `
    <span class="flex shrink-0 gap-1" aria-hidden="true">
      @for (step of steps; track step) {
        <span
          class="h-1.5 w-4 rounded-full transition-colors duration-300 motion-reduce:transition-none"
          [class]="step <= level() ? 'bg-primary' : 'bg-outline-variant'"
        ></span>
      }
    </span>
    <span class="text-label-medium text-on-surface-variant">{{ text() }}</span>
  `,
  host: { class: 'flex items-center gap-2' },
})
export class HintLevelMeter {
  /** 0 before the first hint. */
  readonly level = input.required<HintLevel | 0>();

  protected readonly steps = STEPS;

  protected readonly text = computed(() => {
    const level = this.level();
    if (level === 0) return $localize`:@@tutor.noHints:Sin pistas pedidas`;
    return $localize`:@@tutor.levelOf:Pista nivel ${level}:level: de ${MAX_HINT_LEVEL}:max: · ${HINT_LEVELS[level].name}:name:`;
  });
}
