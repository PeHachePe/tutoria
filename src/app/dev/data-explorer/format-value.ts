/**
 * A value as the student would write it in JavaScript, with spaces after commas: `[1, 2, 3]`,
 * `"2.50"`, `null`. Strings keep their quotes, so `"5"` and `5` never look alike.
 */
export function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`;
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).map(([key, item]) => `${key}: ${formatValue(item)}`);
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  }
  return String(value);
}

/** A test input as the call the student would write: `suma([1, 2, 3])`. */
export function formatCall(functionName: string, input: readonly unknown[]): string {
  return `${functionName}(${input.map(formatValue).join(', ')})`;
}

/** A text with line breaks reads better as a block, line by line, than as a quoted string. */
export function isMultilineText(value: unknown): value is string {
  return typeof value === 'string' && value.includes('\n');
}
