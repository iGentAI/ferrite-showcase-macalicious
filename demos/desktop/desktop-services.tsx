import { MenuItem } from "macalicious/menu-item";
import type { ReactNode } from "react";
import {
  quickActionsFor,
  runQuickActionOnFiles,
  runSavedWorkflow,
  useSavedWorkflows,
} from "../automator/automator-library";
import { lookUp, selectedText } from "../dictionary/dictionary-desktop";
import { readFinderSelection } from "../finder/finder-selection";
import { webAddressFor } from "../safari/safari-web";
import { requestDesktopEffects } from "./desktop-effects";
import { linkAddress, openUrl } from "./desktop-open-url";
import { servedByDesktopApp } from "./desktop-server";

/**
 * The Services submenu: what the desktop can do with the text selected when the menu bar was
 * pressed or a context menu opened. With no text selected no service applies, as on a Mac.
 *
 * An application takes text from a service with `takeSharedText(app)` when its window opens and
 * `onSharedText(app, listener)` while it is open, and says `takesSharedText: true` in its
 * descriptor; its service is listed from then on.
 *
 * A saved Quick Action of Automator is a service too: one that takes text on the selected text, one
 * that takes files on what is selected in Finder while Finder is in front, one that takes nothing
 * always. While the desktop is open it also starts Folder Actions and Calendar Alarms, and listens
 * for Hey Siri.
 */

let selection = "";
/** What a frame of another origin says is selected, which `selectedText` cannot read. */
let reported = "";

/**
 * An application whose text is in a frame says what is selected there, as it changes: the
 * Services submenu reads it. A press anywhere in the page forgets it.
 */
export function reportSelection(text: string): void {
  reported = text;
}

/** Pressing the menu bar takes the keyboard and may clear the selection: it is read just before. */
function rememberSelection(event: PointerEvent) {
  if (event.target instanceof Element && event.target.closest('[role="menubar"]')) {
    selection = selectedText(document) || reported;
  } else {
    reported = "";
  }
}

/** A context menu's Services act on the text selected as it opens. */
function rememberForContextMenu() {
  selection = selectedText(document) || reported;
}

/** Starts remembering the selection for the Services submenu. Returns the cleanup. */
export function startServices(): () => void {
  document.addEventListener("pointerdown", rememberSelection, true);
  document.addEventListener("contextmenu", rememberForContextMenu, true);
  let ended = false;
  let stopBackground: (() => void) | undefined;
  let stopHeySiri: (() => void) | undefined;
  if (servedByDesktopApp()) {
    void import("../automator/automator-background").then(({ startBackgroundWorkflows }) => {
      if (!ended) stopBackground = startBackgroundWorkflows();
    });
    void import("./desktop-siri").then(({ startHeySiri }) => {
      if (!ended) stopHeySiri = startHeySiri();
    });
  }
  return () => {
    ended = true;
    stopBackground?.();
    stopHeySiri?.();
    document.removeEventListener("pointerdown", rememberSelection, true);
    document.removeEventListener("contextmenu", rememberForContextMenu, true);
  };
}

const SHARE_TEXT_EVENT = "macalicious:share-text";

/** Text handed to an application by a service. */
export interface SharedText {
  text: string;
  to: string;
}

const pendingTexts: SharedText[] = [];

const textReceivers = new Set<string>();
/** The desktop's applications, as it told them: what a context menu's Services go by. */
let desktopApps: readonly string[] = [];

/**
 * Hears which of the desktop's applications take text from a service, from their descriptors.
 * Answers the function that forgets them.
 */
export function registerTextReceivers(
  apps: readonly { id: string; takesSharedText?: boolean }[],
): () => void {
  const added = apps.filter((app) => app.takesSharedText).map((app) => app.id);
  for (const id of added) textReceivers.add(id);
  desktopApps = apps.map((app) => app.id);
  return () => {
    for (const id of added) textReceivers.delete(id);
    desktopApps = [];
  };
}

/**
 * Hands `text` to `app`: kept until it takes it, announced, and the app opened. `false` when the
 * app takes no text, which the menu never offers.
 */
