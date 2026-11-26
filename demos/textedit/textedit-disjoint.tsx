import { richTextFromHtml } from "macalicious/lib/rich-text";
import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * A disjoint selection in the rich text view: Command-drag adds a range, and Command-drag over a selected part takes it
 * out, as NSTextView does. A browser's editing host holds one range, so the browser's selection is the range made last
 * and the others are kept here and drawn as a CSS custom highlight, which leaves the document's own markup alone. A
 * Format command runs once per range; typing, Delete and Paste are repeated at each, leaving an insertion point in each
 * that the next key goes to as well; Copy and Cut take every range in document order, one line each.
 */

/** A place in a view's text as a count: of characters, of `br`, `img` and `hr`, and of blocks entered. */
export interface Span {
  start: number;
  end: number;
}

const BLOCKS = new Set(
  "DIV P LI UL OL TABLE TBODY THEAD TFOOT TR TD TH BLOCKQUOTE PRE H1 H2 H3 H4 H5 H6 HR".split(" "),
);
const ATOMS = new Set(["BR", "IMG", "HR"]);

const isText = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE;
const isAtom = (node: Node) => ATOMS.has(node.nodeName);

export function placeOf(root: Node, container: Node, offset: number): number {
  let count = 0;
  const visit = (node: Node): boolean => {
    if (isText(node)) {
      if (node === container) {
        count += offset;
        return true;
      }
      count += node.length;
      return false;
    }
    if (node !== root) count += (BLOCKS.has(node.nodeName) ? 1 : 0) + (isAtom(node) ? 1 : 0);
    const children = [...node.childNodes];
    if (node === container) {
      for (const child of children.slice(0, offset)) visit(child);
      return true;
    }
    return children.some(visit);
  };
  visit(root);
  return count;
}

function pointAt(root: Node, place: number, intoNext: boolean): [Node, number] {
  let count = 0;
  const visit = (node: Node): [Node, number] | null => {
    if (isText(node)) {
      const end = count + node.length;
      if (place >= count && (intoNext ? place < end : place <= end)) return [node, place - count];
      count = end;
      return null;
    }
    if (node !== root) count += (BLOCKS.has(node.nodeName) ? 1 : 0) + (isAtom(node) ? 1 : 0);
    if (isAtom(node)) return null;
    const children = [...node.childNodes];
    for (const [at, child] of children.entries()) {
      if (count === place && isAtom(child)) return [node, at];
      const found = visit(child);
      if (found) return found;
    }
    return count === place ? [node, children.length] : null;
  };
  return visit(root) ?? [root, root.childNodes.length];
}

export function spanOf(root: Node, range: Range): Span {
  return {
    start: placeOf(root, range.startContainer, range.startOffset),
    end: placeOf(root, range.endContainer, range.endOffset),
  };
}

export function rangeAt(root: Node, span: Span): Range {
  const range = (root.ownerDocument ?? (root as Document)).createRange();
  const collapsed = span.start === span.end;
  range.setStart(...pointAt(root, span.start, !collapsed));
  range.setEnd(...pointAt(root, span.end, false));
  return range;
}

/** The spans with `cut` taken out, and whether it touched any: then it deselects rather than adds. */
export function subtractSpan(
  spans: readonly Span[],
  cut: Span,
): { spans: Span[]; touched: boolean } {
  const left: Span[] = [];
  let touched = false;
  for (const span of spans) {
    if (cut.end <= span.start || cut.start >= span.end) {
      left.push(span);
      continue;
    }
    touched = true;
    if (span.start < cut.start) left.push({ start: span.start, end: cut.start });
    if (cut.end < span.end) left.push({ start: cut.end, end: span.end });
  }
  return { spans: left, touched };
}

const byPlace = (a: Span, b: Span) => a.start - b.start;
const sameSpan = (a: Span, b: Span) => a.start === b.start && a.end === b.end;

const HIGHLIGHT = "mac-textedit-disjoint";
const painted = new Map<object, readonly Range[]>();
function repaint() {
  if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
  const ranges = [...painted.values()].flat();
  if (ranges.length > 0) CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
  else CSS.highlights.delete(HIGHLIGHT);
}

const commandHeld = (event: MouseEvent) =>
  /Mac|iP/.test(navigator.platform) ? event.metaKey : event.ctrlKey;

function liveRange(node: HTMLElement): Range | null {
  const live = node.ownerDocument.getSelection();
  return live && live.rangeCount > 0 && node.contains(live.anchorNode) ? live.getRangeAt(0) : null;
}

/** What the browser said it was about to change, before it changed it. */
interface AskedEdit {
  type: string;
  data: string | null;
  html: string;
  text: string;
}

