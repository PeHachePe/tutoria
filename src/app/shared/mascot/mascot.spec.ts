import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ComponentInput, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { REACTION_KINDS } from '../../data/tutor';
import type { Reaction } from '../reactions/reaction';
import { Mascot, MascotMood, REACTION_MOVEMENTS } from './mascot';

describe('Mascot', () => {
  async function renderMascot(inputs: ComponentInput<Mascot> = {}) {
    const { fixture } = await render(Mascot, { inputs });
    return fixture.nativeElement as HTMLElement;
  }

  // The drawing is decorative and hidden from assistive technology, so there is no accessible way
  // to find its parts: the accessories carry a data-testid (4.8)
  const headset = () => screen.queryByTestId('mascot-headset');
  const bowTie = () => screen.queryByTestId('mascot-bow-tie');

  it('is decorative: hidden from assistive technology', async () => {
    const host = await renderMascot();

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 200 200');
  });

  it('rests by default, with the headset on and without the bow tie', async () => {
    const host = await renderMascot();

    expect([...host.classList].filter((name) => name.startsWith('mascot-'))).toEqual([]);
    expect(headset()).toBeTruthy();
    expect(bowTie()).toBeNull();
  });

  it.each<[MascotMood, string]>([
    ['chat', 'mascot-chat'],
    ['thinking', 'mascot-thinking'],
    ['joy', 'mascot-joy'],
  ])('shows the %s mood with the class that animates it', async (mood, moodClass) => {
    const host = await renderMascot({ mood });

    expect(host.classList).toContain(moodClass);
    expect(host.classList).toContain('mascot');
  });

  it('wears the accessories it is given', async () => {
    await renderMascot({ headset: false, bowTie: true });

    expect(headset()).toBeNull();
    expect(bowTie()).toBeTruthy();
  });

  it('gives each mascot its own plaid pattern, so two on one page do not clash', async () => {
    const { container } = await render(
      `<app-mascot [bowTie]="true" /><app-mascot [bowTie]="true" />`,
      { imports: [Mascot] },
    );
    const [first, second] = [...container.querySelectorAll<HTMLElement>('app-mascot')];
    const patternOf = (host: HTMLElement) => host.querySelector('pattern')?.id;

    expect(patternOf(first)).toMatch(/^mascot-plaid-\d+$/);
    expect(patternOf(second)).not.toBe(patternOf(first));
    for (const host of [first, second]) {
      expect(host.querySelectorAll(`[fill="url(#${patternOf(host)})"]`)).toHaveLength(2);
    }
  });

  describe('reactions to the pointer', () => {
    const MOVE_CLASSES = [
      'mascot-move-tilt',
      'mascot-move-hop',
      'mascot-move-ears',
      'mascot-move-cheer',
    ];
    const moveClassOf = (host: HTMLElement) =>
      [...host.classList].filter((name) => MOVE_CLASSES.includes(name));

    /** jsdom has no AnimationEvent: an Event with its name is what the component reads. */
    async function endAnimation(host: HTMLElement, animationName: string): Promise<void> {
      const event = Object.assign(new Event('animationend', { bubbles: true }), { animationName });
      host.querySelector('.mascot-head')?.dispatchEvent(event);
      await TestBed.inject(ApplicationRef).whenStable();
    }

    afterEach(() => vi.restoreAllMocks());

    it('moves at random when the mouse passes over it, and never twice the same in a row', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const host = await renderMascot();
      const user = userEvent.setup();

      await user.hover(host);
      expect(moveClassOf(host)).toEqual(['mascot-move-tilt']);

      // A second pass while it still moves changes nothing
      await user.unhover(host);
      await user.hover(host);
      expect(moveClassOf(host)).toEqual(['mascot-move-tilt']);

      await endAnimation(host, 'mascot-curious');
      expect(moveClassOf(host)).toEqual([]);

      await user.unhover(host);
      await user.hover(host);
      expect(moveClassOf(host)).toEqual(['mascot-move-hop']);
      await endAnimation(host, 'mascot-hop');
      expect(moveClassOf(host)).toEqual([]);
    });

    it('ignores the endings of animations that are not its reactions', async () => {
      const host = await renderMascot();
      await userEvent.setup().hover(host);

      await endAnimation(host, 'mascot-blink');

      expect(moveClassOf(host)).toHaveLength(1);
    });

    it('only moves while resting: the other moods already animate the head', async () => {
      const host = await renderMascot({ mood: 'thinking' });

      await userEvent.setup().hover(host);

      expect(moveClassOf(host)).toEqual([]);
    });

    it('does not move with a tap, which is a click', async () => {
      const host = await renderMascot();

      host.dispatchEvent(Object.assign(new Event('pointerenter'), { pointerType: 'touch' }));
      await TestBed.inject(ApplicationRef).whenStable();

      expect(moveClassOf(host)).toEqual([]);
    });

    it('follows the mouse with its eyes, but not a finger', async () => {
      const host = await renderMascot();
      vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
      const irises = () => screen.getByTestId('mascot-irises');
      const pointerAt = async (clientX: number, clientY: number, pointerType: string) => {
        const event = new MouseEvent('pointermove', { clientX, clientY, bubbles: true });
        document.dispatchEvent(Object.assign(event, { pointerType }));
        await TestBed.inject(ApplicationRef).whenStable();
      };

      expect(irises().getAttribute('transform')).toBeNull();

      await pointerAt(1000, 52, 'mouse');
      expect(irises().getAttribute('transform')).toBe('translate(3.5 0)');

      await pointerAt(50, 52, 'touch');
      expect(irises().getAttribute('transform')).toBe('translate(3.5 0)');

      await pointerAt(50, 52, 'mouse');
      expect(irises().getAttribute('transform')).toBe('translate(0 0)');
    });

    it('sticks its tongue out when clicked, until the animation ends', async () => {
      const host = await renderMascot();

      await userEvent.setup().click(host);
      expect(host.classList).toContain('mascot-lick');

      await endAnimation(host, 'mascot-lick');
      expect(host.classList).not.toContain('mascot-lick');
    });

    it('does not lick with the chat open, where the tongue is already out', async () => {
      const host = await renderMascot({ mood: 'chat' });

      await userEvent.setup().click(host);

      expect(host.classList).not.toContain('mascot-lick');
    });
  });

  describe('reactions of the tutor', () => {
    const reactionOf = (id: string, kind: Reaction['kind']): Reaction => ({
      id,
      kind,
      intensity: 2,
    });

    it('moves with each reaction of the tutor', () => {
      expect(Object.keys(REACTION_MOVEMENTS).sort()).toEqual([...REACTION_KINDS].sort());
      expect(REACTION_MOVEMENTS).toMatchObject({
        hearts: 'tilt',
        cheer: 'hop',
        party: 'cheer',
        throw: 'ears',
      });
    });

    it('moves once with each new reaction, and not with the one there when it appears', async () => {
      const { fixture } = await render(Mascot, {
        inputs: { reaction: reactionOf('r1', 'hearts') },
      });
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).not.toContain('mascot-move-tilt');

      fixture.componentRef.setInput('reaction', reactionOf('r2', 'party'));
      await fixture.whenStable();
      expect(host.classList).toContain('mascot-move-cheer');

      const event = Object.assign(new Event('animationend', { bubbles: true }), {
        animationName: 'mascot-cheer',
      });
      host.querySelector('.mascot-head')?.dispatchEvent(event);
      await fixture.whenStable();
      expect(host.classList).not.toContain('mascot-move-cheer');

      fixture.componentRef.setInput('reaction', null);
      await fixture.whenStable();
      expect([...host.classList].some((name) => name.startsWith('mascot-move-'))).toBe(false);
    });
  });
});
