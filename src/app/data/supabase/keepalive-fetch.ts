/**
 * The `fetch` of the Supabase client: a write sent while the page is hidden goes with `keepalive`,
 * so it still arrives if the page closes right after, as when the student closes the tab and the
 * EventLogger and the autosave send what they had (D-031). Only then: the browser limits what
 * keepalive requests may carry, and a normal request needs none of it.
 */
export function keepaliveFetch(document: Document): typeof fetch {
  return (input, init) => {
    const write = (init?.method ?? 'GET') !== 'GET';
    const keepalive = write && document.visibilityState === 'hidden';
    return fetch(input, keepalive ? { ...init, keepalive } : init);
  };
}
