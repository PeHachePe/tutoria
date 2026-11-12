import { inject } from '@angular/core';
import { NavigationError } from '@angular/router';

import { PageReloader } from './page-reloader';

/** When the page was last loaded again for this reason, in the session of the tab. */
export const STALE_CHUNK_RELOAD_KEY = 'tutoria.staleChunkReload';

/** Within it, a second failure is not an old deployment but code that is missing: no loop. */
const RELOAD_WINDOW_MS = 10_000;

/** What Chrome, Firefox and Safari say when the code of a lazy route does not load. */
const STALE_CHUNK = /dynamically imported module|Importing a module script failed/;

/**
 * Navigation error handler (D-053): every deployment changes the names of the lazy chunks, so a tab
 * opened before it fails to load a page it had not visited yet. Loading that page from scratch
 * brings the new version, once: if it fails again within a few seconds, the router shows the error.
 */
export function reloadOnStaleChunk({ error, url }: NavigationError): void {
  if (!(error instanceof Error) || !STALE_CHUNK.test(error.message)) return;
  const now = Date.now();
  const last = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY));
  if (now - last < RELOAD_WINDOW_MS) return;
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  inject(PageReloader).open(url);
}
