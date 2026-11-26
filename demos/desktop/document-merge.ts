/**
 * How a page's unsaved change meets a document that changed on the server since the page read it
 * (`createServerDocument`, in `desktop-server.ts`). The server keeps one whole document per app
 * and refuses, with 409 and its own copy, a save based on a revision it no longer holds. The page
 * then knows three versions: `base`, the document as the server held it when the page last read
 * or stored it; `mine`, the body the person's change made of it; and `theirs`, what the server
 * holds now, written by another window or browser, or forgotten there. What is sent instead is
 * the result of a merge of the three.
 *
 * `mergeDocuments`, the default, applies the person's change to the server's copy: whatever the
 * change left as it was takes the server's newer value, and whatever it changed keeps the
 * change. A removal on either side wins over an edit on the other, so a document, a field or an
 * item forgotten or deleted elsewhere is never brought back by a window that had not seen it go,
 * and one the person deleted stays deleted. It reads a document as JSON:
 *
 * - An object is a record of independent fields, merged field by field.
 * - An array whose elements are objects that each carry a key (`id` by default, or the fields
 *   named in `keys`), unique within the array, is a set of items merged by key. Items added on
 *   either side stay; items removed on either side go. An item's lists of members (a page's
 *   marks, a collection's books: lists that are sets of items or of distinct values) merge in
 *   turn, so a member removed elsewhere stays removed. Its other fields go together, since an
 *   event's start and end, or a mark's place and its points, only make sense together: when both
 *   sides changed them, they are the person's. The order is the person's when they reordered the
 *   items, and the server's otherwise, with each side's new items placed after the item that
 *   precedes them on that side.
 * - An array of distinct strings or numbers is a set merged the same way.
 * - Anything else, a plain value or a list of any other kind, is one value: when both sides
 *   changed it, the person's change wins, unless the server's copy removed it.
 *
 * A document whose parts cannot be merged on their own (an encrypted envelope, a player whose
 * queue and position go together) gives `createServerDocument` a merge of its own, such as
 * `keepServerCopy`.
 */

/** A merge of the page's change onto the server's newer copy: what the page should send. */
export type DocumentMerge = (base: object | null, mine: object, theirs: object) => object;

export interface MergeOptions {
  /** The fields that name an item of a list, tried in order. `["id"]` by default. */
  keys?: readonly string[];
  /**
   * A record forgotten elsewhere that the person changed takes the change applied to nothing,
   * rather than staying forgotten: the fields the change set are kept, and no field it only
   * carried over comes back; a list or plain value the change touched is kept whole. For
   * settings, where each change stands on its own.
   */
  reapply?: boolean;
}

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Absent and `null` are the same: the server answers `null` for a part never saved. */
const absent = (value: unknown) => value === undefined || value === null;

/**
 * Whether two JSON values are the same document: objects field by field in any order (the server
 * writes its maps sorted, the page in the order it built them), arrays element by element, an
 * absent field the same as a `null` one.
 */
export function sameDocument(a: unknown, b: unknown): boolean {
  if (absent(a) || absent(b)) return absent(a) && absent(b);
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => sameDocument(value, b[index]));
  }
  if (isRecord(a) || isRecord(b)) {
    if (!isRecord(a) || !isRecord(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!sameDocument(a[key], b[key])) return false;
    return true;
  }
  return Object.is(a, b) || a === b;
}

/**
 * The key of each element of `list`, or `null` when the list is not a set of items: an element
 * without a key, an element of another kind than the others, or a key named twice.
 */
