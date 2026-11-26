import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { useEffect, useRef } from "react";

/** One key of a window's menu bar items, and the command it runs. */
export interface WindowKey {
  /** As `MenuItem`'s `keyEquivalent` writes it: "shift+command+n". */
  equivalent: string;
  run: () => void;
  /** Left to a text field or editable text when the keyboard is in one. */
  notInText?: boolean;
}

const isText = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select"));

/**
 * Runs the key equivalents an application's window shows in the menu bar, since a closed menu
 * cannot listen for them. On the desktop (`within`, an element of the window, is in a managed
 * window) they work wherever the keyboard is while the window is key, as a menu bar's do; a window
 * on a page answers only inside itself, so the page keeps its own keys. A modal alert or sheet has
 * the keyboard to itself, and a key another handler took stays taken.
 */
export function useWindowKeys(
  within: Element | null,
  isKey: boolean,
  keys: readonly WindowKey[],
): void {
  const now = useRef({ isKey, keys });
  now.current = { isKey, keys };
  useEffect(() => {
    if (!within) return;
    const onKey = (key: KeyboardEvent) => {
      if (key.defaultPrevented || key.repeat || key.isComposing) return;
      const target = key.target instanceof Node ? key.target : null;
      if (!now.current.isKey) return;
      if (
        !within.closest("[data-window-id]") &&
        !within.closest("[data-window-state]")?.contains(target)
      ) {
        return;
      }
      if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return;
      for (const each of now.current.keys) {
        if (!matchesMenuKeyEquivalent(key, each.equivalent)) continue;
        if (each.notInText && isText(key.target)) return;
        key.preventDefault();
        each.run();
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [within]);
}
