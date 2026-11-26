"use client";

import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { SpeechItems } from "../notes/notes-edit-menu";

/** The number in pasted text, or `null` when the text is not one number. */
export function parsePasted(text: string): number | null {
  let number = text.trim().replace(/[\s\u00a0\u202f]/g, "");
  // A comma before groups of three digits separates thousands; a lone other comma is a decimal point.
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(number)) number = number.replaceAll(",", "");
  else if (/^[-+]?\d*,\d+$/.test(number)) number = number.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(number)) return null;
  const value = Number(number);
  return Number.isFinite(value) ? value : null;
}

export interface EditCommands {
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  delete: () => void;
  selectAll: () => void;
}

/** The display's number, for Edit > Speech: a selection of it, or all of it. */
const displayTarget = (text: () => HTMLElement | null) => () => {
  const element = text();
  return element ? { element, restore: () => {}, editable: false, rich: false } : null;
};

export interface CalculatorEditItemsProps {
  commands: () => EditCommands;
  canUndo: boolean;
  canRedo: boolean;
  /** The display holds a number, and the page can reach the clipboard. */
  canCopy: boolean;
  /** The browser refused to let a menu read the clipboard; the keyboard's Paste still works. */
  pasteRefused: boolean;
  /** The display's text, which Edit > Speech speaks. */
  displayText: () => HTMLElement | null;
}

const pasteKey = () =>
  typeof navigator !== "undefined" && /Mac|iP/.test(navigator.platform) ? "⌘V" : "Ctrl+V";

/** Calculator's Edit menu, on the number in the display. */
export function CalculatorEditItems({
  commands,
  canUndo,
  canRedo,
  canCopy,
  pasteRefused,
  displayText,
}: CalculatorEditItemsProps) {
  return (
    <>
      <MenuItem keyEquivalent="command+z" disabled={!canUndo} onClick={() => commands().undo()}>
        Undo
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+z"
        disabled={!canRedo}
        onClick={() => commands().redo()}
      >
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+x" disabled={!canCopy} onClick={() => commands().cut()}>
        Cut
      </MenuItem>
      <MenuItem keyEquivalent="command+c" disabled={!canCopy} onClick={() => commands().copy()}>
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled={pasteRefused}
        onClick={() => commands().paste()}
      >
        Paste
      </MenuItem>
      {pasteRefused ? (
        <MenuItem disabled>
          {`This browser keeps the clipboard from menus: ${pasteKey()} still pastes`}
        </MenuItem>
      ) : null}
      <MenuItem onClick={() => commands().delete()}>Delete</MenuItem>
      <MenuItem keyEquivalent="command+a" onClick={() => commands().selectAll()}>
        Select All
      </MenuItem>
      <MenuSeparator />
      <SpeechItems target={displayTarget(displayText)} />
    </>
  );
}
