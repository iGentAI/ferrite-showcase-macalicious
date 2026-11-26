import type { FinderKind } from "./finder-data";

/**
 * The applications that open an item of each kind, the default one first. Invented for the
 * demo from the names in its Applications folder. A kind that is missing is opened by Finder
 * itself (a folder, a disk) or is an application.
 */
const APPLICATIONS: Partial<Record<FinderKind, readonly string[]>> = {
  image: ["Preview", "Photos", "Safari"],
  pdf: ["Preview", "Books", "Safari"],
  book: ["Books", "Preview"],
  document: ["TextEdit", "Script Editor", "Safari"],
};

/** The applications that open an item of `kind`, the default first; none for a folder. */
export const applicationsFor = (kind: FinderKind): readonly string[] => APPLICATIONS[kind] ?? [];
