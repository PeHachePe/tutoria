import { Service } from '@angular/core';

/** Connections where the animated emoji are not worth their megabytes: the still ones show. */
const SLOW_CONNECTIONS: readonly string[] = ['slow-2g', '2g'];

/** A download that failed is tried once more, this long after the rest have finished. */
export const RETRY_DELAY_MS = 30_000;

/** The longest wait for an idle moment, so a busy page still gets its emoji eventually. */
const IDLE_TIMEOUT_MS = 5_000;

/** What the browser says of the connection (Network Information API, Chromium only). */
interface Connection {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

/**
 * Asks the browser for the emoji of the reactions ahead, once per visit. The reaction overlay
 * mounts with every exercise, and asking again each time only sent requests that change nothing:
 * the server answers that the file is the same. The images are kept, so the browser keeps them in
 * its memory cache while the page lives, and its HTTP cache keeps them for the next visits.
 */
@Service()
export class EmojiPrefetcher {
  private readonly images = new Map<string, HTMLImageElement>();
  /** The heavy ones waiting for, or in, their background download. */
  private readonly queued = new Set<string>();

  /** The light ones, all at once, with a low priority, so they never delay what the page needs. */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) {
      if (this.images.has(url)) continue;
      const image = new Image();
      image.fetchPriority = 'low';
      image.src = url;
      this.images.set(url, image);
    }
  }

  /**
   * The heavy ones (the animated emoji, a few hundred KB each), little by little: one at a time,
   * when the page is idle and with a low priority, so they never compete with what the student does
   * (saving, running, asking). Never when the student asked the browser to save data, nor on a 2G
   * connection: the still emoji show instead (D-043). One that fails is tried once more later.
   */
  prefetchInBackground(urls: readonly string[]): void {
    if (!worthDownloading()) return;
    const pending = urls.filter((url) => !this.images.has(url) && !this.queued.has(url));
    for (const url of pending) this.queued.add(url);
    if (pending.length > 0) void this.download(pending, true);
  }

  private async download(urls: readonly string[], retry: boolean): Promise<void> {
    const failed: string[] = [];
    for (const url of urls) {
      await idle();
      if (!(await this.load(url))) failed.push(url);
    }
    if (retry && failed.length > 0) {
      setTimeout(() => void this.download(failed, false), RETRY_DELAY_MS);
      return;
    }
    // Given up: a later visit to an exercise may try again
    for (const url of failed) this.queued.delete(url);
  }

  /** Whether the emoji arrived; it stays in memory if it did. */
  private load(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const image = new Image();
      image.fetchPriority = 'low';
      image.onload = () => {
        this.images.set(url, image);
        this.queued.delete(url);
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = url;
    });
  }
}

function worthDownloading(): boolean {
  const connection = (navigator as Navigator & { readonly connection?: Connection }).connection;
  if (connection?.saveData) return false;
  return !SLOW_CONNECTIONS.includes(connection?.effectiveType ?? '');
}

/** A moment when the browser has nothing better to do; right away where it cannot tell. */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in globalThis) {
      requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
