import type { Intensity, ReactionKind } from '../../data/tutor';
import type { ReactionMode } from './reaction';
import {
  applause,
  blast,
  crown,
  flames,
  glow,
  steam,
  flight,
  hero,
  paperBall,
  peekingEyes,
  piece,
  rain,
  type ReactionContext,
  type ReactionParticle,
  type ReactionTone,
} from './reaction-blocks';

export type {
  ReactionMotion,
  ReactionParticle,
  ReactionShape,
  ReactionTone,
} from './reaction-blocks';

/**
 * One part of a recipe: a building block of reaction-blocks.ts with its settings. Recipes are data,
 * not code, so a new reaction only needs a new recipe, and they could move to the back end later.
 */
export type ReactionPart = (
  | {
      readonly block: 'hero';
      readonly icon?: string;
      readonly tone?: ReactionTone;
      /**
       * How the big icon moves: it beats, flickers on like a bulb, shakes before it bursts, shakes
       * with laughter, fumes, or fumes until it blows up (with the blast).
       */
      readonly motion?: 'beat' | 'flicker' | 'shake' | 'giggle' | 'fume' | 'fume-burst';
    }
  | { readonly block: 'glow'; readonly waves?: number; readonly delay?: number }
  | {
      readonly block: 'crown';
      readonly icons: readonly string[];
      readonly count?: number;
      readonly delay?: number;
      readonly reach?: number;
    }
  | {
      readonly block: 'rain';
      readonly icons: readonly string[];
      readonly count?: number;
      readonly confetti?: number;
    }
  | { readonly block: 'flames'; readonly count?: number }
  | { readonly block: 'flight' }
  | { readonly block: 'steam' }
  | { readonly block: 'paper-ball' }
  | { readonly block: 'eyes' }
  | { readonly block: 'applause' }
  | { readonly block: 'blast'; readonly delay: number }
) & {
  /** Only from this intensity on, to keep the biggest effects for the biggest moments. */
  readonly minIntensity?: Intensity;
  /** Only up to this intensity, for a part that a bigger one replaces. */
  readonly maxIntensity?: Intensity;
};

/** A reaction: its main icon and colours, and the parts it is made of. */
export interface ReactionRecipe {
  /** The big one; also what a reduced reaction, or one with reduced motion, shows. */
  readonly icon: string;
  readonly tones: readonly ReactionTone[];
  readonly parts: readonly ReactionPart[];
}

/**
 * The catalog of reactions (D-035). To add one: its name in REACTION_KINDS (data/tutor.ts), which is
 * also the list the tutor chooses from, and its recipe here. A new kind of motion also needs its
 * block and its animation in reactions.css.
 */
export const REACTION_RECIPES: Record<ReactionKind, ReactionRecipe> = {
  hearts: {
    icon: 'favorite',
    tones: ['pink', 'red', 'orange', 'violet'],
    parts: [
      { block: 'glow' },
      { block: 'hero' },
      {
        block: 'rain',
        icons: [
          'favorite',
          'sentiment_very_satisfied',
          'volunteer_activism',
          'local_florist',
          'sunny',
        ],
      },
    ],
  },
  cheer: {
    icon: 'thumb_up',
    tones: ['green', 'cyan', 'blue', 'yellow'],
    parts: [
      { block: 'hero' },
      { block: 'crown', icons: ['star', 'star_shine', 'bolt'] },
      {
        block: 'rain',
        icons: ['thumb_up', 'star', 'bolt', 'fitness_center', 'trending_up'],
        confetti: 4,
      },
    ],
  },
  trophy: {
    icon: 'trophy',
    tones: ['yellow', 'pink', 'orange', 'green', 'cyan', 'blue', 'violet', 'red'],
    parts: [
      { block: 'glow' },
      { block: 'hero' },
      { block: 'crown', icons: ['star', 'star_shine', 'military_tech'], count: 12 },
      {
        block: 'rain',
        icons: [
          'celebration',
          'trophy',
          'military_tech',
          'workspace_premium',
          'cake',
          'diamond_shine',
        ],
        confetti: 30,
      },
    ],
  },
  lightbulb: {
    icon: 'lightbulb',
    tones: ['yellow', 'orange', 'cyan'],
    parts: [
      { block: 'glow', delay: 680 },
      { block: 'hero', motion: 'flicker' },
      { block: 'crown', icons: ['star_shine', 'flare'], delay: 700, count: 12, reach: 1.2 },
    ],
  },
  rocket: {
    icon: 'rocket_launch',
    tones: ['blue', 'orange', 'yellow', 'red'],
    parts: [
      { block: 'flight' },
      { block: 'rain', icons: ['star', 'star_shine'], count: 6, confetti: 0 },
    ],
  },
  fire: {
    icon: 'local_fire_department',
    tones: ['orange', 'red', 'yellow'],
    parts: [
      { block: 'flames', count: 14 },
      { block: 'hero' },
      { block: 'crown', icons: ['local_fire_department', 'bolt'], count: 8 },
    ],
  },
  applause: {
    icon: 'cheer',
    tones: ['orange', 'yellow', 'pink', 'cyan'],
    parts: [
      { block: 'applause' },
      // Clapping hands rain down the sides
      { block: 'rain', icons: ['cheer'], count: 14, confetti: 6 },
    ],
  },
  'mind-blown': {
    icon: 'psychology',
    tones: ['violet', 'pink', 'yellow', 'cyan'],
    parts: [
      { block: 'glow', waves: 2, delay: 900 },
      { block: 'hero', motion: 'shake' },
      {
        block: 'crown',
        icons: ['explosion', 'bolt', 'star_shine'],
        delay: 900,
        count: 16,
        reach: 1.4,
      },
    ],
  },
  'paper-ball': {
    icon: 'priority_high',
    tones: ['yellow', 'orange', 'red'],
    parts: [{ block: 'paper-ball' }],
  },
  eyes: {
    icon: 'visibility',
    tones: ['blue', 'cyan', 'yellow'],
    parts: [
      { block: 'eyes' },
      { block: 'crown', icons: ['help'], count: 6, delay: 1400, reach: 0.9 },
    ],
  },
  laugh: {
    icon: 'sentiment_excited',
    tones: ['yellow', 'orange', 'pink', 'cyan'],
    parts: [
      { block: 'hero', motion: 'giggle' },
      {
        block: 'rain',
        icons: ['sentiment_excited', 'sentiment_very_satisfied', 'mood', 'star_shine'],
        count: 14,
        confetti: 4,
      },
    ],
  },
  // A joke, never for mistakes: a grumpy face that fumes when the student asks for the solution and,
  // at the top intensity, blows up the screen
  grumpy: {
    icon: 'sentiment_frustrated',
    tones: ['red', 'orange'],
    parts: [
      { block: 'steam' },
      { block: 'hero', motion: 'fume', maxIntensity: 2 },
      // At the top, the face itself blows up: it swells and vanishes in the flash
      { block: 'hero', motion: 'fume-burst', minIntensity: 3 },
      { block: 'blast', delay: 1650, minIntensity: 3 },
    ],
  },
};

