/**
 * Where the icons of the desktop stand once the person has moved one. A place counts from the
 * desktop's top right corner, where a Mac starts its icons, so it holds when the window resizes.
 */

export interface IconPlace {
  /** From the desktop's right edge to the icon's, in points. */
  right: number;
  /** From the desktop's top edge to the icon's, in points. */
  top: number;
}

export type IconPlaces = Readonly<Record<string, IconPlace>>;

/** The desktop's grid: the pitch of an icon cell, where the first cell starts, how much fits. */
export interface IconGrid {
  cellWidth: number;
  cellHeight: number;
  startRight: number;
  startTop: number;
  width: number;
  height: number;
}

/** The places in a stored value: the value itself when all of it is well formed. */
export const readIconPlaces = (stored: unknown): IconPlaces | undefined => {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return undefined;
  const all = Object.entries(stored);
  const places = all.filter(
    ([, place]) =>
      typeof place?.right === "number" &&
      Number.isFinite(place.right) &&
      typeof place.top === "number" &&
      Number.isFinite(place.top),
  );
  return places.length === all.length ? (stored as IconPlaces) : Object.fromEntries(places);
};

const rowsOf = (grid: IconGrid) =>
  Math.max(1, Math.floor((grid.height - grid.startTop) / grid.cellHeight));
const columnsOf = (grid: IconGrid) =>
  Math.max(1, Math.floor((grid.width - grid.startRight) / grid.cellWidth));

const placeOfCell = (grid: IconGrid, column: number, row: number): IconPlace => ({
  right: grid.startRight + column * grid.cellWidth,
  top: grid.startTop + row * grid.cellHeight,
});

const cellKey = (grid: IconGrid, place: IconPlace) =>
  `${Math.round((place.right - grid.startRight) / grid.cellWidth)},${Math.round(
    (place.top - grid.startTop) / grid.cellHeight,
  )}`;

/** Keeps an icon's whole cell on the desktop. */
export function clampPlace(place: IconPlace, grid: IconGrid): IconPlace {
  return {
    right: Math.min(Math.max(place.right, 0), Math.max(grid.width - grid.cellWidth, 0)),
    top: Math.min(Math.max(place.top, grid.startTop), Math.max(grid.height - grid.cellHeight, 0)),
  };
}

/** The free cell on the desktop nearest `place`, if there is one. */
function nearestVisibleCell(
  place: IconPlace,
  taken: readonly IconPlace[],
  grid: IconGrid,
): IconPlace | undefined {
  const used = new Set(taken.map((each) => cellKey(grid, each)));
  let best: IconPlace | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (let column = 0; column < columnsOf(grid); column += 1) {
    for (let row = 0; row < rowsOf(grid); row += 1) {
      const cell = placeOfCell(grid, column, row);
      if (used.has(cellKey(grid, cell))) continue;
      const away = Math.hypot(cell.right - place.right, cell.top - place.top);
      if (away < distance) {
        best = cell;
        distance = away;
      }
    }
  }
  return best;
}

/**
 * The free cell nearest `place` among those on the desktop. With none free, the first free cell
 * past them, so two icons never share a cell.
 */
export function nearestFreeCell(
  place: IconPlace,
  taken: readonly IconPlace[],
  grid: IconGrid,
): IconPlace {
  return nearestVisibleCell(place, taken, grid) ?? firstFreeCell(taken, grid);
}

/**
 * The first free cell: down from the top right, then the next column to the left. A desktop that is
 * full goes on in columns past its left edge, as a Mac's does: the icon's place is its own, and the
 * desktop shows it at the edge.
 */
export function firstFreeCell(taken: readonly IconPlace[], grid: IconGrid): IconPlace {
  const used = new Set(taken.map((each) => cellKey(grid, each)));
  for (let column = 0; ; column += 1) {
    for (let row = 0; row < rowsOf(grid); row += 1) {
      const cell = placeOfCell(grid, column, row);
      if (!used.has(cellKey(grid, cell))) return cell;
    }
  }
}

