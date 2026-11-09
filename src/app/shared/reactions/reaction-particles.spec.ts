import { type Intensity, REACTION_KINDS, type ReactionKind } from '../../data/tutor';
import { MINI_EMOJIS, PROJECTILES } from './reaction-blocks';
import {
  prefetchedEmojis,
  REACTION_RECIPES,
  reactionEmoji,
  type ReactionOptions,
  reactionParticles,
  variantOf,
} from './reaction-particles';

const INTENSITIES: Intensity[] = [1, 2, 3];
const FULL_3D: ReactionOptions = { mode: 'full', reducedMotion: false, emoji: true };
const FULL_FLAT: ReactionOptions = { ...FULL_3D, emoji: false };

const half = () => 0.5;
const full = (
  kind: ReactionKind,
  intensity: Intensity = 2,
  { random = half, id = 'r1', options = FULL_3D } = {},
) => reactionParticles({ id, kind, intensity }, options, random);
const motions = (kind: ReactionKind, intensity: Intensity = 2) =>
  new Set(full(kind, intensity).map((particle) => particle.motion));
const shapes = (kind: ReactionKind, intensity: Intensity = 2) =>
  new Set(full(kind, intensity).map((particle) => particle.shape));
/** An id whose variant is the given one: what a reaction shows depends on it. */
const idWithVariant = (variant: number, count: number) =>
  Array.from({ length: 200 }, (_, index) => `id-${index}`).find(
    (id) => variantOf(id) % count === variant,
  )!;

