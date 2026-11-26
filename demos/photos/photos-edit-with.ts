import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";

/*
 * Photos' Edit With: a copy of the photo goes to Preview, and what Preview saves comes back as the
 * photo's edit (`Edit.external`, on the server), while the original on the drive stays as it was.
 * This records, with the person's settings, which file Preview has open for which photo, so that
 * Preview's save knows where to go. A setting is at most 4,096 bytes, so the record keeps the latest
 * few: a photo whose record has gone keeps its edit, and opening it again makes a new record.
 */

export const EDIT_WITH = "photos.editWith";
/** How many files the record names: about 200 bytes each, in a setting of 4,096. */
export const MOST_RECORDED = 16;

export interface EditWithCopy {
  /** The photo's id. */
  photo: string;
  /** The file Preview opens; a save replaces it with a new file. */
  open: string;
  /** The photo's `edited_ms` the copy was made from, 0 for none. */
  at: number;
  /** The file of the last save that came back: what the photo is drawn from. */
  base?: string;
  /**
   * The photo's edit names `base` too. A record from before edits named a file is all there is of
   * its `base`, so it is never dropped to make room.
   */
  held?: true;
}

type EditWithCopies = Readonly<Record<string, EditWithCopy>>;

export function editWithCopies(): EditWithCopies {
  const stored = desktopValues()[EDIT_WITH];
  return typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? (stored as EditWithCopies)
    : {};
}

/** The file the photo with this original is drawn from, when only the record says so. */
export const editedFileOf = (original: string): string | undefined =>
  editWithCopies()[original]?.base;

/** The original and record of the copy Preview has open as `file`. */
export function copyOpenAs(file: string): [string, EditWithCopy] | undefined {
  return Object.entries(editWithCopies()).find(([, copy]) => copy.open === file);
}

/** The record to drop for room: the oldest whose photo's edit keeps its file, then the oldest copy never saved. */
function nextToDrop(copies: EditWithCopies, keeping: string): string | undefined {
  const droppable = Object.entries(copies)
    .filter(([original, copy]) => original !== keeping && (copy.held || !copy.base))
    .sort(([, a], [, b]) => Number(Boolean(b.held)) - Number(Boolean(a.held)) || a.at - b.at);
  return droppable[0]?.[0];
}

export function keepCopy(original: string, copy: EditWithCopy): void {
  const copies: Record<string, EditWithCopy> = { ...editWithCopies() };
  while (Object.keys(copies).length >= MOST_RECORDED && !copies[original]) {
    const drop = nextToDrop(copies, original);
    if (!drop) break;
    delete copies[drop];
  }
  changeDesktopValue(EDIT_WITH, { ...copies, [original]: copy });
}

/** Forgets the copy of this original, answering it: the photo is drawn from its original again. */
export function forgetCopy(original: string): EditWithCopy | undefined {
  const { [original]: copy, ...others } = editWithCopies();
  if (copy) changeDesktopValue(EDIT_WITH, others);
  return copy;
}