/** Moves `ids` by a drag of `dx`, `dy`, to the grid when `snap` says so, and leaves the others. */
export function movedPlaces(
  places: IconPlaces,
  ids: readonly string[],
  dx: number,
  dy: number,
  grid: IconGrid,
  snap: boolean,
  reserved: readonly IconPlace[],
): IconPlaces {
  const next: Record<string, IconPlace> = { ...places };
  const moving = new Set(ids);
  const taken = [
    ...reserved,
    ...Object.entries(places)
      .filter(([id]) => !moving.has(id))
      .map(([, place]) => place),
  ];
  const moved = ids.flatMap((id) => places[id] ?? []);
  // One move for the whole selection, as far as its furthest icon can go: icons keep their distances.
  const shift = (by: number, from: readonly number[], least: number, most: number) =>
    Math.max(least - Math.min(...from), Math.min(by, most - Math.max(...from)));
  const byRight = shift(
    -dx,
    moved.map(({ right }) => right),
    0,
    Math.max(grid.width - grid.cellWidth, 0),
  );
  const byTop = shift(
    dy,
    moved.map(({ top }) => top),
    grid.startTop,
    Math.max(grid.height - grid.cellHeight, 0),
  );
  for (const id of ids) {
    const from = places[id];
    if (!from) continue;
    // A selection spread wider than the desktop has shrunk to has no one move that fits.
    const place = clampPlace({ right: from.right + byRight, top: from.top + byTop }, grid);
    if (snap) {
      next[id] = nearestFreeCell(place, taken, grid);
      taken.push(next[id]);
    } else {
      next[id] = place;
    }
  }
  return next;
}

/**
 * `ids` dropped with the first at `place` and the rest in the cells under it, to the grid when
 * `snap` says so. Answers `places` with them in.
 */
export function placedAt(
  places: IconPlaces,
  ids: readonly string[],
  place: IconPlace,
  grid: IconGrid,
  snap: boolean,
  reserved: readonly IconPlace[],
): IconPlaces {
  const next: Record<string, IconPlace> = { ...places };
  const dropped = new Set(ids);
  const taken = [
    ...reserved,
    ...Object.entries(places)
      .filter(([id]) => !dropped.has(id))
      .map(([, other]) => other),
  ];
  const start = clampPlace(place, grid);
  const lowest = Math.max(grid.height - grid.cellHeight, start.top);
  const fit = Math.max(1, Math.floor((lowest - start.top) / grid.cellHeight) + 1);
  ids.forEach((id, index) => {
    // Down from the drop, then down the next column to the left.
    const at = {
      right: start.right + Math.floor(index / fit) * grid.cellWidth,
      top: start.top + (index % fit) * grid.cellHeight,
    };
    next[id] = snap ? nearestFreeCell(at, taken, grid) : at;
    taken.push(next[id] as IconPlace);
  });
  return next;
}

/**
 * Where the desktop shows each icon. A place that fits shows as it is, and one past the window goes
 * to the free cell nearest it. With no cell left, every icon goes in `order` down columns packed
 * closer together: a later icon lies over part of the one before, which keeps a strip to press. The
 * stored places stay, for when the window is large enough again. `order` is the order the icons are
 * drawn in, so that the later of two is the one on top.
 */
export function placesToShow(
  places: IconPlaces,
  order: readonly string[],
  grid: IconGrid,
  reserved: readonly IconPlace[],
): IconPlaces {
  const farthestRight = Math.max(grid.width - grid.cellWidth, 0);
  const lowest = Math.max(grid.height - grid.cellHeight, grid.startTop);
  const fits = ({ right, top }: IconPlace) =>
    right >= 0 && right <= farthestRight && top >= 0 && top <= lowest;
  const entries = Object.entries(places);
  const next: Record<string, IconPlace> = {};
  const taken = [...reserved];
  for (const [id, place] of entries) {
    if (fits(place)) {
      next[id] = place;
      taken.push(place);
    }
  }
  const outside = entries
    .filter(([, place]) => !fits(place))
    .sort(([, a], [, b]) => a.right - b.right || a.top - b.top);
  for (const [id, place] of outside) {
    const shown = nearestVisibleCell(place, taken, grid);
    if (!shown) return packed(places, order, grid, reserved);
    next[id] = shown;
    taken.push(shown);
  }
  return next;
}

/** The least of a packed icon left showing beside the next one, in points. */
const LEAST_STRIP = 8;

