import { TestBed } from '@angular/core/testing';

import { EmojiPrefetcher } from './emoji-prefetcher';

describe('EmojiPrefetcher', () => {
  const fetched: { url: string; priority: string }[] = [];

  beforeEach(() => {
    fetched.length = 0;
    vi.stubGlobal(
      'Image',
      class {
        fetchPriority = '';
        set src(url: string) {
          fetched.push({ url, priority: this.fetchPriority });
        }
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

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
});
