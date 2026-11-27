// The small part of Markdown the diary needs: inline marks, paragraphs and one-level lists.
// Everything is escaped first, so a document can never inject HTML into the site.

/** Escapes text for HTML. */
export const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Inline Markdown: code, bold, italics; links keep their text; decisions link to their card. */
export function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/&lt;(https?:[^&]+)&gt;/g, '$1')
    .replace(/\b(D-\d{3})\b/g, '<a class="dref" href="#decisiones/$1">$1</a>');
}

/** Block Markdown: paragraphs and one flat list per run of items (nested ones included); tables are skipped. */
export function markdown(text) {
  const out = [];
  let list = null;
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trimEnd();
    const isTable = /^\s*\|/.test(line);
    if (!line.trim() || isTable || line.startsWith('<!--')) {
      flushParagraph();
      if (!isTable) flushList();
      continue;
    }
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (item) {
      flushParagraph();
      (list ??= []).push(item[1]);
    } else if (list && /^\s{2,}\S/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return out.join('');
}

/** The top-level bullets of a block, as inline HTML (continuation lines join their bullet). */
export function bullets(text) {
  const items = [];
  for (const line of String(text ?? '').split('\n')) {
    if (line.startsWith('- ')) items.push(line.slice(2));
    else if (items.length && /^\s{2,}\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map(inline);
}

/** The `## ` sections of a document, by heading. */
export function sections(text) {
  const map = {};
  for (const part of String(text).split(/^## /m).slice(1)) {
    const newline = part.indexOf('\n');
    map[part.slice(0, newline).trim()] = part.slice(newline + 1).trim();
  }
  return map;
}
