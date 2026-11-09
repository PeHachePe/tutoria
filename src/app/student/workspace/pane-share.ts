/**
 * How the splitters of the workspace share their room (ficha 03), in percent: the statement takes a
 * share of the left column, over the code, and the code a share of the width, beside the tutor. The
 * student moves them, and each is remembered per user in this browser, as a convenience.
 */
export interface PaneShare {
  /** Prefix of the localStorage key, followed by the user id. */
  readonly key: string;
  readonly default: number;
  readonly min: number;
  readonly max: number;
}

/** Share of the left column the open statement takes; the code keeps at least 30 %. */
export const STATEMENT_SHARE: PaneShare = {
  key: 'tutoria.statement-share',
  default: 45,
  min: 15,
  max: 70,
};

/**
 * Share of the width the code takes beside the tutor: the tutor has from 20 % to half, and never
 * less than its readable minimum (TUTOR_MIN_WIDTH in the page).
 */
export const CODE_SHARE: PaneShare = { key: 'tutoria.code-share', default: 70, min: 50, max: 80 };

export function paneShareKey(pane: PaneShare, userId: string): string {
  return `${pane.key}.${userId}`;
}

export function readPaneShare(pane: PaneShare, userId: string | undefined): number {
  if (!userId) return pane.default;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(paneShareKey(pane, userId));
  } catch {
    // Storage unavailable: the default share
  }
  const share = Number(saved);
  return saved && share >= pane.min && share <= pane.max ? share : pane.default;
}

export function savePaneShare(pane: PaneShare, userId: string | undefined, share: number): void {
  if (!userId) return;
  try {
    localStorage.setItem(paneShareKey(pane, userId), String(share));
  } catch {
    // Storage unavailable: the share lasts until the page is closed
  }
}
