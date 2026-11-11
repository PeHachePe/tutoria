import type { Difficulty } from '../../exercise';
import type { ExerciseText } from '../../localized-text';

/** An exercise of the seed, written in Spanish, its source language (D-023, D-045). */
export interface ExerciseFixture {
  readonly title: string;
  readonly difficulty: Difficulty;
  /** The contents column of 2.5. */
  readonly topics: readonly string[];
  readonly functionName: string;
  /** Names the function and what it returns as they are, the same in every language. */
  readonly statement: string;
  /**
   * The texts in the other languages of the interface, required so that `npm run check` fails if
   * an exercise of the seed is left without one (D-045).
   */
  readonly translations: Readonly<Record<'en' | 'ca', ExerciseText>>;
  /** Visible tests, the edge case among them: `[input, expectedOutput]`. */
  readonly visible: readonly (readonly [readonly unknown[], unknown])[];
  /**
   * Two hidden tests, after the visible ones: the student only sees whether they passed. One more
   * edge case each, so returning a fixed value cannot pass them by chance.
   */
  readonly hidden: readonly (readonly [readonly unknown[], unknown])[];
}

/** Code of an exercise for the past activity: a version with a typical mistake and a correct one. */
export interface SampleCode {
  readonly partial: string;
  readonly solved: string;
}

/** Lines of code as one text, ending in a line break, as the editor saves it. */
export function lines(...code: string[]): string {
  return code.join('\n') + '\n';
}