function keysOf(list: readonly unknown[], fields: readonly string[]): string[] | null {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const element of list) {
    let key: string | null = null;
    if (typeof element === "string") key = `s:${element}`;
    else if (typeof element === "number" && Number.isFinite(element)) key = `n:${element}`;
    else if (isRecord(element)) {
      for (const field of fields) {
        const value = element[field];
        if (typeof value === "string") key = `o:${field}:s:${value}`;
        else if (typeof value === "number" && Number.isFinite(value)) key = `o:${field}:n:${value}`;
        if (key !== null) break;
      }
    }
    if (key === null || seen.has(key)) return null;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** Whether every key names the same kind of element: all strings, all numbers or all items. */
const oneKind = (keys: readonly string[]) =>
  keys.length === 0 || keys.every((key) => key[0] === keys[0]?.[0]);

/**
 * `primary`'s order, with each key of `secondary` it lacks that `keep` allows placed after the
 * key that precedes it in `secondary` (at the start when none does).
 */
function weave(
  primary: readonly string[],
  secondary: readonly string[],
  keep: (key: string) => boolean,
): string[] {
  const order = primary.filter(keep);
  const placed = new Set(order);
  let anchor: string | null = null;
  for (const key of secondary) {
    if (!placed.has(key) && keep(key)) {
      const at = anchor === null ? 0 : order.indexOf(anchor) + 1;
      order.splice(at, 0, key);
      placed.add(key);
    }
    if (placed.has(key)) anchor = key;
  }
  return order;
}

/** Whether `mine` lists the keys it shares with `base` in another order than `base` does. */
function reordered(base: readonly string[], mine: readonly string[]): boolean {
  const shared = new Set(base);
  const kept = mine.filter((key) => shared.has(key));
  const inMine = new Set(kept);
  const before = base.filter((key) => inMine.has(key));
  return kept.some((key, index) => key !== before[index]);
}

function mergeLists(
  base: readonly unknown[],
  mine: readonly unknown[],
  theirs: readonly unknown[],
  options: Required<MergeOptions>,
): unknown[] | null {
  const baseKeys = keysOf(base, options.keys);
  const mineKeys = keysOf(mine, options.keys);
  const theirKeys = keysOf(theirs, options.keys);
  if (!baseKeys || !mineKeys || !theirKeys) return null;
  if (!oneKind([...baseKeys, ...mineKeys, ...theirKeys])) return null;
  const index = (list: readonly unknown[], keys: readonly string[]) =>
    new Map(keys.map((key, at) => [key, list[at]]));
  const inBase = index(base, baseKeys);
  const inMine = index(mine, mineKeys);
  const inTheirs = index(theirs, theirKeys);
  // Removed on either side: gone, whatever the other side did to it.
  const keep = (key: string) =>
    !(inBase.has(key) && (!inMine.has(key) || !inTheirs.has(key))) &&
    (inMine.has(key) || inTheirs.has(key));
  const order = reordered(baseKeys, mineKeys)
    ? weave(mineKeys, theirKeys, keep)
    : weave(theirKeys, mineKeys, keep);
  return order.map((key) => {
    if (!inMine.has(key)) return inTheirs.get(key);
    if (!inTheirs.has(key)) return inMine.get(key);
    return mergeItem(inBase.get(key), inMine.get(key), inTheirs.get(key), options);
  });
}

/** Whether `value` is absent, or a list that is a set of items or of distinct values. */
const memberList = (value: unknown, keys: readonly string[]) =>
  absent(value) || (Array.isArray(value) && keysOf(value, keys) !== null);

/**
 * One item kept on both sides: its lists of members merge, and its other fields go together,
 * the person's when they changed any of them.
 */
function mergeItem(
  base: unknown,
  mine: unknown,
  theirs: unknown,
  options: Required<MergeOptions>,
): unknown {
  if (sameDocument(mine, base)) return theirs;
  if (sameDocument(theirs, base)) return mine;
  if (sameDocument(mine, theirs)) return mine;
  if (!isRecord(mine) || !isRecord(theirs) || !(absent(base) || isRecord(base))) return mine;
  const was: Json = isRecord(base) ? base : {};
  const fields = [...new Set([...Object.keys(theirs), ...Object.keys(mine), ...Object.keys(was)])];
  const members = (field: string) =>
    (Array.isArray(mine[field]) || Array.isArray(theirs[field])) &&
    [was[field], mine[field], theirs[field]].every((value) => memberList(value, options.keys));
  const changedHere = fields.some(
    (field) => !members(field) && !sameDocument(mine[field], was[field]),
  );
  const result: Json = {};
  for (const field of fields) {
    const value = members(field)
      ? merge(was[field], mine[field], theirs[field], options)
      : (changedHere ? mine : theirs)[field];
    if (value !== undefined) result[field] = value;
  }
  return result;
}

/** Whether a merged record holds anything. */
const holdsAnything = (value: unknown) => isRecord(value) && Object.keys(value).length > 0;

function merge(
  base: unknown,
  mine: unknown,
  theirs: unknown,
  options: Required<MergeOptions>,
): unknown {
  if (sameDocument(mine, base)) return theirs;
  if (sameDocument(theirs, base)) return mine;
  if (sameDocument(mine, theirs)) return mine;
  // Both sides changed it, differently. Removed on one side: it stays removed, so that nothing
  // forgotten or deleted comes back, unless the person's change of it is to be applied to nothing.
  if (absent(theirs)) {
    if (!options.reapply) return theirs;
    if (isRecord(mine) && (absent(base) || isRecord(base))) {
      const kept = merge(base, mine, {}, options);
      return holdsAnything(kept) ? kept : theirs;
    }
    // A list or a plain value the change touched is kept as the person left it: a list of
    // settings (an order) means nothing in part.
    return mine;
  }
  if (absent(mine)) return mine;
  if (isRecord(mine) && isRecord(theirs) && (absent(base) || isRecord(base))) {
    const was: Json = isRecord(base) ? base : {};
    const result: Json = {};
    const fields = new Set([...Object.keys(theirs), ...Object.keys(mine), ...Object.keys(was)]);
    for (const field of fields) {
      const value = merge(was[field], mine[field], theirs[field], options);
      if (value !== undefined) result[field] = value;
    }
    return result;
  }
  if (Array.isArray(mine) && Array.isArray(theirs) && (absent(base) || Array.isArray(base))) {
    const merged = mergeLists(Array.isArray(base) ? base : [], mine, theirs, options);
    if (merged) return merged;
  }
  // One value both changed: the person's change.
  return mine;
}

/** The person's change (`base` to `mine`) applied to the server's newer copy, `theirs`. */
export function mergeDocuments(
  base: object | null,
  mine: object,
  theirs: object,
  options: MergeOptions = {},
): object {
  const merged = merge(base ?? {}, mine, theirs, {
    keys: options.keys ?? ["id"],
    reapply: options.reapply ?? false,
  });
  return isRecord(merged) ? merged : theirs;
}

/** `mergeDocuments` with the lists' items named by `keys` (`["file"]`, `["id", "page"]`). */
export const mergeByKeys =
  (...keys: string[]): DocumentMerge =>
  (base, mine, theirs) =>
    mergeDocuments(base, mine, theirs, { keys });

/**
 * For a document that is one thing and cannot be merged (an encrypted keychain): the server's
 * copy stays, and the page's change is dropped, which the page is told (`onSaveFailure`).
 */
export const keepServerCopy: DocumentMerge = (_base, _mine, theirs) => theirs;

/**
 * For a document that is the state of something the page runs (a player, whose queue, song and
 * place make sense only together): the page's copy replaces the server's as the newest state,
 * except that a field forgotten elsewhere stays forgotten.
 */
export const keepPageCopy: DocumentMerge = (base, mine, theirs) => {
  const was: Json = isRecord(base) ? base : {};
  const now = theirs as Json;
  return Object.fromEntries(
    Object.entries(mine).map(([field, value]) => [
      field,
      absent(now[field]) && !absent(was[field]) ? now[field] : value,
    ]),
  );
};
