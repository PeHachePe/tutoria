import { type Intensity, REACTION_KINDS, type ReactionKind } from '../../data/tutor';
import { REACTION_RECIPES, reactionParticles } from './reaction-particles';

const INTENSITIES: Intensity[] = [1, 2, 3];

/** A sequence of random numbers that repeats, so each case is predictable. */
function sequence(...values: number[]): () => number {
  let next = 0;
  return () => values[next++ % values.length];
}

const half = () => 0.5;
const full = (kind: ReactionKind, intensity: Intensity = 2, random = half) =>
  reactionParticles({ kind, intensity }, 'full', false, random);
const motions = (kind: ReactionKind, intensity: Intensity = 2) =>
  new Set(full(kind, intensity).map((particle) => particle.motion));
const shapes = (kind: ReactionKind, intensity: Intensity = 2) =>
  new Set(full(kind, intensity).map((particle) => particle.shape));

describe('reactionParticles', () => {
  it('has a recipe for every reaction the tutor can choose', () => {
    expect(Object.keys(REACTION_RECIPES).sort()).toEqual([...REACTION_KINDS].sort());
    for (const kind of REACTION_KINDS) {
      expect(REACTION_RECIPES[kind].parts.length).toBeGreaterThan(0);
      expect(full(kind).length).toBeGreaterThan(0);
    }
  });

  it('lasts between two and three seconds, and marks the piece that ends last', () => {
    for (const kind of REACTION_KINDS) {
      for (const intensity of INTENSITIES) {
        for (const random of [() => 0, () => 0.999]) {
          const particles = full(kind, intensity, random);
          const ends = particles.map((particle) => particle.delay + particle.duration);
          const longest = Math.max(...ends);

          expect(longest, `${kind} ${intensity}`).toBeGreaterThanOrEqual(2000);
          expect(longest, `${kind} ${intensity}`).toBeLessThanOrEqual(3000);
          expect(particles.filter((particle) => particle.last)).toHaveLength(1);
          expect(ends[particles.findIndex((particle) => particle.last)]).toBe(longest);
        }
      }
    }
  });

  it('shows more pieces and a bigger icon the more intense it is', () => {
    for (const kind of REACTION_KINDS) {
      expect(full(kind, 3).length, kind).toBeGreaterThan(full(kind, 1).length);
    }
    const heroSize = (intensity: Intensity) =>
      full('hearts', intensity).find((particle) => particle.motion === 'beat')!.size;
    expect(heroSize(3)).toBeGreaterThan(heroSize(1));
  });

  it('beats the big icon in the middle, with its glow and a wave for each beat', () => {
    const particles = full('hearts');
    const hero = particles.find((particle) => particle.motion === 'beat')!;

    expect(hero).toMatchObject({ shape: 'icon', icon: 'favorite', x: 50, y: 50 });
    expect(particles.filter((particle) => particle.shape === 'halo')).toHaveLength(1);
    const waves = particles.filter((particle) => particle.shape === 'wave');
    expect(waves).toHaveLength(3);
    expect(new Set(waves.map((wave) => wave.delay)).size).toBe(3);
    // The glow and the waves are behind and around the icon, never smaller than it
    for (const light of particles.filter((particle) => particle.motion !== 'rain')) {
      if (light !== hero) expect(light.size).toBeGreaterThanOrEqual(hero.size);
    }
  });

  it('moves the big icon as the recipe says', () => {
    expect(motions('lightbulb')).toContain('flicker');
    expect(motions('mind-blown')).toContain('shake');
    expect(motions('laugh')).toContain('giggle');
    expect(motions('grumpy', 2)).toContain('fume');
  });

  it('rains icons and confetti of several shapes down both sides, leaving the middle free', () => {
    const rain = full('trophy', 3, sequence(0.1, 0.9, 0.4, 0.7)).filter(
      (particle) => particle.motion === 'rain',
    );

    expect(new Set(rain.map((particle) => particle.shape))).toEqual(
      new Set(['icon', 'square', 'dot', 'streamer']),
    );
    for (const { x } of rain) expect(x < 26 || x > 74).toBe(true);
    expect(rain.some(({ x }) => x < 50)).toBe(true);
    expect(rain.some(({ x }) => x > 50)).toBe(true);
  });

  it('throws a crown of icons and sparks out of the middle in every direction', () => {
    const crown = full('cheer').filter((particle) => particle.motion === 'burst');

    expect(new Set(crown.map((particle) => particle.shape))).toEqual(new Set(['icon', 'dot']));
    expect(crown.some(({ drift }) => drift < 0)).toBe(true);
    expect(crown.some(({ drift }) => drift > 0)).toBe(true);
    expect(crown.some(({ lift }) => lift < 0)).toBe(true);
    expect(crown.some(({ lift }) => lift > 0)).toBe(true);
  });

  it('gives each reaction its own choreography', () => {
    expect(motions('rocket')).toEqual(new Set(['fly', 'trail', 'rain']));
    expect(motions('fire')).toContain('flame');
    expect(motions('applause')).toEqual(new Set(['clap-left', 'clap-right', 'burst', 'rain']));
    expect(shapes('paper-ball')).toEqual(new Set(['crack', 'impact', 'paper', 'shard']));
    expect(shapes('eyes')).toContain('eyes');
    expect(motions('grumpy')).toContain('steam');
  });

  it('crosses the screen with the rocket, leaving its trail as it passes', () => {
    const particles = full('rocket');
    const rocket = particles.find((particle) => particle.motion === 'fly')!;
    const trail = particles.filter((particle) => particle.motion === 'trail');

    expect(rocket).toMatchObject({ icon: 'rocket_launch', drift: 84, lift: -78 });
    expect(trail.map((spark) => spark.delay)).toEqual(
      [...trail.map((spark) => spark.delay)].sort((a, b) => a - b),
    );
  });

  it('blows the grumpy face up only at the top intensity', () => {
    for (const intensity of [1, 2] as const) {
      expect(shapes('grumpy', intensity)).not.toContain('flash');
      expect(motions('grumpy', intensity)).toContain('fume');
      expect(motions('grumpy', intensity)).not.toContain('fume-burst');
    }
    expect([...shapes('grumpy', 3)]).toEqual(expect.arrayContaining(['flash', 'smog', 'wave']));
    expect(motions('grumpy', 3)).toContain('fume-burst');
    expect(motions('grumpy', 3)).not.toContain('fume');
  });

  it('shows only its icon, smaller, when the student reduces them, and nothing when off', () => {
    for (const kind of REACTION_KINDS) {
      const reduced = reactionParticles({ kind, intensity: 3 }, 'reduced', false, half);

      expect(reduced).toHaveLength(1);
      expect(reduced[0]).toMatchObject({
        icon: REACTION_RECIPES[kind].icon,
        motion: 'beat',
        last: true,
      });
      expect(reactionParticles({ kind, intensity: 3 }, 'off', false, half)).toEqual([]);
    }
    expect(
      reactionParticles({ kind: 'hearts', intensity: 1 }, 'reduced', false, half)[0].size,
    ).toBeLessThan(full('hearts', 1).find((particle) => particle.motion === 'beat')!.size);
  });

  it('only fades its icon in and out, without moving, with reduced motion', () => {
    const particles = reactionParticles({ kind: 'trophy', intensity: 3 }, 'full', true, half);

    expect(particles).toEqual([
      expect.objectContaining({ icon: 'trophy', motion: 'fade', drift: 0, lift: 0, last: true }),
    ]);
    expect(reactionParticles({ kind: 'trophy', intensity: 3 }, 'off', true, half)).toEqual([]);
  });

  it('places the pieces somewhere else each time', () => {
    const at = (random: () => number) => full('cheer', 2, random).map((particle) => particle.x);

    expect(at(() => 0)).not.toEqual(at(() => 0.999));
  });
});
