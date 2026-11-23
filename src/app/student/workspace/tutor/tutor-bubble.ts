import { Component, computed, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { splitCodeBlocks } from '../../../shared/split-code-blocks';
import { splitInlineCode } from '../../../shared/split-inline-code';

/**
 * Where the bubble of the folded tutor is (6.2d, D-064): thinking while the student's question is
 * answered, the first words of a new answer, or the answer that did not arrive.
 */
export type TutorBubbleState = 'thinking' | 'answer' | 'error';

/** What pressing the bubble does, before what it says. */
const OPEN_TUTOR = $localize`:@@tutor.bubble.open:Abrir el tutor:`;

/** The answer did not arrive: the notice opens the tutor, where «Reintentar» is. */
export const TUTOR_BUBBLE_ERROR = $localize`:@@tutor.bubble.error:No he podido responder. Ábreme para reintentar`;

/**
 * The bubble beside the folded mascot (ficha 04, D-064). Thinking, three dots and nothing to press:
 * the mascot opens the tutor. With an answer, its first words without its blocks of code, in two
 * lines at most, open it; with the error, so does the notice, where «Reintentar» is. Both can be
 * closed. It never takes the focus, and says nothing to screen readers by itself: the layout
 * announces each state once, in its own region, as the bubble comes and goes.
 */
@Component({
  selector: 'app-tutor-bubble',
  imports: [MatIcon, MatIconButton, MatTooltip],
  host: {
    class:
      'flex max-w-72 animate-tutor-turn-in items-start rounded-2xl rounded-ee-sm border shadow-lg motion-reduce:animate-none',
    '[class]':
      "state() === 'error' ? 'border-error-container bg-error-container text-on-error-container' : 'border-outline-variant bg-surface-container-high text-on-surface'",
  },
  template: `
    @if (state() === 'thinking') {
      <span
        class="inline-flex gap-1 px-4 py-3 *:size-1.5 *:animate-tutor-typing *:rounded-full *:bg-on-surface-variant *:motion-reduce:animate-none *:motion-reduce:opacity-60 *:nth-2:[animation-delay:150ms] *:nth-3:[animation-delay:300ms]"
        aria-hidden="true"
        ><span></span><span></span><span></span
      ></span>
    } @else {
      <button
        type="button"
        class="flex min-w-0 flex-1 items-start gap-2 rounded-2xl rounded-ee-sm py-2 ps-3 pe-1 text-start text-body-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
        [attr.aria-label]="openName()"
        (click)="opened.emit()"
      >
        @if (state() === 'error') {
          <mat-icon class="size-5! shrink-0 text-[1.25rem]!" aria-hidden="true">error</mat-icon>
          <span class="line-clamp-2">{{ errorText }}</span>
        } @else {
          <span class="line-clamp-2">
            @for (piece of pieces(); track $index) {
              @if (piece.code) {
                <code class="rounded bg-surface-container px-1 font-mono text-[0.9em]">{{
                  piece.text
                }}</code>
              } @else {
                <span>{{ piece.text }}</span>
              }
            }
          </span>
        }
      </button>
      <button
        matIconButton
        type="button"
        class="m-1 size-8! shrink-0 p-1!"
        [attr.aria-label]="closeLabel"
        [matTooltip]="closeLabel"
        (click)="dismissed.emit()"
      >
        <mat-icon>close</mat-icon>
      </button>
    }
  `,
})
export class TutorBubble {
  readonly state = input.required<TutorBubbleState>();
  /** The answer whose first words it shows. */
  readonly text = input('');
  /** The student wants to read it: the tutor opens. */
  readonly opened = output<void>();
  /** «Cerrar el aviso». */
  readonly dismissed = output<void>();

  protected readonly errorText = TUTOR_BUBBLE_ERROR;
  protected readonly closeLabel = $localize`:@@tutor.bubble.close:Cerrar el aviso`;

  /** Its words without the blocks of code, which would not fit, and the `inline code` as code. */
  protected readonly pieces = computed(() =>
    splitInlineCode(
      splitCodeBlocks(this.text())
        .flatMap((part) => (part.kind === 'text' ? [part.text] : []))
        .join(' '),
    ),
  );

  /**
   * «Abrir el tutor: » and all it says, as one name: put together from its pieces, the inline ones
   * would lose the spaces between them in some screen readers.
   */
  protected readonly openName = computed(() => {
    const said =
      this.state() === 'error'
        ? this.errorText
        : this.pieces()
            .map((piece) => piece.text)
            .join('');
    return `${OPEN_TUTOR} ${said.replace(/\s+/g, ' ').trim()}`;
  });
}
