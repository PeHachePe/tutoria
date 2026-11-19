import { splitCodeBlocks } from '../../shared/split-code-blocks';
import type { AppLocale } from '../i18n/locale';

export interface SpeakableOptions {
  readonly locale: AppLocale;
  /** Said last if the text had a block of code or leaves a button: «Te lo dejo en el chat». */
  readonly closing: string;
  /** The answer leaves a button in the chat (2.5e). */
  readonly leavesButton?: boolean;
  /** Still arriving: the last sentence may not be whole, so it waits, and so does the closing. */
  readonly partial?: boolean;
}

/** Abbreviations after which a capital letter does not start a new sentence («p. ej. For»). */
const ABBREVIATIONS: Readonly<Record<AppLocale, readonly string[]>> = {
  es: ['p. ej.', 'ej.', 'etc.', 'núm.', 'pág.'],
  en: ['e.g.', 'i.e.', 'etc.', 'vs.'],
  ca: ['p. ex.', 'ex.', 'etc.', 'núm.', 'pàg.'],
};

const FENCE = '```';
const LINE_MARKS: readonly [RegExp, string][] = [
  [/^\s{0,3}#{1,6}\s+/, ''],
  // A quote, not a comparison («>= 0»)
  [/^\s*>(?!=)\s?/, ''],
  [/^\s*[-*•]\s+/, ''],
  [/^\s*(\d+)[.)]\s+/, '$1, '],
];
const INLINE_MARKS: readonly [RegExp, string][] = [
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/\*\*(.+?)\*\*/g, '$1'],
  [/__(.+?)__/g, '$1'],
  [/(?<![\p{L}\p{N}*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}*])/gu, '$1'],
  [/(?<![\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, '$1'],
  [/`/g, ''],
  [/(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D)+/gu, ''],
  [/[^\S\n]+(?=[.,;:!?])/g, ''],
  [/[^\S\n]{2,}/g, ' '],
];
const HAS_WORDS = /[\p{L}\p{N}]/u;
const HAS_LETTERS = /\p{L}/u;
/** One per language: it is built for every piece of an answer that arrives. */
const SEGMENTERS = new Map<AppLocale, Intl.Segmenter>();

/**
 * The text the tutor says aloud, sentence by sentence (2.11): no blocks of code, Markdown marks nor
 * emojis, and the inline code as a word. While the answer arrives, what it gives never changes as
 * the text grows: the sentences of a longer prefix always start with these.
 */
export function speakableSentences(text: string, options: SpeakableOptions): string[] {
  const hadBlock = text.includes(FENCE);
  const segmenter = segmenterOf(options.locale);
  const sentences = splitCodeBlocks(text)
    .filter((part) => part.kind === 'text')
    .flatMap((part) => sentencesOf(plain(part.text), segmenter, ABBREVIATIONS[options.locale]));
  if (options.partial) {
    const endsInBlock = text.split(FENCE).length % 2 === 0;
    const lastFence = text.lastIndexOf(FENCE);
    const tail = lastFence < 0 ? text : text.slice(lastFence + FENCE.length);
    if (!endsInBlock && tail.trim()) {
      const last = sentences.pop();
      // After «. » come digits or brackets and no letter yet: a lower case would join them to the
      // sentence before («. 2 veces»), so it waits too (UAX #29, rule SB8)
      if (last !== undefined && !HAS_LETTERS.test(last)) sentences.pop();
    }
    return sentences.filter((sentence) => HAS_WORDS.test(sentence));
  }
  const spoken = sentences.filter((sentence) => HAS_WORDS.test(sentence));
  if (text.trim() && (hadBlock || options.leavesButton)) spoken.push(options.closing);
  return spoken;
}

function segmenterOf(locale: AppLocale): Intl.Segmenter {
  let segmenter = SEGMENTERS.get(locale);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
    SEGMENTERS.set(locale, segmenter);
  }
  return segmenter;
}

function plain(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => LINE_MARKS.reduce((result, [mark, by]) => result.replace(mark, by), line));
  return INLINE_MARKS.reduce((result, [mark, by]) => result.replace(mark, by), lines.join('\n'));
}

function sentencesOf(
  text: string,
  segmenter: Intl.Segmenter,
  abbreviations: readonly string[],
): string[] {
  const sentences: string[] = [];
  let pending = '';
  for (const { segment } of segmenter.segment(text)) {
    pending += segment;
    const sentence = pending.trim();
    if (!abbreviations.some((abbreviation) => endsWithWord(sentence, abbreviation))) {
      if (sentence) sentences.push(sentence.replace(/\s*\n\s*/g, ' '));
      pending = '';
    }
  }
  if (pending.trim()) sentences.push(pending.trim().replace(/\s*\n\s*/g, ' '));
  return sentences;
}

function endsWithWord(sentence: string, abbreviation: string): boolean {
  if (!sentence.endsWith(abbreviation)) return false;
  const before = sentence.at(-abbreviation.length - 1);
  return before === undefined || /\s/.test(before);
}
