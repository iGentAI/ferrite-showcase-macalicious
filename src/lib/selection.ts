// What a view selects by: a row's or item's id.
export type SelectionKey = string | number;

// `"none"` selects nothing, `"single"` one item, `"multiple"` any number.
export type SelectionMode = "none" | "single" | "multiple";

// The selection after a click or a key lands on the item at `index`, as AppKit's tables do
// it: a plain click selects that item alone; with `toggle` (Command) it is added or removed;
// with `extend` (Shift) everything from the anchor to it is selected.
//
// `idAt` gives the id of the item at an index. `anchor` is the index a range starts from
// (-1 for none); one at or past `count`, left over from items that have gone, is ignored.
// Returns the new selection and the new anchor.
export function nextSelection(
  mode: SelectionMode,
  value: readonly SelectionKey[],
  anchor: number,
  index: number,
  idAt: (index: number) => SelectionKey,
  toggle = false,
  extend = false,
  count = Number.POSITIVE_INFINITY,
): [SelectionKey[], number] {
  if (mode === "none") return [[], -1];
  const id = idAt(index);
  if (mode === "multiple" && extend && anchor >= 0 && anchor < count) {
    const range: SelectionKey[] = [];
    for (let at = Math.min(anchor, index); at <= Math.max(anchor, index); at++)
      range.push(idAt(at));
    return [range, anchor];
  }
  if (mode === "multiple" && toggle) {
    return [value.includes(id) ? value.filter((key) => key !== id) : [...value, id], index];
  }
  return [[id], index];
}
