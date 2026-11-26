"use client";

import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import "./notes-find.css";

/*
 * Find, and Replace where the text can take it, in the text of an editor (Notes, TextEdit, Stickies):
 * the bar above the text, Find Next and Previous, Use Selection for Find and Jump to Selection. The
 * text is an editable element or a plain text document's text area. Every match in an editable
 * element is tinted through the CSS Custom Highlight API where the browser has it; the count and the
 * commands work without it. The selection moves to a match only when the text has the keyboard or a
 * command leaves the field, since a selection set while the field is being typed in would take the
 * keyboard from it. A replacement is the browser's own insertText, so Undo takes it back.
 */

/** A match: a range of an editable element, or the offsets in a text area. */
type Match = Range | readonly [number, number];

const isArea = (root: Element | null | undefined): root is HTMLTextAreaElement =>
  root instanceof HTMLTextAreaElement;

/** Where `query` is in `text`, whatever the case, in order and not overlapping. */
function offsets(text: string, query: string): number[] {
  if (query === "") return [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const found: number[] = [];
  for (
    let at = haystack.indexOf(needle);
    at >= 0;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    found.push(at);
  }
  return found;
}

/** The elements that start a line of text, as `readLines` reads a note. */
const LINE_ELEMENTS = /^(BR|DIV|P|H[1-6]|LI|UL|OL|TABLE|TBODY|TR|TD|TH|BLOCKQUOTE|PRE)$/;

/**
 * The ranges of `query` in the text of `root`, in document order, whatever the case. Lines are
 * parted by one line feed, so a match never runs from one line into the next unless `query` says
 * so, as the text of a selection over several lines does.
 */
export function findRanges(root: Node, query: string): Range[] {
  const document = root.ownerDocument;
  if (!document) return [];
  const segments: { node: Text; start: number }[] = [];
  let text = "";
  const breakLine = () => {
    if (text !== "" && !text.endsWith("\n")) text += "\n";
  };
  const walk = (parent: Node) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === 3) {
        segments.push({ node: child as Text, start: text.length });
        text += child.nodeValue ?? "";
      } else if (child.nodeType === 1) {
        const line = LINE_ELEMENTS.test(child.nodeName);
        if (line) breakLine();
        walk(child);
        if (line) breakLine();
      }
    }
  };
  walk(root);
  /** The text node and the offset in it of a position in the whole text. */
  const place = (position: number, ending: boolean): [Text, number] | null => {
    for (const { node, start } of segments) {
      const end = start + node.data.length;
      if (position >= start && (ending ? position <= end : position < end)) {
        return [node, position - start];
      }
    }
    return null;
  };
  const ranges: Range[] = [];
  for (const at of offsets(text, query)) {
    const from = place(at, false);
    const to = place(at + query.length, true);
    if (!from || !to) continue;
    const range = document.createRange();
    range.setStart(from[0], from[1]);
    range.setEnd(to[0], to[1]);
    ranges.push(range);
  }
  return ranges;
}

function matchesIn(root: HTMLElement | null | undefined, query: string): Match[] {
  if (!root) return [];
  if (isArea(root)) {
    return offsets(root.value, query).map((at) => [at, at + query.length] as const);
  }
  return findRanges(root, query);
}

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

function paint(all: readonly Match[], current: Match | undefined) {
  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined)
    ?.highlights;
  const Highlight = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown })
    .Highlight;
  if (!registry || !Highlight) return;
  const ranges = all.filter((match): match is Range => !Array.isArray(match));
  registry.set("mac-find", new Highlight(...ranges));
  registry.set(
    "mac-find-current",
    new Highlight(...(current && !Array.isArray(current) ? [current as Range] : [])),
  );
}

export interface TextFind {
  shown: boolean;
  /** Whether the bar shows the Replace row. */
  replacing: boolean;
  query: string;
  setQuery: (query: string) => void;
  replacement: string;
  setReplacement: (replacement: string) => void;
  /** How many matches there are, and which one is current (from 0; -1 for none). */
  count: number;
  index: number;
  /** Show the bar, with its Replace row when `replace`, and give its field the keyboard. */
  open: (replace?: boolean) => void;
  /** Hide the bar and leave the selection on the current match. */
  close: () => void;
  /** Move to the next match, or the one before, and select it in the text. */
  move: (backwards: boolean) => void;
  /** Replace the current match and move to the next. */
  replace: () => void;
  /** Replace every match, as one edit of the browser's history per match. */
  replaceAll: () => void;
  /** Search for the text selected in the editor, without showing the bar. */
  fromSelection: () => void;
  /** Bring the selection into view. */
  jump: () => void;
  fieldRef: { current: HTMLInputElement | null };
}

/**
 * The state of a find bar over the editor `editor()` gives, which may change with the document.
 * `content` names what the text holds now: when it changes, what was found is found again.
 */
