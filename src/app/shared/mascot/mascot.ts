import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';

import type { ReactionKind } from '../../data/tutor';
import type { Reaction } from '../reactions/reaction';
import { gazeOffset } from './gaze-offset';
import { MascotMovement, pickMovement } from './pick-movement';

/** What the mascot is doing: resting, with the chat open, waiting for the tutor or celebrating. */
export type MascotMood = 'idle' | 'chat' | 'thinking' | 'joy';

/** Class of each mood, animated in mascot.css (4.8). Resting needs none: it is the default. */
const MOOD_CLASSES: Record<MascotMood, string> = {
  idle: '',
  chat: 'mascot-chat',
  thinking: 'mascot-thinking',
  joy: 'mascot-joy',
};

/** A movement on hover, or the two hops of a celebration, which only the tutor's reactions make. */
type MascotAction = MascotMovement | 'cheer';

/** Class and CSS animation of each movement; the names must match mascot.css. */
const MOVEMENTS: Record<MascotAction, { readonly className: string; readonly animation: string }> =
  {
    tilt: { className: 'mascot-move-tilt', animation: 'mascot-curious' },
    hop: { className: 'mascot-move-hop', animation: 'mascot-hop' },
    ears: { className: 'mascot-move-ears', animation: 'mascot-ear-wiggle' },
    cheer: { className: 'mascot-move-cheer', animation: 'mascot-cheer' },
  };

/** How the mascot joins each reaction of the tutor (1.8). */
export const REACTION_MOVEMENTS: Record<ReactionKind, MascotAction> = {
  hearts: 'tilt',
  cheer: 'hop',
  party: 'cheer',
  thinking: 'tilt',
  lightbulb: 'ears',
  rocket: 'hop',
  fire: 'cheer',
  applause: 'cheer',
  'mind-blown': 'ears',
  laugh: 'hop',
  wink: 'tilt',
  secret: 'ears',
  seriously: 'tilt',
  throw: 'ears',
  grumpy: 'ears',
  eyes: 'tilt',
  empathy: 'tilt',
  sleepy: 'ears',
};
const MOVEMENT_ANIMATIONS = new Set(Object.values(MOVEMENTS).map((movement) => movement.animation));

/** Centre of the eyes, as a fraction of the width and height of the drawing (100, 104 of 200). */
const EYES_CENTRE = { x: 0.5, y: 0.52 };

const LICK_CLASS = 'mascot-lick';
const LICK_ANIMATION = 'mascot-lick';

/** Ids inside an inline SVG are global to the page, so each mascot numbers its own (D-022). */
let nextPatternId = 0;

/**
 * The TutorIA mascot (step 1.1b): a pug based on the author's dog, as an inline SVG. It is
 * decorative, so it is hidden from assistive technology, and the parent sets its size with a class
 * (`class="size-40"`). The accessories are inputs so the student settings can change them (1.9).
 * The coat keeps its own colours in both themes instead of using theme tokens (D-022).
 *
 * With the tutor's reactions (1.8) it moves too: a happy tilt for joy, its ears for surprise, a hop
 * to encourage and two hops to celebrate. For fun, it also reacts to the pointer: its eyes follow the mouse, passing the mouse over it while
 * resting makes it move (a random movement), and clicking or tapping it (giving it the bone) makes
 * it stick its tongue out and hop. Each reaction ends with its CSS animation; with reduced motion only the eyes move, because
 * they follow what the user does.
 */
@Component({
  selector: 'app-mascot',
  templateUrl: './mascot.html',
  host: {
    class: 'mascot block',
    '[class]': 'stateClasses()',
    'aria-hidden': 'true',
    '(pointerenter)': 'move($event)',
    '(click)': 'lick()',
    '(animationend)': 'endReaction($event)',
    '(document:pointermove)': 'look($event)',
  },
})
export class Mascot {
  readonly mood = input<MascotMood>('idle');
  readonly headset = input(true);
  readonly bowTie = input(false);
  /** Each new reaction of the tutor moves it once; the one already there when it appears does not. */
  readonly reaction = input<Reaction | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly movement = linkedSignal<Reaction | null, MascotAction | null>({
    source: this.reaction,
    computation: (reaction, previous) =>
      previous && reaction ? REACTION_MOVEMENTS[reaction.kind] : null,
  });
  private readonly licking = signal(false);
  private lastMovement: MascotMovement | null = null;

  protected readonly stateClasses = computed(() => {
    const movement = this.movement();
    return [
      MOOD_CLASSES[this.mood()],
      movement ? MOVEMENTS[movement].className : '',
      this.licking() ? LICK_CLASS : '',
    ]
      .filter(Boolean)
      .join(' ');
  });

  /** Transform of the irises, towards the mouse; null looks straight ahead. */
  protected readonly gaze = signal<string | null>(null);

  protected readonly plaidId = `mascot-plaid-${nextPatternId++}`;
  protected readonly plaidFill = `url(#${this.plaidId})`;

  /** Only with a mouse and while resting: a tap is a click, and the moods animate the head. */
  protected move(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.mood() !== 'idle' || this.movement()) return;
    this.lastMovement = pickMovement(this.lastMovement, Math.random());
    this.movement.set(this.lastMovement);
  }

  /** Not with the chat open, where the tongue is already out. */
  protected lick(): void {
    if (this.mood() !== 'chat') this.licking.set(true);
  }

  /** Only with a mouse: a finger on the screen would leave the eyes looking at the last tap. */
  protected look(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    const box = this.host.getBoundingClientRect();
    const { x, y } = gazeOffset(
      event.clientX - (box.left + box.width * EYES_CENTRE.x),
      event.clientY - (box.top + box.height * EYES_CENTRE.y),
      box.width,
    );
    this.gaze.set(`translate(${x} ${y})`);
  }

  protected endReaction(event: AnimationEvent): void {
    if (MOVEMENT_ANIMATIONS.has(event.animationName)) this.movement.set(null);
    if (event.animationName === LICK_ANIMATION) this.licking.set(false);
  }
}