export function shareText(app: string, text: string): boolean {
  if (!textReceivers.has(app)) return false;
  const shared: SharedText = { text, to: app };
  pendingTexts.push(shared);
  window.dispatchEvent(new CustomEvent(SHARE_TEXT_EVENT, { cancelable: true, detail: shared }));
  requestDesktopEffects([{ open: app }]);
  return true;
}

/** The text kept for `app`, oldest first, and forgets it: its window takes it when it opens. */
export function takeSharedText(app: string): SharedText[] {
  const taken = pendingTexts.filter((shared) => shared.to === app);
  for (const shared of taken) pendingTexts.splice(pendingTexts.indexOf(shared), 1);
  return taken;
}

/** Hears text handed to `app` from now on; it is then not kept as well. Returns the cleanup. */
export function onSharedText(app: string, listener: (shared: SharedText) => void): () => void {
  const hear = (event: Event) => {
    if (event.defaultPrevented) return;
    const shared = (event as CustomEvent<SharedText>).detail;
    if (shared.to !== app) return;
    pendingTexts.splice(pendingTexts.indexOf(shared), 1);
    event.preventDefault();
    listener(shared);
  };
  window.addEventListener(SHARE_TEXT_EVENT, hear);
  return () => window.removeEventListener(SHARE_TEXT_EVENT, hear);
}

const TEXT_SERVICES = [
  { app: "notes", title: "New Note With Selection" },
  { app: "mail", title: "New Email With Selection" },
  { app: "stickies", title: "Make New Sticky Note" },
] as const;

export interface ServicesItemsProps {
  /** The ids of the desktop's applications: a service needs its application. By default those the
   * desktop told `registerTextReceivers`. */
  apps?: readonly string[];
  /** The application asking, which a web address opened from here names. */
  from: string;
  /** What the submenu shows when no service applies. */
  none: ReactNode;
}

/** The rows of the Services submenu, for the text selected when it was asked for. */
export function ServicesItems({ apps = desktopApps, from, none }: ServicesItemsProps) {
  const text = selection.trim();
  const address = linkAddress(text);
  const has = (id: string) => apps.includes(id);
  const saved = useSavedWorkflows();
  const finderItems = from === "finder" ? readFinderSelection() : [];
  const rows = text
    ? [
        has("dictionary") && (
          <MenuItem key="look-up" onClick={() => lookUp(text)}>
            Look Up in Dictionary
          </MenuItem>
        ),
        has("safari") && address && (
          <MenuItem key="open-url" onClick={() => openUrl(address, from)}>
            Open URL
          </MenuItem>
        ),
        has("safari") && (
          <MenuItem key="search" onClick={() => openUrl(webAddressFor(text), from)}>
            Search the Web
          </MenuItem>
        ),
        ...TEXT_SERVICES.filter(({ app }) => has(app) && textReceivers.has(app)).map(
          ({ app, title }) => (
            <MenuItem key={app} onClick={() => shareText(app, text)}>
              {title}
            </MenuItem>
          ),
        ),
      ].filter(Boolean)
    : [];
  const quickRows = [
    ...(text
      ? quickActionsFor(saved, "text").map((workflow) => (
          <MenuItem
            key={workflow.id}
            onClick={() => runSavedWorkflow(workflow, [text], "quick-action")}
          >
            {workflow.name}
          </MenuItem>
        ))
      : []),
    ...(finderItems.length > 0
      ? quickActionsFor(saved, "files").map((workflow) => (
          <MenuItem key={workflow.id} onClick={() => runQuickActionOnFiles(workflow, finderItems)}>
            {workflow.name}
          </MenuItem>
        ))
      : []),
    ...quickActionsFor(saved, "none").map((workflow) => (
      <MenuItem key={workflow.id} onClick={() => runSavedWorkflow(workflow, [], "quick-action")}>
        {workflow.name}
      </MenuItem>
    )),
  ];
  const all = [...rows, ...quickRows];
  return all.length > 0 ? all : none;
}
