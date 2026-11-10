import type { Intensity, ReactionKind } from '../../data/tutor';
import type { ReactionMode } from './reaction';
import {
  blast,
  crown,
  flames,
  flight,
  glow,
  emojiUrl,
  hero,
  MINI_EMOJIS,
  peekingEyes,
  piece,
  projectile,
  PROJECTILES,
  rain,
  type ReactionContext,
  type ReactionParticle,
  type ReactionTone,
  steam,
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
      /** All over the screen instead of down the sides. */
      readonly everywhere?: boolean;
    }
  | { readonly block: 'flames'; readonly count?: number }
  | { readonly block: 'flight' }
  | { readonly block: 'steam' }
  | { readonly block: 'throw' }
  | { readonly block: 'eyes' }
  | { readonly block: 'blast'; readonly delay: number }
) & {
  /** Only from this intensity on, to keep the biggest effects for the biggest moments. */
  readonly minIntensity?: Intensity;
  /** Only up to this intensity, for a part that a bigger one replaces. */
  readonly maxIntensity?: Intensity;
};

/** A reaction: its icon, its emoji, its colours and the parts it is made of. */
export interface ReactionRecipe {
  /** The big one; also what shows without the 3D emoji or before one loads. */
  readonly icon: string;
  /**
   * Official Fluent emoji, by name (`npm run emojis`): one for each reaction, chosen by its id, 3D or
   * flat as the student wants, that takes the place of the icon.
   */
  readonly emojis: readonly string[];
  readonly tones: readonly ReactionTone[];
  readonly parts: readonly ReactionPart[];
}

/** An emoji of a recipe, by its name: emojiUrl finds its file, animated or still. */
const emoji = (name: string) => name;

/**
 * The catalog of reactions (D-036). To add one: its name in REACTION_KINDS (data/tutor.ts), which is
 * also the list the tutor chooses from, with when to use it in REACTION_USES, and its recipe here; to add an emoji, its name in `npm run
 * emojis` and here. A new kind of motion also needs its block and its file in styles/.
 */
