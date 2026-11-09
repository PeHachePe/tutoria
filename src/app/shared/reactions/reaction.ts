import type { Emotion, Intensity } from '../../data/tutor';

/** One reaction of the tutor to show: a new id plays it again, even with the same emotion. */
export interface Reaction {
  readonly id: string;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
}

/** How much the reactions show, as the student chooses (RF-10, CU-03 4a). */
export const REACTION_MODES = ['full', 'reduced', 'off'] as const;

export type ReactionMode = (typeof REACTION_MODES)[number];
