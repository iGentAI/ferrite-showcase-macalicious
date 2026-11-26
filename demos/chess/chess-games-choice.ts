/** The games chosen in the Games sheet, and the one a Shift-click reaches from. */
export interface GamesChosen {
  ids: readonly string[];
  anchor: string | null;
}

export const NOTHING_CHOSEN: GamesChosen = { ids: [], anchor: null };

/**
 * What is chosen after a click on `id`: that game alone, or with Command the others too and without
 * it if it was chosen, or with Shift everything from the anchor to it. `order` is the list as shown.
 */
export function chosenAfter(
  chosen: GamesChosen,
  order: readonly string[],
  id: string,
  { add = false, range = false }: { add?: boolean; range?: boolean } = {},
): GamesChosen {
  if (range && chosen.anchor !== null) {
    const from = order.indexOf(chosen.anchor);
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      return {
        ids: order.slice(Math.min(from, to), Math.max(from, to) + 1),
        anchor: chosen.anchor,
      };
    }
  }
  if (!add) return { ids: [id], anchor: id };
  return {
    ids: chosen.ids.includes(id) ? chosen.ids.filter((each) => each !== id) : [...chosen.ids, id],
    anchor: id,
  };
}

/** The game next to the anchor in `order`, one step down or up, or the first when none is chosen. */
export function chosenByArrow(chosen: GamesChosen, order: readonly string[], step: 1 | -1) {
  const at = chosen.anchor === null ? -1 : order.indexOf(chosen.anchor);
  const next = order[at < 0 ? 0 : Math.min(order.length - 1, Math.max(0, at + step))];
  return next === undefined ? chosen : chosenAfter(chosen, order, next);
}
