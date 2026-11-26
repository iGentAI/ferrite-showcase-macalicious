/** A press on a row of a list that selects several: `command` toggles it, `shift` takes the range. */
export interface RowPress {
  command: boolean;
  shift: boolean;
}

/**
 * The rows selected after a press on `id`, in a list whose rows stand in `order`. A range runs from
 * `anchor`, the row last pressed without Shift.
 */
export function pressedRows(
  selected: readonly string[],
  order: readonly string[],
  anchor: string | null,
  id: string,
  press: RowPress,
): readonly string[] {
  if (press.command) {
    return selected.includes(id) ? selected.filter((one) => one !== id) : [...selected, id];
  }
  if (press.shift) {
    const from = order.indexOf(anchor ?? id);
    const to = order.indexOf(id);
    if (from < 0 || to < 0) return [id];
    return order.slice(Math.min(from, to), Math.max(from, to) + 1);
  }
  return [id];
}
