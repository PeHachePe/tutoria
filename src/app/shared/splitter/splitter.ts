import { formatPercent } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  model,
  output,
} from '@angular/core';

/** Which way the bar runs: across, between a pane and the one under it, or upright, between columns. */
export type SplitterOrientation = 'horizontal' | 'vertical';

type KeyStep = (value: number, step: number, min: number, max: number) => number;

const toMin: KeyStep = (_value, _step, min) => min;
const toMax: KeyStep = (_value, _step, _min, max) => max;
const smaller: KeyStep = (value, step) => value - step;
const larger: KeyStep = (value, step) => value + step;

/** Keys that move the splitter, and how: the arrows along its own direction of travel. */
const KEY_STEPS: Record<SplitterOrientation, Record<string, KeyStep>> = {
  horizontal: { ArrowUp: smaller, ArrowDown: larger, Home: toMin, End: toMax },
  vertical: { ArrowLeft: smaller, ArrowRight: larger, Home: toMin, End: toMax },
};

/** Size of the bar and of its target, which is larger on touch screens. */
const ORIENTATION_CLASSES: Record<SplitterOrientation, { host: string; bar: string }> = {
  horizontal: { host: 'h-4 cursor-row-resize pointer-coarse:h-6', bar: 'h-1 w-12' },
  vertical: { host: 'w-4 cursor-col-resize pointer-coarse:w-6', bar: 'h-12 w-1' },
};

/**
 * A bar that resizes the pane before it (above, or to the left when it is vertical), as a share of
 * their container (the parent element): it is dragged with the mouse, a finger or a pen, and moved
 * with the arrow keys, Home and End, following the window splitter pattern of the ARIA practices. A
 * double click goes back to the default.
 */
@Component({
  selector: 'app-splitter',
  template: `
    <span
      [class]="orientationClasses().bar"
      class="rounded-full bg-outline-variant transition-colors group-hover:bg-outline group-focus-visible:bg-primary motion-reduce:transition-none"
    ></span>
  `,
  host: {
    role: 'separator',
    tabindex: '0',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.aria-label]': 'label()',
    '[attr.aria-controls]': 'controls()',
    '[attr.aria-valuenow]': 'value()',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuetext]': 'valueText()',
    // `touch-none` keeps the page from scrolling while dragging
    class:
      'group flex shrink-0 touch-none items-center justify-center rounded outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-primary',
    '[class]': 'orientationClasses().host',
    '(pointerdown)': 'startDrag($event)',
    '(document:pointermove)': 'drag($event)',
    '(document:pointerup)': 'endDrag()',
    '(document:pointercancel)': 'endDrag()',
    '(keydown)': 'move($event)',
    '(dblclick)': 'reset()',
  },
})
export class Splitter {
  /** Share of the container the pane before it takes, in percent. */
  readonly value = model.required<number>();
  readonly orientation = input<SplitterOrientation>('horizontal');
  readonly min = input(15);
  readonly max = input(70);
  readonly defaultValue = input(45);
  /** Percent moved by each arrow key. */
  readonly step = input(5);
  /** What it resizes, such as «Tamaño del enunciado». */
  readonly label = input.required<string>();
  /** Id of the pane it resizes. */
  readonly controls = input<string>();

  /** The student let go of the splitter, or moved it with the keyboard: time to keep the value. */
  readonly changeEnd = output<number>();

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly locale = inject(LOCALE_ID);
  private dragging = false;

  protected readonly orientationClasses = computed(() => ORIENTATION_CLASSES[this.orientation()]);
  protected readonly valueText = computed(() => formatPercent(this.value() / 100, this.locale));

  protected startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault(); // no text selection while dragging
    this.dragging = true;
    this.host.focus();
  }

  protected drag(event: PointerEvent): void {
    const container = this.host.parentElement;
    if (!this.dragging || !container) return;
    const box = container.getBoundingClientRect();
    const vertical = this.orientation() === 'vertical';
    const size = vertical ? box.width : box.height;
    if (size === 0) return;
    const offset = vertical ? event.clientX - box.left : event.clientY - box.top;
    this.set((offset / size) * 100);
  }

  protected endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.changeEnd.emit(this.value());
  }

  protected move(event: KeyboardEvent): void {
    const next = KEY_STEPS[this.orientation()][event.key];
    if (!next) return;
    event.preventDefault();
    this.set(next(this.value(), this.step(), this.min(), this.max()));
    this.changeEnd.emit(this.value());
  }

  protected reset(): void {
    this.set(this.defaultValue());
    this.changeEnd.emit(this.value());
  }

  private set(value: number): void {
    this.value.set(Math.round(Math.min(this.max(), Math.max(this.min(), value))));
  }
}