describe('reactionParticles', () => {
  it('has a recipe for every reaction, with when to use it and its emoji', () => {
    expect(Object.keys(REACTION_RECIPES).sort()).toEqual([...REACTION_KINDS].sort());
    for (const kind of REACTION_KINDS) {
      const recipe = REACTION_RECIPES[kind];
      expect(recipe.use.length, kind).toBeGreaterThan(10);
      expect(recipe.emojis?.length, kind).toBeGreaterThan(0);
      expect(full(kind).length, kind).toBeGreaterThan(0);
    }
  });

  it('lasts between two and three seconds, and marks the piece that ends last', () => {
    for (const kind of REACTION_KINDS) {
      for (const intensity of INTENSITIES) {
        for (const random of [() => 0, () => 0.999]) {
          for (const id of ['a', 'b', 'c', 'd', 'e']) {
            const particles = full(kind, intensity, { random, id });
            const ends = particles.map((particle) => particle.delay + particle.duration);
            const longest = Math.max(...ends);

            expect(longest, `${kind} ${intensity}`).toBeGreaterThanOrEqual(2000);
            expect(longest, `${kind} ${intensity}`).toBeLessThanOrEqual(3000);
            expect(particles.filter((particle) => particle.last)).toHaveLength(1);
            expect(ends[particles.findIndex((particle) => particle.last)]).toBe(longest);
          }
        }
      }
    }
  });

  it('shows more pieces and a bigger icon the more intense it is', () => {
    for (const kind of REACTION_KINDS) {
      expect(full(kind, 3).length, kind).toBeGreaterThanOrEqual(full(kind, 1).length);
    }
    expect(full('party', 3).length).toBeGreaterThan(full('party', 1).length);
    const heroSize = (intensity: Intensity) =>
      full('hearts', intensity).find((particle) => particle.motion === 'beat')!.size;
    expect(heroSize(3)).toBeGreaterThan(heroSize(1));
  });

  it('shows one of its emoji, chosen by its id, animated in 3D or flat', () => {
    const hero = (id: string, options = FULL_3D) =>
      reactionParticles({ id, kind: 'hearts', intensity: 1 }, options, half).find(
        (particle) => particle.motion === 'beat',
      )!;

    expect(hero('a')).toMatchObject({ icon: 'favorite', x: 50, y: 50 });
    expect(hero('a').image).toBe(reactionEmoji({ id: 'a', kind: 'hearts' }, true));
    expect(hero('a').image).toMatch(/^reactions\/[a-z-]+\.webp$/);
    expect(hero('a', FULL_FLAT).image).toMatch(/^reactions\/flat\/[a-z-]+\.svg$/);
    const shown = new Set(Array.from({ length: 40 }, (_, index) => hero(`id-${index}`).image));
    expect(shown.size).toBeGreaterThan(3);
  });

  it('gives the pieces around their small emoji, in 3D or flat, and keeps confetti plain', () => {
    const rain = (options: ReactionOptions) =>
      full('hearts', 2, { options }).filter((particle) => particle.motion === 'rain');

    for (const piece of rain(FULL_3D)) {
      if (piece.shape === 'icon') {
        expect(piece.image).toBe(`reactions/mini/${MINI_EMOJIS[piece.icon!]}.webp`);
      } else {
        expect(piece.image).toBeNull();
      }
    }
    expect(rain(FULL_FLAT).find((piece) => piece.shape === 'icon')!.image).toMatch(
      /^reactions\/flat\//,
    );
  });

  it('beats the big icon in the middle, with its glow and a wave for each beat', () => {
    const particles = full('hearts');
    const hero = particles.find((particle) => particle.motion === 'beat')!;
    const halo = particles.filter((particle) => particle.shape === 'halo');
    const waves = particles.filter((particle) => particle.shape === 'wave');

    expect(halo).toHaveLength(1);
    expect(waves).toHaveLength(3);
    expect(new Set(waves.map((wave) => wave.delay)).size).toBe(3);
    for (const light of [...halo, ...waves]) expect(light.size).toBeGreaterThanOrEqual(hero.size);
  });

  it('moves the big icon as the recipe says', () => {
    expect(motions('lightbulb')).toContain('flicker');
    expect(motions('mind-blown')).toContain('shake');
    expect(motions('laugh')).toContain('giggle');
    expect(motions('secret')).toContain('giggle');
    expect(motions('grumpy', 2)).toContain('fume');
  });

  it('rains icons and confetti down both sides, leaving the middle free', () => {
    const rain = full('party', 3, { random: () => 0.3 }).filter(
      (particle) => particle.motion === 'rain',
    );

    expect(new Set(rain.map((particle) => particle.shape))).toEqual(
      new Set(['icon', 'square', 'dot', 'streamer']),
    );
    for (const { x } of rain) expect(x < 26 || x > 74).toBe(true);
  });

  it('throws a crown of icons and sparks out of the middle in every direction', () => {
    const crown = full('cheer').filter((particle) => particle.motion === 'burst');

    expect(new Set(crown.map((particle) => particle.shape))).toEqual(new Set(['icon', 'dot']));
    expect(crown.some(({ drift }) => drift < 0) && crown.some(({ drift }) => drift > 0)).toBe(true);
    expect(crown.some(({ lift }) => lift < 0) && crown.some(({ lift }) => lift > 0)).toBe(true);
  });

  it('gives each reaction its own choreography', () => {
    expect(motions('rocket')).toEqual(new Set(['fly', 'trail', 'rain']));
    expect(motions('fire')).toContain('flame');
    expect(motions('eyes')).toContain('peek');
    expect(motions('grumpy')).toContain('steam');
  });

  it('crosses the screen with the rocket, its emoji and a trail that appears as it passes', () => {
    const particles = full('rocket');
    const rocket = particles.find((particle) => particle.motion === 'fly')!;
    const trail = particles.filter((particle) => particle.motion === 'trail');

    expect(rocket).toMatchObject({ icon: 'rocket_launch', image: 'reactions/rocket.webp' });
    expect(trail.map((spark) => spark.delay)).toEqual(
      [...trail.map((spark) => spark.delay)].sort((a, b) => a - b),
    );
    // Its trail is mostly little balls, with sparkles; its stars fall all over, not on the sides
    expect(new Set(trail.map((spark) => spark.shape))).toEqual(new Set(['dot', 'icon']));
    const stars = full('rocket', 2, { random: () => 0.5 }).filter(
      (particle) => particle.motion === 'rain',
    );
    expect(stars.some(({ x }) => x > 26 && x < 74)).toBe(true);
  });

  it('throws something chosen by its id: a ball bounces off, the rest leave a stain', () => {
    const thrown = (index: number) => {
      const id = idWithVariant(index, PROJECTILES.length);
      return {
        particles: full('throw', 2, { id }),
        image: reactionEmoji({ id, kind: 'throw' }, true),
      };
    };
    const ball = thrown(0);
    const egg = thrown(1);

    for (const { particles, image } of [ball, egg]) {
      expect(particles.find((particle) => particle.motion === 'throw')!.image).toBe(image);
      expect(particles.find((particle) => particle.motion === 'impact')!.image).toBe(
        'reactions/mini/collision.webp',
      );
    }
    expect(ball.image).toBe('reactions/baseball.webp');
    expect(ball.particles.some((particle) => particle.shape === 'splat')).toBe(false);
    expect(egg.image).toBe('reactions/egg.webp');
    expect(egg.particles.find((particle) => particle.shape === 'splat')!.tone).toBe('yellow');
    expect(egg.particles.filter((particle) => particle.shape === 'drip').length).toBeGreaterThan(0);
  });

  it('blows the grumpy face up only at the top intensity, with a falling bomb', () => {
    for (const intensity of [1, 2] as const) {
      expect(shapes('grumpy', intensity)).not.toContain('flash');
      expect(motions('grumpy', intensity)).toContain('fume');
      expect(motions('grumpy', intensity)).not.toContain('drop');
    }
    const blast = full('grumpy', 3);
    expect([...shapes('grumpy', 3)]).toEqual(expect.arrayContaining(['flash', 'smog', 'wave']));
    expect(blast.find((particle) => particle.motion === 'drop')!.image).toBe('reactions/bomb.webp');
    expect(motions('grumpy', 3)).toContain('fume-burst');
    expect(motions('grumpy', 3)).not.toContain('fume');
  });

  it('shows only its emoji, smaller, when reduced, and nothing when off', () => {
    for (const kind of REACTION_KINDS) {
      const reaction = { id: 'r1', kind, intensity: 3 } as const;
      const reduced = reactionParticles(reaction, { ...FULL_3D, mode: 'reduced' }, half);

      expect(reduced).toHaveLength(1);
      expect(reduced[0]).toMatchObject({
        icon: REACTION_RECIPES[kind].icon,
        image: reactionEmoji(reaction, true),
        motion: 'beat',
        last: true,
      });
      expect(reactionParticles(reaction, { ...FULL_3D, mode: 'off' }, half)).toEqual([]);
    }
  });

  it('only fades its emoji in and out, without moving, with reduced motion', () => {
    const particles = reactionParticles(
      { id: 'r1', kind: 'party', intensity: 3 },
      { ...FULL_FLAT, reducedMotion: true },
      half,
    );

    expect(particles).toEqual([
      expect.objectContaining({ icon: 'celebration', motion: 'fade', drift: 0, last: true }),
    ]);
    expect(particles[0].image).toMatch(/^reactions\/flat\//);
  });

  it('fetches ahead the light emoji: the small 3D ones and the bomb, or every flat one', () => {
    const threeD = prefetchedEmojis(true);
    expect(threeD).toContain('reactions/bomb.webp');
    expect(threeD).toContain('reactions/mini/red-heart.webp');
    expect(threeD.every((url) => url.endsWith('.webp'))).toBe(true);

    const flat = prefetchedEmojis(false);
    expect(flat).toContain('reactions/flat/bomb.svg');
    expect(flat).toContain('reactions/flat/winking-face.svg');
    expect(flat).toContain('reactions/flat/red-heart.svg');
    expect(new Set(flat).size).toBe(flat.length);
  });

  it('places the pieces somewhere else each time', () => {
    const at = (random: () => number) => full('cheer', 2, { random }).map((particle) => particle.x);

    expect(at(() => 0)).not.toEqual(at(() => 0.999));
  });
});
