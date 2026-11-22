/** Words of their own the student must say over the tutor to interrupt it (2.11). */
export const MIN_OWN_WORDS = 2;

/** The words of a text, in lower case and without accents or punctuation. */
function words(text: string): string[] {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/**
 * Whether what the microphone heard is the tutor itself (2.11): fewer than MIN_OWN_WORDS of its
 * words are not in `spoken`. The recognition gives it late and not always right, so a piece of the
 * sentence, or a word of its own, is still echo.
 */
export function isEcho(heard: string, spoken: string): boolean {
  const said = new Set(words(spoken));
  return words(heard).filter((word) => !said.has(word)).length < MIN_OWN_WORDS;
}