const DELETE_MOVES: Record<string, ["forward" | "backward", string]> = {
  deleteWordBackward: ["backward", "word"],
  deleteWordForward: ["forward", "word"],
  deleteSoftLineBackward: ["backward", "lineboundary"],
  deleteHardLineBackward: ["backward", "lineboundary"],
  deleteSoftLineForward: ["forward", "lineboundary"],
  deleteHardLineForward: ["forward", "lineboundary"],
};

/**
 * The edit to repeat at each other range; null when it belongs to one place only. A Transformation, Replace or
 * correction arrives as `insertText` with no `beforeinput`, since the browser fires none for `execCommand`.
 */
function repeatOf(document: Document, type: string, asked: AskedEdit | null): (() => void) | null {
  if (type === "insertLineBreak" || type === "insertParagraph") {
    return () => document.execCommand(type);
  }
  if (type.startsWith("delete") && type !== "deleteByDrag") {
    return () => {
      const selection = document.getSelection();
      const move = DELETE_MOVES[type];
      if (move && selection?.isCollapsed) selection.modify("extend", move[0], move[1]);
      document.execCommand(
        selection?.isCollapsed && type === "deleteContentForward" ? "forwardDelete" : "delete",
      );
    };
  }
  if (asked?.type !== type) return null;
  if (type === "insertText" && asked.data !== null) {
    const { data } = asked;
    return () => document.execCommand("insertText", false, data);
  }
  if (type === "insertFromPaste") {
    if (asked.html !== "") {
      const holder = document.createElement("div");
      holder.append(richTextFromHtml(asked.html, document));
      return () => document.execCommand("insertHTML", false, holder.innerHTML);
    }
    return () => document.execCommand("insertText", false, asked.text);
  }
  return null;
}

/** A collapsed range's rectangle, measured from the character beside it, as a browser gives a collapsed range none. */
function caretRect(range: Range, fallback: Element): { left: number; top: number; height: number } {
  const direct = range.getClientRects()[0];
  if (direct) return direct;
  const { startContainer: place, startOffset: at } = range;
  if (isText(place) && place.length > 0) {
    const beside = range.cloneRange();
    const forward = at < place.length;
    if (forward) beside.setEnd(place, at + 1);
    else beside.setStart(place, at - 1);
    const rect = beside.getClientRects()[0];
    if (rect) return { left: forward ? rect.left : rect.right, top: rect.top, height: rect.height };
  }
  const element = isText(place) ? place.parentElement : (place as Element);
  const box = (element ?? fallback).getBoundingClientRect();
  return { left: box.left, top: box.top, height: Math.min(box.height, 18) };
}

/** Inline elements around a range, so that a copied word keeps the style its paragraph gave it. */
function styledCopy(node: HTMLElement, range: Range): HTMLElement {
  const document = node.ownerDocument;
  let content: Node = range.cloneContents();
  let at: Node | null = range.commonAncestorContainer;
  while (at && at !== node) {
    if (at instanceof Element && !BLOCKS.has(at.nodeName)) {
      const wrap = at.cloneNode(false);
      wrap.appendChild(content);
      content = wrap;
    }
    at = at.parentNode;
  }
  const line = document.createElement("div");
  line.append(content);
  return line;
}

export interface DisjointCaret {
  left: number;
  top: number;
  height: number;
}

