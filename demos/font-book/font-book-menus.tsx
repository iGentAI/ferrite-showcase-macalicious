"use client";

import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useMemo, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { type EditMenuTarget, EditorEditItems } from "../notes/notes-edit-menu";

/** The four views of the preview pane, in the order of the toolbar's segmented control. */
export type FontBookView = "sample" | "repertoire" | "custom" | "info";

/** What the menu bar's rows do. They are read when one is chosen, so they act on the window now. */
export interface FontBookMenuCommands {
  newCollection: () => void;
  newSmartCollection: () => void;
  newLibrary: () => void;
  restoreStandardFonts: () => void;
  customizeToolbar: () => void;
  editSmartCollection: () => void;
  addFonts: () => void;
  toggleEnabled: () => void;
  selectAllFonts: () => void;
  /** The Delete key: the fonts selected, or the collection while the sidebar has the keyboard. */
  deleteKey: () => void;
  remove: () => void;
  deleteCollection: () => void;
  findFonts: () => void;
  setView: (view: FontBookView) => void;
  toggleInfo: () => void;
  fit: () => void;
  bigger: () => void;
  smaller: () => void;
  toggleCollections: () => void;
  toggleFonts: () => void;
  print: () => void;
  validateFont: () => void;
  validateFile: () => void;
  exportFonts: () => void;
  lookForDuplicates: () => void;
  resolveDuplicates: () => void;
  toggleToolbar: () => void;
  /** The Custom view's text while it is shown, for Undo, Cut, Copy, Paste and Select All. */
  customText: () => EditMenuTarget | null;
}

/** What the rows show. */
export interface FontBookMenuStatus {
  view: FontBookView;
  /** "Disable “Courier” Family", or "Enable …" for a family that is off. */
  enableTitle: string;
  canToggleEnabled: boolean;
  /** "Remove “Courier” from “Mine”": what Delete does to the selected fonts now. */
  removeTitle: string;
  canRemove: boolean;
  canDeleteCollection: boolean;
  /** Whether the collection selected is a smart one the person made. */
  canEditSmart: boolean;
  canExport: boolean;
  /** Whether there is a drive to read files from: without one nothing can be a duplicate. */
  hasDrive: boolean;
  canFit: boolean;
  canBigger: boolean;
  canSmaller: boolean;
  collectionsShown: boolean;
  fontsShown: boolean;
  toolbarShown: boolean;
}

const VIEW_ROWS: readonly [view: FontBookView, title: string, key: string][] = [
  ["sample", "Sample", "command+1"],
  ["repertoire", "Repertoire", "command+2"],
  ["custom", "Custom", "command+3"],
];

/**
 * Font Book's File, Edit and View menus in the desktop's menu bar, and their keys while the window
 * is key. Nothing answers until the library has loaded (`loading`), as the window's controls are
 * inert until then.
 */
