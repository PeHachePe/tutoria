import { MediaMatcher } from '@angular/cdk/layout';
import { NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';

import type { Reaction, ReactionMode } from './reaction';
import {
  prefetchedEmojis,
  reactionEmoji,
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
  cream: { icon: 'text-reaction-cream', confetti: 'bg-reaction-cream' },
  mud: { icon: 'text-reaction-mud', confetti: 'bg-reaction-mud' },
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Side of the emoji files (`npm run emojis`), which NgOptimizedImage needs. */
const EMOJI_SIZE_PX = 192;

/** The small emoji are fetched once the page has settled, so they never compete with it. */
const PREFETCH_DELAY_MS = 2000;

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
 *
 * Its emoji, animated 3D or flat 2D as the student wants, show as soon as they load, never the
 * icons behind them. The light ones are fetched ahead once the page has settled, and the big 3D one
 * of each reaction as soon as the tutor chooses it (`upcoming`), while its answer arrives.
 */
@Component({
  selector: 'app-reaction-overlay',
  imports: [NgOptimizedImage],
  host: {
    class: 'pointer-events-none fixed inset-0 z-40 overflow-hidden',
    'aria-hidden': 'true',
    // The overlay has no role or name to find it by (4.8)
    'data-testid': 'reaction-overlay',
    '(animationend)': 'end($event)',
  },
  template: `
    <!-- The emoji of the reaction on its way, loading while the answer arrives -->
    @if (upcomingEmoji(); as emoji) {
      <img
        class="hidden"
        [ngSrc]="emoji"
        [width]="emojiSize"
        [height]="emojiSize"
        alt=""
        [loading]="'eager'"
        (load)="markLoaded(emoji)"
      />
    }
    @for (reaction of playing(); track reaction.id) {
      @for (piece of reaction.pieces; track $index) {
        <span
          class="reaction-piece"
          [class]="piece.classes"
          [class.reaction-has-emoji]="piece.image !== null"
          [class.reaction-emoji-ready]="piece.image !== null && loaded().has(piece.image)"
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
          {{ piece.icon }}
          @if (piece.image; as image) {
            <!-- Eager: a reaction lasts two or three seconds, it cannot wait for lazy loading -->
            <img
              class="reaction-emoji"
              [ngSrc]="image"
              [width]="emojiSize"
              [height]="emojiSize"
              alt=""
              [loading]="'eager'"
              (load)="markLoaded(image)"
            />
          }
        </span>
      }
    }
  `,
})
export class ReactionOverlay {
  readonly reaction = input<Reaction | null>(null);
  readonly mode = input<ReactionMode>('full');
  /** The animated 3D emoji; without them, the light flat 2D ones. */
  readonly emojis = input(true);
  /** The reaction the tutor chose for the answer still arriving, whose emoji loads ahead. */
  readonly upcoming = input<Reaction | null>(null);

  private readonly media = inject(MediaMatcher);

  protected readonly emojiSize = EMOJI_SIZE_PX;
  protected readonly upcomingEmoji = computed(() => {
    const upcoming = this.upcoming();
    return upcoming && this.mode() !== 'off' ? reactionEmoji(upcoming, this.emojis()) : null;
  });
  /** The emoji that have loaded, which can take the place of their icons. */
  protected readonly loaded = signal<ReadonlySet<string>>(new Set());

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

  constructor() {
    // A boundary with the browser, not state: it only warms the cache for the first reactions
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const timer = setTimeout(() => {
        prefetch(prefetchedEmojis(this.emojis()));
      }, PREFETCH_DELAY_MS);
      destroyRef.onDestroy(() => clearTimeout(timer));
    });
  }

  protected markLoaded(emoji: string): void {
    this.loaded.update((loaded) => new Set(loaded).add(emoji));
  }

  protected end(event: AnimationEvent): void {
    const id = (event.target as HTMLElement).dataset['ends'];
    if (id) this.playing.update((playing) => playing.filter((reaction) => reaction.id !== id));
  }

  /** The pieces of a reaction, once: the settings and reduced motion count from the next one. */
  private draw(reaction: Reaction): PlayingReaction['pieces'] {
    const reducedMotion = this.media.matchMedia(REDUCED_MOTION_QUERY).matches;
    const options = { mode: this.mode(), reducedMotion, emoji: this.emojis() };
    return reactionParticles(reaction, options, Math.random).map((particle) => ({
      ...particle,
      classes: [`reaction-${particle.motion}`, shapeClasses(particle)].join(' '),
    }));
  }
}

/**
 * An icon is a glyph of the icon font, which its emoji covers once loaded; the screen effects bring
 * their own colours; the rest take theirs as a fill.
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
    // Screen effects, with their own colours
    case 'flash':
    case 'smog':
      return `reaction-${shape}`;
    default:
      return `reaction-${shape} ${colours.confetti}`;
  }
}

/** Asks the browser for each emoji with a low priority, so the first reactions find them ready. */
function prefetch(emojis: readonly string[]): void {
  for (const emoji of emojis) {
    const image = new Image();
    image.fetchPriority = 'low';
    image.src = emoji;
  }
}
