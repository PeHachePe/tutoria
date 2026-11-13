import { Directive, effect, ElementRef, inject, input } from '@angular/core';

/** How long the highlight of a changed row lasts. */
export const FLASH_MS = 1200;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Highlights its element for a moment each time `appFlashOnChange` changes, but not the first time:
 * a row of the live panel when its student does something. With the Web Animations API, so the row
 * is not created again and keeps the focus of whoever is on it; nothing for whoever asks for less
 * motion. The colour is that of the token `--mat-sys-primary-container`.
 */
@Directive({ selector: '[appFlashOnChange]' })
export class FlashOnChange {
  readonly appFlashOnChange = input.required<unknown>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const window = element.ownerDocument.defaultView;
    let first = true;
    // effect(): the boundary with an imperative API, element.animate() (4.8)
    effect(() => {
      this.appFlashOnChange();
      if (first) {
        first = false;
        return;
      }
      if (window?.matchMedia?.(REDUCED_MOTION).matches || !element.animate) return;
      element.animate(
        [
          { backgroundColor: 'var(--mat-sys-primary-container)' },
          { backgroundColor: 'transparent' },
        ],
        { duration: FLASH_MS, easing: 'ease-out' },
      );
    });
  }
}