export function useTextFind(
  editor: () => HTMLElement | null | undefined,
  content: string,
): TextFind {
  const [shown, setShown] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [query, setQueryState] = useState("");
  const [replacement, setReplacement] = useState("");
  const [count, setCount] = useState(0);
  const [index, setIndex] = useState(-1);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const current = useRef(-1);

  const refresh = (text: string, keep: number) => {
    const found = matchesIn(editor(), text);
    const at = found.length === 0 ? -1 : Math.min(Math.max(keep, 0), found.length - 1);
    current.current = at;
    setCount(found.length);
    setIndex(at);
    paint(found, found[at]);
    return { found, at };
  };

  const select = (match: Match | undefined) => {
    const root = editor();
    if (!match || !root) return;
    root.focus({ preventScroll: true });
    if (isArea(root)) {
      const [from, to] = match as readonly [number, number];
      root.setSelectionRange(from, to);
      return;
    }
    const range = match as Range;
    const selection = root.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (range.startContainer.parentElement ?? root).scrollIntoView?.({ block: "nearest" });
  };

  useEffect(
    () => () => {
      paint([], undefined);
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: found again when the text changes
  useEffect(() => {
    if (shown) refresh(query, current.current);
  }, [content]);

  const replaceMatch = (match: Match | undefined) => {
    const root = editor();
    if (!match || !root) return false;
    select(match);
    return root.ownerDocument.execCommand("insertText", false, replacement);
  };

  return {
    shown,
    replacing,
    query,
    replacement,
    setReplacement,
    count,
    index,
    fieldRef,
    setQuery: (next) => {
      setQueryState(next);
      const { found, at } = refresh(next, 0);
      const match = found[at];
      if (match && !Array.isArray(match)) {
        (match as Range).startContainer.parentElement?.scrollIntoView?.({ block: "nearest" });
      }
    },
    open: (replace = false) => {
      setShown(true);
      setReplacing(replace);
      refresh(query, current.current);
      queueMicrotask(() => {
        fieldRef.current?.focus();
        fieldRef.current?.select();
      });
    },
    close: () => {
      const { found, at } = refresh(query, current.current);
      setShown(false);
      paint([], undefined);
      if (found[at]) select(found[at]);
      else editor()?.focus({ preventScroll: true });
    },
    move: (backwards) => {
      const { found } = refresh(query, current.current);
      if (found.length === 0) return;
      const at = (current.current + (backwards ? -1 : 1) + found.length) % found.length;
      current.current = at;
      setIndex(at);
      paint(found, found[at]);
      select(found[at]);
    },
    replace: () => {
      const { found, at } = refresh(query, current.current);
      if (!replaceMatch(found[at])) return;
      const after = refresh(query, at);
      if (after.found[after.at]) select(after.found[after.at]);
    },
    replaceAll: () => {
      const { found } = refresh(query, 0);
      // From the end, so that the matches not yet replaced stay where they were found.
      for (const match of [...found].reverse()) replaceMatch(match);
      refresh(query, 0);
    },
    fromSelection: () => {
      const root = editor();
      let text = "";
      if (isArea(root)) {
        text = root.value.slice(root.selectionStart, root.selectionEnd);
      } else if (root) {
        const selection = root.ownerDocument.getSelection();
        if (selection && root.contains(selection.anchorNode)) text = selection.toString();
      }
      if (text === "") return;
      setQueryState(text);
      refresh(text, 0);
    },
    jump: () => {
      const root = editor();
      if (isArea(root)) {
        root.focus();
        return;
      }
      const selection = root?.ownerDocument.getSelection();
      if (root && selection && selection.rangeCount > 0 && root.contains(selection.anchorNode)) {
        const at = selection.getRangeAt(0).startContainer;
        (at instanceof Element ? at : at.parentElement)?.scrollIntoView?.({ block: "center" });
      }
    },
  };
}

/** The bar above the text: the field, what it found, Previous, Next, Done, and Replace if shown. */
export function FindBar({ find }: { find: TextFind }) {
  if (!find.shown) return null;
  const keys = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      find.close();
    } else if (event.key === "Enter") {
      event.preventDefault();
      find.move(event.shiftKey);
    }
  };
  const found =
    find.query === "" ? "" : find.count === 0 ? "Not found" : `${find.index + 1} of ${find.count}`;
  return (
    <search className="mac-notes-find" aria-label="Find" onKeyDown={keys}>
      <SearchField
        aria-label="Find"
        placeholder="Find"
        size="small"
        value={find.query}
        onValueChange={find.setQuery}
        inputRef={find.fieldRef}
        style={{ flex: "1 1 auto" }}
      />
      <span role="status" className="mac-notes-find-count">
        {found}
      </span>
      <PushButton size="small" disabled={find.count === 0} onClick={() => find.move(true)}>
        Previous
      </PushButton>
      <PushButton size="small" disabled={find.count === 0} onClick={() => find.move(false)}>
        Next
      </PushButton>
      <PushButton size="small" onClick={find.close}>
        Done
      </PushButton>
      {find.replacing ? (
        <span className="mac-notes-find-replace">
          <SearchField
            aria-label="Replace"
            placeholder="Replace"
            size="small"
            searchMenu={false}
            value={find.replacement}
            onValueChange={find.setReplacement}
            style={{ flex: "1 1 auto" }}
          />
          <PushButton size="small" disabled={find.count === 0} onClick={find.replace}>
            Replace
          </PushButton>
          <PushButton size="small" disabled={find.count === 0} onClick={find.replaceAll}>
            All
          </PushButton>
        </span>
      ) : null}
    </search>
  );
}
