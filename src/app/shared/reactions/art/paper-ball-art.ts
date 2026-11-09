import { Component } from '@angular/core';

/** Light of each facet of the ball, lit from the top left; the colours are in paper-ball.css. */
type Shade = 'bright' | 'light' | 'mid' | 'dark';

/** Outline of the ball, uneven like crumpled paper (viewBox 0 0 100 100). */
const RIM = [
  [50, 5],
  [72, 10],
  [90, 28],
  [95, 52],
  [86, 76],
  [66, 93],
  [42, 95],
  [20, 84],
  [7, 62],
  [8, 36],
  [24, 14],
] as const;

/** Points inside where the folds meet. */
const FOLDS = {
  a: [45, 30],
  b: [66, 38],
  c: [62, 62],
  d: [38, 66],
  e: [28, 45],
  f: [52, 48],
} as const;

type Point = readonly [number, number];
const [r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10] = RIM;
const { a, b, c, d, e, f } = FOLDS;

/** The facets: triangles between the outline and the folds, each with its light. */
const FACETS: readonly { readonly points: readonly Point[]; readonly shade: Shade }[] = [
  { points: [r10, r0, a], shade: 'bright' },
  { points: [r0, r1, a], shade: 'light' },
  { points: [r1, b, a], shade: 'light' },
  { points: [r1, r2, b], shade: 'light' },
  { points: [r2, r3, b], shade: 'mid' },
  { points: [r3, c, b], shade: 'dark' },
  { points: [r3, r4, c], shade: 'mid' },
  { points: [r4, r5, c], shade: 'dark' },
  { points: [r5, d, c], shade: 'mid' },
  { points: [r5, r6, d], shade: 'dark' },
  { points: [r6, r7, d], shade: 'mid' },
  { points: [r7, r8, d], shade: 'mid' },
  { points: [r8, e, d], shade: 'light' },
  { points: [r8, r9, e], shade: 'light' },
  { points: [r9, r10, e], shade: 'bright' },
  { points: [r10, a, e], shade: 'bright' },
  { points: [a, b, f], shade: 'light' },
  { points: [b, c, f], shade: 'mid' },
  { points: [c, d, f], shade: 'mid' },
  { points: [d, e, f], shade: 'light' },
  { points: [e, a, f], shade: 'bright' },
];

/**
 * A crumpled notebook page, drawn as a ball of folded facets with bits of its ruled lines and its
 * red margin (1.8, the paper-ball reaction). Decorative: the overlay that shows it is hidden from
 * assistive technology.
 */
@Component({
  selector: 'app-paper-ball-art',
  host: { class: 'block size-full' },
  template: `
    <svg viewBox="0 0 100 100" class="size-full overflow-visible">
      @for (facet of facets; track $index) {
        <polygon [attr.points]="facet.points" [class]="'paper-facet paper-' + facet.shade" />
      }
      <!-- Bits of the ruled lines and of the margin, on the lit facets -->
      <path class="paper-rule" d="M22 30 L40 26 M30 52 L46 50 M50 40 L62 42 M14 52 L24 50" />
      <path class="paper-margin" d="M30 18 L22 40" />
      <polygon class="paper-rim" [attr.points]="rim" />
    </svg>
  `,
})
export class PaperBallArt {
  protected readonly facets = FACETS.map((facet) => ({
    points: facet.points.map((point) => point.join(',')).join(' '),
    shade: facet.shade,
  }));

  protected readonly rim = RIM.map((point) => point.join(',')).join(' ');
}
