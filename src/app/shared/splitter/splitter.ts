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

/** Keys that move the splitter, and how. */
const KEY_STEPS: Record<string, (value: number, step: number, min: number, max: number) => number> =
  {
    ArrowUp: (value, step) => value - step,
    ArrowDown: (value, step) => value + step,
    Home: (_value, _step, min) => min,
    End: (_value, _step, _min, max) => max,
  };

/**
 * A bar that resizes the pane above it, as a share of their container (the parent element): it is
 * dragged with the mouse, a finger or a pen, and moved with the arrow keys, Home and End, following
 * the window splitter pattern of the ARIA practices. A double click goes back to the default.
 */
@Component({
  selector: 'app-splitter',
  template: `
    <span
      class="h-1 w-12 rounded-full bg-outline-variant transition-colors group-hover:bg-outline group-focus-visible:bg-primary motion-reduce:transition-none"
    ></span>
  `,
  host: {
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'horizontal',
    '[attr.aria-label]': 'label()',
    '[attr.aria-controls]': 'controls()',
    '[attr.aria-valuenow]': 'value()',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuetext]': 'valueText()',
    // A taller target on touch screens; `touch-none` keeps the page from scrolling while dragging
    class:
      'group flex h-4 shrink-0 cursor-row-resize touch-none items-center justify-center rounded outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:h-6',
    '(pointerdown)': 'startDrag($event)',
    '(document:pointermove)': 'drag($event)',
    '(document:pointerup)': 'endDrag()',
    '(document:pointercancel)': 'endDrag()',
    '(keydown)': 'move($event)',
    '(dblclick)': 'reset()',
  },
})
export class Splitter {
  /** Share of the container the pane above takes, in percent. */
  readonly value = model.required<number>();
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
    if (box.height === 0) return;
    this.set(((event.clientY - box.top) / box.height) * 100);
  }

  protected endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.changeEnd.emit(this.value());
  }

  protected move(event: KeyboardEvent): void {
    const next = KEY_STEPS[event.key];
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
