import { InjectionToken } from '@angular/core';

/**
 * Pause before each chunk of an answer, in milliseconds, as if it were being written: the answer
 * arrives whole and checked (D-043), and appears a little at a time, like a chat.
 */
export const TUTOR_TYPING_MS = new InjectionToken<number>('TUTOR_TYPING_MS', {
  factory: () => 40,
});

/** Words per chunk of the answer. */
const WORDS_PER_CHUNK = 3;

/** The answer in chunks of a few words, each sent as a `delta` event. */
export function typingChunks(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += WORDS_PER_CHUNK) {
    chunks.push(words.slice(start, start + WORDS_PER_CHUNK).join(''));
  }
  return chunks;
}

/** The text chunk by chunk, each after a short pause. */
export async function* typeOut(text: string, pauseMs: number): AsyncGenerator<string> {
  for (const chunk of typingChunks(text)) {
    await wait(pauseMs);
    yield chunk;
  }
}

function wait(ms: number): Promise<void> {
  return ms === 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}
