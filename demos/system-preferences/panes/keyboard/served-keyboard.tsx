"use client";

import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import { PaneAt, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { NO_SHORTCUT, NOTIFICATION_CENTER_KEY } from "./notification-center-key";
import { DEFAULT_REPLACEMENTS, REPLACEMENTS_KEY, readReplacements } from "./text-replacements";

/** The tab view's top-left corner in the window frame, as `keyboard.tsx` places it. */
const TABS = { x: 20, y: 63 };

const REPLACEMENT_COLUMNS: readonly TableViewColumn[] = [
  { id: "replace", title: "Replace", width: 180 },
  { id: "with", title: "With" },
];

/** The Text tab on the served desktop: replacements that work in the desktop's text. */
export function ServedText() {
  const [stored, setStored] = usePreference<unknown>(REPLACEMENTS_KEY, DEFAULT_REPLACEMENTS);
  const rules = readReplacements(stored);
  const [selected, setSelected] = useState<string | null>(null);
  const [replace, setReplace] = useState("");
  const [replacement, setReplacement] = useState("");
  const word = replace.trim();
  const add = () => {
    if (word === "" || replacement === "") return;
    setStored([
      ...rules.filter((rule) => rule.replace !== word),
      { replace: word, with: replacement },
    ]);
    setReplace("");
    setReplacement("");
    setSelected(word);
  };
  return (
    <PaneForm origin={TABS}>
      <PaneAt x={40} y={102}>
        <TableView
          aria-label="Text replacements"
          columns={REPLACEMENT_COLUMNS}
          rowCount={rules.length}
          getRowId={(row) => rules[row]?.replace ?? row}
          getRowLabel={(row) => rules[row]?.replace ?? ""}
          renderCell={(row, column) => rules[row]?.[column.id === "replace" ? "replace" : "with"]}
          value={selected === null ? [] : [selected]}
          onValueChange={(value) => setSelected(value[0] === undefined ? null : String(value[0]))}
          style={{ width: 588, height: 280 }}
        />
      </PaneAt>
      <PaneAt x={40} y={382}>
        <GradientButtonGroup aria-label="Replacements">
          <GradientButton glyph="add" aria-label="Add the replacement" onClick={add} />
          <GradientButton
            glyph="remove"
            aria-label="Remove the replacement"
            disabled={selected === null}
            onClick={() => {
              setStored(rules.filter((rule) => rule.replace !== selected));
              setSelected(null);
            }}
          />
        </GradientButtonGroup>
      </PaneAt>
      <PaneAt x={40} y={414}>
        <TextField
          aria-label="Replace"
          placeholder="Replace"
          spellCheck={false}
          value={replace}
          onChange={(event) => setReplace(event.target.value)}
          style={{ width: 170 }}
        />
      </PaneAt>
      <PaneAt x={220} y={414}>
        <TextField
          aria-label="With"
          placeholder="With"
          spellCheck={false}
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          style={{ width: 320 }}
        />
      </PaneAt>
      <PaneAt x={550} y={413}>
        <PushButton disabled={word === "" || replacement === ""} onClick={add}>
          Add
        </PushButton>
      </PaneAt>
      <PaneAt x={40} y={448} width={588}>
        <Label textStyle="small">
          A replacement happens when a space or punctuation follows the word, in the desktop's text
          fields and documents. Spelling and capitals are your browser's own.
        </Label>
      </PaneAt>
    </PaneForm>
  );
}

/** The keys the desktop's menu bar answers, as its menus show them. */
const SHORTCUTS: readonly (readonly [command: string, keys: string])[] = [
  ["Force Quit…", "⌥⌘⎋"],
  ["Lock Screen", "⌃⌘Q"],
  ["Log Out…", "⇧⌘Q"],
  ["Preferences…", "⌘,"],
  ["Empty Trash…", "⇧⌘⌫"],
  ["Hide", "⌘H"],
  ["Hide Others", "⌥⌘H"],
  ["Quit", "⌘Q"],
  ["New Window", "⌘N"],
  ["Close Window", "⌘W"],
  ["Minimize", "⌘M"],
  ["Enter Full Screen", "⌃⌘F"],
  ["Back", "⌘["],
  ["Forward", "⌘]"],
  ["Undo", "⌘Z"],
  ["Redo", "⇧⌘Z"],
  ["Cut", "⌘X"],
  ["Copy", "⌘C"],
  ["Paste", "⌘V"],
  ["Select All", "⌘A"],
];

const SHORTCUT_COLUMNS: readonly TableViewColumn[] = [
  { id: "command", title: "Command" },
  { id: "keys", title: "Keys", width: 90 },
];

/** The keys Show Notification Center can have: F3 and F4 are always Mission Control's and Launchpad's. */
const FREE_FUNCTION_KEYS = Array.from({ length: 13 }, (_, index) => `F${index + 1}`).filter(
  (key) => key !== "F3" && key !== "F4",
);

/**
 * The Shortcuts tab on the served desktop: the keys there are, which cannot be changed here, and
 * Show Notification Center, which has none until the person gives it one.
 */
export function ServedShortcuts() {
  const [notificationCenter, setNotificationCenter] = usePreference<string>(
    NOTIFICATION_CENTER_KEY,
    NO_SHORTCUT,
  );
  return (
    <PaneForm origin={TABS}>
      <PaneAt x={40} y={102}>
        <TableView
          aria-label="Keyboard shortcuts"
          columns={SHORTCUT_COLUMNS}
          rowCount={SHORTCUTS.length}
          getRowId={(row) => SHORTCUTS[row]?.[0] ?? row}
          getRowLabel={(row) => SHORTCUTS[row]?.[0] ?? ""}
          renderCell={(row, column) => SHORTCUTS[row]?.[column.id === "command" ? 0 : 1]}
          style={{ width: 588, height: 305 }}
        />
      </PaneAt>
      <PaneAt x={40} y={417}>
        <Label id="keyboard-show-notification-center">Show Notification Center:</Label>
      </PaneAt>
      <PaneAt x={210} y={414}>
        <PopUpButton
          aria-labelledby="keyboard-show-notification-center"
          value={notificationCenter}
          onValueChange={(next) => setNotificationCenter(String(next))}
          style={{ width: 90 }}
        >
          <PopUpButtonItem value={NO_SHORTCUT}>{NO_SHORTCUT}</PopUpButtonItem>
          {FREE_FUNCTION_KEYS.map((key) => (
            <PopUpButtonItem key={key} value={key}>
              {key}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </PaneAt>
      <PaneAt x={40} y={448} width={588}>
        <Label textStyle="small">
          The keys of this desktop's menus cannot be changed. On a computer that is not a Mac,
          Control stands for Command, and the browser keeps some keys for itself.
        </Label>
      </PaneAt>
    </PaneForm>
  );
}

/** The Input Sources tab: what a page can say about what belongs to the computer. */
export function ServedStatement() {
  return (
    <PaneForm origin={TABS}>
      <PaneAt x={82.5} y={113} width={500}>
        <Label>
          {`Your computer chooses the input source, and this desktop's text fields take what it types. A web page cannot add or switch input sources. Your browser asks for pages in: ${navigator.languages.join(", ")}.`}
        </Label>
      </PaneAt>
    </PaneForm>
  );
}
