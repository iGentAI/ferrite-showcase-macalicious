/**
 * Where a person left each file they opened in Preview, newest first, as the desktop's Ferrite
 * application keeps it (`ferrite-apps/desktop/src/apps/preview/mod.rs`, `places`): the window's
 * Open Recent lists them, and on launch the window reopens the first where it was left.
 */

export const PREVIEW_PLACES_URL = "/api/preview/places";
/** Files whose place is kept (the module's `MAX_PLACES`). */
export const MAX_PLACES = 20;
/** How many Open Recent lists. */
export const RECENT_SHOWN = 10;

export interface Place {
  /** The drive file's id. */
  file: string;
  /** Its name when it was last opened (Open Recent lists it without reading the drive). */
  name: string;
  /** The page shown, from 1. */
  page: number;
  /** The zoom, 1 being the fit to the window. */
  zoom: number;
  /** How a PDF's pages are laid out; continuous when left out. */
  display?: PageDisplay;
  opened_ms: number;
}

/** How a PDF's pages are shown (the module's `DISPLAYS`). */
export type PageDisplay = "continuous" | "single" | "two" | "contact";
export const PAGE_DISPLAYS: readonly PageDisplay[] = ["continuous", "single", "two", "contact"];

/**
 * The pages of `count` that a display shows with `page` current: every page when continuous, the
 * page alone, the odd-even pair holding it, or none for the contact sheet, which draws its own.
 */
export function pagesShown(display: PageDisplay, page: number, count: number): number[] {
  if (display === "contact") return [];
  if (display === "single") return [page];
  if (display === "continuous") return Array.from({ length: count }, (_, index) => index + 1);
  const first = page % 2 === 1 ? page : page - 1;
  return first < count ? [first, first + 1] : [first];
}

const isPlace = (value: unknown): value is Place => {
  if (typeof value !== "object" || value === null) return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.file === "string" &&
    typeof place.name === "string" &&
    Number.isInteger(place.page) &&
    (place.page as number) >= 1 &&
    typeof place.zoom === "number" &&
    Number.isFinite(place.zoom) &&
    (place.zoom as number) > 0 &&
    typeof place.opened_ms === "number"
  );
};

/** The places in a reply of the module; `undefined` for a reply that is not one. */
export function placesFromServer(reply: unknown): Place[] | undefined {
  if (typeof reply !== "object" || reply === null) return undefined;
  const { places, rev } = reply as { places?: unknown; rev?: unknown };
  if (typeof rev !== "number") return undefined;
  if (places === null || places === undefined) return [];
  if (!Array.isArray(places)) return undefined;
  return places.filter(isPlace).slice(0, MAX_PLACES);
}

export const placesToServer = (places: readonly Place[]) => ({ places: [...places] });

/** `place` first (just opened), without another of its file, at most `MAX_PLACES`. */
export function openedPlace(places: readonly Place[], place: Place): Place[] {
  return [place, ...places.filter((each) => each.file !== place.file)].slice(0, MAX_PLACES);
}

/**
 * The page, zoom and display of `file` changed. Answers the same list when nothing changed, or the
 * file has no place, so a state holding it is left alone.
 */
export function movedPlace(
  places: Place[],
  file: string,
  page: number,
  zoom: number,
  display: PageDisplay = "continuous",
): Place[] {
  const at = places.findIndex((each) => each.file === file);
  const current = places[at];
  if (
    !current ||
    (current.page === page &&
      Math.abs(current.zoom - zoom) < 1e-9 &&
      (current.display ?? "continuous") === display)
  ) {
    return places;
  }
  const next = [...places];
  const { display: _before, ...rest } = current;
  next[at] = { ...rest, page, zoom, ...(display === "continuous" ? {} : { display }) };
  return next;
}

/** The places without `file`'s (it is gone from the drive). */
export const forgetPlace = (places: readonly Place[], file: string): Place[] =>
  places.filter((each) => each.file !== file);
