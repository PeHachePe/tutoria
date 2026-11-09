import type { Emotion, Intensity } from '../../data/tutor';
import type { ReactionMode } from './reaction';

/** How the pieces move; each one is a CSS animation in reactions.css. */
export type ReactionMotion = 'hero' | 'rise' | 'pop' | 'bounce' | 'burst' | 'fade';

/** Colour of a piece, from the vivid palette of the reactions (theme tokens, 4.8). */
export type ReactionTone =
  'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'violet';

/** An icon, or a bit of confetti: a square, a dot or a streamer. */
export type ReactionShape = 'icon' | 'square' | 'dot' | 'streamer';

/** One floating piece. */
export interface ReactionParticle {
  readonly shape: ReactionShape;
  /** Material Symbols name; null for confetti. */
  readonly icon: string | null;
  readonly tone: ReactionTone;
  readonly motion: ReactionMotion;
  /** Where its centre starts, in percent of the width of the area. */
  readonly x: number;
  /** Sideways travel, in pixels: a sway when rising, the spread of a burst. */
  readonly drift: number;
  /** Turn at the end, in degrees. */
  readonly spin: number;
  /** In rem. */
  readonly size: number;
  /** In milliseconds. */
  readonly delay: number;
  readonly duration: number;
  /** The piece that ends last: its animationend ends the reaction. */
  readonly last: boolean;
}

interface ReactionStyle {
  readonly motion: Exclude<ReactionMotion, 'hero' | 'fade'>;
  /** The big one that pops in the middle; also the piece a reduced reaction shows. */
  readonly hero: string;
  readonly icons: readonly string[];
  readonly tones: readonly ReactionTone[];
}

/**
 * What each emotion of the tutor (2.6) looks like: a big icon pops in the middle while the rest
 * float around it. Hearts, smiles, flowers and suns rise for joy; exclamations, bolts and bulbs pop
 * for surprise; thumbs, rockets and flames bounce up to encourage; and trophies, medals and stars
 * burst with confetti to celebrate. Icons of the self-hosted Material Symbols, not emojis, so they
 * look the same on every system, in a vivid palette of their own.
 */
export const REACTION_STYLES: Record<Emotion, ReactionStyle> = {
  joy: {
    motion: 'rise',
    hero: 'favorite',
    icons: [
      'favorite',
      'sentiment_very_satisfied',
      'local_florist',
      'sunny',
      'mood',
      'volunteer_activism',
      'star_shine',
    ],
    tones: ['pink', 'red', 'orange', 'yellow', 'violet'],
  },
  surprise: {
    motion: 'pop',
    hero: 'priority_high',
    icons: ['priority_high', 'bolt', 'emoji_objects', 'star_shine', 'help', 'flare'],
    tones: ['yellow', 'orange', 'cyan', 'violet', 'pink'],
  },
  encouragement: {
    motion: 'bounce',
    hero: 'thumb_up',
    icons: [
      'thumb_up',
      'rocket_launch',
      'local_fire_department',
      'star',
      'bolt',
      'fitness_center',
      'trending_up',
    ],
    tones: ['green', 'cyan', 'blue', 'yellow', 'orange'],
  },
  celebration: {
    motion: 'burst',
    hero: 'trophy',
    icons: [
      'celebration',
      'trophy',
      'military_tech',
      'star',
      'star_shine',
      'workspace_premium',
      'cake',
      'diamond_shine',
    ],
    tones: ['pink', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'red'],
  },
};

/** Duration of each motion, in milliseconds: with the delays, a reaction lasts 2 to 3 seconds. */
const DURATIONS: Record<ReactionMotion, number> = {
  hero: 2400,
  rise: 2300,
  pop: 2100,
  bounce: 2200,
  burst: 2400,
  fade: 2000,
};

const ICONS: Record<Intensity, number> = { 1: 5, 2: 9, 3: 14 };
/** A celebration always throws confetti; the other emotions, only when they are intense. */
const CONFETTI: Record<Intensity, number> = { 1: 0, 2: 10, 3: 18 };
const CELEBRATION_CONFETTI: Record<Intensity, number> = { 1: 16, 2: 28, 3: 44 };
const CONFETTI_SHAPES: readonly ReactionShape[] = ['square', 'dot', 'streamer'];

