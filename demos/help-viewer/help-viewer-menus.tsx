"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { matchesMenuKeyEquivalent, onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";
import { printEntry, SpeechSubmenu } from "../dictionary/dictionary-menus";
import type { TextFind } from "../notes/notes-find";
import { whenMenusClosed } from "../notes/notes-menus";

/** The sizes of Make Text Bigger and Make Text Smaller, as factors of the page's own. */
export const TEXT_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
export const DEFAULT_TEXT_SCALE = 2;

/** The items the toolbar can show, as View > Customize Toolbar lists them. */
export const TOOLBAR_ITEMS = ["Back and Forward", "Table of Contents", "Share", "Book", "Search"];

const NO_PAGE_SETUP = "The browser's print dialog sets the page.";
const NO_TABS =
  "Help Viewer opens another page in a new window: the desktop has tabs for Finder and Safari alone.";

/** View > Customize Toolbar…: which of the toolbar's items show. A change shows at once. */
export function CustomizeToolbarSheet({
  open,
  anchor,
  hidden,
  onChange,
  onDone,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  hidden: readonly string[];
  onChange: (hidden: readonly string[]) => void;
  onDone: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => next || onDone()}>
      <SheetPopup anchor={anchor} width={320}>
        <SheetTitle>Choose the items the toolbar shows</SheetTitle>
        {TOOLBAR_ITEMS.map((item) => (
          <Checkbox
            key={item}
            className="mac-help-viewer-toolbar-choice"
            checked={!hidden.includes(item)}
            onCheckedChange={(shown) =>
              onChange(shown ? hidden.filter((each) => each !== item) : [...hidden, item])
            }
          >
            {item}
          </Checkbox>
        ))}
        <SheetActions>
          <DefaultButton onClick={onDone}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

export interface HelpViewerMenusOptions {
  /** Whether the window is the key window: only then do the keys act. */
  isKey: boolean;
  /** An element of the window: a use of the window makes these its application's menus. */
  within: Element | null;
  /** The element that holds the page. */
  page: RefObject<HTMLElement | null>;
  /** What the page is called, for File > Print. */
  title: string;
  /** Whether the page is an article rather than a list of results. */
  onPage: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  sidebarOpen: boolean;
  textScale: number;
  step: (by: number) => void;
  home: () => void;
  toggleSidebar: () => void;
  setTextScale: (scale: number) => void;
  toolbarShown: boolean;
  showToolbar: (shown: boolean) => void;
  customizeToolbar: () => void;
  focusSearch: () => void;
  find: TextFind;
  /** Tells the person what a row of the Edit menu could not do. */
  say: (message: string) => void;
}

/**
 * A press on the menu bar or on a row lets go of the text selected on the page, which the shared Edit
 * rows read as the menu opens and Copy reads as it is chosen. Rendered before them, this selects it
 * again at both moments.
 */
function PageSelectionHeld({ restore }: { restore: () => void }) {
  restore();
  useEffect(() => {
    document.addEventListener("click", restore, true);
    return () => document.removeEventListener("click", restore, true);
  }, [restore]);
  return null;
}

/**
 * Speech with the text the menu opened on: a press on a row can take it away from the page, and
 * `range` still holds it.
 */
function PageSpeech({
  page,
  range,
}: {
  page: RefObject<HTMLElement | null>;
  range: RefObject<Range | null>;
}) {
  return <SpeechSubmenu page={page} selected={range.current?.toString()} />;
}

/**
 * Help Viewer's rows in the desktop's menu bar and their keys: File > Print; Undo to Select All on
 * the field with the keyboard or the page, Find and Speech on the page; View's table of contents and
 * text sizes; Go's history and Home.
 */
export function useHelpViewerMenus(options: HelpViewerMenusOptions) {
  const { isKey, within, page, canGoBack, canGoForward, sidebarOpen, textScale, onPage } = options;
  const { toolbarShown } = options;
  const range = useRef<Range | null>(null);
  useEffect(() => {
    const read = () => {
      const held = document.getSelection();
      if (!held?.anchorNode || !page.current?.contains(held.anchorNode)) {
        // With the keyboard outside the window, a menu is open and what was selected stands.
        if (page.current?.closest(".mac-window")?.contains(document.activeElement)) {
          range.current = null;
        }
        return;
      }
      range.current = held.isCollapsed ? null : held.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [page]);
  const article = () => page.current?.querySelector("article") ?? null;
  const restore = () => {
    const held = document.getSelection();
    if (!held || !range.current) return;
    held.removeAllRanges();
    held.addRange(range.current);
  };
  const commands = {
    ...options,
    restore,
    print: () => {
      const shown = article();
      if (shown) printEntry(shown, options.title);
    },
    copy: () => {
      restore();
      document.execCommand("copy");
      whenMenusClosed(document, restore);
    },
    selectAll: () => {
      const shown = article();
      if (!shown) return;
      const whole = document.createRange();
      whole.selectNodeContents(shown);
      range.current = whole;
      restore();
      whenMenusClosed(document, restore);
    },
    openFind: () => {
      options.find.open();
      whenMenusClosed(document, () => {
        options.find.fieldRef.current?.focus();
        options.find.fieldRef.current?.select();
      });
    },
    grow: (by: number) =>
      options.setTextScale(Math.min(TEXT_SCALES.length - 1, Math.max(0, options.textScale + by))),
  };
  const run = useRef(commands);
  run.current = commands;
  const restoreNow = useCallback(() => run.current.restore(), []);

  useEffect(() => {
    if (!isKey) return;
    return onMenuKeyEquivalents(window, {
      "command+[": () => run.current.step(-1),
      "command+]": () => run.current.step(1),
      "command+p": () => run.current.print(),
      "option+command+1": () => run.current.toggleSidebar(),
      "command+0": () => run.current.setTextScale(DEFAULT_TEXT_SCALE),
      "command+=": () => run.current.grow(1),
      "shift+command+=": () => run.current.grow(1),
      "command+-": () => run.current.grow(-1),
      "command+f": () => run.current.find.open(),
      "command+g": () => run.current.find.move(false),
      "shift+command+g": () => run.current.find.move(true),
      "command+e": () => run.current.find.fromSelection(),
      "command+j": () => run.current.find.jump(),
      "option+command+f": () => run.current.focusSearch(),
    });
  }, [isKey]);
  // Command-A on the page selects the page; the browser would select the whole desktop. In the find
  // bar's field it is the field's own.
  useEffect(() => {
    const element = page.current;
    if (!element) return;
    const press = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (!matchesMenuKeyEquivalent(event, "command+a")) return;
      event.preventDefault();
      run.current.selectAll();
    };
    element.addEventListener("keydown", press);
    return () => element.removeEventListener("keydown", press);
  }, [page]);

  const goMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="command+["
          disabled={!canGoBack}
          onClick={() => run.current.step(-1)}
        >
          Back
        </MenuItem>
        <MenuItem
          keyEquivalent="command+]"
          disabled={!canGoForward}
          onClick={() => run.current.step(1)}
        >
          Forward
        </MenuItem>
        <MenuItem onClick={() => run.current.home()}>Home</MenuItem>
      </>
    ),
    [canGoBack, canGoForward],
  );
  useDesktopAppMenu("help-viewer", "Go", goMenu, within);

  const fileMenu = useMemo(
    () => (
      <>
        <MenuItem disabled title={NO_TABS} keyEquivalent="command+t">
          New Tab
        </MenuItem>
        <MenuItem disabled title={NO_PAGE_SETUP} keyEquivalent="shift+command+p">
          Page Setup…
        </MenuItem>
        <MenuItem keyEquivalent="command+p" disabled={!onPage} onClick={() => run.current.print()}>
          Print…
        </MenuItem>
        <MenuSeparator />
      </>
    ),
    [onPage],
  );
  useDesktopAppMenu("help-viewer", "File", fileMenu, within);

  const editMenu = useMemo(
    () => (
      <>
        <PageSelectionHeld restore={restoreNow} />
        <EditRows
          nothing="Click in the search field, or select text on the page, first."
          selectAll={{
            enabled: onPage,
            title: "A list of search results has no page to select.",
            run: () => run.current.selectAll(),
          }}
          say={(message) => run.current.say(message)}
        />
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Find</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem keyEquivalent="command+f" onClick={() => run.current.openFind()}>
              Find…
            </MenuItem>
            <MenuItem keyEquivalent="command+g" onClick={() => run.current.find.move(false)}>
              Find Next
            </MenuItem>
            <MenuItem keyEquivalent="shift+command+g" onClick={() => run.current.find.move(true)}>
              Find Previous
            </MenuItem>
            <MenuItem keyEquivalent="command+e" onClick={() => run.current.find.fromSelection()}>
              Use Selection for Find
            </MenuItem>
            <MenuItem keyEquivalent="command+j" onClick={() => run.current.find.jump()}>
              Jump to Selection
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <PageSpeech page={page} range={range} />
      </>
    ),
    [onPage, page, restoreNow],
  );
  useDesktopAppMenu("help-viewer", "Edit", editMenu, within);

  const viewMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="option+command+1"
          disabled={!onPage}
          onClick={() => run.current.toggleSidebar()}
        >
          {sidebarOpen ? "Hide Table of Contents" : "Show Table of Contents"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+0"
          disabled={textScale === DEFAULT_TEXT_SCALE}
          onClick={() => run.current.setTextScale(DEFAULT_TEXT_SCALE)}
        >
          Actual Size
        </MenuItem>
        <MenuItem
          keyEquivalent="command++"
          disabled={textScale === TEXT_SCALES.length - 1}
          onClick={() => run.current.grow(1)}
        >
          Make Text Bigger
        </MenuItem>
        <MenuItem
          keyEquivalent="command+-"
          disabled={textScale === 0}
          onClick={() => run.current.grow(-1)}
        >
          Make Text Smaller
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => run.current.showToolbar(!run.current.toolbarShown)}>
          {toolbarShown ? "Hide Toolbar" : "Show Toolbar"}
        </MenuItem>
        <MenuItem onClick={() => run.current.customizeToolbar()}>Customize Toolbar…</MenuItem>
        <MenuSeparator />
      </>
    ),
    [onPage, sidebarOpen, textScale, toolbarShown],
  );
  useDesktopAppMenu("help-viewer", "View", viewMenu, within);

  return { copy: () => run.current.copy() };
}
