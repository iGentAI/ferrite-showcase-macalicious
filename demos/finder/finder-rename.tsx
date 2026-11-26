import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup } from "macalicious/dialog";
import { Label } from "macalicious/label";
import { observeResize } from "macalicious/lib/observe-resize";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { TextField } from "macalicious/text-field";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./finder.tokens.css";
import "./finder-dialogs.css";

/*
 * Renaming in Finder: one item in place, in a field over its own name, and several in Rename N
 * Items' dialog. `batchNames` is what that dialog does to the names.
 */

/** The elements a name is drawn in, in each of the views. */
const NAME_SELECTOR = ".mac-icon-view-label-text, .mac-finder-name-text";

/** The element that holds the name of the item at `element`: the name itself, or else the row. */
export const nameElementOf = (element: Element): Element =>
  element.querySelector(NAME_SELECTOR) ?? element;

/** Whether `target` is an item's name, which a second, slow click starts renaming. */
export const isItemName = (target: EventTarget): boolean =>
  target instanceof Element && target.closest(NAME_SELECTOR) !== null;

export interface FinderRenameFieldProps {
  /** The item's name now, which the field starts from. */
  name: string;
  /** Whether the item is a folder, whose whole name is selected. */
  folder: boolean;
  /** The element to stand over, found afresh each time: `null` hides the field. */
  locate: () => Element | null;
  /** The element that holds the views: the field is placed in it. */
  container: Element | null;
  /** Called with a new name, and whether a key ended the editing. Not for an empty or unchanged one. */
  onRename: (name: string, keyboard: boolean) => void;
  /** Called when the field is done; `keyboard` when a key ended it, so the window takes the keys. */
  onClose: (keyboard: boolean) => void;
}

/**
 * The field a name is edited in. Return and leaving the field keep the name, as on a Mac; Escape
 * keeps the old one. It follows its item as the view scrolls and the window changes size.
 */
export function FinderRenameField({
  name,
  folder,
  locate,
  container,
  onRename,
  onClose,
}: FinderRenameFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  const [frame, setFrame] = useState<{ left: number; top: number; width: number } | null>(null);
  const locating = useRef(locate);
  locating.current = locate;

  useLayoutEffect(() => {
    if (!container) return;
    let hidden: Element | null = null;
    const place = () => {
      const over = locating.current();
      if (over !== hidden) {
        hidden?.removeAttribute("data-finder-renaming");
        over?.setAttribute("data-finder-renaming", "");
        hidden = over;
      }
      const rect = over?.getBoundingClientRect();
      if (!rect) {
        setFrame(null);
        return;
      }
      const outer = container.getBoundingClientRect();
      setFrame({
        left: rect.left - outer.left + container.scrollLeft,
        top: rect.top - outer.top + container.scrollTop,
        width: rect.width,
      });
    };
    place();
    const stopObserving = observeResize(container, place);
    container.addEventListener("scroll", place, true);
    return () => {
      stopObserving();
      container.removeEventListener("scroll", place, true);
      hidden?.removeAttribute("data-finder-renaming");
    };
  }, [container]);

  const shown = frame !== null;
  useEffect(() => {
    const field = input.current;
    if (!shown || !field) return;
    field.focus({ preventScroll: true });
    // As Finder selects a name: the part before the extension.
    const dot = folder ? -1 : name.lastIndexOf(".");
    field.setSelectionRange(0, dot > 0 ? dot : name.length);
  }, [shown, folder, name]);

  function finish(keep: boolean, keyboard: boolean) {
    if (finished.current) return;
    finished.current = true;
    const typed = input.current?.value.trim() ?? "";
    if (keep && typed !== "" && typed !== name) onRename(typed, keyboard);
    onClose(keyboard);
  }

  if (!frame) return null;
  return (
    <TextField
      aria-label="Name"
      className="mac-finder-rename"
      size="small"
      inputRef={input}
      defaultValue={name}
      style={frame}
      onBlur={() => finish(true, false)}
      onKeyDown={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.stopPropagation();
        // An input method's own Return and Escape finish its composition, not the name. WebKit
        // reports composing as false for the keydown that ends one, with the key code 229.
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Enter") finish(true, true);
        else if (event.key === "Escape") finish(false, true);
      }}
    />
  );
}