/** The pieces come out one after another over this time, each a little off its turn. */
const STAGGER_MS = 500;
const BURST_STAGGER_MS = 120;
const JITTER_MS = 100;

const HERO_SIZE_REM = 6;
const ICON_SIZE_REM = 2.75;
const SIZE_PER_INTENSITY_REM = 1;
const SIZE_JITTER_REM = 1.25;
const REDUCED_SIZE_REM = 2.5;
const FADE_SIZE_REM = 4;
const CONFETTI_SIZE_REM = 0.75;

/** Rising pieces start across the area, leaving a margin; a burst and the hero, near the middle. */
const SPREAD_START = 8;
const SPREAD_WIDTH = 84;
const CENTRE_START = 35;
const CENTRE_WIDTH = 30;

const SWAY_PX = 60;
const BURST_PX = 340;
const SPIN_DEG = 40;
const CONFETTI_SPIN_DEG = 720;

/**
 * The pieces of one reaction, at random places so it never looks the same twice. Reduced, a single
 * small icon; off, nothing. With reduced motion a single icon fades in and out where it is.
 *
 * @param random a number in [0, 1) on each call, such as `Math.random`
 */
export function reactionParticles(
  { emotion, intensity }: { readonly emotion: Emotion; readonly intensity: Intensity },
  mode: ReactionMode,
  reducedMotion: boolean,
  random: () => number,
): ReactionParticle[] {
  if (mode === 'off') return [];
  const style = REACTION_STYLES[emotion];
  const spread = () => SPREAD_START + random() * SPREAD_WIDTH;
  const centre = () => CENTRE_START + random() * CENTRE_WIDTH;
  const single = (motion: ReactionMotion, size: number): ReactionParticle[] => [
    {
      shape: 'icon',
      icon: style.hero,
      tone: style.tones[0],
      motion,
      x: centre(),
      drift: 0,
      spin: 0,
      size,
      delay: 0,
      duration: DURATIONS[motion],
      last: true,
    },
  ];
  if (reducedMotion) return single('fade', FADE_SIZE_REM);
  if (mode === 'reduced') return single(style.motion, REDUCED_SIZE_REM);

  const burst = style.motion === 'burst';
  const origin = centre();
  const hero: Omit<ReactionParticle, 'last'> = {
    shape: 'icon',
    icon: style.hero,
    tone: style.tones[0],
    motion: 'hero',
    x: centre(),
    drift: 0,
    spin: swing(random) * SPIN_DEG,
    size: HERO_SIZE_REM + intensity,
    delay: 0,
    duration: DURATIONS.hero,
  };
  const icons = ICONS[intensity];
  const total = icons + (burst ? CELEBRATION_CONFETTI : CONFETTI)[intensity];
  const pieces = Array.from({ length: total }, (_, index): Omit<ReactionParticle, 'last'> => {
    const confetti = index >= icons;
    return {
      shape: confetti ? CONFETTI_SHAPES[index % CONFETTI_SHAPES.length] : 'icon',
      icon: confetti ? null : style.icons[index % style.icons.length],
      tone: style.tones[(index + 1) % style.tones.length],
      motion: style.motion,
      x: burst ? origin : spread(),
      drift: swing(random) * (burst ? BURST_PX : SWAY_PX),
      spin: swing(random) * (confetti ? CONFETTI_SPIN_DEG : SPIN_DEG),
      size: confetti
        ? CONFETTI_SIZE_REM
        : ICON_SIZE_REM + (intensity - 1) * SIZE_PER_INTENSITY_REM + random() * SIZE_JITTER_REM,
      delay: Math.round(
        (index / total) * (burst ? BURST_STAGGER_MS : STAGGER_MS) + random() * JITTER_MS,
      ),
      duration: DURATIONS[style.motion],
    };
  });
  const particles = [hero, ...pieces];
  const ends = particles.map((particle) => particle.delay + particle.duration);
  const lastIndex = ends.indexOf(Math.max(...ends));
  return particles.map((particle, index) => ({ ...particle, last: index === lastIndex }));
}

/** A number in [-1, 1): to one side or the other. */
function swing(random: () => number): number {
  return random() * 2 - 1;
}
