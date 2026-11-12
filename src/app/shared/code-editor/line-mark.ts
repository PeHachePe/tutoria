/** A line of the code the tutor points at, with a short note in words (2.5e, `highlightLines`). */
export interface LineMark {
  /** From 1, as the editor numbers them. */
  readonly line: number;
  readonly note?: string;
}