/** What Rename N Items does to the names. */
export type BatchRule =
  | { mode: "replace"; find: string; replace: string }
  | { mode: "add"; text: string; where: "before" | "after" }
  | {
      mode: "format";
      format: "index" | "counter" | "date";
      where: "before" | "after";
      custom: string;
      start: number;
    };

/** An item to rename. */
export interface BatchItem {
  id: string;
  name: string;
  /** The folder it is in: two items of one folder cannot share a name. */
  parent: string;
  folder: boolean;
}

/** The new names, or why they cannot be used. */
export interface BatchResult {
  /** The items whose name changes. */
  changes: { id: string; name: string }[];
  /** The name the first item gets, for the dialog's example. */
  example: string;
  refusal?: string;
}

const two = (value: number) => String(value).padStart(2, "0");

/** The date part of Name and Date, in the form Finder writes it. */
const dateText = (at: Date) =>
  `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} at ${two(at.getHours())}.${two(at.getMinutes())}.${two(at.getSeconds())}`;

function stemOf(item: BatchItem): [string, string] {
  const dot = item.folder ? -1 : item.name.lastIndexOf(".");
  return dot > 0 ? [item.name.slice(0, dot), item.name.slice(dot)] : [item.name, ""];
}

function newStem(rule: BatchRule, stem: string, index: number, at: Date): string {
  if (rule.mode === "replace") {
    return rule.find === "" ? stem : stem.split(rule.find).join(rule.replace);
  }
  if (rule.mode === "add") {
    return rule.where === "before" ? `${rule.text}${stem}` : `${stem}${rule.text}`;
  }
  const number = rule.start + index;
  const mark =
    rule.format === "index"
      ? String(number)
      : rule.format === "counter"
        ? String(number).padStart(5, "0")
        : index === 0
          ? dateText(at)
          : `${dateText(at)} ${index + 1}`;
  const parts = rule.where === "before" ? [mark, rule.custom] : [rule.custom, mark];
  return parts.filter((part) => part !== "").join(" ");
}

/**
 * The names `rule` gives `items`, in order, each keeping its extension. Refused, with nothing
 * renamed, when a name would be empty or two items of one folder would share one.
 */
export function batchNames(items: readonly BatchItem[], rule: BatchRule, at: Date): BatchResult {
  const named = items.map((item, index) => {
    const [stem, extension] = stemOf(item);
    return { item, stem: newStem(rule, stem, index, at), extension };
  });
  const example = named[0] ? `${named[0].stem}${named[0].extension}` : "";
  const changes = named
    .map(({ item, stem, extension }) => ({ id: item.id, name: `${stem}${extension}` }))
    .filter(({ id, name }) => items.find((item) => item.id === id)?.name !== name);
  if (named.some(({ stem }) => stem.trim() === "")) {
    return { changes: [], example, refusal: "A name can’t be empty." };
  }
  const taken = new Set<string>();
  for (const { item, stem, extension } of named) {
    const key = `${item.parent}\n${stem}${extension}`.toLowerCase();
    if (taken.has(key)) {
      return { changes: [], example, refusal: `Two items would be named “${stem}${extension}”.` };
    }
    taken.add(key);
  }
  return { changes, example };
}

type Mode = BatchRule["mode"];

export interface FinderRenameItemsProps {
  /** The items to rename; empty closes the dialog. */
  items: readonly BatchItem[];
  /** Called by Rename with the names that change. */
  onRename: (changes: { id: string; name: string }[]) => void;
  /** Called by Cancel, Escape and Rename. */
  onClose: () => void;
  /** Where the keyboard goes when the dialog closes. */
  finalFocus?: Parameters<typeof DialogPopup>[0]["finalFocus"];
}

