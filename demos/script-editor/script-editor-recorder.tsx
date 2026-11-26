"use client";

import { useWindowManagerStore } from "macalicious/window-manager";
import { useEffect, useRef } from "react";
import { onFinderFolder } from "../desktop/desktop-effects";
import type { ScriptLanguage } from "./script-editor-data";

/**
 * What Record hears: the actions the desktop itself can report about any application, and the
 * folder Finder shows. A script of these lines does what was done (`Application(..).activate()`,
 * `Application("Finder").open(..)`, `Appearance.set`). What happens inside other applications reaches
 * no one outside them, so it is not among them.
 */
export type RecordedAction = { activate: string } | { dark: boolean } | { folder: string };

/** The lines of one action, in the language of the script. */
export function recordedLines(action: RecordedAction, language: ScriptLanguage): string {
  if ("folder" in action) {
    const place = JSON.stringify(action.folder);
    return language === "JavaScript"
      ? `Application("Finder").open(${place});`
      : `tell application "Finder"\n\topen folder ${place}\nend tell`;
  }
  if ("activate" in action) {
    return language === "JavaScript"
      ? `Application(${JSON.stringify(action.activate)}).activate();`
      : `tell application "${action.activate}"\n\tactivate\nend tell`;
  }
  return language === "JavaScript"
    ? `Appearance.set({ mode: "${action.dark ? "dark" : "light"}" });`
    : `tell application "System Events"\n\ttell appearance preferences\n\t\tset dark mode to ${action.dark}\n\tend tell\nend tell`;
}

/** The script with an action's lines at its end. */
export const withRecorded = (source: string, action: RecordedAction, language: ScriptLanguage) => {
  const written = source.replace(/\s+$/, "");
  return `${written}${written ? "\n" : ""}${recordedLines(action, language)}\n`;
};

const appNames = () =>
  import("../desktop/desktop-apps").then(
    ({ discoveredApps }) => new Map(discoveredApps.map(({ id, name }) => [id, name])),
  );

/**
 * Rendered while recording, inside a window of the desktop: hears another application becoming the
 * front one, the folder Finder shows, and the page's appearance being set to light or dark. Script
 * Editor itself is not recorded, as coming back to it to press Stop is no part of what was done.
 */
export function DesktopRecorder({ onAction }: { onAction: (action: RecordedAction) => void }) {
  const store = useWindowManagerStore();
  const latest = useRef(onAction);
  latest.current = onAction;
  useEffect(() => {
    const names = appNames();
    const front = () => store.list().find((each) => each.state === "key")?.app;
    let last = front();
    const stopWindows = store.subscribe(() => {
      const now = front();
      if (!now || now === last) return;
      last = now;
      if (now === "script-editor") return;
      void names.then((known) => latest.current({ activate: known.get(now) ?? now }));
    });
    const page = document.documentElement;
    let appearance = page.getAttribute("data-appearance");
    const watcher = new MutationObserver(() => {
      const now = page.getAttribute("data-appearance");
      if (now === appearance) return;
      appearance = now;
      if (now === "dark" || now === "light") latest.current({ dark: now === "dark" });
    });
    watcher.observe(page, { attributes: true, attributeFilter: ["data-appearance"] });
    let folder: string | undefined;
    const stopFolders = onFinderFolder((path) => {
      if (path === folder) return;
      folder = path;
      latest.current({ folder: path });
    });
    return () => {
      stopWindows();
      stopFolders();
      watcher.disconnect();
    };
  }, [store]);
  return null;
}
