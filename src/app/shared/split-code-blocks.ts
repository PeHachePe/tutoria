/** A piece of a message: plain text (maybe with `inline code`), or a fenced block of code. */
export type MessagePart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'block'; readonly code: string; readonly language: string };

/**
 * A fenced block: three backticks, its language, its code and the closing backticks, or the end of
 * the text while the answer is still arriving.
 */
const FENCED_BLOCK = /```([\w-]*)[^\S\n]*\n?([\s\S]*?)(?:```|$)/g;

/**
 * Splits a message into its text and its fenced blocks of code (```js … ```), so the template can show
 * each block as code without parsing HTML (2.5d: the tutor may give the empty skeleton). A block that
 * has not closed yet is a block too: an answer arrives bit by bit and its backticks never show.
 */
export function splitCodeBlocks(message: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  const pushText = (text: string) => {
    const trimmed = text.replace(/^\n+|\n+$/g, '');
    if (trimmed) parts.push({ kind: 'text', text: trimmed });
  };
  for (const match of message.matchAll(FENCED_BLOCK)) {
    pushText(message.slice(last, match.index));
    const code = match[2].replace(/\n+$/, '');
    if (code) parts.push({ kind: 'block', code, language: match[1] });
    last = match.index + match[0].length;
  }
  pushText(message.slice(last));
  return parts;
}
