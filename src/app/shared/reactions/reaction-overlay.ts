import { MediaMatcher } from '@angular/cdk/layout';
import { Component, inject, input, linkedSignal, untracked } from '@angular/core';

import { CartoonEyesArt } from './art/cartoon-eyes-art';
import { PaperBallArt } from './art/paper-ball-art';
import type { Reaction, ReactionMode } from './reaction';
import {
  reactionParticles,
  type ReactionParticle,
  type ReactionTone,
  type TimedParticle,
} from './reaction-particles';

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
  smoke: { icon: 'text-reaction-smoke', confetti: 'bg-reaction-smoke' },
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Reactions shown at once: one more replaces the oldest, so they never pile up. */
export const MAX_PLAYING_REACTIONS = 3;

/** A reaction on screen, with its pieces drawn once so they never jump. */
interface PlayingReaction {
  readonly id: string;
  readonly pieces: readonly (TimedParticle & { readonly classes: string })[];
}

/**
 * The tutor's floating reactions (step 1.8, RF-10): the emotion of each answer (2.6) as a big icon
 * that beats in the middle of the screen while others rain down both sides, for two or three
 * seconds. They are decorative, so hidden from assistive technology, and never catch the pointer.
 * The student can reduce them to the icon in the middle or turn them off; with reduced motion that
 * icon fades in and out without moving.
 *
 * A new reaction (a new id) plays on top of those still playing, which end on their own, up to
 * MAX_PLAYING_REACTIONS. The one already there when the overlay appears does not play, so a layout
 * that creates it again replays nothing. Its pieces are new elements, so their CSS animations
 * (reactions.css) start on their own, and the one that ends last removes its reaction.
 */
@Component({
  selector: 'app-reaction-overlay',
  imports: [PaperBallArt, CartoonEyesArt],
  host: {
    class: 'pointer-events-none fixed inset-0 z-40 overflow-hidden',
    'aria-hidden': 'true',
    // The overlay has no role or name to find it by (4.8)
    'data-testid': 'reaction-overlay',
    '(animationend)': 'end($event)',
  },
  template: `
    @for (reaction of playing(); track reaction.id) {
      @for (piece of reaction.pieces; track $index) {
        <span
          class="reaction-piece"
          [class]="piece.classes"
          [style.--x]="piece.x + '%'"
          [style.--y]="piece.y + '%'"
          [style.--drift]="piece.drift + 'px'"
          [style.--lift]="piece.lift + 'px'"
          [style.--drift-n]="piece.drift"
          [style.--lift-n]="piece.lift"
          [style.--spin]="piece.spin + 'deg'"
          [style.--size]="piece.size + 'rem'"
          [style.--delay]="piece.delay + 'ms'"
          [style.--duration]="piece.duration + 'ms'"
          [attr.data-ends]="piece.last ? reaction.id : null"
        >
          <!-- Two pieces are drawings of their own; the rest are icons or plain shapes -->
          @switch (piece.shape) {
            @case ('paper') {
              <app-paper-ball-art />
            }
            @case ('eyes') {
              <app-cartoon-eyes-art />
            }
            @default {
              {{ piece.icon }}
            }
          }
        </span>
      }
    }
  `,
})
export class ReactionOverlay {
  readonly reaction = input<Reaction | null>(null);
  readonly mode = input<ReactionMode>('full');

  private readonly media = inject(MediaMatcher);

  /** The reactions on screen: each new one joins them, and each leaves when its last piece ends. */
  protected readonly playing = linkedSignal<Reaction | null, readonly PlayingReaction[]>({
    source: this.reaction,
    computation: (reaction, previous) => {
      if (!previous) return [];
      // The same reaction again (a new object with its id) has already played
      if (!reaction || reaction.id === previous.source?.id) {
        return previous.value;
      }
      const pieces = untracked(() => this.draw(reaction));
      return pieces.length
        ? [...previous.value, { id: reaction.id, pieces }].slice(-MAX_PLAYING_REACTIONS)
        : previous.value;
    },
  });

  protected end(event: AnimationEvent): void {
    const id = (event.target as HTMLElement).dataset['ends'];
    if (id) this.playing.update((playing) => playing.filter((reaction) => reaction.id !== id));
  }

  /** The pieces of a reaction, once: the mode and reduced motion count from the next one. */
  private draw(reaction: Reaction): PlayingReaction['pieces'] {
    const reducedMotion = this.media.matchMedia(REDUCED_MOTION_QUERY).matches;
    return reactionParticles(reaction, this.mode(), reducedMotion, Math.random).map((particle) => ({
      ...particle,
      classes: [`reaction-${particle.motion}`, shapeClasses(particle)].join(' '),
    }));
  }
}

/**
 * An icon is a glyph of the icon font; the drawings bring
 * their own colours; the rest, as a fill.
 */
function shapeClasses({ shape, tone }: ReactionParticle): string {
  const colours = TONE_CLASSES[tone];
  switch (shape) {
    case 'icon':
      return `material-symbols-outlined ${colours.icon}`;
    // Light of the colour of the icon: they draw with it as text colour
    case 'halo':
    case 'wave':
      return `reaction-${shape} ${colours.icon}`;
    // Drawings and screen effects of their own, with their own colours
    case 'paper':
    case 'eyes':
    case 'flash':
    case 'smog':
      return `reaction-${shape}`;
    default:
      return `reaction-${shape} ${colours.confetti}`;
  }
}
