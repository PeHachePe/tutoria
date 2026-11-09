import { Component } from '@angular/core';

/** Ids inside an inline SVG are global to the page, so each pair numbers its own (as the mascot). */
let nextClipId = 0;

/** Centre of each eye in the drawing (viewBox 0 0 200 120). */
const EYES = [
  { side: 'left', cx: 60 },
  { side: 'right', cx: 140 },
] as const;

/**
 * A pair of cartoon eyes (1.8, the eyes reaction): whites with an outline, pupils with their shine
 * that look to each side, lids that blink and narrow in suspicion, and brows that frown. Their
 * movements are CSS animations in eyes.css, timed with the piece that shows them. Decorative: the
 * overlay that shows it is hidden from assistive technology.
 */
@Component({
  selector: 'app-cartoon-eyes-art',
  host: { class: 'block size-full' },
  template: `
    <svg viewBox="0 0 200 120" class="size-full overflow-visible">
      <defs>
        @for (eye of eyes; track eye.side) {
          <clipPath [attr.id]="clipId + '-' + eye.side">
            <ellipse [attr.cx]="eye.cx" cy="72" rx="34" ry="40" />
          </clipPath>
        }
      </defs>
      @for (eye of eyes; track eye.side) {
        <g>
          <ellipse class="eyes-white" [attr.cx]="eye.cx" cy="72" rx="34" ry="40" />
          <g [attr.clip-path]="'url(#' + clipId + '-' + eye.side + ')'">
            <g class="eyes-pupil">
              <circle class="eyes-iris" [attr.cx]="eye.cx" cy="76" r="15" />
              <circle class="eyes-shine" [attr.cx]="eye.cx - 5" cy="70" r="5" />
            </g>
            <rect class="eyes-lid" [attr.x]="eye.cx - 40" y="26" width="80" height="92" />
          </g>
          <ellipse class="eyes-rim" [attr.cx]="eye.cx" cy="72" rx="34" ry="40" />
          <path
            [class]="'eyes-brow eyes-brow-' + eye.side"
            [attr.d]="'M' + (eye.cx - 26) + ' 18 Q' + eye.cx + ' 6 ' + (eye.cx + 26) + ' 18'"
          />
        </g>
      }
    </svg>
  `,
})
export class CartoonEyesArt {
  protected readonly eyes = EYES;
  protected readonly clipId = `reaction-eyes-${nextClipId++}`;
}
