/**
 * The building blocks of the reactions (1.8, D-035): each one returns the pieces of a part of the
 * choreography (the big icon that beats, its glow and waves, the crown that flies out, the rain…), and each
 * reaction in reaction-particles.ts is a recipe that puts some of them together. They are pure: the
 * randomness comes in as a function.
 */

/** How a piece moves; each one is a CSS animation in styles/, the file of its block. */
export type ReactionMotion =
  | 'beat'
  | 'burst'
  | 'halo'
  | 'wave'
  | 'rain'
  | 'fade'
  | 'fly'
  | 'trail'
  | 'throw'
  | 'impact'
  | 'flame'
  | 'peek'
  | 'flicker'
  | 'shake'
  | 'giggle'
  | 'fume'
  | 'fume-burst'
  | 'steam'
  | 'flash'
  | 'smog'
  | 'splat'
  | 'drip'
  | 'drop';

/** Colour of a piece, from the vivid palette of the reactions (theme tokens, 4.8). */
export type ReactionTone =
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'smoke'
  | 'cream'
  | 'mud';

/**
 * What a piece is: an icon; confetti (a square, a dot or a streamer); the glow behind the big icon
 * and the waves of light it sends out; the stain something leaves on the
 * screen and its drips; or, over the whole screen, the flash and the dark cloud of an explosion.
 */
export type ReactionShape =
  'icon' | 'square' | 'dot' | 'streamer' | 'halo' | 'wave' | 'splat' | 'drip' | 'flash' | 'smog';

/** One piece of a reaction. */
export interface ReactionParticle {
  readonly shape: ReactionShape;
  /** Material Symbols name; null for the shapes that are not icons. */
  readonly icon: string | null;
  /**
   * An animated emoji that takes the place of the icon once it has loaded; until then, or if it
   * never does, the icon shows (D-036).
   */
  readonly image: string | null;
  readonly tone: ReactionTone;
  readonly motion: ReactionMotion;
  /** Where its centre starts, in percent of the width and the height of the screen. */
  readonly x: number;
  readonly y: number;
  /** Travel in pixels: sideways and down (up is negative). Each motion uses them its own way. */
  readonly drift: number;
  readonly lift: number;
  /** Turn at the end, in degrees. */
  readonly spin: number;
  /** In rem. */
  readonly size: number;
  /** In milliseconds. */
  readonly delay: number;
  readonly duration: number;
}

/** What every block needs: how intense the reaction is and where the randomness comes from. */
export interface ReactionContext {
  readonly intensity: 1 | 2 | 3;
  /** A number in [0, 1) on each call, such as `Math.random`. */
  readonly random: () => number;
  /** The animated 3D emoji the student wants, or the light flat 2D ones (D-036). */
  readonly emoji: boolean;
  /**
   * Which of its options this reaction takes (its emoji, what it throws): fixed by its id, so the
   * one it will show is known, and can load, as soon as the tutor chooses it.
   */
  readonly variant: number;
}

/**
 * Where an emoji lives (`npm run emojis`): animated 3D in public/reactions/ (small and still in
 * mini/, for the pieces around the big one), or flat 2D in flat/ when the 3D ones are off.
 */
export function emojiUrl(name: string, threeD: boolean, small = false): string {
  if (!threeD) return `reactions/flat/${name}.svg`;
  return small ? `reactions/mini/${name}.webp` : `reactions/${name}.webp`;
}

/**
 * The flat 2D version of a 3D emoji, a few kilobytes, which stands in while the animated one loads or
 * if it fails; null for an emoji that is already flat.
 */
export function flatEmojiOf(url: string): string | null {
  const name = /^reactions\/(?:mini\/)?([a-z0-9-]+)\.webp$/.exec(url)?.[1];
  return name ? emojiUrl(name, false) : null;
}

/**
 * The emoji that take the place of the icons around the big one, by the icon they replace. An icon
 * without one stays an icon.
 */
