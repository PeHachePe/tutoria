import { Service } from '@angular/core';

/**
 * Asks the browser for the emoji of the reactions ahead, once per visit. The reaction overlay
 * mounts with every exercise, and asking again each time only sent requests that change nothing:
 * the server answers that the file is the same. The images are kept, so the browser keeps them in
 * its memory cache while the page lives.
 */
@Service()
export class EmojiPrefetcher {
  private readonly images = new Map<string, HTMLImageElement>();

  /** With a low priority, so they never delay what the page needs now. */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) {
      if (this.images.has(url)) continue;
      const image = new Image();
      image.fetchPriority = 'low';
      image.src = url;
      this.images.set(url, image);
    }
  }
}