export function useDisjointSelection(
  editor: RefObject<HTMLElement | null>,
  remembered: RefObject<Range | null>,
  view: unknown,
) {
  const extras = useRef<Range[]>([]);
  const main = useRef<Span | null>(null);
  // Where the other ranges stood after the last change, as the browser may rebuild their nodes in the next one.
  const stood = useRef<{ spans: readonly Span[]; total: number } | null>(null);
  const gesture = useRef(false);
  const running = useRef(false);
  const steps = useRef(0);
  const undo = useRef<number[]>([]);
  const redo = useRef<number[]>([]);
  const typingRun = useRef(false);
  const asked = useRef<AskedEdit | null>(null);
  const [carets, setCarets] = useState<readonly DisjointCaret[]>([]);
  const owner = useRef({}).current;

  const paint = () => {
    const node = editor.current;
    painted.set(
      owner,
      extras.current.filter((range) => !range.collapsed),
    );
    repaint();
    const standing = extras.current.filter((range) => range.collapsed);
    const body = node?.closest(".mac-textedit-body");
    if (!node || !body || standing.length === 0) {
      setCarets((before) => (before.length === 0 ? before : []));
      return;
    }
    const box = body.getBoundingClientRect();
    setCarets(
      standing.map((range) => {
        const rect = caretRect(range, node);
        return {
          left: rect.left - box.left + body.scrollLeft,
          top: rect.top - box.top + body.scrollTop,
          height: rect.height,
        };
      }),
    );
  };

  const drop = () => {
    extras.current = [];
    main.current = null;
    typingRun.current = false;
    paint();
  };

  const select = (node: HTMLElement, span: Span) => {
    const range = rangeAt(node, span);
    const live = node.ownerDocument.getSelection();
    live?.removeAllRanges();
    live?.addRange(range);
    remembered.current = range.cloneRange();
  };

  const restore = (node: HTMLElement, others: readonly Span[], last: Span) => {
    const kept = others.filter((span) => !sameSpan(span, last));
    extras.current = kept.map((span) => rangeAt(node, span));
    main.current = kept.length > 0 ? last : null;
    stood.current = { spans: kept, total: placeOf(node, node, node.childNodes.length) };
    select(node, last);
    paint();
  };

  const counted = (work: () => void): number => {
    running.current = true;
    steps.current = 0;
    try {
      work();
    } finally {
      running.current = false;
    }
    return steps.current;
  };

  const record = (count: number, typing: boolean) => {
    const run = typing && typingRun.current ? undo.current.pop() : undefined;
    undo.current.push((run ?? 0) + count);
    redo.current = [];
    typingRun.current = typing;
  };

  /** Runs `act` at each of `spans`, last first; each ends as what the action left there, and `others` follow along. */
  const repeatAt = (
    node: HTMLElement,
    spans: readonly Span[],
    others: readonly Span[],
    act: () => void,
  ): { done: Span[]; others: Span[] } => {
    const order = spans
      .map((span, at) => ({ span, at }))
      .sort((a, b) => b.span.start - a.span.start);
    const done: Span[] = [...spans];
    const moved = others.map((span) => ({ ...span }));
    const finished: number[] = [];
    for (const { span, at } of order) {
      const before = placeOf(node, node, node.childNodes.length);
      select(node, span);
      act();
      const delta = placeOf(node, node, node.childNodes.length) - before;
      const live = liveRange(node);
      done[at] = live ? spanOf(node, live) : { start: span.start, end: span.start };
      for (const later of finished) {
        const shifted = done[later] as Span;
        done[later] = { start: shifted.start + delta, end: shifted.end + delta };
      }
      finished.push(at);
      for (const other of moved) {
        if (other.start > span.start) {
          other.start += delta;
          other.end += delta;
        }
      }
    }
    return { done, others: moved };
  };

  const writeClipboard = (node: HTMLElement, data: DataTransfer) => {
    const ranges = [...extras.current];
    const live = main.current;
    if (live) ranges.push(rangeAt(node, live));
    const spans = ranges.map((range) => spanOf(node, range)).sort(byPlace);
    const document = node.ownerDocument;
    const selection = document.getSelection();
    const holder = document.createElement("div");
    const lines: string[] = [];
    for (const span of spans) {
      if (span.start === span.end) continue;
      const range = rangeAt(node, span);
      selection?.removeAllRanges();
      selection?.addRange(range);
      lines.push(selection?.toString() ?? range.toString());
      holder.append(styledCopy(node, range));
    }
    if (live) select(node, live);
    data.setData("text/plain", lines.join("\n"));
    data.setData("text/html", holder.innerHTML);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new view (session, plain) is a new element, and every other name here is a ref or a function of refs
  useEffect(() => {
    const node = editor.current;
    if (!node) return;
    const document = node.ownerDocument;

    const finishGesture = () => {
      document.removeEventListener("pointerup", finishGesture, true);
      document.removeEventListener("pointercancel", finishGesture, true);
      if (!gesture.current) return;
      gesture.current = false;
      const existing = extras.current.map((range) => spanOf(node, range));
      if (existing.length === 0) {
        main.current = null;
        return;
      }
      const live = liveRange(node);
      const made = live ? spanOf(node, live) : null;
      const sorted = [...existing].sort(byPlace);
      if (!made || made.start === made.end) {
        const last = existing.at(-1) as Span;
        restore(node, existing.slice(0, -1), last);
        return;
      }
      const { spans, touched } = subtractSpan(sorted, made);
      if (!touched) {
        restore(node, existing, made);
      } else {
        const last = spans.at(-1) ?? { start: made.start, end: made.start };
        restore(node, spans.slice(0, -1), last);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!commandHeld(event)) {
        drop();
        return;
      }
      const live = liveRange(node);
      extras.current = extras.current.filter((range) => !range.collapsed);
      if (live && !live.collapsed) {
        extras.current.push(live.cloneRange());
        // The browser would start dragging the text, were the press inside what it has selected.
        document.getSelection()?.collapseToEnd();
      }
      gesture.current = true;
      paint();
      document.addEventListener("pointerup", finishGesture, true);
      document.addEventListener("pointercancel", finishGesture, true);
    };

    const onSelectionChange = () => {
      if (gesture.current || !main.current) return;
      const live = liveRange(node);
      if (live && !sameSpan(spanOf(node, live), main.current)) drop();
    };

    const onBeforeInput = (event: InputEvent) => {
      asked.current = {
        type: event.inputType,
        data: event.data,
        html: event.dataTransfer?.getData("text/html") ?? "",
        text: event.dataTransfer?.getData("text/plain") ?? event.data ?? "",
      };
    };

    const onInput = (event: Event) => {
      const { inputType, isComposing } = event as InputEvent;
      if (running.current) {
        steps.current += 1;
        return;
      }
      const was = asked.current;
      asked.current = null;
      if (!main.current) {
        undo.current = [];
        redo.current = [];
        typingRun.current = false;
        return;
      }
      if (isComposing) return;
      const act = repeatOf(document, inputType, was);
      const live = liveRange(node);
      const before = main.current;
      const standing = stood.current;
      if (!act || !live || !standing) {
        drop();
        return;
      }
      const delta = placeOf(node, node, node.childNodes.length) - standing.total;
      const spans = standing.spans.map((span) =>
        span.start >= before.end ? { start: span.start + delta, end: span.end + delta } : span,
      );
      const repeat = () => {
        const caret = liveRange(node);
        if (!caret) {
          drop();
          return;
        }
        const result = { done: spans, others: [spanOf(node, caret)] };
        const count = counted(() => {
          const made = repeatAt(node, spans, result.others, act);
          result.done = made.done;
          result.others = made.others;
        });
        restore(node, result.done, result.others[0] as Span);
        record(count + 1, inputType === "insertText");
      };
      // The browser ignores `execCommand` called while its own `execCommand` is firing this event.
      if (was) repeat();
      else queueMicrotask(repeat);
    };

    const onCopy = (event: ClipboardEvent) => {
      if (!main.current || !event.clipboardData) return;
      event.preventDefault();
      writeClipboard(node, event.clipboardData);
    };

    const onCut = (event: ClipboardEvent) => {
      const last = main.current;
      if (!last || !event.clipboardData) return;
      event.preventDefault();
      writeClipboard(node, event.clipboardData);
      if (!node.isContentEditable) return;
      const spans = [...extras.current.map((range) => spanOf(node, range)), last];
      const result = { done: spans };
      const count = counted(() => {
        result.done = repeatAt(node, spans, [], () => document.execCommand("delete")).done;
      });
      restore(node, result.done.slice(0, -1), result.done.at(-1) as Span);
      record(count, false);
    };

    const onCompositionStart = () => {
      if (main.current) drop();
    };

    const onScroll = () => {
      if (extras.current.some((range) => range.collapsed)) paint();
    };

    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (extras.current.some((range) => range.collapsed)) paint();
          });
    resize?.observe(node);
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("beforeinput", onBeforeInput);
    node.addEventListener("input", onInput);
    node.addEventListener("copy", onCopy);
    node.addEventListener("cut", onCut);
    node.addEventListener("compositionstart", onCompositionStart);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      resize?.disconnect();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("beforeinput", onBeforeInput);
      node.removeEventListener("input", onInput);
      node.removeEventListener("copy", onCopy);
      node.removeEventListener("cut", onCut);
      node.removeEventListener("compositionstart", onCompositionStart);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerup", finishGesture, true);
      document.removeEventListener("pointercancel", finishGesture, true);
      gesture.current = false;
      undo.current = [];
      redo.current = [];
      drop();
      painted.delete(owner);
      repaint();
    };
  }, [view]);

  return {
    carets,
    /** Runs `action` with the browser's selection on each range in turn, or once when there is one range. */
    each(action: () => void) {
      const node = editor.current;
      const last = main.current;
      if (!node || !last) {
        action();
        return;
      }
      const active = node.ownerDocument.activeElement;
      const others = extras.current.map((range) => spanOf(node, range));
      const count = counted(() => {
        for (const span of [...others, last].sort(byPlace).reverse()) {
          select(node, span);
          action();
        }
      });
      restore(node, others, last);
      if (count > 0) record(count, false);
      if (active instanceof HTMLElement && active !== node && active.isConnected) {
        active.focus({ preventScroll: true });
      }
    },
    /** Undo or Redo of one change made at several ranges: whether there was one. */
    step(way: "undo" | "redo"): boolean {
      const node = editor.current;
      const from = way === "undo" ? undo.current : redo.current;
      const count = from.pop();
      if (!node || count === undefined) return false;
      drop();
      counted(() => {
        for (let at = 0; at < count; at += 1) node.ownerDocument.execCommand(way);
      });
      (way === "undo" ? redo.current : undo.current).push(count);
      return true;
    },
  };
}
