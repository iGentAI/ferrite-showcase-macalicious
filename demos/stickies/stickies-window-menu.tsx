"use client";

import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { StickiesArrangement } from "./stickies-data";

export interface StickiesFileItemsProps {
  /** Whether another note can be kept: the server holds a limited number. */
  canAdd: boolean;
  onNewNote: () => void;
  onClose: () => void;
  onSaveAll: () => void;
  onImport: () => void;
  onExport: () => void;
  onPageSetup: () => void;
  onPrint: () => void;
  onPrintAll: () => void;
}

/** Stickies' own rows of the desktop's File menu. */
export function StickiesFileItems({
  canAdd,
  onNewNote,
  onClose,
  onSaveAll,
  onImport,
  onExport,
  onPageSetup,
  onPrint,
  onPrintAll,
}: StickiesFileItemsProps) {
  const full = "You have as many notes as Stickies keeps: close one first";
  return (
    <>
      <MenuItem
        keyEquivalent="command+n"
        disabled={!canAdd}
        title={canAdd ? undefined : full}
        onClick={onNewNote}
      >
        New Note
      </MenuItem>
      <MenuItem keyEquivalent="command+w" onClick={onClose}>
        Close
      </MenuItem>
      <MenuItem keyEquivalent="command+s" onClick={onSaveAll}>
        Save All
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+i"
        disabled={!canAdd}
        title={canAdd ? undefined : full}
        onClick={onImport}
      >
        Import Text…
      </MenuItem>
      <MenuItem onClick={onExport}>Export Text…</MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="shift+command+p" onClick={onPageSetup}>
        Page Setup…
      </MenuItem>
      <MenuItem keyEquivalent="command+p" onClick={onPrint}>
        Print Active Note
      </MenuItem>
      <MenuItem onClick={onPrintAll}>Print All Notes</MenuItem>
      <MenuSeparator />
    </>
  );
}

export interface StickiesWindowItemsProps {
  collapsed: boolean;
  floating: boolean;
  translucent: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onFloatingChange: (floating: boolean) => void;
  onTranslucentChange: (translucent: boolean) => void;
  onUseAsDefault: () => void;
  onArrange: (by: StickiesArrangement) => void;
}

/** Stickies' own rows of the desktop's Window menu, for the note used last. */
export function StickiesWindowItems({
  collapsed,
  floating,
  translucent,
  onCollapsedChange,
  onFloatingChange,
  onTranslucentChange,
  onUseAsDefault,
  onArrange,
}: StickiesWindowItemsProps) {
  return (
    <>
      <MenuItem keyEquivalent="command+m" onClick={() => onCollapsedChange(!collapsed)}>
        {collapsed ? "Expand" : "Collapse"}
      </MenuItem>
      <MenuCheckboxItem
        keyEquivalent="option+command+f"
        checked={floating}
        onCheckedChange={onFloatingChange}
      >
        Floating Window
      </MenuCheckboxItem>
      <MenuCheckboxItem
        keyEquivalent="option+command+t"
        checked={translucent}
        onCheckedChange={onTranslucentChange}
      >
        Translucent
      </MenuCheckboxItem>
      <MenuItem onClick={onUseAsDefault}>Use as Default</MenuItem>
      <Submenu>
        <SubmenuTrigger>Arrange By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem onClick={() => onArrange("color")}>Color</MenuItem>
          <MenuItem onClick={() => onArrange("content")}>Content</MenuItem>
          <MenuItem onClick={() => onArrange("date")}>Date</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
    </>
  );
}