export const MINI_EMOJIS: Readonly<Record<string, string>> = {
  favorite: 'red-heart',
  sentiment_very_satisfied: 'smiling-face-with-smiling-eyes',
  volunteer_activism: 'heart-hands',
  local_florist: 'cherry-blossom',
  sunny: 'sun',
  star: 'star',
  star_shine: 'sparkles',
  bolt: 'high-voltage',
  fitness_center: 'flexed-biceps',
  military_tech: '1st-place-medal',
  trophy: 'trophy',
  workspace_premium: 'sports-medal',
  cake: 'birthday-cake',
  diamond_shine: 'gem-stone',
  flare: 'glowing-star',
  explosion: 'collision',
  help: 'red-question-mark',
  mood: 'slightly-smiling-face',
  sentiment_excited: 'grinning-squinting-face',
  lock: 'locked',
  visibility_off: 'see-no-evil-monkey',
  bedtime: 'crescent-moon',
  snooze: 'zzz',
  cloud: 'cloud',
  thumb_up: 'thumbs-up',
  cheer: 'clapping-hands',
  local_fire_department: 'fire',
  celebration: 'party-popper',
};

/** The small emoji of an icon, 3D or flat, when it has one. */
function mini(icon: string | null, { emoji }: ReactionContext): string | null {
  const name = icon ? MINI_EMOJIS[icon] : undefined;
  return name ? emojiUrl(name, emoji, true) : null;
}

const CENTRE = 50;

/** How many pieces for a base amount: as many at intensity 1, half as many more at 2, twice at 3. */
function amount(base: number, { intensity }: ReactionContext): number {
  return Math.round(base * (1 + (intensity - 1) * 0.5));
}

/** A number in [-1, 1): to one side or the other. */
function swing(random: () => number): number {
  return random() * 2 - 1;
}

const BEAT_MS = 2600;
const HERO_SIZE_REM = 9;
const HERO_PER_INTENSITY_REM = 1.5;

/** The size of the big icon in the middle, which grows with the intensity. */
export function heroSize({ intensity }: ReactionContext): number {
  return HERO_SIZE_REM + intensity * HERO_PER_INTENSITY_REM;
}

/** A piece with the defaults: an icon in the middle of the screen, still. */
export function piece(
  part: Partial<ReactionParticle> & Pick<ReactionParticle, 'tone' | 'motion'>,
): ReactionParticle {
  return {
    shape: 'icon',
    icon: null,
    image: null,
    x: CENTRE,
    y: CENTRE,
    drift: 0,
    lift: 0,
    spin: 0,
    size: 2,
    delay: 0,
    duration: BEAT_MS,
    ...part,
  };
}

/** The big icon that pops in the middle and beats like a heart. */
export function hero(
  icon: string,
  tone: ReactionTone,
  context: ReactionContext,
  part: Partial<ReactionParticle> = {},
): ReactionParticle {
  return piece({ icon, tone, motion: 'beat', size: heroSize(context), ...part });
}

const WAVE_MS = 850;
/** The big icon beats every 18 % of its 2.6 s (reaction-beat in hero.css): a wave goes with each. */
const BEAT_EVERY_MS = 468;
const FIRST_BEAT_MS = 260;

/**
 * Light around the big icon: a soft glow of its colour behind it, which beats with it, and thin
 * waves that go out from behind it, one with each beat.
 */
export function glow(
  tone: ReactionTone,
  context: ReactionContext,
  { waves = 3, delay = FIRST_BEAT_MS }: { waves?: number; delay?: number } = {},
): ReactionParticle[] {
  const size = heroSize(context);
  return [
    piece({ shape: 'halo', tone, motion: 'halo', size: size * 1.6 }),
    ...Array.from({ length: waves }, (_, index) =>
      piece({
        shape: 'wave',
        tone,
        motion: 'wave',
        size: size * 1.2,
        delay: delay + index * BEAT_EVERY_MS,
        duration: WAVE_MS,
      }),
    ),
  ];
}

const BURST_MS = 1300;
const BURST_MIN_PX = 150;
const BURST_SPREAD_PX = 150;
const BURST_ICON_REM = 1.75;
const BURST_ICON_JITTER_REM = 1.25;
const SPARK_REM = 0.8;
const SPIN_DEG = 60;