function packed(
  places: IconPlaces,
  order: readonly string[],
  grid: IconGrid,
  reserved: readonly IconPlace[],
): IconPlaces {
  const ids = order.filter((id) => places[id]);
  const rows = rowsOf(grid);
  const columns = Math.ceil(ids.length / rows);
  const roomFrom = (start: number) => Math.max(grid.width - start - grid.cellWidth, 0);
  // Past the disks' columns, so that nothing packed lies over a disk, unless that would leave the
  // icons too little of one another.
  const pastDisks = reserved.reduce(
    (from, { right }) => Math.max(from, right + grid.cellWidth),
    grid.startRight,
  );
  const start =
    pastDisks + grid.cellWidth > grid.width ||
    (columns > 1 && roomFrom(pastDisks) / (columns - 1) < LEAST_STRIP)
      ? grid.startRight
      : pastDisks;
  // A desktop narrower still has its last columns past its left edge: no icon lies exactly on another.
  const pitch =
    columns > 1
      ? Math.max(LEAST_STRIP, Math.min(grid.cellWidth, roomFrom(start) / (columns - 1)))
      : grid.cellWidth;
  const next: Record<string, IconPlace> = {};
  for (const [slot, id] of ids.entries()) {
    next[id] = {
      right: start + Math.floor(slot / rows) * pitch,
      top: grid.startTop + (slot % rows) * grid.cellHeight,
    };
  }
  return next;
}

/** The same icons on another grid: each keeps its share of the way along, so none comes to lie on another. */
export function rescaledPlaces(places: IconPlaces, was: IconGrid, now: IconGrid): IconPlaces {
  return Object.fromEntries(
    Object.entries(places).map(([id, place]) => [
      id,
      {
        right: now.startRight + ((place.right - was.startRight) * now.cellWidth) / was.cellWidth,
        top: now.startTop + ((place.top - was.startTop) * now.cellHeight) / was.cellHeight,
      },
    ]),
  );
}

/** Clean Up: every icon to the free cell nearest it, those nearest the top right choosing first. */
export function cleanedUp(
  places: IconPlaces,
  grid: IconGrid,
  reserved: readonly IconPlace[],
): IconPlaces {
  const next: Record<string, IconPlace> = {};
  const taken = [...reserved];
  const order = Object.entries(places).sort(([, a], [, b]) => a.right - b.right || a.top - b.top);
  for (const [id, place] of order) {
    next[id] = nearestFreeCell(place, taken, grid);
    taken.push(next[id]);
  }
  return next;
}

/** `ids` with the last to arrive first; one whose arrival is not known yet has only just arrived. */
export function newestArrivalsFirst(
  ids: readonly string[],
  arrivals: Readonly<Record<string, number>>,
): string[] {
  const when = (id: string) => arrivals[id] ?? Number.POSITIVE_INFINITY;
  return [...ids].sort((a, b) => {
    const [first, second] = [when(b), when(a)];
    return first === second ? 0 : first > second ? 1 : -1;
  });
}

/** Clean Up By: `ids` in that order, in the cells a Mac fills first. */
export function inOrder(
  ids: readonly string[],
  grid: IconGrid,
  reserved: readonly IconPlace[],
): IconPlaces {
  const next: Record<string, IconPlace> = {};
  const taken = [...reserved];
  for (const id of ids) {
    next[id] = firstFreeCell(taken, grid);
    taken.push(next[id]);
  }
  return next;
}

/**
 * `places` for the items that are there now: one that left goes, and a new one takes the first free
 * cell. Answers `places` itself when nothing changed.
 */
export function placesForItems(
  places: IconPlaces,
  ids: readonly string[],
  grid: IconGrid,
  reserved: readonly IconPlace[],
): IconPlaces {
  const present = new Set(ids);
  const kept = Object.entries(places).filter(([id]) => present.has(id));
  const missing = ids.filter((id) => !places[id]);
  if (missing.length === 0 && kept.length === Object.keys(places).length) return places;
  const next: Record<string, IconPlace> = Object.fromEntries(kept);
  const taken = [...reserved, ...kept.map(([, place]) => place)];
  for (const id of missing) {
    next[id] = firstFreeCell(taken, grid);
    taken.push(next[id]);
  }
  return next;
}
