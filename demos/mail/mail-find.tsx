"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { ScopeBar, ScopeBarActions } from "macalicious/scope-bar";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

/** The names `::highlight()` finds in mail.css. */
const MATCHES = "mail-find";
const CURRENT = "mail-find-current";

/**
 * `text` in one case, with the source offsets each folded unit came from. It folds one character at
 * a time because lowering a whole string changes offsets ("İ" lowers to two units) and spells a
 * sigma by its neighbours, so ς and σ are also folded to one.
 */
function folded(text: string) {
  let held = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  for (const character of text) {
    const lower = character.toLowerCase().replace(/ς/g, "σ");
    for (let unit = 0; unit < lower.length; unit += 1) {
      starts.push(at);
      ends.push(at + character.length);
    }
    held += lower;
    at += character.length;
  }
  return { held, starts, ends };
}

/**
 * Every place `text` stands under `root` as it reads, in any case: `fer<b>ry</b>` holds "ferry", and
 * two lines or blocks do not run together. How an element is laid out says which, whatever its tag:
 * `root` must be in the document.
 */
export function findRanges(root: Node, text: string): Range[] {
  const wanted = folded(text).held;
  if (wanted === "") return [];
  const document = root.ownerDocument ?? (root as Document);
  let held = "";
  // Where each unit of `held` came from; a line's end came from nowhere.
  const places: ({ node: Node; start: number; end: number } | null)[] = [];
  const lineEnd = () => {
    held += "\n";
    places.push(null);
  };
  const read = (parent: Node) => {
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const piece = folded(node.nodeValue ?? "");
        // Under `pre` styles a newline or a carriage return in the text ends a line, as in a plain
        // text message; elsewhere it reads as a space. Where the style collapses white space a run
        // of it reads as one, across text nodes too, and none at the start of a line; where it
        // preserves it, each stands as itself.
        const { whiteSpace } = getComputedStyle(parent as Element);
        const lines = /^(pre|break-spaces)/.test(whiteSpace);
        const preserved = lines && whiteSpace !== "pre-line";
        piece.starts.forEach((start, unit) => {
          const character = piece.held[unit] as string;
          const place = { node, start, end: piece.ends[unit] as number };
          if (lines && /[\n\r]/.test(character)) {
            lineEnd();
          } else if (preserved || !/[ \t\n\r\f]/.test(character)) {
            held += character;
            places.push(place);
          } else if (held !== "" && !/[ \n]/.test(held.at(-1) as string)) {
            held += " ";
            places.push(place);
          }
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const { display } = getComputedStyle(node as Element);
        if (display === "none") continue;
        const inline =
          (node as Element).tagName !== "BR" && /^(inline|contents|ruby)/.test(display);
        if (!inline) lineEnd();
        read(node);
        if (!inline) lineEnd();
      }
    }
  };
  read(root);
  const ranges: Range[] = [];
  for (let at = held.indexOf(wanted); at >= 0; at = held.indexOf(wanted, at + wanted.length)) {
    const spanned = places.slice(at, at + wanted.length);
    if (spanned.includes(null)) continue;
    const first = spanned[0];
    const last = spanned.at(-1);
    if (!first || !last) continue;
    const range = document.createRange();
    range.setStart(first.node, first.start);
    range.setEnd(last.node, last.end);
    ranges.push(range);
  }
  return ranges;
}

const NO_RANGES: readonly Range[] = [];

/** What each open reader has marked: a page has one highlight of each name, shared among them. */
const marks = new Map<object, { all: readonly Range[]; current: Range | undefined }>();

/** Marks one reader's ranges in the page, where the browser has CSS custom highlights. */
function paint(reader: object, all: readonly Range[], current: Range | undefined) {
  if (all.length > 0) marks.set(reader, { all, current });
  else marks.delete(reader);
  if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
  const held = [...marks.values()];
  CSS.highlights.set(MATCHES, new Highlight(...held.flatMap((each) => each.all)));
  CSS.highlights.set(
    CURRENT,
    new Highlight(...held.flatMap((each) => (each.current ? [each.current] : []))),
  );
}

