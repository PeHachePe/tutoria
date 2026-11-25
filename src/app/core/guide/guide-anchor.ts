import { Directive, input } from '@angular/core';

import { ADMIN_ANCHORS } from './anchors/admin-anchors';
import { BAR_ANCHORS } from './anchors/bar-anchors';
import { STUDENT_ANCHORS } from './anchors/student-anchors';
import { TEACHER_ANCHORS } from './anchors/teacher-anchors';

/**
 * The pieces the guided help points at (2.12), one id per piece, declared by area in `anchors/`.
 * Each one is marked in its template with GuideAnchor, never found by a style class or a
 * `data-testid`, so moving or restyling a piece keeps its help. scripts/guide/anchors.test.mjs
 * checks that no id is repeated and that every piece a profile names is marked.
 */
export const GUIDE_ANCHORS = {
  ...BAR_ANCHORS,
  ...STUDENT_ANCHORS,
  ...TEACHER_ANCHORS,
  ...ADMIN_ANCHORS,
} as const;

export type GuideAnchorId = (typeof GUIDE_ANCHORS)[keyof typeof GUIDE_ANCHORS];

/** The attribute that carries the id in the page, for TourRunner to find the piece. */
export const GUIDE_ANCHOR_ATTRIBUTE = 'data-guide';

/** CSS selector of the pieces marked with an id. */
export function guideAnchorSelector(anchor: GuideAnchorId): string {
  return `[${GUIDE_ANCHOR_ATTRIBUTE}="${anchor}"]`;
}

/**
 * Marks a piece the guided help can point at: `[appGuideAnchor]="anchors.runTests"`. With null,
 * the element is not marked (only the first of a list, for example).
 */
@Directive({
  selector: '[appGuideAnchor]',
  host: { '[attr.data-guide]': 'appGuideAnchor()' },
})
export class GuideAnchor {
  readonly appGuideAnchor = input.required<GuideAnchorId | null>();
}
