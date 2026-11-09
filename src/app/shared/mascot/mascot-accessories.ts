import { InjectionToken, signal, type Signal } from '@angular/core';

/** What the mascot wears when its parent does not say: the student chooses it in the settings (1.9). */
export interface MascotAccessories {
  readonly headset: Signal<boolean>;
  readonly bowTie: Signal<boolean>;
  /** Over the mascot, the pointer becomes a little bone. */
  readonly boneCursor: Signal<boolean>;
}

/**
 * The accessories of every mascot under an injector. By default the headset with microphone, the
 * bow tie (1.9, at the author's request) and the bone pointer; the student area provides the ones the student chose (student.routes.ts), so all
 * its mascots follow the settings without each page passing them.
 */
export const MASCOT_ACCESSORIES = new InjectionToken<MascotAccessories>('MASCOT_ACCESSORIES', {
  factory: () => ({ headset: signal(true), bowTie: signal(true), boneCursor: signal(true) }),
});
