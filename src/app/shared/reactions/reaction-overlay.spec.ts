import { MediaMatcher } from '@angular/cdk/layout';
import { type ComponentInput, render, screen } from '@testing-library/angular';

import type { Reaction } from './reaction';
import { ReactionOverlay } from './reaction-overlay';

const celebration: Reaction = { id: 'r1', emotion: 'celebration', intensity: 3 };

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

  beforeEach(() => (reducedMotion = false));

  it('is decorative and floats beside the tutor without catching the pointer', async () => {
    await renderOverlay();

    expect(overlay().getAttribute('aria-hidden')).toBe('true');
    expect(overlay().classList).toContain('pointer-events-none');
    expect(overlay().classList).toContain('end-0');
    expect(pieces()).toEqual([]);
  });

  it('can float across the whole screen', async () => {
    await renderOverlay({ area: 'full' });

    expect(overlay().classList).toContain('inset-x-0');
    expect(overlay().classList).not.toContain('end-0');
  });

  it('plays each new reaction with its icons, confetti and path, until its last piece ends', async () => {
    const { play } = await renderOverlay();

    await play(celebration);

    expect(pieces().length).toBeGreaterThan(10);
    const [hero, first] = pieces();
    expect(hero.classList).toContain('reaction-hero');
    expect(hero.textContent).toBe('trophy');
    expect(first.classList).toContain('reaction-burst');
    expect(first.classList).toContain('material-symbols-outlined');
    expect(first.classList).toContain('text-reaction-orange');
    expect(first.style.getPropertyValue('--x')).toMatch(/%$/);
    expect(first.style.getPropertyValue('--duration')).toBe('2400ms');
    const confetti = pieces().filter((piece) => !piece.textContent);
    expect(confetti.length).toBeGreaterThan(0);
    expect(confetti[0].className).toMatch(/reaction-(square|dot|streamer)/);
    expect(confetti[0].className).toMatch(/bg-reaction-/);

    // Another piece ending is not the end
    pieces()
      .find((piece) => !piece.hasAttribute('data-last'))
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await play(celebration);
    expect(pieces().length).toBeGreaterThan(10);

    overlay()
      .querySelector('[data-last]')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await play(celebration);
    expect(pieces()).toEqual([]);

    await play({ ...celebration, id: 'r2', emotion: 'joy', intensity: 1 });
    expect(pieces()).toHaveLength(6);
  });

  it('does not play the reaction already there when it appears', async () => {
    await renderOverlay({ reaction: celebration });

    expect(pieces()).toEqual([]);
  });

  it('shows a single piece when reduced and none when turned off', async () => {
    const { fixture, play } = await renderOverlay({ mode: 'reduced' });

    await play(celebration);
    expect(pieces()).toHaveLength(1);

    fixture.componentRef.setInput('mode', 'off');
    await play({ ...celebration, id: 'r2' });
    expect(pieces()).toEqual([]);
  });

  it('only fades a single piece with reduced motion', async () => {
    reducedMotion = true;
    const { play } = await renderOverlay();

    await play(celebration);

    expect(pieces()).toHaveLength(1);
    expect(pieces()[0].classList).toContain('reaction-fade');
  });
});
