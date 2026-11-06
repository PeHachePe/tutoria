/**
 * Adds a row to a CSV text, or replaces the row with the same `step` and `session`.
 * The file keeps the order of its rows and is rewritten with the given columns.
 *
 * @param {string} csv current content, empty if the file does not exist
 * @param {string[]} columns
 * @param {Record<string, unknown>} row
 */
export function upsertCsvRow(csv, columns, row) {
  const [, ...records] = parseCsv(csv);
  const rows = records.map((values) =>
    Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ''])),
  );

  const index = rows.findIndex(
    (existing) => existing.step === String(row.step) && existing.session === String(row.session),
  );
  if (index === -1) {
    rows.push(row);
  } else {
    rows[index] = row;
  }

  return [columns, ...rows.map((r) => columns.map((column) => r[column]))]
    .map((values) => values.map(formatValue).join(','))
    .join('\n')
    .concat('\n');
}

function formatValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsv(csv) {
  const records = [];
  let values = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      values.push(value);
      value = '';
    } else if (char === '\n') {
      records.push([...values, value.replace(/\r$/, '')]);
      values = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value || values.length) {
    records.push([...values, value]);
  }
  return records;
}
