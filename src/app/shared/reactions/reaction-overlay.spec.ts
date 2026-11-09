import { MediaMatcher } from '@angular/cdk/layout';
import { type ComponentInput, render, screen } from '@testing-library/angular';

import type { Reaction } from './reaction';
import { MAX_PLAYING_REACTIONS, ReactionOverlay } from './reaction-overlay';

const trophy: Reaction = { id: 'r1', kind: 'trophy', intensity: 3 };

describe('ReactionOverlay', () => {
  let reducedMotion: boolean;

  async function renderOverlay(inputs: ComponentInput<ReactionOverlay> = {}) {
    const { fixture } = await render(ReactionOverlay, {
      inputs,
      providers: [
        {
          provide: MediaMatcher,
          useValue: { matchMedia: () => ({ matches: reducedMotion }) },
        },
      ],
    });
    const play = async (reaction: Reaction | null) => {
      fixture.componentRef.setInput('reaction', reaction);
      await fixture.whenStable();
    };
    return { fixture, play };
  }

  // Decorative and hidden from assistive technology: only its data-testid finds it (4.8)
  const overlay = () => screen.getByTestId('reaction-overlay');
  const pieces = () => [...overlay().querySelectorAll<HTMLElement>('.reaction-piece')];
  const ends = (id: string) => overlay().querySelector(`[data-ends="${id}"]`);
  const finish = async (id: string, play: (reaction: Reaction | null) => Promise<void>) => {
    ends(id)?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await play(null);
  };

  beforeEach(() => (reducedMotion = false));

  it('is decorative and covers the screen without catching the pointer', async () => {
    await renderOverlay();

    expect(overlay().getAttribute('aria-hidden')).toBe('true');
    expect(overlay().classList).toContain('pointer-events-none');
    expect(overlay().classList).toContain('inset-0');
    expect(pieces()).toEqual([]);
  });

  it('plays a reaction with its pieces, their colours and their paths', async () => {
    const { play } = await renderOverlay();

    await play(trophy);

    const hero = pieces().find((piece) => piece.classList.contains('reaction-beat'))!;
    expect(hero.classList).toContain('material-symbols-outlined');
    expect(hero.classList).toContain('text-reaction-yellow');
    expect(hero.textContent?.trim()).toBe('trophy');
    expect(hero.style.getPropertyValue('--x')).toBe('50%');
    expect(hero.style.getPropertyValue('--y')).toBe('50%');
    expect(hero.style.getPropertyValue('--duration')).toBe('2600ms');
    const halo = pieces().find((piece) => piece.classList.contains('reaction-halo'))!;
    expect(halo.className).toMatch(/text-reaction-/);
    const confetti = pieces().filter((piece) =>
      /reaction-(square|dot|streamer)/.test(piece.className),
    );
    expect(confetti.length).toBeGreaterThan(0);
    expect(confetti[0].className).toMatch(/bg-reaction-/);
  });

  it('draws the paper ball and the eyes, which bring their own colours', async () => {
    const { play } = await renderOverlay();

    await play({ id: 'p', kind: 'paper-ball', intensity: 1 });
    await play({ id: 'e', kind: 'eyes', intensity: 1 });

    const paper = overlay().querySelector('.reaction-paper')!;
    expect(paper.querySelector('app-paper-ball-art svg')).toBeTruthy();
    expect(paper.className).not.toMatch(/bg-reaction-/);
    const eyes = overlay().querySelector('.reaction-eyes')!;
    expect(eyes.querySelector('app-cartoon-eyes-art svg')).toBeTruthy();
    expect(eyes.className).not.toMatch(/bg-reaction-/);
  });

  it('covers the screen with the flash and the dark cloud of an explosion', async () => {
    const { play } = await renderOverlay();

    await play({ id: 'g', kind: 'grumpy', intensity: 3 });

    for (const effect of ['.reaction-flash', '.reaction-smog']) {
      expect(overlay().querySelector(effect)!.className).not.toMatch(/bg-reaction-/);
    }
  });

  it('plays a new reaction over those still playing, each until its last piece ends', async () => {
    const { play } = await renderOverlay();

    await play({ id: 'a', kind: 'hearts', intensity: 1 });
    const first = pieces().length;
    await play({ id: 'b', kind: 'cheer', intensity: 1 });
    expect(pieces().length).toBeGreaterThan(first);

    // Another piece ending is not the end
    pieces()
      .find((piece) => !piece.hasAttribute('data-ends'))
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await play(null);
    expect(ends('a')).toBeTruthy();

    await finish('a', play);
    expect(ends('a')).toBeNull();
    expect(ends('b')).toBeTruthy();
    await finish('b', play);
    expect(pieces()).toEqual([]);
  });

  it('keeps a few reactions at most, dropping the oldest', async () => {
    const { play } = await renderOverlay();

    for (let index = 0; index <= MAX_PLAYING_REACTIONS; index++) {
      await play({ id: `r${index}`, kind: 'cheer', intensity: 1 });
    }

    expect(ends('r0')).toBeNull();
    expect(ends(`r${MAX_PLAYING_REACTIONS}`)).toBeTruthy();
  });

  it('does not play again the same reaction, nor the one there when it appears', async () => {
    const { play } = await renderOverlay({ reaction: trophy });
    expect(pieces()).toEqual([]);

    await play({ id: 'x', kind: 'cheer', intensity: 1 });
    const count = pieces().length;
    await play({ id: 'x', kind: 'cheer', intensity: 1 });

    expect(pieces()).toHaveLength(count);
  });

  it('shows a single piece when reduced and none when turned off', async () => {
    const { fixture, play } = await renderOverlay({ mode: 'reduced' });

    await play(trophy);
    expect(pieces()).toHaveLength(1);

    fixture.componentRef.setInput('mode', 'off');
    await play({ ...trophy, id: 'r2' });
    expect(pieces()).toHaveLength(1);
  });

  it('only fades a single piece with reduced motion', async () => {
    reducedMotion = true;
    const { play } = await renderOverlay();

    await play(trophy);

    expect(pieces()).toHaveLength(1);
    expect(pieces()[0].classList).toContain('reaction-fade');
  });
});
