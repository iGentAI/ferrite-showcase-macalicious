import { useSyncExternalStore } from "react";
import type { DesktopDragItem } from "./desktop-drag";
import { onTextCopied } from "./desktop-share-link";

/**
 * The desktop's clipboard for files: Copy in any Finder window holds drive items that every other
 * window and application can paste. It lives in the page alone, so the names do not reach other
 * programs on the computer. A copy or cut of anything else in the page replaces the items: a copy
 * event, or `copyText`, which a page's own copy should go through, since a direct
 * `navigator.clipboard.writeText` tells nobody.
 *
 * An application takes pasted files from its `onPaste`:
 *
 * ```tsx
 * onPaste={async (event) => {
 *   const items = copiedDriveItems();
 *   if (items.length === 0) return; // an ordinary paste
 *   event.preventDefault();
 *   attach(await filesOfDrag(items));
 * }}
 * ```
 */

const NONE: readonly DesktopDragItem[] = [];

let copied: readonly DesktopDragItem[] = NONE;
let hearing = false;
const listeners = new Set<() => void>();

function set(next: readonly DesktopDragItem[]) {
  if (next === copied) return;
  copied = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Empties the clipboard: something else was copied, or Move Item Here took what was on it. */
export const clearCopiedDriveItems = (): void => set(NONE);

/** Copy: `items` are on the desktop's clipboard. */
export function copyDriveItems(items: readonly DesktopDragItem[]): void {
  if (!hearing) {
    hearing = true;
    document.addEventListener("copy", clearCopiedDriveItems, true);
    document.addEventListener("cut", clearCopiedDriveItems, true);
    onTextCopied(clearCopiedDriveItems);
  }
  set(items.length > 0 ? [...items] : NONE);
}

/** The drive items on the clipboard now. */
export const copiedDriveItems = (): readonly DesktopDragItem[] => copied;

/** The drive items on the clipboard, following every change. */
export function useCopiedDriveItems(): readonly DesktopDragItem[] {
  return useSyncExternalStore(subscribe, copiedDriveItems, () => NONE);
}

/** The pictures on the computer's clipboard, as files an app takes; text with them is what is meant. */
export const clipboardPictures = (data: DataTransfer): DesktopDragItem[] =>
  data.getData("text/plain")
    ? []
    : [...data.files]
        .filter((file) => file.type.startsWith("image/"))
        .map((file, index) => ({
          id: `pasted-${Date.now()}-${index}`,
          name: file.name || "Pasted Image.png",
          kind: "file",
          type: file.type,
          size: file.size,
          bytes: async () => file,
        }));
