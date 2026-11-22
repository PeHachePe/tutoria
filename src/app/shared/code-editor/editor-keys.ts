/** How the shortcuts of the code editor are named (2.5d), as on the keyboard of the student. */
export interface EditorKeys {
  /** Formats the code (`isFormatKey()`). */
  readonly format: string;
  /** Runs the tests: Ctrl + Enter, or ⌘ + Enter on a Mac, where Ctrl + Enter works too. */
  readonly run: string;
}

/**
 * The names of the keys of the editor. On a Mac, the symbols printed on its keys: ⌥ is called
 * Opción or alt depending on the keyboard, and ⌘ is the key Mac users run things with.
 */
export function editorKeys(mac: boolean): EditorKeys {
  return mac
    ? {
        format: $localize`:@@codeEditor.keys.format.mac:Mayús + ⌥ + F`,
        run: $localize`:@@codeEditor.keys.run.mac:⌘ + Intro`,
      }
    : {
        format: $localize`:@@codeEditor.keys.format:Mayús + Alt + F`,
        run: $localize`:@@codeEditor.keys.run:Ctrl + Intro`,
      };
}