/** The piece that ends last: its animationend ends the reaction. */
export type TimedParticle = ReactionParticle & { readonly last: boolean };

const MAX_INTENSITY: Intensity = 3;
const REDUCED_SIZE_REM = 4;
const FADE_SIZE_REM = 6;
const FADE_MS = 2000;

/**
 * The pieces of one reaction, at random places so it never looks the same twice. Reduced, only its
 * icon beating in the middle, smaller; off, nothing. With reduced motion its icon fades in and out
 * in the middle, without moving.
 *
 * @param random a number in [0, 1) on each call, such as `Math.random`
 */
export function reactionParticles(
  { kind, intensity }: { readonly kind: ReactionKind; readonly intensity: Intensity },
  mode: ReactionMode,
  reducedMotion: boolean,
  random: () => number,
): TimedParticle[] {
  if (mode === 'off') return [];
  const recipe = REACTION_RECIPES[kind];
  const [tone] = recipe.tones;
  const context: ReactionContext = { intensity, random };
  if (reducedMotion) {
    return [
      {
        ...piece({
          icon: recipe.icon,
          tone,
          motion: 'fade',
          size: FADE_SIZE_REM,
          duration: FADE_MS,
        }),
        last: true,
      },
    ];
  }
  if (mode === 'reduced') {
    return [
      { ...piece({ icon: recipe.icon, tone, motion: 'beat', size: REDUCED_SIZE_REM }), last: true },
    ];
  }
  const particles = recipe.parts
    .filter(
      (part) =>
        intensity >= (part.minIntensity ?? 1) && intensity <= (part.maxIntensity ?? MAX_INTENSITY),
    )
    .flatMap((part) => build(part, recipe, context));
  const ends = particles.map((particle) => particle.delay + particle.duration);
  const lastIndex = ends.indexOf(Math.max(...ends));
  return particles.map((particle, index) => ({ ...particle, last: index === lastIndex }));
}

/** The pieces of one part of a recipe. */
function build(
  part: ReactionPart,
  recipe: ReactionRecipe,
  context: ReactionContext,
): ReactionParticle[] {
  const [tone] = recipe.tones;
  switch (part.block) {
    case 'hero':
      return [
        hero(part.icon ?? recipe.icon, part.tone ?? tone, context, {
          motion: part.motion ?? 'beat',
        }),
      ];
    case 'glow':
      return glow(tone, context, part);
    case 'crown':
      return crown(part.icons, recipe.tones, context, part);
    case 'rain':
      return rain(part.icons, recipe.tones, context, part);
    case 'flames':
      return flames(context, part.count);
    case 'steam':
      return steam(context);
    case 'flight':
      return flight(recipe.icon, tone, recipe.tones, context);
    case 'paper-ball':
      return paperBall(context);
    case 'eyes':
      return peekingEyes(context);
    case 'applause':
      return applause(recipe.tones, context);
    case 'blast':
      return blast(context, part.delay);
  }
}
