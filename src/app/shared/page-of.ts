/**
 * A page of rows, from 0; a page past the end shows the last one (a link kept after deleting, or a
 * list that shrank while the user was on its last page), and nonsense, the first one.
 */
export function pageOf<Row>(
  rows: readonly Row[],
  pageIndex: number,
  pageSize: number,
): { readonly rows: readonly Row[]; readonly pageIndex: number } {
  const last = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const wanted = Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0;
  const index = Math.min(Math.max(0, wanted), last);
  return { rows: rows.slice(index * pageSize, (index + 1) * pageSize), pageIndex: index };
}
