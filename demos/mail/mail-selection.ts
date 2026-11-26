"use client";

/*
 * What is selected in Mail, for the rest of the page: Automator's Get Selected Mail Items reads it.
 * A viewer that gets a new selection, or closes, says so; nothing here is stored.
 */

/** A message as another app is told of it. */
export interface SelectedMail {
  subject: string;
  from: string;
}

let holder: object | null = null;
let selection: readonly SelectedMail[] = [];

/** The viewer `owner` now has `messages` selected. */
export function publishMailSelection(owner: object, messages: readonly SelectedMail[]) {
  holder = owner;
  selection = messages;
}

/** The viewer `owner` closed: its selection goes, unless another viewer has spoken since. */
export function clearMailSelection(owner: object) {
  if (holder !== owner) return;
  holder = null;
  selection = [];
}

/** The messages selected in the Mail viewer that spoke last; none when Mail is closed. */
export const readMailSelection = (): readonly SelectedMail[] => selection;
