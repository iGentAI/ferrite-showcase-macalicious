import {
  type Guide,
  MAX_FAVORITES,
  MAX_GUIDE_PLACES,
  type PlacesDocument,
  type ServedPlace,
  withFavorite,
  withGuidePlace,
} from "./maps-server";

/*
 * The rows of the Places sidebar, named by their values (`favorite:<id>`, `recent:<id>`,
 * `guide:<id>` and `guide:<id>:<place>`), and what removing and dragging them does to the document.
 */

/** What a row of the sidebar stands for. */
export type Row =
  | { kind: "favorite"; place: ServedPlace }
  | { kind: "recent"; place: ServedPlace }
  | { kind: "guide"; guideId: string }
  | { kind: "guide-place"; guideId: string; place: ServedPlace };

export function rowOf(doc: PlacesDocument, value: string | null): Row | null {
  if (!value) return null;
  const [kind, first, second] = value.split(":");
  if (kind === "favorite") {
    const place = doc.favorites.find((item) => item.id === first);
    return place ? { kind, place } : null;
  }
  if (kind === "recent") {
    const place = doc.recents.find((item) => item.id === first);
    return place ? { kind, place } : null;
  }
  const guide = doc.guides.find((item) => item.id === first);
  if (!guide) return null;
  if (kind === "guide" && second === undefined) return { kind: "guide", guideId: guide.id };
  const place = guide.places.find((item) => item.id === second);
  return kind === "guide" && place ? { kind: "guide-place", guideId: guide.id, place } : null;
}

/** The document without a row. */
export function withoutRow(doc: PlacesDocument, row: Row): PlacesDocument {
  switch (row.kind) {
    case "favorite":
      return withFavorite(doc, row.place, false);
    case "recent":
      return { ...doc, recents: doc.recents.filter((item) => item.id !== row.place.id) };
    case "guide":
      return { ...doc, guides: doc.guides.filter((item) => item.id !== row.guideId) };
    case "guide-place":
      return withGuidePlace(doc, row.guideId, row.place, false);
  }
}

/** The document without the rows named; one already gone with its guide is passed over. */
export const withoutRows = (doc: PlacesDocument, values: readonly string[]): PlacesDocument =>
  values.reduce((now, value) => {
    const row = rowOf(now, value);
    return row ? withoutRow(now, row) : now;
  }, doc);

/** Where a row dragged over another lands: beside it, or in it when it is a guide taking a place. */
export type DropPlace = "before" | "after" | "into";

/** How a row dragged over `target` lands, given which half of the row the pointer is in. */
export function dropPlaceOn(
  doc: PlacesDocument,
  dragged: string,
  target: string,
  upper: boolean,
): DropPlace | undefined {
  const from = rowOf(doc, dragged);
  const to = rowOf(doc, target);
  if (!from || !to || dragged === target || to.kind === "recent") return undefined;
  if (from.kind === "guide") {
    if (to.kind !== "guide") return undefined;
    return upper ? "before" : "after";
  }
  if (to.kind === "guide") return "into";
  return upper ? "before" : "after";
}

/** `list` with `item` beside the one with id `target`, or last without one, once. */
function beside<T extends { id: string }>(
  list: readonly T[],
  item: T,
  target: string | null,
  place: DropPlace,
): T[] {
  const rest = list.filter((other) => other.id !== item.id);
  const at = target === null ? -1 : rest.findIndex((other) => other.id === target);
  if (at < 0) return [...rest, item];
  const to = place === "after" ? at + 1 : at;
  return [...rest.slice(0, to), item, ...rest.slice(to)];
}

/** Why a place cannot land in the list it was dragged to, when it would not fit. */
export function dropRefusal(
  doc: PlacesDocument,
  dragged: string,
  target: string,
): string | undefined {
  const from = rowOf(doc, dragged);
  const to = rowOf(doc, target);
  if (!from || !to || from.kind === "guide") return undefined;
  if (to.kind === "favorite") {
    return doc.favorites.length >= MAX_FAVORITES &&
      !doc.favorites.some(({ id }) => id === from.place.id)
      ? `Favorites holds ${MAX_FAVORITES} places, the most it keeps.`
      : undefined;
  }
  if (to.kind !== "guide" && to.kind !== "guide-place") return undefined;
  const guide = doc.guides.find(({ id }) => id === to.guideId);
  return guide &&
    guide.places.length >= MAX_GUIDE_PLACES &&
    !guide.places.some(({ id }) => id === from.place.id)
    ? `“${guide.name}” holds ${MAX_GUIDE_PLACES} places, the most a guide keeps.`
    : undefined;
}