/** A crown of icons and sparks that flies out of a point in every direction, like a firework. */
export function crown(
  icons: readonly string[],
  tones: readonly ReactionTone[],
  context: ReactionContext,
  { count = 10, delay = 120, reach = 1 }: { count?: number; delay?: number; reach?: number } = {},
): ReactionParticle[] {
  const { random } = context;
  const total = amount(count, context);
  return Array.from({ length: total }, (_, index) => {
    const angle = (index / total) * 2 * Math.PI + random() * 0.3;
    const distance = (BURST_MIN_PX + random() * BURST_SPREAD_PX) * reach;
    const spark = index % 2 === 1;
    return piece({
      shape: spark ? 'dot' : 'icon',
      icon: spark ? null : icons[index % icons.length],
      image: spark ? null : mini(icons[index % icons.length], context),
      tone: tones[index % tones.length],
      motion: 'burst',
      drift: Math.round(Math.cos(angle) * distance),
      lift: Math.round(Math.sin(angle) * distance),
      spin: swing(random) * SPIN_DEG * 3,
      size: spark ? SPARK_REM : BURST_ICON_REM + random() * BURST_ICON_JITTER_REM,
      delay,
      duration: BURST_MS,
    });
  });
}

const RAIN_MS = 1900;
const RAIN_JITTER_MS = 300;
const RAIN_STAGGER_MS = 700;
const JITTER_MS = 100;
const RAIN_ICON_REM = 2.25;
const RAIN_PER_INTENSITY_REM = 0.5;
const RAIN_ICON_JITTER_REM = 1.25;
const CONFETTI_REM = 0.8;
const CONFETTI_SHAPES: readonly ReactionShape[] = ['square', 'dot', 'streamer'];
const SIDE_WIDTH = 24;
const SIDE_MARGIN = 1;
const SWAY_PX = 50;
const CONFETTI_SPIN_DEG = 720;

/**
 * Icons and confetti that rain down a band on each side, leaving the middle of the screen free, or
 * all over it.
 */
export function rain(
  icons: readonly string[],
  tones: readonly ReactionTone[],
  context: ReactionContext,
  {
    count = 10,
    confetti = 8,
    everywhere = false,
  }: { count?: number; confetti?: number; everywhere?: boolean } = {},
): ReactionParticle[] {
  const { random, intensity } = context;
  const iconCount = amount(count, context);
  const total = iconCount + amount(confetti, context);
  return Array.from({ length: total }, (_, index) => {
    const isConfetti = index >= iconCount;
    // Alternate sides, so both get the same amount
    const side = index % 2 === 0 ? SIDE_MARGIN : 100 - SIDE_MARGIN - SIDE_WIDTH;
    return piece({
      shape: isConfetti ? CONFETTI_SHAPES[index % CONFETTI_SHAPES.length] : 'icon',
      icon: isConfetti ? null : icons[index % icons.length],
      image: isConfetti ? null : mini(icons[index % icons.length], context),
      tone: tones[(index + 1) % tones.length],
      motion: 'rain',
      // On both sides, leaving the middle free, or mixed all over the screen
      x: everywhere
        ? SIDE_MARGIN + random() * (100 - 2 * SIDE_MARGIN)
        : side + random() * SIDE_WIDTH,
      y: 0,
      drift: swing(random) * SWAY_PX,
      spin: swing(random) * (isConfetti ? CONFETTI_SPIN_DEG : SPIN_DEG),
      size: isConfetti
        ? CONFETTI_REM
        : RAIN_ICON_REM +
          (intensity - 1) * RAIN_PER_INTENSITY_REM +
          random() * RAIN_ICON_JITTER_REM,
      delay: Math.round((index / total) * RAIN_STAGGER_MS + random() * JITTER_MS),
      duration: Math.round(RAIN_MS + random() * RAIN_JITTER_MS),
    });
  });
}

const FLAME_MS = 2000;
const FLAME_STAGGER_MS = 600;
const FLAME_REM = 3;
const FLAME_JITTER_REM = 2.5;
const FIRE_TONES: readonly ReactionTone[] = ['orange', 'red', 'yellow'];

/** Flames that rise from the bottom of the screen and flicker. */
export function flames(context: ReactionContext, count = 12): ReactionParticle[] {
  const { random } = context;
  const total = amount(count, context);
  return Array.from({ length: total }, (_, index) =>
    piece({
      icon: 'local_fire_department',
      image: mini('local_fire_department', context),
      tone: FIRE_TONES[index % FIRE_TONES.length],
      motion: 'flame',
      x: ((index + random()) / total) * 100,
      y: 100,
      lift: -Math.round(80 + random() * 160),
      size: FLAME_REM + random() * FLAME_JITTER_REM,
      delay: Math.round(random() * FLAME_STAGGER_MS),
      duration: FLAME_MS,
    }),
  );
}