export const REACTION_RECIPES: Record<ReactionKind, ReactionRecipe> = {
  hearts: {
    icon: 'favorite',
    emojis: [
      'smiling-face-with-hearts',
      'smiling-face-with-heart-eyes',
      'sparkling-heart',
      'revolving-hearts',
      'growing-heart',
      'two-hearts',
      'beating-heart',
      'heart-on-fire',
    ].map(emoji),
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
    emojis: [emoji('thumbs-up')],
    tones: ['green', 'cyan', 'blue', 'yellow'],
    parts: [
      { block: 'hero' },
      { block: 'crown', icons: ['star', 'star_shine', 'bolt'] },
      {
        block: 'rain',
        icons: ['thumb_up', 'star', 'bolt', 'fitness_center'],
        confetti: 4,
      },
    ],
  },
  party: {
    icon: 'celebration',
    emojis: [emoji('party-popper'), emoji('partying-face')],
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
  thinking: {
    icon: 'psychology_alt',
    emojis: ['thinking-face', 'face-with-monocle', 'nerd-face'].map(emoji),
    tones: ['blue', 'cyan', 'violet'],
    parts: [
      { block: 'hero' },
      { block: 'crown', icons: ['help', 'star_shine'], count: 8, delay: 400, reach: 0.9 },
    ],
  },
  lightbulb: {
    icon: 'lightbulb',
    // Still: it moves with the flicker of a bulb that switches on
    emojis: [emoji('light-bulb')],
    tones: ['yellow', 'orange', 'cyan'],
    parts: [
      { block: 'hero', motion: 'flicker' },
      { block: 'glow', delay: 680 },
      { block: 'crown', icons: ['star_shine', 'flare'], delay: 700, count: 12, reach: 1.2 },
    ],
  },
  rocket: {
    icon: 'rocket_launch',
    emojis: [emoji('rocket')],
    tones: ['blue', 'orange', 'yellow', 'red'],
    parts: [
      { block: 'flight' },
      {
        block: 'rain',
        icons: ['star', 'star_shine', 'flare'],
        count: 12,
        confetti: 0,
        everywhere: true,
      },
    ],
  },
  fire: {
    icon: 'local_fire_department',
    emojis: [emoji('fire')],
    tones: ['orange', 'red', 'yellow'],
    parts: [
      { block: 'flames', count: 14 },
      { block: 'hero' },
      { block: 'crown', icons: ['local_fire_department', 'bolt'], count: 8 },
    ],
  },
  applause: {
    icon: 'cheer',
    emojis: [emoji('clapping-hands')],
    tones: ['orange', 'yellow', 'pink', 'cyan'],
    parts: [
      { block: 'glow' },
      { block: 'hero' },
      { block: 'crown', icons: ['cheer', 'star_shine', 'star'] },
      // Clapping hands rain down the sides
      { block: 'rain', icons: ['cheer'], count: 14, confetti: 6 },
    ],
  },
  'mind-blown': {
    icon: 'psychology',
    emojis: [emoji('exploding-head'), emoji('knocked-out-face')],
    tones: ['violet', 'pink', 'yellow', 'cyan'],
    parts: [
      { block: 'hero', motion: 'shake' },
      { block: 'glow', waves: 2, delay: 900 },
      {
        block: 'crown',
        icons: ['explosion', 'bolt', 'star_shine'],
        delay: 900,
        count: 16,
        reach: 1.4,
      },
    ],
  },
  laugh: {
    icon: 'sentiment_excited',
    emojis: [emoji('face-with-tears-of-joy'), emoji('rolling-on-the-floor-laughing')],
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
  // The jokes for when the student asks for the solution: always jokes, never for mistakes (D-037)
  wink: {
    icon: 'sentiment_satisfied',
    emojis: [emoji('winking-face'), emoji('smirking-face')],
    tones: ['yellow', 'orange'],
    parts: [
      { block: 'hero' },
      { block: 'crown', icons: ['star_shine', 'favorite'], count: 6, delay: 300, reach: 0.8 },
    ],
  },
  secret: {
    icon: 'visibility_off',
    emojis: ['see-no-evil-monkey', 'hear-no-evil-monkey', 'speak-no-evil-monkey'].map(emoji),
    tones: ['orange', 'yellow', 'pink'],
    parts: [
      { block: 'hero', motion: 'giggle' },
      { block: 'crown', icons: ['lock', 'visibility_off', 'star_shine'], count: 8, delay: 400 },
    ],
  },
  seriously: {
    icon: 'sentiment_neutral',
    // Resigned: unamused, rolling its eyes, sceptical, or melting with a «meh»
    emojis: [
      'unamused-face',
      'face-with-rolling-eyes',
      'face-with-raised-eyebrow',
      'melting-face',
    ].map(emoji),
    tones: ['yellow', 'orange'],
    parts: [
      { block: 'hero' },
      { block: 'crown', icons: ['help'], count: 6, delay: 500, reach: 0.8 },
    ],
  },
  throw: {
    icon: 'sports_baseball',
    // What it throws: a ball, an egg, a pie, a tomato or a poo, chosen by its id as any emoji
    emojis: PROJECTILES.map((thrown) => thrown.emoji),
    tones: ['yellow', 'orange', 'red'],
    parts: [{ block: 'throw' }],
  },
  grumpy: {
    icon: 'sentiment_frustrated',
    emojis: ['face-with-steam-from-nose', 'pouting-face', 'face-with-symbols-on-mouth'].map(emoji),
    tones: ['red', 'orange'],
    parts: [
      { block: 'steam' },
      { block: 'hero', motion: 'fume', maxIntensity: 2 },
      // At the top, the face itself blows up: a bomb falls, it swells and vanishes in the flash
      { block: 'hero', motion: 'fume-burst', minIntensity: 3 },
      { block: 'blast', delay: 1650, minIntensity: 3 },
    ],
  },
  eyes: {
    icon: 'visibility',
    emojis: [emoji('eyes')],
    tones: ['blue', 'cyan', 'yellow'],
    parts: [
      { block: 'eyes' },
      { block: 'crown', icons: ['help'], count: 6, delay: 1400, reach: 0.9 },
    ],
  },
  empathy: {
    icon: 'volunteer_activism',
    emojis: ['hugging-face', 'relieved-face', 'pleading-face'].map(emoji),
    tones: ['pink', 'violet', 'orange'],
    parts: [
      { block: 'glow', waves: 2 },
      { block: 'hero' },
      { block: 'rain', icons: ['favorite', 'volunteer_activism'], count: 6, confetti: 0 },
    ],
  },
  sleepy: {
    icon: 'bedtime',
    emojis: [emoji('yawning-face')],
    tones: ['blue', 'violet'],
    parts: [
      { block: 'hero' },
      { block: 'crown', icons: ['bedtime', 'snooze'], count: 6, delay: 500, reach: 0.8 },
    ],
  },
};

/**
 * The reactions from the one the tutor uses most to the one it uses least, so that their animated
 * emoji download in that order (D-043).
 */
const REACTIONS_BY_USE: readonly ReactionKind[] = [
  'thinking',
  'lightbulb',
  'cheer',
  'party',
  'laugh',
  'applause',
  'hearts',
  'empathy',
  'mind-blown',
  'rocket',
  'fire',
  'secret',
  'wink',
  'seriously',
  'grumpy',
  'throw',
  'eyes',
  'sleepy',
];

/** Every big emoji, by name, in the order of REACTIONS_BY_USE: those of the recipes, what is thrown and the bomb. */
function bigEmojis(): readonly string[] {
  const recipes = REACTIONS_BY_USE.flatMap((kind) => REACTION_RECIPES[kind].emojis);
  return [...new Set([...recipes, ...PROJECTILES.map((projectile) => projectile.emoji), 'bomb'])];
}

/**
 * The light emoji to fetch ahead, once the page has settled: the small ones around the big one and
 * the still 3D version of every big one, a few KB each. They stand in while an animated one loads,
 * and they are the emoji themselves when the animations are off (D-043).
 */
export function prefetchedEmojis(): readonly string[] {
  const small = Object.values(MINI_EMOJIS).map((name) => emojiUrl(name, false, true));
  return [...new Set([...small, ...bigEmojis().map((name) => emojiUrl(name, false))])];
}

/**
 * The animated emoji, a few hundred KB each, for the background download: those of the reactions
 * the tutor uses most first (D-043).
 */
export function animatedEmojis(): readonly string[] {
  return bigEmojis().map((name) => emojiUrl(name, true));
}

/** Which of its options a reaction takes, from its id: always the same for the same reaction. */
export function variantOf(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

/** The emoji a reaction will show, 3D or flat, to load it ahead. */
export function reactionEmoji(
  { id, kind }: { readonly id: string; readonly kind: ReactionKind },
  threeD: boolean,
): string {
  const emojis = REACTION_RECIPES[kind].emojis;
  return emojiUrl(emojis[variantOf(id) % emojis.length], threeD);
}

/** The piece that ends last: its animationend ends the reaction. */
export type TimedParticle = ReactionParticle & { readonly last: boolean };

/** How the student wants to see the reactions. */
export interface ReactionOptions {
  readonly mode: ReactionMode;
  readonly reducedMotion: boolean;
  /** The animated 3D emoji, or the flat 2D ones (D-036). */
  readonly emoji: boolean;
}

const MAX_INTENSITY: Intensity = 3;
const REDUCED_SIZE_REM = 4;
const FADE_SIZE_REM = 6;
const FADE_MS = 2000;

/**
 * The pieces of one reaction, at random places so it never looks the same twice, with one of its
 * emoji, chosen by its id. Reduced, only its icon beating in the middle, smaller; off, nothing. With
 * reduced motion its icon fades in and out in the middle, without moving.
 *
 * @param random a number in [0, 1) on each call, such as `Math.random`
 */
export function reactionParticles(
  {
    id,
    kind,
    intensity,
  }: { readonly id: string; readonly kind: ReactionKind; readonly intensity: Intensity },
  { mode, reducedMotion, emoji: withEmoji }: ReactionOptions,
  random: () => number,
): TimedParticle[] {
  if (mode === 'off') return [];
  const recipe = REACTION_RECIPES[kind];
  const [tone] = recipe.tones;
  const image = reactionEmoji({ id, kind }, withEmoji);
  const context: ReactionContext = { intensity, random, emoji: withEmoji, variant: variantOf(id) };
  if (reducedMotion || mode === 'reduced') {
    const fade = reducedMotion;
    return [
      {
        ...piece({
          icon: recipe.icon,
          image,
          tone,
          motion: fade ? 'fade' : 'beat',
          size: fade ? FADE_SIZE_REM : REDUCED_SIZE_REM,
          ...(fade && { duration: FADE_MS }),
        }),
        last: true,
      },
    ];
  }
  const particles = recipe.parts
    .filter(
      (part) =>
        intensity >= (part.minIntensity ?? 1) && intensity <= (part.maxIntensity ?? MAX_INTENSITY),
    )
    .flatMap((part) => build(part, recipe, image, context));
  const ends = particles.map((particle) => particle.delay + particle.duration);
  const lastIndex = ends.indexOf(Math.max(...ends));
  return particles.map((particle, index) => ({ ...particle, last: index === lastIndex }));
}

/** The pieces of one part of a recipe, with the emoji chosen for this reaction. */
function build(
  part: ReactionPart,
  recipe: ReactionRecipe,
  image: string | null,
  context: ReactionContext,
): ReactionParticle[] {
  const [tone] = recipe.tones;
  switch (part.block) {
    case 'hero':
      return [hero(recipe.icon, tone, context, { motion: part.motion ?? 'beat', image })];
    case 'glow':
      return glow(tone, context, part);
    case 'crown':
      return crown(part.icons, recipe.tones, context, part);
    case 'rain':
      return rain(part.icons, recipe.tones, context, part);
    case 'flames':
      return flames(context, part.count);
    case 'flight':
      return flight(recipe.icon, image, tone, recipe.tones, context);
    case 'steam':
      return steam(context);
    case 'throw':
      return projectile(context);
    case 'eyes':
      return peekingEyes(recipe.icon, image, tone, context);
    case 'blast':
      return blast(context, part.delay);
  }
}