export function useFontBookMenus({
  within,
  isKey,
  loading,
  commands,
  status,
}: {
  /** An element of the window: its title bar. */
  within: Element | null;
  isKey: boolean;
  loading: boolean;
  commands: FontBookMenuCommands;
  status: FontBookMenuStatus;
}) {
  const now = useRef({ commands, status });
  now.current = { commands, status };
  const run = (take: (each: FontBookMenuCommands) => void) => () => take(now.current.commands);

  const {
    view,
    enableTitle,
    canToggleEnabled,
    removeTitle,
    canRemove,
    canDeleteCollection,
    canEditSmart,
    canExport,
    hasDrive,
    canFit,
    canBigger,
    canSmaller,
    collectionsShown,
    fontsShown,
    toolbarShown,
  } = status;
  const customShown = view === "custom";

  const fileMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+n" onClick={() => now.current.commands.newCollection()}>
          New Collection
        </MenuItem>
        <MenuItem
          keyEquivalent="option+command+n"
          onClick={() => now.current.commands.newSmartCollection()}
        >
          New Smart Collection…
        </MenuItem>
        <MenuItem
          keyEquivalent="option+command+l"
          onClick={() => now.current.commands.newLibrary()}
        >
          New Library
        </MenuItem>
        <MenuItem keyEquivalent="command+o" onClick={() => now.current.commands.addFonts()}>
          Add Fonts…
        </MenuItem>
        <MenuItem onClick={() => now.current.commands.restoreStandardFonts()}>
          Restore Standard Fonts…
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => now.current.commands.validateFont()}>Validate Font</MenuItem>
        <MenuItem onClick={() => now.current.commands.validateFile()}>Validate File…</MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!canExport} onClick={() => now.current.commands.exportFonts()}>
          Export Fonts…
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+p" onClick={() => now.current.commands.print()}>
          Print…
        </MenuItem>
      </>
    ),
    [canExport],
  );
  const editMenu = useMemo(
    () => (
      <>
        {customShown ? (
          <EditorEditItems target={() => now.current.commands.customText()} />
        ) : (
          <>
            {/* Nothing in a font list or a sample is text to edit: only the list's selection. */}
            <MenuItem disabled keyEquivalent="command+z">
              Undo
            </MenuItem>
            <MenuItem disabled keyEquivalent="shift+command+z">
              Redo
            </MenuItem>
            <MenuSeparator />
            <MenuItem disabled keyEquivalent="command+x">
              Cut
            </MenuItem>
            <MenuItem disabled keyEquivalent="command+c">
              Copy
            </MenuItem>
            <MenuItem disabled keyEquivalent="command+v">
              Paste
            </MenuItem>
            <MenuItem
              keyEquivalent="command+a"
              onClick={() => now.current.commands.selectAllFonts()}
            >
              Select All
            </MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuItem
          keyEquivalent="shift+command+d"
          disabled={!canToggleEnabled}
          onClick={() => now.current.commands.toggleEnabled()}
        >
          {enableTitle}
        </MenuItem>
        <MenuItem
          keyEquivalent="delete"
          disabled={!canRemove}
          onClick={() => now.current.commands.remove()}
        >
          {removeTitle}
        </MenuItem>
        <MenuItem
          disabled={!canDeleteCollection}
          onClick={() => now.current.commands.deleteCollection()}
        >
          Delete Collection
        </MenuItem>
        <MenuItem
          disabled={!canEditSmart}
          onClick={() => now.current.commands.editSmartCollection()}
        >
          Edit Smart Collection…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+l"
          disabled={!hasDrive}
          onClick={() => now.current.commands.lookForDuplicates()}
        >
          Look for Enabled Duplicates…
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+l"
          disabled={!hasDrive}
          onClick={() => now.current.commands.resolveDuplicates()}
        >
          Resolve Duplicates
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Find</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem
              keyEquivalent="option+command+f"
              onClick={() => now.current.commands.findFonts()}
            >
              Search
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
      </>
    ),
    [
      customShown,
      canToggleEnabled,
      enableTitle,
      canRemove,
      removeTitle,
      canDeleteCollection,
      canEditSmart,
      hasDrive,
    ],
  );
  const viewMenu = useMemo(
    () => (
      <>
        <MenuRadioGroup value={view}>
          {VIEW_ROWS.map(([value, title, keyEquivalent]) => (
            <MenuRadioItem
              key={value}
              value={value}
              keyEquivalent={keyEquivalent}
              onClick={() => now.current.commands.setView(value)}
            >
              {title}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+i" onClick={() => now.current.commands.toggleInfo()}>
          {view === "info" ? "Hide Font Info" : "Show Font Info"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!canFit} onClick={() => now.current.commands.fit()}>
          Fit
        </MenuItem>
        <MenuItem
          keyEquivalent="command+="
          disabled={!canBigger}
          onClick={() => now.current.commands.bigger()}
        >
          Bigger
        </MenuItem>
        <MenuItem
          keyEquivalent="command+-"
          disabled={!canSmaller}
          onClick={() => now.current.commands.smaller()}
        >
          Smaller
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => now.current.commands.toggleCollections()}>
          {collectionsShown ? "Hide Collections" : "Show Collections"}
        </MenuItem>
        <MenuItem onClick={() => now.current.commands.toggleFonts()}>
          {fontsShown ? "Hide Fonts" : "Show Fonts"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => now.current.commands.toggleToolbar()}>
          {toolbarShown ? "Hide Toolbar" : "Show Toolbar"}
        </MenuItem>
        <MenuItem disabled={!toolbarShown} onClick={() => now.current.commands.customizeToolbar()}>
          Customize Toolbar…
        </MenuItem>
      </>
    ),
    [view, canFit, canBigger, canSmaller, collectionsShown, fontsShown, toolbarShown],
  );

  useDesktopAppMenu("font-book", "File", loading ? null : fileMenu, within);
  useDesktopAppMenu("font-book", "Edit", loading ? null : editMenu, within);
  useDesktopAppMenu("font-book", "View", loading ? null : viewMenu, within);

  useWindowKeys(within, isKey && !loading, [
    { equivalent: "command+n", run: run((each) => each.newCollection()) },
    { equivalent: "option+command+n", run: run((each) => each.newSmartCollection()) },
    { equivalent: "option+command+l", run: run((each) => each.newLibrary()) },
    { equivalent: "command+o", run: run((each) => each.addFonts()) },
    { equivalent: "command+p", run: run((each) => each.print()) },
    {
      equivalent: "shift+command+d",
      run: () => {
        if (now.current.status.canToggleEnabled) now.current.commands.toggleEnabled();
      },
    },
    { equivalent: "option+command+f", run: run((each) => each.findFonts()) },
    {
      equivalent: "command+l",
      run: () => {
        if (now.current.status.hasDrive) now.current.commands.lookForDuplicates();
      },
    },
    {
      equivalent: "shift+command+l",
      run: () => {
        if (now.current.status.hasDrive) now.current.commands.resolveDuplicates();
      },
    },
    { equivalent: "command+a", run: run((each) => each.selectAllFonts()), notInText: true },
    { equivalent: "delete", run: run((each) => each.deleteKey()), notInText: true },
    { equivalent: "command+1", run: run((each) => each.setView("sample")) },
    { equivalent: "command+2", run: run((each) => each.setView("repertoire")) },
    { equivalent: "command+3", run: run((each) => each.setView("custom")) },
    { equivalent: "command+i", run: run((each) => each.toggleInfo()) },
    { equivalent: "command+=", run: run((each) => each.bigger()) },
    // Command-Plus is the same key with Shift held.
    { equivalent: "shift+command+=", run: run((each) => each.bigger()) },
    { equivalent: "command+-", run: run((each) => each.smaller()) },
  ]);
}
