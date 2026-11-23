import type { GuideAnchorId } from '../core/guide/guide-anchor';

/** An entry of a navigation menu: a top bar, the side menu or the user menu. */
export interface NavLink {
  readonly path: string;
  readonly label: string;
  /** Material Symbols name. */
  readonly icon: string;
  /** The piece the guided help points at, if it explains this entry (2.12). */
  readonly guideAnchor?: GuideAnchorId;
}
