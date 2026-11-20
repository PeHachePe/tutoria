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
