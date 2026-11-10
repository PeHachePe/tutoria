import { TestBed } from '@angular/core/testing';

import { TUTOR_TYPING_MS, typeOut, typingChunks } from './typing';

describe('typing', () => {
  it('splits the text in chunks of a few words, as if it were being written', () => {
    expect(typingChunks('Uno dos tres cuatro cinco')).toEqual(['Uno dos tres ', 'cuatro cinco']);
    expect(typingChunks('')).toEqual([]);
  });

  it('types the text out chunk by chunk, each after a pause', async () => {
    vi.useFakeTimers();
    const chunks: string[] = [];
    const typing = (async () => {
      for await (const chunk of typeOut('Uno dos tres cuatro', 40)) chunks.push(chunk);
    })();

    await vi.advanceTimersByTimeAsync(39);
    expect(chunks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(chunks).toEqual(['Uno dos tres ']);
    await vi.advanceTimersByTimeAsync(40);
    await typing;
    expect(chunks).toEqual(['Uno dos tres ', 'cuatro']);
    vi.useRealTimers();
  });

  it('writes a little at a time by default', () => {
    expect(TestBed.inject(TUTOR_TYPING_MS)).toBe(40);
  });
});
