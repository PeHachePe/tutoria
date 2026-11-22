/**
 * Mayús + Alt + F, «Format document» in VS Code (2.5d), told by the physical key and not by the
 * character it types: on a Mac, Option combinations type characters (⇧⌥F is «ﬁ»), and CodeMirror
 * leaves them alone instead of matching a key binding. VS Code reads the key the same way.
 */
export function isFormatKey(
  event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
): boolean {
  return (
    event.code === 'KeyF' && event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey
  );
}
