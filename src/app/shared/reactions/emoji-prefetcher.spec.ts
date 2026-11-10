import { TestBed } from '@angular/core/testing';

import { EmojiPrefetcher, RETRY_DELAY_MS } from './emoji-prefetcher';

describe('EmojiPrefetcher', () => {
  const fetched: { url: string; priority: string }[] = [];
  /** URLs whose download fails, as long as they are here. */
  const broken = new Set<string>();

  beforeEach(() => {
    fetched.length = 0;
    broken.clear();
    vi.stubGlobal(
      'Image',
      class {
        fetchPriority = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(url: string) {
          fetched.push({ url, priority: this.fetchPriority });
          // As the browser does, it answers later
          setTimeout(() => (broken.has(url) ? this.onerror?.() : this.onload?.()), 1);
        }
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks the browser for each emoji with a low priority', () => {
    TestBed.inject(EmojiPrefetcher).prefetch(['reactions/a.webp', 'reactions/b.webp']);

    expect(fetched).toEqual([
      { url: 'reactions/a.webp', priority: 'low' },
      { url: 'reactions/b.webp', priority: 'low' },
    ]);
  });

  it('asks only once per visit, however many times the overlay mounts', () => {
    const prefetcher = TestBed.inject(EmojiPrefetcher);

    prefetcher.prefetch(['reactions/a.webp']);
    prefetcher.prefetch(['reactions/a.webp', 'reactions/b.webp']);

    expect(fetched.map((request) => request.url)).toEqual(['reactions/a.webp', 'reactions/b.webp']);
  });

  describe('in the background', () => {
    beforeEach(() => vi.useFakeTimers());

    it('downloads the heavy ones one at a time, each when the previous one has arrived', async () => {
      const prefetcher = TestBed.inject(EmojiPrefetcher);

      prefetcher.prefetchInBackground(['reactions/a.webp', 'reactions/b.webp']);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetched).toEqual([{ url: 'reactions/a.webp', priority: 'low' }]);

      await vi.advanceTimersByTimeAsync(10);
      expect(fetched.map((request) => request.url)).toEqual([
        'reactions/a.webp',
        'reactions/b.webp',
      ]);

      // Already there: nothing more to download
      prefetcher.prefetchInBackground(['reactions/a.webp', 'reactions/b.webp']);
      await vi.advanceTimersByTimeAsync(10);
      expect(fetched).toHaveLength(2);
    });

    it('waits for an idle moment when the browser can tell', async () => {
      const idle = vi.fn((callback: () => void) => setTimeout(callback, 100));
      vi.stubGlobal('requestIdleCallback', idle);

      TestBed.inject(EmojiPrefetcher).prefetchInBackground(['reactions/a.webp']);
      await vi.advanceTimersByTimeAsync(50);
      expect(fetched).toEqual([]);

      await vi.advanceTimersByTimeAsync(60);
      expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 5_000 });
      expect(fetched).toHaveLength(1);
    });

    it('tries a failed one once more later, and then a later visit may try again', async () => {
      broken.add('reactions/a.webp');
      const prefetcher = TestBed.inject(EmojiPrefetcher);

      prefetcher.prefetchInBackground(['reactions/a.webp']);
      await vi.advanceTimersByTimeAsync(10);
      expect(fetched).toHaveLength(1);

      // Asked again while it waits for its retry: it is already queued
      prefetcher.prefetchInBackground(['reactions/a.webp']);
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 10);
      expect(fetched).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 2);
      expect(fetched).toHaveLength(2);

      broken.clear();
      prefetcher.prefetchInBackground(['reactions/a.webp']);
      await vi.advanceTimersByTimeAsync(10);
      expect(fetched).toHaveLength(3);
    });

    it('downloads nothing when the student saves data or the connection is 2G', async () => {
      vi.stubGlobal('navigator', { connection: { saveData: true } });
      TestBed.inject(EmojiPrefetcher).prefetchInBackground(['reactions/a.webp']);
      vi.stubGlobal('navigator', { connection: { effectiveType: '2g' } });
      TestBed.inject(EmojiPrefetcher).prefetchInBackground(['reactions/b.webp']);
      await vi.advanceTimersByTimeAsync(10);
      expect(fetched).toEqual([]);

      vi.stubGlobal('navigator', { connection: { effectiveType: '3g' } });
      TestBed.inject(EmojiPrefetcher).prefetchInBackground(['reactions/c.webp']);
      await vi.advanceTimersByTimeAsync(10);
      expect(fetched).toHaveLength(1);
    });
  });
});
