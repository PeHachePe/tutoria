/** What the mascot does when the pointer passes over it: tilts its head, hops or wiggles an ear. */
export const MASCOT_MOVEMENTS = ['tilt', 'hop', 'ears'] as const;

export type MascotMovement = (typeof MASCOT_MOVEMENTS)[number];

/**
 * Picks a movement at random, never the same as the previous one, so that passing the pointer
 * over the mascot again always looks different.
 *
 * @param previous the last movement, or null for the first one
 * @param random a number in [0, 1), such as `Math.random()`
 */
export function pickMovement(previous: MascotMovement | null, random: number): MascotMovement {
  const choices = MASCOT_MOVEMENTS.filter((movement) => movement !== previous);
  return choices[Math.floor(random * choices.length)];
}
