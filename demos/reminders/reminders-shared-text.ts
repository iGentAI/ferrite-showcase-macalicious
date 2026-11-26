import { requestDesktopEffects } from "../desktop/desktop-effects";

/**
 * Text shared with Reminders (Notes' File > Share > Reminders): a reminder titled with its first
 * line, the rest in its notes. The text is kept until Reminders takes it, so it reaches a window that
 * opens only now as well as one already open, in the shape of `desktop-share-link.tsx`.
 */

const SHARE_TEXT_EVENT = "macalicious:reminders-share-text";
const MAX_PENDING = 20;

/** A reminder to make of shared text. */
export interface SharedText {
  title: string;
  notes?: string;
}

const pending: SharedText[] = [];

/** What `text` makes: `null` for text with nothing in it. */
export function reminderOfText(text: string): SharedText | null {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim() !== "");
  const title = lines[first]?.trim();
  if (!title) return null;
  const notes = lines
    .slice(first + 1)
    .join("\n")
    .trim();
  return notes ? { title, notes } : { title };
}

/** Hands `text` to Reminders and opens it. Says whether there was anything to hand. */
export function shareTextWithReminders(text: string): boolean {
  const shared = reminderOfText(text);
  if (!shared) return false;
  pending.push(shared);
  if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
  window.dispatchEvent(new CustomEvent(SHARE_TEXT_EVENT, { detail: shared }));
  requestDesktopEffects([{ open: "reminders" }]);
  return true;
}

/** What is kept for Reminders, the oldest first, taken: its window takes it when it opens. */
export function takeSharedTexts(): SharedText[] {
  return pending.splice(0);
}

/** Hears each text shared from now on, which is then not kept as well. Answers the stop. */
export function onSharedText(listener: (shared: SharedText) => void): () => void {
  const hear = (event: Event) => {
    const shared = (event as CustomEvent<SharedText>).detail;
    const at = pending.indexOf(shared);
    if (at < 0) return;
    pending.splice(at, 1);
    listener(shared);
  };
  window.addEventListener(SHARE_TEXT_EVENT, hear);
  return () => window.removeEventListener(SHARE_TEXT_EVENT, hear);
}