const FLY_MS = 1600;
const FLY_FROM = { x: 8, y: 88 };
const FLY_TO = { x: 92, y: 10 };
const TRAIL_MS = 1100;
const TRAIL_PIECES = 24;

/**
 * An icon that crosses the screen diagonally from the bottom left, leaving a trail of little balls
 * of light and sparkles that appear as it passes.
 */
export function flight(
  icon: string,
  image: string | null,
  tone: ReactionTone,
  trailTones: readonly ReactionTone[],
  context: ReactionContext,
): ReactionParticle[] {
  const { random } = context;
  const trail = amount(TRAIL_PIECES, context);
  return [
    piece({
      icon,
      image,
      tone,
      motion: 'fly',
      x: FLY_FROM.x,
      y: FLY_FROM.y,
      // The motion travels in viewport units, which these percentages are
      drift: FLY_TO.x - FLY_FROM.x,
      lift: FLY_TO.y - FLY_FROM.y,
      size: heroSize(context) * 0.7,
      duration: FLY_MS,
    }),
    ...Array.from({ length: trail }, (_, index) => {
      const along = (index + 1) / (trail + 1);
      // Mostly little balls of light, with a sparkle now and then
      const sparkle = index % 3 === 0;
      return piece({
        shape: sparkle ? 'icon' : 'dot',
        icon: sparkle ? 'star_shine' : null,
        image: sparkle ? mini('star_shine', context) : null,
        tone: trailTones[index % trailTones.length],
        motion: 'trail',
        x: FLY_FROM.x + (FLY_TO.x - FLY_FROM.x) * along + swing(random) * 2,
        y: FLY_FROM.y + (FLY_TO.y - FLY_FROM.y) * along + swing(random) * 2,
        size: sparkle ? 1.5 + random() : SPARK_REM + random() * 0.6,
        delay: Math.round(along * FLY_MS * 0.8),
        duration: TRAIL_MS,
      });
    }),
  ];
}

const THROW_MS = 2000;
const IMPACT_MS = 600;
/** It hits the screen at this share of its flight, where it leaves its mark. */
const HIT_AT = 0.35;
const STAIN_MS = 1900;
const DRIP_MS = 1500;

/** Something to throw at the screen in jest, and the mark it leaves where it hits. */
interface Projectile {
  /** Its icon, which shows until its emoji loads. */
  readonly icon: string;
  /** Its emoji, by name. */
  readonly emoji: string;
  /** The stain it leaves, of its colour, that drips; a ball leaves none. */
  readonly stain: ReactionTone | null;
}

/** Always jokes, never for mistakes (D-037): a ball, an egg, a pie, a tomato or a poo. */
export const PROJECTILES: readonly Projectile[] = [
  { icon: 'sports_baseball', emoji: 'baseball', stain: null },
  { icon: 'egg', emoji: 'egg', stain: 'yellow' },
  { icon: 'cake', emoji: 'pie', stain: 'cream' },
  { icon: 'nutrition', emoji: 'tomato', stain: 'red' },
  { icon: 'sports_baseball', emoji: 'pile-of-poo', stain: 'mud' },
];

/**
 * Something thrown at the screen in jest: it flies in and hits it with a 💥, squashes and falls. An
 * egg, a pie, a tomato or a poo leave a stain that drips; a ball only bounces off.
 */
export function projectile(context: ReactionContext): ReactionParticle[] {
  const { random } = context;
  const thrown = PROJECTILES[context.variant % PROJECTILES.length];
  const hit = Math.round(THROW_MS * HIT_AT);
  const size = heroSize(context);
  const mark = thrown.stain ? stain(thrown.stain, hit, context) : [];
  return [
    ...mark,
    piece({
      icon: 'explosion',
      image: emojiUrl('collision', context.emoji, true),
      tone: 'orange',
      motion: 'impact',
      size: size * 0.8,
      delay: hit - 60,
      duration: IMPACT_MS,
    }),
    piece({
      icon: thrown.icon,
      image: emojiUrl(thrown.emoji, context.emoji),
      tone: thrown.stain ?? 'orange',
      motion: 'throw',
      size: size * 0.55,
      drift: Math.round(swing(random) * 80),
      spin: 200 + Math.round(random() * 160),
      duration: THROW_MS,
    }),
  ];
}