/**
 * Each row of a drag that moves and where it goes, in the order that leaves them in the order given.
 * The row landed on, when it is one of them, stays put: those chosen before it go before it, those
 * chosen after it go after. Places landing on a guide's own row join the end of its list, wherever
 * on the row they land, so they go in the order given.
 */
function landing(
  doc: PlacesDocument,
  dragged: readonly string[],
  target: string,
  place: DropPlace,
): { value: string; place: DropPlace }[] {
  const onGuide = rowOf(doc, target)?.kind === "guide";
  const joinsList = (value: string) => onGuide && rowOf(doc, value)?.kind !== "guide";
  const at = dragged.indexOf(target);
  const before = at < 0 ? (place === "before" ? dragged : []) : dragged.slice(0, at);
  const after = at < 0 ? (place === "after" ? dragged : []) : dragged.slice(at + 1);
  return [
    ...dragged
      .filter((value) => value !== target && joinsList(value))
      .map((value) => ({ value, place })),
    ...before
      .filter((value) => !joinsList(value))
      .map((value) => ({ value, place: "before" as const })),
    ...after
      .filter((value) => !joinsList(value))
      .reverse()
      .map((value) => ({ value, place: "after" as const })),
  ];
}

/**
 * Why the rows `dragged` cannot all land on `target`: asked of the list as each before it leaves it,
 * since two places can each fit a list that has room for only one.
 */
export function dropRowsRefusal(
  doc: PlacesDocument,
  dragged: readonly string[],
  target: string,
  place: DropPlace,
): string | undefined {
  let now = doc;
  for (const row of landing(doc, dragged, target, place)) {
    const refused = dropRefusal(now, row.value, target);
    if (refused) return refused;
    now = dropRow(now, row.value, target, row.place);
  }
  return undefined;
}

/**
 * The document after the rows `dragged`, in order, land on `target`. The target itself is not moved,
 * and they end up together in the order given. A caller asks `dropRowsRefusal` first.
 */
export function dropRows(
  doc: PlacesDocument,
  dragged: readonly string[],
  target: string,
  place: DropPlace,
): PlacesDocument {
  return landing(doc, dragged, target, place).reduce(
    (now, row) => dropRow(now, row.value, target, row.place),
    doc,
  );
}

/**
 * The document after `dragged` lands on `target`: within a list it moves; a place taken to another
 * guide leaves the one it was in, and one taken from Favorites or Recents stays there too.
 */
export function dropRow(
  doc: PlacesDocument,
  dragged: string,
  target: string,
  place: DropPlace,
): PlacesDocument {
  const from = rowOf(doc, dragged);
  const to = rowOf(doc, target);
  if (!from || !to || dropRefusal(doc, dragged, target)) return doc;
  if (from.kind === "guide") {
    if (to.kind !== "guide") return doc;
    const moved = doc.guides.find(({ id }) => id === from.guideId) as Guide;
    return { ...doc, guides: beside(doc.guides, moved, to.guideId, place) };
  }
  if (to.kind === "recent") return doc;
  if (to.kind === "favorite") {
    return { ...doc, favorites: beside(doc.favorites, from.place, to.place.id, place) };
  }
  const anchor = to.kind === "guide-place" ? to.place.id : null;
  const left =
    from.kind === "guide-place" && from.guideId !== to.guideId
      ? withGuidePlace(doc, from.guideId, from.place, false)
      : doc;
  return {
    ...left,
    guides: left.guides.map((guide) =>
      guide.id === to.guideId
        ? { ...guide, places: beside(guide.places, from.place, anchor, place) }
        : guide,
    ),
  };
}