const reveal = (range: Range | undefined) => {
  const start = range?.startContainer;
  const element = start instanceof Element ? start : start?.parentElement;
  const box = range?.getBoundingClientRect?.();
  let view = element ?? null;
  while (view && view.scrollHeight <= view.clientHeight) view = view.parentElement;
  if (!box || !view) {
    element?.scrollIntoView?.({ block: "nearest" });
    return;
  }
  // The match itself: a paragraph taller than the pane holds matches its own scroll would not show.
  const shown = view.getBoundingClientRect();
  if (box.top < shown.top) view.scrollTop -= shown.top - box.top;
  else if (box.bottom > shown.bottom) view.scrollTop += box.bottom - shown.bottom;
};

/** What Edit > Find runs, on the text in the pane. */
export interface MailFindCommands {
  find: () => void;
  next: () => void;
  previous: () => void;
  findSelection: () => void;
  jump: () => void;
}

/**
 * Find in a message: Edit > Find opens a bar over the text, every match is marked, and Find Next and
 * Find Previous step through them. `pane` holds the text searched; what changes in it (another
 * message selected, its text loaded) is searched again.
 */
export function useMailFind(pane: RefObject<HTMLElement | null>): {
  commands: MailFindCommands;
  bar: React.ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [at, setAt] = useState(0);
  const [ranges, setRanges] = useState<readonly Range[]>([]);
  const field = useRef<HTMLInputElement>(null);
  const reader = useRef({}).current;
  const shown = open ? ranges : NO_RANGES;

  const search = useCallback(() => {
    const root = pane.current;
    setRanges(root && open ? findRanges(root, text) : []);
  }, [pane, open, text]);

  useEffect(() => {
    search();
    const root = pane.current;
    if (!root || !open) return;
    const observer = new MutationObserver(search);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pane, open, search]);

  const place = shown.length > 0 ? Math.min(at, shown.length - 1) : 0;
  const current = shown[place];
  useEffect(() => {
    paint(reader, shown, current);
    reveal(current);
  }, [reader, shown, current]);
  useEffect(
    () => () => {
      paint(reader, NO_RANGES, undefined);
    },
    [reader],
  );

  const step = (by: number) => {
    setOpen(true);
    if (shown.length > 0) setAt((place + by + shown.length) % shown.length);
  };
  const close = () => {
    setOpen(false);
    setAt(0);
  };
  const commands: MailFindCommands = {
    find: () => {
      setOpen(true);
      queueMicrotask(() => {
        field.current?.focus();
        field.current?.select();
      });
    },
    next: () => step(1),
    previous: () => step(-1),
    findSelection: () => {
      const words = document.getSelection()?.toString().trim() ?? "";
      if (words === "") return;
      setText(words);
      setAt(0);
      setOpen(true);
    },
    jump: () => {
      const selection = document.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        reveal(selection.getRangeAt(0));
      } else reveal(current);
    },
  };

  const bar = open ? (
    <ScopeBar surface="toolbar" size="small" className="mac-mail-find">
      <ToolbarSearchField
        inputRef={field}
        aria-label="Find in Message"
        placeholder="Find"
        value={text}
        autoFocus
        onValueChange={(next) => {
          setText(next);
          setAt(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          } else if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        style={{ width: 200 }}
      />
      <Label role="status" textStyle="small" color="secondary">
        {text === "" ? "" : shown.length === 0 ? "Not found" : `${place + 1} of ${shown.length}`}
      </Label>
      <ScopeBarActions>
        <PushButton size="small" aria-label="Find Previous" onClick={() => step(-1)}>
          ‹
        </PushButton>
        <PushButton size="small" aria-label="Find Next" onClick={() => step(1)}>
          ›
        </PushButton>
        <PushButton size="small" onClick={close}>
          Done
        </PushButton>
      </ScopeBarActions>
    </ScopeBar>
  ) : null;

  return { commands, bar };
}
