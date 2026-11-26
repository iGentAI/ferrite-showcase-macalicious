import type { FontCollection } from "./font-book-data";

/**
 * Font Book's collections and turned-off fonts as its module of the `macalicious-desktop` Ferrite
 * application keeps them (`ferrite-apps/desktop/src/apps/font_book`): `GET` and `PUT` of
 * `{ collections, disabled }`, each collection `{ id, name, families }` and `disabled` the ids of
 * the families turned off.
 */
export const FONT_BOOK_LIBRARY_URL = "/api/font-book/library";

/** What the window keeps on the server. */
export interface FontBookLibrary {
  /** The collections the user made. */
  collections: readonly FontCollection[];
  /** The ids of the families the user turned off. */
  disabled: readonly string[];
}

/** The `PUT` body for the window's collections and turned-off fonts. */
export function libraryToServer({ collections, disabled }: FontBookLibrary) {
  return {
    collections: collections.map(({ id, name, families }) => ({
      id,
      name,
      families: [...(families ?? [])],
    })),
    disabled: [...disabled],
  };
}

const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string");

const isCollection = (
  value: unknown,
): value is { id: string; name: string; families: string[] } => {
  const collection = value as Record<string, unknown> | null;
  return (
    typeof collection === "object" &&
    collection !== null &&
    typeof collection.id === "string" &&
    typeof collection.name === "string" &&
    isIds(collection.families)
  );
};

/**
 * Whether a `GET` reply is a library Font Book can read: both lists are lists of entries it
 * understands, or both `null` before the session has saved. Anything else, including one
 * collection in another shape, is stored data that must not be saved over.
 */
export function libraryReadable(reply: unknown): boolean {
  const { collections, disabled } = (reply ?? {}) as { collections?: unknown; disabled?: unknown };
  if (collections === null && disabled === null) return true;
  return Array.isArray(collections) && collections.every(isCollection) && isIds(disabled);
}

/**
 * The library of a `GET` reply, or `undefined` when it holds none or one Font Book cannot read
 * whole: the session has not saved yet, or the reply is not the module's.
 */
export function libraryFromServer(reply: unknown): FontBookLibrary | undefined {
  if (!libraryReadable(reply)) return undefined;
  const { collections, disabled } = reply as { collections: unknown; disabled: unknown };
  if (!Array.isArray(collections) || !isIds(disabled)) return undefined;
  return {
    collections: collections.filter(isCollection).map(({ id, name, families }) => ({
      id,
      name,
      icon: "collection" as const,
      families,
    })),
    disabled,
  };
}
