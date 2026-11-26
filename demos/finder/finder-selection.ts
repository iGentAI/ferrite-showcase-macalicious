"use client";

/*
 * What is selected in Finder, for the rest of the page: Automator's Get Selected Finder Items and the
 * Services menu read it. A window that gets a new selection, or closes, says so; nothing here is
 * stored.
 */

let holder: object | null = null;
let selection: readonly string[] = [];

/** The window `owner` now has these drive entries selected. */
export function publishFinderSelection(owner: object, ids: readonly string[]) {
  holder = owner;
  selection = ids;
}

/** The window `owner` closed: its selection goes, unless another window has spoken since. */
export function clearFinderSelection(owner: object) {
  if (holder !== owner) return;
  holder = null;
  selection = [];
}

/** The drive ids selected in the Finder window that spoke last; none when Finder is closed. */
export const readFinderSelection = (): readonly string[] => selection;
