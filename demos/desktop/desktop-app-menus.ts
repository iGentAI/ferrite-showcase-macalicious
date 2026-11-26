import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";

/**
 * An application's own menu items in the desktop's menu bar. The menu bar fills each menu of the
 * front application from its title (`desktop-menus.tsx`); an application whose window has
 * commands of its own (TextEdit's File menu: Open Recent, Save, Duplicate, Rename) registers
 * them here while the window is open, by application and menu title, and the menu bar shows them
 * above the desktop's own items of that menu. The items are elements of the window's last
 * render, so they act on the window as it is.
 *
 * Every open window of an application keeps its own registration. The menu bar shows the items
 * of the one the person used last: a window counts as used when it opens and whenever the
 * pointer goes down or the focus moves inside it. A window that renders again in the background
 * changes its own items only, and when the window in front closes, the one used before it shows
 * its items again.
 */

interface Registration {
  items: ReactNode | null;
  /** When the window was last used, as a count of uses: the highest is in front. */
  used: number;
}

const registered = new Map<string, Map<object, Registration>>();
const listeners = new Set<() => void>();
let uses = 0;
// A new object on every change, so that a subscriber sees that something changed.
let version = {};

function changed() {
  version = {};
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const keyOf = (app: string, title: string) => `${app}\u0000${title}`;

/**
 * Shows `items` in the menu `title` of the application `app` while the calling component is
 * mounted and its window is the application's last used; `null` shows none. `within` is an
 * element of the window (its title bar, say): the pointer or the focus inside the window that
 * holds it (its closest `[data-window-id]`, else the element itself) makes it the last used.
 */
export function useDesktopAppMenu(
  app: string,
  title: string,
  items: ReactNode | null,
  within?: Element | null,
): void {
  const [owner] = useState(() => ({}));
  const key = keyOf(app, title);
  // Opening counts as a use: a window opens in front.
  useEffect(() => {
    const windows = registered.get(key) ?? new Map<object, Registration>();
    registered.set(key, windows);
    windows.set(owner, { items: null, used: ++uses });
    return () => {
      windows.delete(owner);
      if (windows.size === 0) registered.delete(key);
      changed();
    };
  }, [key, owner]);
  // A new render changes this window's items, not which window is in front.
  useEffect(() => {
    const own = registered.get(key)?.get(owner);
    if (!own) return;
    own.items = items;
    changed();
  }, [key, owner, items]);
  useEffect(() => {
    const target = within?.closest("[data-window-id]") ?? within;
    if (!target) return;
    const use = () => {
      const own = registered.get(key)?.get(owner);
      if (!own || own.used === uses) return;
      own.used = ++uses;
      changed();
    };
    target.addEventListener("pointerdown", use, true);
    target.addEventListener("focusin", use);
    return () => {
      target.removeEventListener("pointerdown", use, true);
      target.removeEventListener("focusin", use);
    };
  }, [key, owner, within]);
}

/**
 * The items the application `app`'s last used window registered for its menu `title`, for the
 * menu bar; `undefined` when it registered none.
 */
export function useDesktopAppMenuItems(app: string, title: string): ReactNode | undefined {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  let front: Registration | undefined;
  for (const each of registered.get(keyOf(app, title))?.values() ?? []) {
    if (!front || each.used > front.used) front = each;
  }
  return front?.items ?? undefined;
}
