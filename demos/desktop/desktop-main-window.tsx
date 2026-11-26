"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem } from "macalicious/menu-item";
import { type ReactNode, useEffect, useMemo } from "react";
import { useDesktopAppMenu } from "./desktop-app-menus";
import { requestDesktopEffects } from "./desktop-effects";

/** The application a key window of the desktop belongs to, as its windows are named. This file does
 * not import `desktop-apps`, which loads every application: an app that uses the row must not. */
const keyWindowOf = (app: string) => {
  const id = document
    .querySelector('[data-window-id] [data-window-state="key"]')
    ?.closest<HTMLElement>("[data-window-id]")?.dataset.windowId;
  return id === app || !!id?.startsWith(`${app}:`);
};

/**
 * The Window menu's row of an application's main window, Command-0 as on a Mac: it brings that window
 * forward, or opens it when it is closed. `title` is what the application calls the window. The key
 * works while any window of the application is key, since it is what brings the main one back.
 * `rows` come first in the menu: the application's own items of Window, of which there is one list.
 */
export function useMainWindowItem(
  app: string,
  title: string,
  within?: Element | null,
  rows?: ReactNode,
  shortcut = true,
) {
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (key: KeyboardEvent) => {
      if (key.defaultPrevented || !matchesMenuKeyEquivalent(key, "command+0")) return;
      if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return;
      if (!keyWindowOf(app)) return;
      key.preventDefault();
      requestDesktopEffects([{ open: app }]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [app, shortcut]);
  const item = useMemo(
    () => (
      <>
        {rows}
        <MenuItem
          keyEquivalent={shortcut ? "command+0" : undefined}
          onClick={() => requestDesktopEffects([{ open: app }])}
        >
          {title}
        </MenuItem>
      </>
    ),
    [app, title, rows, shortcut],
  );
  useDesktopAppMenu(app, "Window", item, within);
}
