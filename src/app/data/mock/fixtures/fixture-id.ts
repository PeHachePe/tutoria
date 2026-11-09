/** First block of the UUID of each table, so a fixture id says where it belongs. */
const TABLE_PREFIXES = {
  user: '10000000',
  group: '20000000',
  enrollment: '30000000',
  exercise: '40000000',
  test: '50000000',
  assignment: '60000000',
  attempt: '70000000',
  interaction: '80000000',
  event: '90000000',
  session: 'a0000000',
} as const;

export type FixtureTable = keyof typeof TABLE_PREFIXES;

/**
 * Fixed, valid UUID (version 4 layout) for row `n` of a fixture table, such as
 * `10000000-0000-4000-8000-000000000001`: the mock data and `supabase/seed.sql` share it.
 */
export function fixtureId(table: FixtureTable, n: number): string {
  return `${TABLE_PREFIXES[table]}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
