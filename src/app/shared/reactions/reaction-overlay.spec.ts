import { MediaMatcher } from '@angular/cdk/layout';
import { type ComponentInput, render, screen } from '@testing-library/angular';

import type { Reaction } from './reaction';
import { MAX_PLAYING_REACTIONS, ReactionOverlay } from './reaction-overlay';

const party: Reaction = { id: 'r1', kind: 'party', intensity: 3 };

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

    await play(party);

    const hero = pieces().find((piece) => piece.classList.contains('reaction-beat'))!;
    expect(hero.classList).toContain('material-symbols-outlined');
    expect(hero.classList).toContain('text-reaction-yellow');
    expect(hero.textContent?.trim()).toBe('celebration');
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

  it('shows the emoji of each piece over its icon once it loads, 3D or flat', async () => {
    const { fixture, play } = await renderOverlay();

    await play(party);
    const hero = pieces().find((piece) => piece.classList.contains('reaction-beat'))!;
    const image = hero.querySelector('img.reaction-emoji')!;
    expect(image.getAttribute('src')).toMatch(/^reactions\/[a-z-]+\.webp$/);
    expect(image.getAttribute('loading')).toBe('eager');
    expect(hero.classList).toContain('reaction-has-emoji');
    expect(hero.classList).not.toContain('reaction-emoji-ready');

    image.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(hero.classList).toContain('reaction-emoji-ready');

    fixture.componentRef.setInput('emojis', false);
    await play({ ...party, id: 'r2' });
    const flat = [...pieces()].filter((piece) => piece.classList.contains('reaction-beat')).pop()!;
    expect(flat.querySelector('img')!.getAttribute('src')).toMatch(/^reactions\/flat\/.+\.svg$/);
  });

  it('shows the flat emoji while the 3D one loads, and keeps it if the 3D one fails', async () => {
    const { fixture, play } = await renderOverlay();

    await play(party);
    const hero = pieces().find((piece) => piece.classList.contains('reaction-beat'))!;
    const flat = hero.querySelector<HTMLImageElement>('img.reaction-emoji-flat')!;
    const threeD = hero.querySelector<HTMLImageElement>('img.reaction-emoji')!;
    expect(flat.getAttribute('src')).toBe(
      threeD.getAttribute('src')!.replace(/^reactions\/(.+)\.webp$/, 'reactions/flat/$1.svg'),
    );
    expect(flat.getAttribute('loading')).toBe('eager');

    // The light flat one arrives first and stands in; the 3D one fails and never takes its place
    flat.dispatchEvent(new Event('load'));
    threeD.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(hero.classList).toContain('reaction-flat-ready');
    expect(hero.classList).not.toContain('reaction-emoji-ready');

    // The small 3D pieces around it have their flat one too
    const small = pieces()
      .map((piece) => piece.querySelector('img.reaction-emoji-flat')?.getAttribute('src'))
      .filter((src) => src && src !== flat.getAttribute('src'));
    expect(small.every((src) => /^reactions\/flat\/.+\.svg$/.test(src!))).toBe(true);
  });

  it('needs no stand-in for a flat emoji', async () => {
    const { fixture, play } = await renderOverlay();

    fixture.componentRef.setInput('emojis', false);
    await play(party);

    expect(overlay().querySelector('img.reaction-emoji-flat')).toBeNull();
  });

  it('loads the emoji of the reaction on its way, while its answer arrives', async () => {
    const { fixture } = await renderOverlay();
    const preload = () => overlay().querySelector<HTMLImageElement>('img.hidden');

    fixture.componentRef.setInput('upcoming', { id: 'u1', kind: 'rocket', intensity: 1 });
    await fixture.whenStable();
    expect(preload()?.getAttribute('src')).toBe('reactions/rocket.webp');
    expect(preload()?.getAttribute('loading')).toBe('eager');

    // Loaded ahead, the reaction shows its emoji from the start
    preload()!.dispatchEvent(new Event('load'));
    fixture.componentRef.setInput('reaction', { id: 'u1', kind: 'rocket', intensity: 1 });
    await fixture.whenStable();
    expect(pieces().find((piece) => piece.classList.contains('reaction-fly'))?.classList).toContain(
      'reaction-emoji-ready',
    );

    fixture.componentRef.setInput('mode', 'off');
    await fixture.whenStable();
    expect(preload()).toBeNull();
  });

  it('fetches the light emoji ahead once the page has settled', async () => {
    vi.useFakeTimers();
    const fetched: string[] = [];
    vi.stubGlobal(
      'Image',
      class {
        fetchPriority = '';
        set src(url: string) {
          fetched.push(url);
        }
      },
    );
    try {
      const { fixture } = await renderOverlay({ emojis: false });
      await fixture.whenStable();
      expect(fetched).toEqual([]);

      await vi.advanceTimersByTimeAsync(2000);
      expect(fetched).toContain('reactions/flat/red-heart.svg');
      fixture.destroy();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
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
    const { play } = await renderOverlay({ reaction: party });
    expect(pieces()).toEqual([]);

    await play({ id: 'x', kind: 'cheer', intensity: 1 });
    const count = pieces().length;
    await play({ id: 'x', kind: 'cheer', intensity: 1 });

    expect(pieces()).toHaveLength(count);
  });

  it('shows a single piece when reduced and none when turned off', async () => {
    const { fixture, play } = await renderOverlay({ mode: 'reduced' });

    await play(party);
    expect(pieces()).toHaveLength(1);

    fixture.componentRef.setInput('mode', 'off');
    await play({ ...party, id: 'r2' });
    expect(pieces()).toHaveLength(1);
  });

  it('only fades a single piece with reduced motion', async () => {
    reducedMotion = true;
    const { play } = await renderOverlay();

    await play(party);

    expect(pieces()).toHaveLength(1);
    expect(pieces()[0].classList).toContain('reaction-fade');
  });
});
