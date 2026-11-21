/** What ends a sentence: what is said after it starts a new one. */
const SENTENCE_END = /(^|[.!?…\n])\s*$/;

/** The first letter of what is said, after an opening sign or quote (`¿por` → `¿Por`). */
const FIRST_LETTER = /^([¿¡"«“'(]*)(\p{Ll})/u;

/**
 * The question with what was said added after what was written (2.11): trimmed, with a space when
 * what was written does not end in one, starting with a capital when it starts a sentence (the
 * browser gives it in lower case), and cut at the longest question. Nothing said leaves it as it
 * was.
 */
export function appendDictation(written: string, spoken: string, max: number): string {
  let said = spoken.trim();
  if (!said) return written;
  if (SENTENCE_END.test(written)) {
    said = said.replace(
      FIRST_LETTER,
      (_, opening: string, letter: string) => `${opening}${letter.toLocaleUpperCase()}`,
    );
  }
  const separator = written === '' || /\s$/.test(written) ? '' : ' ';
  return `${written}${separator}${said}`.slice(0, max);
}
