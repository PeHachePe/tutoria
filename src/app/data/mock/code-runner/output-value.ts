/**
 * The value a test obtained, as the page receives it. Like JSON, except that it keeps `undefined`,
 * `NaN` and `±Infinity`, which JSON would turn into `null` or drop: they are typical beginner
 * mistakes (`let total;` gives `NaN`), and the student must see them as they are. The Edge Function
 * `execute` keeps them too. Runs in the Worker, so what it returns can always be copied to
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
