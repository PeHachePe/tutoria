import { Clipboard } from '@angular/cdk/clipboard';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/** How long «Copiado» stays before the button offers to copy again. */
export const COPIED_FEEDBACK_MS = 2_000;

/** The names of the languages the blocks say they are in; any other is shown as it comes. */
const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
};

/**
 * A block of code, monospaced and scrolling sideways if it is wide, with its language and a button
 * to copy it (2.5d: the empty skeleton the tutor may give). Extra actions go in its content, beside
 * «Copiar».
 */
@Component({
  selector: 'app-code-block',
  imports: [MatButton, MatIcon],
  template: `
    <div class="flex items-center gap-2 ps-3 text-label-medium text-on-surface-variant">
      <span class="flex-1">{{ languageName() }}</span>
      <ng-content />
      <button matButton type="button" (click)="copy()">
        <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
        @if (copied()) {
          <span i18n="@@codeBlock.copied">Copiado</span>
        } @else {
          <span i18n="@@codeBlock.copy">Copiar</span>
        }
      </button>
    </div>
    <!-- Long lines wrap: in the narrow column of the chat, nothing to scroll sideways -->
    <pre
      class="px-3 pb-3 font-mono text-body-small wrap-break-word whitespace-pre-wrap"
    ><code>{{ code() }}</code></pre>
    <span class="sr-only" aria-live="polite">
      @if (copied()) {
        <span i18n="@@codeBlock.copiedAnnounce">Código copiado</span>
      }
    </span>
  `,
  host: { class: 'flex flex-col rounded-lg bg-surface-container text-on-surface' },
})
export class CodeBlock {
  readonly code = input.required<string>();
  /** As written after the backticks (`js`); empty if it says none. */
  readonly language = input('');

  private readonly clipboard = inject(Clipboard);

  protected readonly copied = signal(false);
  /** Its language by name, as written if unknown, or «Código» without one. */
  protected readonly languageName = computed(() => {
    const language = this.language();
    if (!language) return $localize`:@@codeBlock.label:Código`;
    return LANGUAGE_NAMES[language.toLowerCase()] ?? language;
  });

  private feedback: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.feedback));
  }

  protected copy(): void {
    if (!this.clipboard.copy(this.code())) return;
    this.copied.set(true);
    clearTimeout(this.feedback);
    this.feedback = setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
  }
}
