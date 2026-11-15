/**
 * The list with the item at `from` moved to `to`, clamped to its ends: what dragging a block or an
 * exercise, or «Subir» and «Bajar», does (4.3b). A new list; the one given stays as it was.
 */
export function moveItem<Item>(items: readonly Item[], from: number, to: number): Item[] {
  const result = [...items];
  const target = Math.min(Math.max(to, 0), items.length - 1);
  const [moved] = result.splice(from, 1);
  result.splice(target, 0, moved);
  return result;
}
