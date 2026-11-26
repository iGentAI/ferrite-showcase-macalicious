import type { WebFolder, WebLink } from "./safari-web";

/** The person's Favorites, bookmarks and folders, as the server keeps them. */
export interface SafariLibrary {
  favorites: readonly WebLink[];
  bookmarks: readonly WebLink[];
  folders: readonly WebFolder[];
}

/** A link by its place (`favorites`, `bookmarks` or `folder:<name>`) and position there. */
export interface SafariRow {
  place: string;
  index: number;
}

export function linksAt(library: SafariLibrary, place: string): readonly WebLink[] {
  if (place === "favorites") return library.favorites;
  if (place === "bookmarks") return library.bookmarks;
  return library.folders.find((folder) => `folder:${folder.title}` === place)?.links ?? [];
}

export function withLinksAt(
  library: SafariLibrary,
  place: string,
  links: readonly WebLink[],
): SafariLibrary {
  if (place === "favorites") return { ...library, favorites: links };
  if (place === "bookmarks") return { ...library, bookmarks: links };
  return {
    ...library,
    folders: library.folders.map((folder) =>
      `folder:${folder.title}` === place ? { ...folder, links } : folder,
    ),
  };
}

const isOneOf = (rows: readonly SafariRow[], place: string, index: number) =>
  rows.some((row) => row.place === place && row.index === index);

/** `library` without the rows. */
export function withoutRows(library: SafariLibrary, rows: readonly SafariRow[]): SafariLibrary {
  return [...new Set(rows.map((row) => row.place))].reduce(
    (next, place) =>
      withLinksAt(
        next,
        place,
        linksAt(next, place).filter((_, index) => !isOneOf(rows, place, index)),
      ),
    library,
  );
}

/**
 * `library` with the rows moved to the end of a place, in the order they stand, unless they are
 * there already. A link the place holds under the same name and address is not added twice.
 */
export function movedRows(
  library: SafariLibrary,
  rows: readonly SafariRow[],
  to: string,
): SafariLibrary {
  const moving = rows.filter((row) => row.place !== to);
  const joined = [...linksAt(library, to)];
  for (const row of moving) {
    const link = linksAt(library, row.place)[row.index];
    if (link && !joined.some((one) => one.url === link.url && one.title === link.title)) {
      joined.push(link);
    }
  }
  return withLinksAt(withoutRows(library, moving), to, joined);
}

/**
 * `library` with one row moved to stand before the row at `before` of a place, or at its end: what
 * dragging a row in the sidebar does. A place that already holds the link under the same name and
 * address keeps its own, and the dragged row goes.
 */
export function rowMovedTo(
  library: SafariLibrary,
  row: SafariRow,
  to: string,
  before: number | null,
): SafariLibrary {
  const link = linksAt(library, row.place)[row.index];
  if (!link) return library;
  const here = row.place === to;
  if (here && (before === row.index || before === row.index + 1)) return library;
  const without = withoutRows(library, [row]);
  const links = linksAt(without, to);
  if (!here && links.some((one) => one.url === link.url && one.title === link.title)) {
    return without;
  }
  const place = before === null ? links.length : here && before > row.index ? before - 1 : before;
  return withLinksAt(without, to, [...links.slice(0, place), link, ...links.slice(place)]);
}

export function withFolderRenamed(
  library: SafariLibrary,
  from: string,
  title: string,
): SafariLibrary {
  return {
    ...library,
    folders: library.folders.map((folder) =>
      folder.title === from ? { ...folder, title } : folder,
    ),
  };
}

export function withoutFolder(library: SafariLibrary, title: string): SafariLibrary {
  return { ...library, folders: library.folders.filter((folder) => folder.title !== title) };
}
