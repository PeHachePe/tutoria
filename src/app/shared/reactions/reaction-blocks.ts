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
  | 'clap-left'
  | 'clap-right'
  | 'flicker'
  | 'shake'
  | 'giggle'
  | 'fume'
  | 'fume-burst'
  | 'steam'
  | 'flash'
  | 'smog'
  | 'crack';

/** Colour of a piece, from the vivid palette of the reactions (theme tokens, 4.8). */
export type ReactionTone =
  'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'violet' | 'smoke';

/**
 * What a piece is: an icon; confetti (a square, a dot or a streamer); the glow behind the big icon
 * and the waves of light it sends out; a crumpled
 * paper ball and the star of its impact, the crack it leaves in the glass and its shards (both
 * drawings of their own); a pair of cartoon eyes; or, over the whole screen, the flash and the
 * dark cloud of an explosion.
 */
export type ReactionShape =
  | 'icon'
  | 'square'
  | 'dot'
  | 'streamer'
  | 'halo'
  | 'wave'
  | 'paper'
  | 'impact'
  | 'crack'
  | 'shard'
  | 'eyes'
  | 'flash'
  | 'smog';

/** One piece of a reaction. */
export interface ReactionParticle {
  readonly shape: ReactionShape;
  /** Material Symbols name; null for the shapes that are not icons. */
  readonly icon: string | null;
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
}

export const CENTRE = 50;

/** How many pieces for a base amount: as many at intensity 1, half as many more at 2, twice at 3. */
export function amount(base: number, { intensity }: ReactionContext): number {
  return Math.round(base * (1 + (intensity - 1) * 0.5));
}

/** A number in [-1, 1): to one side or the other. */
export function swing(random: () => number): number {
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

/** Icons and confetti that rain down a band on each side, leaving the middle of the screen free. */
export function rain(
  icons: readonly string[],
  tones: readonly ReactionTone[],
  context: ReactionContext,
  { count = 10, confetti = 8 }: { count?: number; confetti?: number } = {},
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
      tone: tones[(index + 1) % tones.length],
      motion: 'rain',
      x: side + random() * SIDE_WIDTH,
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
const TRAIL_MS = 900;

/**
 * An icon that crosses the screen diagonally from the bottom left, leaving a trail of sparks that
 * appear as it passes.
 */
export function flight(
  icon: string,
  tone: ReactionTone,
  trailTones: readonly ReactionTone[],
  context: ReactionContext,
): ReactionParticle[] {
  const { random } = context;
  const trail = amount(14, context);
  return [
    piece({
      icon,
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
      return piece({
        shape: index % 3 === 0 ? 'icon' : 'dot',
        icon: index % 3 === 0 ? 'star_shine' : null,
        tone: trailTones[index % trailTones.length],
        motion: 'trail',
        x: FLY_FROM.x + (FLY_TO.x - FLY_FROM.x) * along + swing(random) * 2,
        y: FLY_FROM.y + (FLY_TO.y - FLY_FROM.y) * along + swing(random) * 2,
        size: index % 3 === 0 ? 1.5 + random() : SPARK_REM + random() * 0.6,
        delay: Math.round(along * FLY_MS * 0.8),
        duration: TRAIL_MS,
      });
    }),
  ];
}

const THROW_MS = 2000;
const IMPACT_MS = 600;
/** The ball hits the screen at this share of its flight, where the glass cracks. */
const HIT_AT = 0.35;
const CRACK_MS = 1300;

/**
 * A crumpled notebook page thrown at the screen: it flies in, cracks the glass with a star where
 * it hits, shards fall, and it drops.
 */
export function paperBall(context: ReactionContext): ReactionParticle[] {
  const { random } = context;
  const hit = Math.round(THROW_MS * HIT_AT);
  const shards = amount(10, context);
  return [
    piece({
      shape: 'crack',
      tone: 'cyan',
      motion: 'crack',
      size: heroSize(context) * 2.2,
      delay: hit,
      duration: CRACK_MS,
    }),
    piece({
      shape: 'impact',
      tone: 'yellow',
      motion: 'impact',
      size: heroSize(context) * 0.8,
      delay: hit - 60,
      duration: IMPACT_MS,
    }),
    piece({
      shape: 'paper',
      tone: 'yellow',
      motion: 'throw',
      size: heroSize(context) * 0.55,
      drift: Math.round(swing(random) * 80),
      spin: 200 + Math.round(random() * 160),
      duration: THROW_MS,
    }),
    ...Array.from({ length: shards }, (_, index) => {
      const angle = (index / shards) * 2 * Math.PI + random() * 0.4;
      const distance = 60 + random() * 120;
      return piece({
        shape: 'shard',
        tone: 'cyan',
        motion: 'burst',
        drift: Math.round(Math.cos(angle) * distance),
        // Shards fall: they fly out and down
        lift: Math.round(Math.sin(angle) * distance * 0.5 + 220 + random() * 180),
        spin: Math.round(swing(random) * 400),
        size: 0.8 + random() * 1.4,
        delay: hit + 40,
        duration: BURST_MS,
      });
    }),
  ];
}

const PEEK_MS = 2800;

/**
 * A pair of cartoon eyes (a drawing of their own) that peeks up from the bottom, looks to each
 * side, frowns in suspicion, blinks and hides again.
 */
export function peekingEyes(context: ReactionContext): ReactionParticle[] {
  return [
    piece({
      shape: 'eyes',
      tone: 'blue',
      motion: 'peek',
      y: 100,
      size: heroSize(context) * 1.4,
      duration: PEEK_MS,
    }),
  ];
}

const CLAP_MS = 2400;
/** The hands meet three times; the sparks fly at each clap. */
const CLAPS_AT = [0.25, 0.5, 0.75];
/** The sparks leave a moment before the hands meet. */
const SPARKS_AHEAD_MS = 100;

/** Two hands that clap three times in the middle, with sparks at each clap. */
export function applause(
  tones: readonly ReactionTone[],
  context: ReactionContext,
): ReactionParticle[] {
  const size = heroSize(context) * 0.7;
  return [
    piece({
      icon: 'front_hand',
      tone: tones[0],
      motion: 'clap-left',
      x: 43,
      size,
      duration: CLAP_MS,
    }),
    piece({
      icon: 'front_hand',
      tone: tones[0],
      motion: 'clap-right',
      x: 57,
      size,
      duration: CLAP_MS,
    }),
    ...CLAPS_AT.flatMap((at) =>
      crown(['star_shine', 'star'], tones, context, {
        count: 6,
        delay: Math.round(CLAP_MS * at) - SPARKS_AHEAD_MS,
        reach: 0.7,
      }),
    ),
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
const SMOG_MS = 1250;

/**
 * An explosion over the whole screen: a single flash out of the middle, the screen going almost
 * black and flying debris. One flash only, as WCAG 2.3.1 allows; reduced motion never
 * gets here.
 */
export function blast(context: ReactionContext, delay: number): ReactionParticle[] {
  return [
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
