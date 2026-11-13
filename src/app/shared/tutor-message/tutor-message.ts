import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { CodeBlock } from '../code-block/code-block';
import { splitCodeBlocks } from '../split-code-blocks';
import { splitInlineCode } from '../split-inline-code';

/**
 * An answer of the tutor: its paragraphs, keeping their line breaks, with the `inline code` in
 * monospace, and its blocks of code, such as the empty skeleton of the function (2.5d), each with
 * «Copiar». While it arrives, a caret blinks after its last words.
 */
@Component({
  selector: 'app-tutor-message',
  imports: [CodeBlock, NgTemplateOutlet],
  template: `
    @for (part of parts(); track $index; let last = $last) {
      @if (part.kind === 'block') {
        <app-code-block class="my-2" [code]="part.code" [language]="part.language" />
      } @else {
        <p class="whitespace-pre-line">
          @for (piece of part.pieces; track $index) {
            @if (piece.code) {
              <code class="rounded bg-surface-container px-1 font-mono text-[0.9em]">{{
                piece.text
              }}</code>
            } @else {
              <!-- In its own element, so no space of this template sneaks in beside the code -->
              <span>{{ piece.text }}</span>
            }
          }
          @if (typing() && last) {
            <ng-container [ngTemplateOutlet]="caret" />
          }
        </p>
      }
    }
    @if (typing() && !endsInText()) {
      <ng-container [ngTemplateOutlet]="caret" />
    }
    <ng-template #caret>
      <span
        class="ms-0.5 inline-block h-[1em] w-0.5 animate-tutor-caret bg-current align-text-bottom motion-reduce:animate-none"
        aria-hidden="true"
        data-testid="tutor-caret"
      ></span>
    </ng-template>
  `,
  host: { class: 'flex flex-col gap-1' },
})
export class TutorMessage {
  readonly text = input.required<string>();
  /** Still arriving: the caret shows where the next words will go. */
  readonly typing = input(false);

  protected readonly parts = computed(() =>
    splitCodeBlocks(this.text()).map((part) =>
      part.kind === 'block' ? part : { ...part, pieces: splitInlineCode(part.text) },
    ),
  );

  protected readonly endsInText = computed(() => this.parts().at(-1)?.kind === 'text');
}
