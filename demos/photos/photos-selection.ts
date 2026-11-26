"use client";

/*
 * What is selected in Photos, for the rest of the page: Automator's Get Selected Photos Items reads
 * it. A window that gets a new selection, or closes, says so; nothing here is stored.
 */

let holder: object | null = null;
let selection: readonly string[] = [];

/** The window `owner` now has the photos of these drive files selected. */
export function publishPhotosSelection(owner: object, files: readonly string[]) {
  holder = owner;
  selection = files;
}

/** The window `owner` closed: its selection goes, unless another window has spoken since. */
export function clearPhotosSelection(owner: object) {
  if (holder !== owner) return;
  holder = null;
  selection = [];
}

/** The drive files of the photos selected in the window that spoke last; none when Photos is closed. */
export const readPhotosSelection = (): readonly string[] => selection;
