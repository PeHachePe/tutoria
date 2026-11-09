import { MediaMatcher } from '@angular/cdk/layout';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';

import type { Reaction, ReactionMode } from './reaction';
import { reactionParticles, type ReactionTone } from './reaction-particles';

/** Where the pieces float: beside the tutor, on the end side, or across the whole screen. */
export type ReactionArea = 'end' | 'full';

const AREA_CLASSES: Record<ReactionArea, string> = {
  end: 'end-0 w-[min(40rem,100%)]',
  full: 'inset-x-0',
};

/** Icons take the colour as text, confetti as background: always theme tokens (4.8). */
const TONE_CLASSES: Record<ReactionTone, { readonly icon: string; readonly confetti: string }> = {
  pink: { icon: 'text-reaction-pink', confetti: 'bg-reaction-pink' },
  red: { icon: 'text-reaction-red', confetti: 'bg-reaction-red' },
  orange: { icon: 'text-reaction-orange', confetti: 'bg-reaction-orange' },
  yellow: { icon: 'text-reaction-yellow', confetti: 'bg-reaction-yellow' },
  green: { icon: 'text-reaction-green', confetti: 'bg-reaction-green' },
  cyan: { icon: 'text-reaction-cyan', confetti: 'bg-reaction-cyan' },
  blue: { icon: 'text-reaction-blue', confetti: 'bg-reaction-blue' },
  violet: { icon: 'text-reaction-violet', confetti: 'bg-reaction-violet' },
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The tutor's floating reactions (step 1.8, RF-10): the emotion of each answer (2.6) as icons that
 * float for two or three seconds somewhere different each time. They are decorative, so hidden from
 * assistive technology, and never catch the pointer. The student can reduce them to one small icon
 * or turn them off; with reduced motion a single icon fades in and out without moving.
 *
 * A new reaction (a new id) plays once; the one already there when the overlay appears does not, so
 * a layout that creates it again replays nothing. Its pieces are new elements, so their CSS
 * animations (reactions.css) start on their own, and the one that ends last clears the overlay.
 */
@Component({
  selector: 'app-reaction-overlay',
  host: {
    class: 'pointer-events-none fixed inset-y-0 z-40 overflow-hidden',
    '[class]': 'areaClass()',
    'aria-hidden': 'true',
    // The overlay has no role or name to find it by (4.8)
    'data-testid': 'reaction-overlay',
    '(animationend)': 'end($event)',
  },
  template: `
    @for (piece of pieces(); track piece.key) {
      <span
        class="reaction-piece"
        [class]="piece.classes"
        [style.--x]="piece.x + '%'"
        [style.--drift]="piece.drift + 'px'"
        [style.--spin]="piece.spin + 'deg'"
        [style.--size]="piece.size + 'rem'"
        [style.--delay]="piece.delay + 'ms'"
        [style.--duration]="piece.duration + 'ms'"
        [attr.data-last]="piece.last ? '' : null"
        >{{ piece.icon }}</span
      >
    }
  `,
})
export class ReactionOverlay {
  readonly reaction = input<Reaction | null>(null);
  readonly mode = input<ReactionMode>('full');
  readonly area = input<ReactionArea>('end');

  private readonly media = inject(MediaMatcher);

  /** What is playing now: each new reaction, until its last piece ends. */
  private readonly playing = linkedSignal<Reaction | null, Reaction | null>({
    source: this.reaction,
    computation: (reaction, previous) => (previous ? reaction : null),
  });

  protected readonly areaClass = computed(() => AREA_CLASSES[this.area()]);

  protected readonly pieces = computed(() => {
    const reaction = this.playing();
    if (!reaction) return [];
    // Read on each reaction, so a change in the system settings counts from the next one
    const reducedMotion = this.media.matchMedia(REDUCED_MOTION_QUERY).matches;
    return reactionParticles(reaction, this.mode(), reducedMotion, Math.random).map(
      (particle, index) => ({
        ...particle,
        key: `${reaction.id}-${index}`,
        icon: particle.icon ?? '',
        classes: [
          `reaction-${particle.motion}`,
          particle.icon
            ? `material-symbols-outlined ${TONE_CLASSES[particle.tone].icon}`
            : `reaction-${particle.shape} ${TONE_CLASSES[particle.tone].confetti}`,
        ].join(' '),
      }),
    );
  });

  protected end(event: AnimationEvent): void {
    if ((event.target as HTMLElement).hasAttribute('data-last')) this.playing.set(null);
  }
}
