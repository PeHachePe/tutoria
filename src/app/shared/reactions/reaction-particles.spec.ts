import type { Emotion } from '../../data/tutor';
import { REACTION_STYLES, reactionParticles } from './reaction-particles';

const EMOTIONS: Emotion[] = ['joy', 'surprise', 'encouragement', 'celebration'];

/** A sequence of random numbers that repeats, so each case is predictable. */
function sequence(...values: number[]): () => number {
  let next = 0;
  return () => values[next++ % values.length];
}

const half = () => 0.5;

describe('reactionParticles', () => {
  it('gives each emotion its own animation, its big icon and a variety of icons', () => {
    expect(REACTION_STYLES.joy.motion).toBe('rise');
    expect(REACTION_STYLES.surprise.motion).toBe('pop');
    expect(REACTION_STYLES.encouragement.motion).toBe('bounce');
    expect(REACTION_STYLES.celebration.motion).toBe('burst');

    for (const emotion of EMOTIONS) {
      const style = REACTION_STYLES[emotion];
      const [hero, ...pieces] = reactionParticles({ emotion, intensity: 3 }, 'full', false, half);

      expect(hero).toMatchObject({ shape: 'icon', icon: style.hero, motion: 'hero' });
      expect(pieces.every((piece) => piece.motion === style.motion)).toBe(true);
      const icons = new Set(pieces.map((piece) => piece.icon).filter(Boolean));
      expect(icons).toEqual(new Set(style.icons));
      expect(style.icons.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('shows more and bigger pieces the more intense the emotion', () => {
    const icons = (intensity: 1 | 2 | 3) =>
      reactionParticles({ emotion: 'joy', intensity }, 'full', false, half).filter(
        (particle) => particle.shape === 'icon',
      );

    expect([1, 2, 3].map((intensity) => icons(intensity as 1 | 2 | 3).length)).toEqual([6, 10, 15]);
    expect(icons(3)[0].size).toBeGreaterThan(icons(1)[0].size);
    expect(icons(3)[1].size).toBeGreaterThan(icons(1)[1].size);
  });

  it('throws confetti of several shapes: always to celebrate, only when intense otherwise', () => {
    const confetti = (emotion: Emotion, intensity: 1 | 2 | 3) =>
      reactionParticles({ emotion, intensity }, 'full', false, half).filter(
        (particle) => particle.shape !== 'icon',
      );

    expect(confetti('joy', 1)).toEqual([]);
    expect(confetti('joy', 2).length).toBeGreaterThan(0);
    expect(confetti('celebration', 1).length).toBeGreaterThan(0);
    expect(confetti('celebration', 3).length).toBeGreaterThan(confetti('celebration', 2).length);
    expect(new Set(confetti('celebration', 3).map((piece) => piece.shape))).toEqual(
      new Set(['square', 'dot', 'streamer']),
    );
    expect(confetti('celebration', 3).every((piece) => piece.icon === null)).toBe(true);
  });

  it('places the pieces somewhere else each time, inside the area', () => {
    const at = (random: () => number) =>
      reactionParticles({ emotion: 'encouragement', intensity: 2 }, 'full', false, random).map(
        (particle) => particle.x,
      );

    const low = at(() => 0);
    const high = at(() => 0.999);
    expect(low).not.toEqual(high);
    for (const x of [...low, ...high]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
    }
  });

  it('bursts a celebration from one point, spreading its pieces', () => {
    const [, ...pieces] = reactionParticles(
      { emotion: 'celebration', intensity: 3 },
      'full',
      false,
      sequence(0.1, 0.9, 0.4, 0.7),
    );

    expect(new Set(pieces.map((particle) => particle.x)).size).toBe(1);
    expect(new Set(pieces.map((particle) => particle.drift)).size).toBeGreaterThan(1);
  });

  it('lasts between two and three seconds, and marks the piece that ends last', () => {
    for (const emotion of EMOTIONS) {
      for (const random of [() => 0, () => 0.999]) {
        const particles = reactionParticles({ emotion, intensity: 3 }, 'full', false, random);
        const ends = particles.map((particle) => particle.delay + particle.duration);
        const longest = Math.max(...ends);

        expect(longest).toBeGreaterThanOrEqual(2000);
        expect(longest).toBeLessThanOrEqual(3000);
        expect(particles.filter((particle) => particle.last)).toHaveLength(1);
        expect(ends[particles.findIndex((particle) => particle.last)]).toBe(longest);
      }
    }
  });

  it('shows a single small icon when the student reduces them, and none when they turn them off', () => {
    const reduced = reactionParticles(
      { emotion: 'celebration', intensity: 3 },
      'reduced',
      false,
      half,
    );

    expect(reduced).toHaveLength(1);
    expect(reduced[0]).toMatchObject({
      icon: REACTION_STYLES.celebration.hero,
      motion: 'burst',
      last: true,
    });
    expect(reduced[0].size).toBeLessThan(
      reactionParticles({ emotion: 'celebration', intensity: 1 }, 'full', false, half)[1].size,
    );
    expect(reactionParticles({ emotion: 'joy', intensity: 3 }, 'off', false, half)).toEqual([]);
  });

  it('only fades a single icon in and out, without moving, with reduced motion', () => {
    const particles = reactionParticles({ emotion: 'joy', intensity: 3 }, 'full', true, half);

    expect(particles).toHaveLength(1);
    expect(particles[0]).toMatchObject({ motion: 'fade', drift: 0, spin: 0, delay: 0, last: true });
    expect(reactionParticles({ emotion: 'joy', intensity: 3 }, 'off', true, half)).toEqual([]);
  });
});