/** A stain of its colour where it hits, splashes around it, and drips that slide down. */
function stain(tone: ReactionTone, hit: number, context: ReactionContext): ReactionParticle[] {
  const { random } = context;
  const size = heroSize(context) * 1.5;
  const drips = amount(4, context);
  return [
    piece({ shape: 'splat', tone, motion: 'splat', size, delay: hit, duration: STAIN_MS }),
    ...crown([], [tone], context, { count: 8, delay: hit, reach: 0.6 }).map((splash) => ({
      ...splash,
      shape: 'dot' as const,
      icon: null,
    })),
    ...Array.from({ length: drips }, (_, index) =>
      piece({
        shape: 'drip',
        tone,
        motion: 'drip',
        // Along the lower half of the stain
        drift: 0,
        x: CENTRE + ((index + 0.5) / drips - 0.5) * size * 3 + swing(random) * 2,
        y: CENTRE + 4,
        lift: Math.round(80 + random() * 140),
        size: 0.8 + random() * 0.8,
        delay: hit + 150 + Math.round(random() * 250),
        duration: DRIP_MS,
      }),
    ),
  ];
}

const PEEK_MS = 2800;

/** Eyes that peek up from the bottom edge, look around and hide again. */
export function peekingEyes(
  icon: string,
  image: string | null,
  tone: ReactionTone,
  context: ReactionContext,
): ReactionParticle[] {
  return [
    piece({
      icon,
      image,
      tone,
      motion: 'peek',
      y: 100,
      size: heroSize(context) * 1.1,
      duration: PEEK_MS,
    }),
  ];
}

const STEAM_MS = 1500;
const STEAM_REM = 2.5;
const STEAM_JITTER_REM = 1.5;
/** The puffs come out over this time, after the face appears. */
const STEAM_FROM_MS = 300;
const STEAM_OVER_MS = 1200;
const REM_PX = 16;

/** Puffs of steam that come out of both sides of the big icon, again and again, like anger. */
export function steam(context: ReactionContext): ReactionParticle[] {
  const { random } = context;
  const puffs = amount(8, context);
  // Out of the sides of the head: just above the middle of the big icon, to the left and right
  const offset = heroSize(context) * 0.45;
  return Array.from({ length: puffs }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    return piece({
      icon: 'cloud',
      image: mini('cloud', context),
      tone: 'smoke',
      motion: 'steam',
      x: CENTRE,
      y: CENTRE - 6,
      drift: Math.round(side * (offset * REM_PX + 30 + random() * 50)),
      lift: -Math.round(60 + random() * 80),
      size: STEAM_REM + random() * STEAM_JITTER_REM,
      delay: Math.round(STEAM_FROM_MS + (index / puffs) * STEAM_OVER_MS),
      duration: STEAM_MS,
    });
  });
}

const FLASH_MS = 650;
const BOMB_FALL_MS = 700;
const SMOG_MS = 1250;

/**
 * An explosion over the whole screen: a single flash out of the middle, the screen going almost
 * black and flying debris. One flash only, as WCAG 2.3.1 allows; reduced motion never
 * gets here.
 */
export function blast(context: ReactionContext, delay: number): ReactionParticle[] {
  return [
    // A bomb falls onto the face just before it blows up
    piece({
      icon: 'bomb',
      image: emojiUrl('bomb', context.emoji),
      tone: 'smoke',
      motion: 'drop',
      size: heroSize(context) * 0.6,
      delay: delay - BOMB_FALL_MS,
      duration: BOMB_FALL_MS,
    }),
    piece({ shape: 'smog', tone: 'smoke', motion: 'smog', delay, duration: SMOG_MS }),
    piece({ shape: 'flash', tone: 'yellow', motion: 'flash', delay, duration: FLASH_MS }),
    ...glow('orange', context, { waves: 2, delay }).filter((wave) => wave.shape === 'wave'),
    ...crown(['explosion', 'bolt', 'local_fire_department'], ['orange', 'yellow', 'red'], context, {
      count: 14,
      delay,
      reach: 2,
    }),
  ];
}