/** Rename N Items: Replace Text, Add Text or Format, with an example of the first new name. */
export function FinderRenameItems({
  items,
  onRename,
  onClose,
  finalFocus,
}: FinderRenameItemsProps) {
  const open = items.length > 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup title={`Rename ${items.length} Items`} width={460} finalFocus={finalFocus}>
        {open ? <RenameItemsForm items={items} onRename={onRename} onClose={onClose} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function RenameItemsForm({
  items,
  onRename,
  onClose,
}: Pick<FinderRenameItemsProps, "items" | "onRename" | "onClose">) {
  const [mode, setMode] = useState<Mode>("replace");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [text, setText] = useState("");
  const [where, setWhere] = useState<"before" | "after">("after");
  const [format, setFormat] = useState<"index" | "counter" | "date">("index");
  const [custom, setCustom] = useState("Item");
  const [start, setStart] = useState("1");
  const [at] = useState(() => new Date());

  const rule: BatchRule =
    mode === "replace"
      ? { mode, find, replace }
      : mode === "add"
        ? { mode, text, where }
        : { mode, format, where, custom, start: Number.parseInt(start, 10) || 0 };
  const result = batchNames(items, rule, at);

  const field = (label: string, value: string, change: (next: string) => void) => (
    <TextField
      aria-label={label}
      placeholder={label}
      className="mac-finder-batch-field"
      value={value}
      onChange={(event) => change(event.currentTarget.value)}
    />
  );
  const wherePopUp = (
    <PopUpButton
      aria-label="Where"
      value={where}
      onValueChange={(next) => setWhere(next as "before" | "after")}
    >
      <PopUpButtonItem value="after">after name</PopUpButtonItem>
      <PopUpButtonItem value="before">before name</PopUpButtonItem>
    </PopUpButton>
  );

  return (
    <form
      className="mac-finder-batch"
      onSubmit={(event) => {
        event.preventDefault();
        if (result.refusal) return;
        if (result.changes.length > 0) onRename(result.changes);
        onClose();
      }}
    >
      <PopUpButton
        aria-label="Rename Finder Items"
        value={mode}
        onValueChange={(next) => setMode(next as Mode)}
      >
        <PopUpButtonItem value="replace">Replace Text</PopUpButtonItem>
        <PopUpButtonItem value="add">Add Text</PopUpButtonItem>
        <PopUpButtonItem value="format">Format</PopUpButtonItem>
      </PopUpButton>
      {mode === "replace" ? (
        <>
          {field("Find", find, setFind)}
          {field("Replace with", replace, setReplace)}
        </>
      ) : mode === "add" ? (
        <>
          {field("Text to add", text, setText)}
          {wherePopUp}
        </>
      ) : (
        <>
          <PopUpButton
            aria-label="Name Format"
            value={format}
            onValueChange={(next) => setFormat(next as "index" | "counter" | "date")}
          >
            <PopUpButtonItem value="index">Name and Index</PopUpButtonItem>
            <PopUpButtonItem value="counter">Name and Counter</PopUpButtonItem>
            <PopUpButtonItem value="date">Name and Date</PopUpButtonItem>
          </PopUpButton>
          {wherePopUp}
          {field("Custom Format", custom, setCustom)}
          {format === "date" ? null : field("Start numbers at", start, setStart)}
        </>
      )}
      <Label textStyle="small" color="secondary">
        Example: {result.example}
      </Label>
      {result.refusal ? (
        <Label role="alert" textStyle="small" className="mac-finder-go-missing">
          {result.refusal}
        </Label>
      ) : null}
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton type="submit" disabled={result.refusal !== undefined}>
          Rename
        </DefaultButton>
      </DialogActions>
    </form>
  );
}
