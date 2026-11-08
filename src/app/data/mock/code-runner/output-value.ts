/**
 * The value a test obtained, as the page receives it. Like JSON, except that it keeps `undefined`,
 * `NaN` and `±Infinity`, which JSON would turn into `null` or drop: they are typical beginner
 * mistakes (`let total;` gives `NaN`), and the student must see them as they are. The real runner
 * of step 2.3 has to keep them too. Runs in the Worker, so what it returns can always be copied to
 * the page (a function could not).
 */
export function normalizeOutput(value: unknown): unknown {
  return normalize(value, new Set());
}

function normalize(value: unknown, ancestors: Set<object>): unknown {
  switch (typeof value) {
    case 'function':
    case 'symbol':
      return undefined;
    case 'bigint':
      return value.toString();
    case 'object':
      break;
    default:
      return value;
  }
  if (value === null) return null;
  if (value instanceof Date) return value.toJSON();
  if (ancestors.has(value)) {
    throw new TypeError('The value contains itself');
  }
  ancestors.add(value);
  const copy = Array.isArray(value)
    ? value.map((item) => normalize(item, ancestors))
    : Object.fromEntries(
        Object.entries(value)
          .map(([key, item]) => [key, normalize(item, ancestors)])
          .filter(([, item]) => item !== undefined),
      );
  ancestors.delete(value);
  return copy;
}

/**
 * Whether the obtained value is the expected one, compared as JSON (2.5) without minding the order
 * of the keys of an object. `undefined`, `NaN` and `±Infinity` are only equal to themselves.
 */
export function outputsEqual(actual: unknown, expected: unknown): boolean {
  return canonical(actual) === canonical(expected);
}

/** JSON with sorted keys, where the values JSON lacks are written bare, so no string can match them. */
function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
