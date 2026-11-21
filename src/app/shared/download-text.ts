/** The byte order mark: a spreadsheet reads the accents of the file as UTF-8. */
const BYTE_ORDER_MARK = '﻿';

/** Saves a CSV text as a file in the browser, without a request: a link to it, clicked at once. */
export function downloadCsv(document: Document, fileName: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([BYTE_ORDER_MARK, text], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lines of fields as a spreadsheet in Spanish opens them: separated by «;», each line ended in
 * CRLF. A field with a separator, a quote or a line break goes between quotes, doubling them; one
 * that starts as a formula (`=`, `+`, `-`, `@`) gets a quote before it, so a name pasted by someone
 * never runs as one when the file is opened (CSV injection).
 */
export function toCsv(lines: readonly (readonly string[])[]): string {
  return lines.map((line) => line.map(csvField).join(';') + '\r\n').join('');
}

function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
