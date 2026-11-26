"use client";

import { ScrollView } from "macalicious/scroll-view";
import {
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";
import { playAlert } from "../system-preferences/panes/sound/alert-sounds";
import { alertSoundSettings } from "../system-preferences/setting-effects";
import {
  type Cell,
  type CellStyle,
  charWidth,
  paletteColor,
  type TerminalColor,
  type TerminalPosition,
} from "./terminal-emulator";
import { encodeKey, matchesTerminalCommand } from "./terminal-keys";
import type { TerminalSession } from "./terminal-shell";

/** What the window asks of the screen it shows. */
export interface TerminalScreenHandle {
  focus: () => void;
  selectedText: () => string;
  clearSelection: () => void;
  selectAll: () => void;
  selectBetweenMarks: () => void;
  /** Selects the next match from the selection, or from the end. Answers whether it found one. */
  find: (query: string, direction: 1 | -1) => boolean;
  jumpToSelection: () => void;
  scroll: (where: "top" | "bottom" | "pageUp" | "pageDown" | "lineUp" | "lineDown") => void;
  jumpToMark: (direction: 1 | -1) => void;
  mark: (marked: boolean) => void;
}

export interface TerminalScreenProps {
  session: TerminalSession;
  /** The profile's font size, in points. */
  fontSize: number;
  /** The profile's font family; the system's monospaced font without one. */
  fontFamily?: string | null;
  /** The bell flashes the screen. @default true */
  visualBell?: boolean;
  /** The bell sounds the person's alert. @default false */
  audibleBell?: boolean;
  /** Whether this pane sets the terminal's size. */
  active: boolean;
  showMarks: boolean;
  optionAsMeta: boolean;
  /** Pointer or keyboard went into this pane. */
  onActivate?: () => void;
  /** A key press that may be a menu's. Answers whether it was. */
  onCommandKey?: (event: KeyboardEvent<HTMLElement>, hasSelection: boolean) => boolean;
  onSelectionChange?: (has: boolean) => void;
  ref?: Ref<TerminalScreenHandle>;
}

interface Selection {
  anchor: TerminalPosition;
  head: TerminalPosition;
  mode: "char" | "word" | "line";
  rectangular: boolean;
}

const PADDING = 2;

const comparePositions = (a: TerminalPosition, b: TerminalPosition) =>
  a.line - b.line || a.column - b.column;

function colorValue(color: TerminalColor): string {
  if (typeof color === "string") return color;
  return color < 16 ? `var(--mac-terminal-ansi-${color})` : paletteColor(color);
}

const styleCache = new WeakMap<CellStyle, CSSProperties>();

function cssOf(style: CellStyle): CSSProperties {
  const cached = styleCache.get(style);
  if (cached) return cached;
  const css: CSSProperties = {};
  let fg = style.fg === undefined ? undefined : colorValue(style.fg);
  let bg = style.bg === undefined ? undefined : colorValue(style.bg);
  if (style.inverse) {
    const swapped = bg ?? "var(--_background)";
    bg = fg ?? "var(--_foreground)";
    fg = swapped;
  }
  if (fg) css.color = fg;
  if (bg) css.backgroundColor = bg;
  if (style.bold) {
    css.fontWeight = "bold";
    if (!fg) css.color = "var(--_bold)";
  }
  if (style.faint) css.opacity = 0.5;
  if (style.italic) css.fontStyle = "italic";
  if (style.hidden) css.color = "transparent";
  const lines = [style.underline ? "underline" : "", style.strike ? "line-through" : ""]
    .filter((line) => line !== "")
    .join(" ");
  if (lines) css.textDecoration = lines;
  styleCache.set(style, css);
  return css;
}

/** One line of cells as elements: runs of a style, each wide character in a box of two cells. */
function runsOf(cells: readonly Cell[], cellWidth: number): ReactNode[] {
  const out: ReactNode[] = [];
  let text = "";
  let style: CellStyle | null = null;
  const flush = () => {
    if (!text) return;
    const key = out.length;
    out.push(
      style && Object.keys(style).length > 0 ? (
        <span key={key} style={cssOf(style)}>
          {text}
        </span>
      ) : (
        text
      ),
    );
    text = "";
  };
  for (const cell of cells) {
    if (cell.ch === "") continue;
    const first = String.fromCodePoint(cell.ch.codePointAt(0) ?? 32);
    if (charWidth(first) === 2) {
      flush();
      out.push(
        <span
          key={out.length}
          className="mac-terminal-wide"
          style={{ ...cssOf(cell.style), width: cellWidth * 2 }}
        >
          {cell.ch}
        </span>,
      );
      style = null;
      continue;
    }
    if (cell.style !== style) {
      flush();
      style = cell.style;
    }
    text += cell.ch;
  }
  flush();
  return out;
}

const wordChar = (ch: string | undefined) =>
  ch === "" || (ch !== undefined && ch !== " " && /[\p{L}\p{N}_./~:@%+=-]/u.test(ch));

const isApple = () =>
  typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);

/**
 * The fixed width of the profile's font, as the browser sets it, and a line height from its size
 * alone, so that a window holds the same rows whichever fallback font the system has.
 */
function useCellSize(element: HTMLElement | null, fontSize: number, fontFamily?: string | null) {
  const height = Math.ceil(fontSize * 1.18);
  const [width, setWidth] = useState(fontSize * 0.6);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the family changes what is measured.
  useLayoutEffect(() => {
    const measured = element?.getBoundingClientRect().width ?? 0;
    setWidth(measured > 0 ? measured / 100 : fontSize * 0.6);
  }, [element, fontSize, fontFamily]);
  return { width, height };
}

export function TerminalScreen({
  session,
  fontSize,
  fontFamily,
  visualBell = true,
  audibleBell = false,
  active,
  showMarks,
  optionAsMeta,
  onActivate,
  onCommandKey,
  onSelectionChange,
  ref,
}: TerminalScreenProps) {
  const { emulator } = session;
  const [measure, setMeasure] = useState<HTMLElement | null>(null);
  const cell = useCellSize(measure, fontSize, fontFamily);
  const viewport = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const following = useRef(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  /** The press in hand is on the selected text, and may become a drag of it. */
  const draggingText = useRef(false);
  const pressedPointer = useRef<number | null>(null);
  const [, setTick] = useState(0);
  const [bell, setBell] = useState(false);
  const composing = useRef(false);
  const dragging = useRef(false);

  // A change of the terminal is shown at the next frame, however many writes come before it.
  useEffect(() => {
    let frame = 0;
    const show = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setTick((tick) => tick + 1);
      });
    };
    const stop = session.subscribe(show);
    show();
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, [session]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    emulator.onBell = () => {
      if (audibleBell) {
        const { name, volume, muted } = alertSoundSettings();
        if (!muted) playAlert(name, volume);
      }
      if (!visualBell) return;
      setBell(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBell(false), 120);
    };
    return () => {
      clearTimeout(timer);
      emulator.onBell = () => {};
    };
  }, [audibleBell, emulator, visualBell]);

  const total = emulator.endLine - emulator.firstLine;
  const fromLine = emulator.firstLine;

  // The size of the terminal follows the pane that has the keyboard.
  const fitToPane = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    setViewHeight(element.clientHeight);
    if (!active || element.clientHeight === 0 || element.clientWidth === 0) return;
    const rows = Math.max(1, Math.floor(element.clientHeight / cell.height));
    const cols = Math.max(2, Math.floor((element.clientWidth - PADDING * 2) / cell.width));
    if (rows !== emulator.rows || cols !== emulator.cols) session.resize(rows, cols);
  }, [active, cell.height, cell.width, emulator, session]);

  useLayoutEffect(() => {
    fitToPane();
    const element = viewport.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fitToPane);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitToPane]);

  // Scrolled to the end, the view stays there as lines come; scrolled up, it stays where it is.
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && following.current) element.scrollTop = total * cell.height;
  });

  const onScroll = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    setScrollTop(element.scrollTop);
    following.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - cell.height / 2;
  }, [cell.height]);

  const positionAt = useCallback(
    (clientX: number, clientY: number): TerminalPosition => {
      const element = viewport.current;
      const box = element?.getBoundingClientRect();
      const x = clientX - (box?.left ?? 0) - PADDING;
      const y = clientY - (box?.top ?? 0) + (element?.scrollTop ?? 0);
      return {
        line: Math.max(
          fromLine,
          Math.min(fromLine + total - 1, fromLine + Math.floor(y / cell.height)),
        ),
        column: Math.max(0, Math.min(emulator.cols, Math.round(x / cell.width))),
      };
    },
    [cell.height, cell.width, emulator.cols, fromLine, total],
  );

  /** The cell under a point, as a program counts it. */
  const cellAt = useCallback(
    (clientX: number, clientY: number) => {
      const box = viewport.current?.getBoundingClientRect();
      return {
        column: Math.max(0, Math.floor((clientX - (box?.left ?? 0) - PADDING) / cell.width)),
        row: Math.max(0, Math.floor((clientY - (box?.top ?? 0)) / cell.height)),
      };
    },
    [cell.height, cell.width],
  );

  /** The selection's ends in reading order, widened to words or lines as it was made. */
  const bounds = useCallback(
    (current: Selection): { start: TerminalPosition; end: TerminalPosition } => {
      const [from, to] =
        comparePositions(current.anchor, current.head) <= 0
          ? [current.anchor, current.head]
          : [current.head, current.anchor];
      if (current.mode === "char") return { start: from, end: to };
      if (current.mode === "line") {
        let first = from.line;
        while (emulator.lineAt(first)?.wrapped && first > emulator.firstLine) first -= 1;
        let last = to.line;
        while (emulator.lineAt(last + 1)?.wrapped) last += 1;
        return { start: { line: first, column: 0 }, end: { line: last, column: emulator.cols } };
      }
      const cellsOf = (line: number) => emulator.lineAt(line)?.cells ?? [];
      let left = from.column;
      const startCells = cellsOf(from.line);
      if (wordChar(startCells[left]?.ch)) {
        while (left > 0 && wordChar(startCells[left - 1]?.ch)) left -= 1;
      }
      let right = to.column;
      const endCells = cellsOf(to.line);
      if (wordChar(endCells[right]?.ch)) {
        while (wordChar(endCells[right]?.ch)) right += 1;
      } else if (right < endCells.length) {
        right += 1;
      }
      return { start: { line: from.line, column: left }, end: { line: to.line, column: right } };
    },
    [emulator],
  );

  const selectedText = useCallback(() => {
    if (!selection) return "";
    const { start, end } = bounds(selection);
    if (!selection.rectangular) return emulator.textBetween(start, end);
    const left = Math.min(selection.anchor.column, selection.head.column);
    const right = Math.max(selection.anchor.column, selection.head.column);
    const lines: string[] = [];
    for (let line = start.line; line <= end.line; line += 1) {
      lines.push(emulator.lineText(line, left, right));
    }
    return lines.join("\n");
  }, [bounds, emulator, selection]);

  const has = selection !== null && comparePositions(selection.anchor, selection.head) !== 0;
  const hasSelection = has || (selection !== null && selection.mode !== "char");
  useEffect(() => onSelectionChange?.(hasSelection), [hasSelection, onSelectionChange]);

  const scrollToLine = useCallback(
    (line: number) => {
      const element = viewport.current;
      if (!element) return;
      const top = (line - fromLine) * cell.height;
      if (top < element.scrollTop || top + cell.height > element.scrollTop + element.clientHeight) {
        element.scrollTop = Math.max(0, top - element.clientHeight / 2);
      }
      following.current = false;
      onScroll();
    },
    [cell.height, fromLine, onScroll],
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus({ preventScroll: true }),
      selectedText,
      clearSelection: () => setSelection(null),
      selectAll: () =>
        setSelection({
          anchor: { line: emulator.firstLine, column: 0 },
          head: { line: emulator.endLine - 1, column: emulator.cols },
          mode: "char",
          rectangular: false,
        }),
      selectBetweenMarks: () => {
        const line = emulator.cursorLine;
        const from = emulator.lineAt(line)?.marked ? line : emulator.markBefore(line);
        if (from === undefined) return;
        const to = emulator.markAfter(from) ?? emulator.endLine;
        setSelection({
          anchor: { line: from, column: 0 },
          head: { line: to - 1, column: emulator.cols },
          mode: "char",
          rectangular: false,
        });
      },
      find: (query, direction) => {
        if (!query) return false;
        const start = selection ? bounds(selection) : null;
        const from =
          direction > 0
            ? (start?.end ?? { line: emulator.firstLine, column: 0 })
            : (start?.start ?? { line: emulator.endLine - 1, column: emulator.cols });
        const found = emulator.find(query, from, direction);
        if (!found) return false;
        setSelection({
          anchor: { line: found.line, column: found.start },
          head: { line: found.line, column: found.end },
          mode: "char",
          rectangular: false,
        });
        scrollToLine(found.line);
        return true;
      },
      jumpToSelection: () => {
        if (selection) scrollToLine(bounds(selection).start.line);
      },
      scroll: (where) => {
        const element = viewport.current;
        if (!element) return;
        const page = Math.max(cell.height, element.clientHeight - cell.height);
        if (where === "top") element.scrollTop = 0;
        else if (where === "bottom") element.scrollTop = element.scrollHeight;
        else if (where === "pageUp") element.scrollTop -= page;
        else if (where === "pageDown") element.scrollTop += page;
        else if (where === "lineUp") element.scrollTop -= cell.height;
        else element.scrollTop += cell.height;
        onScroll();
      },
      jumpToMark: (direction) => {
        const element = viewport.current;
        const from = element
          ? fromLine + Math.round(element.scrollTop / cell.height)
          : emulator.cursorLine;
        const line = direction > 0 ? emulator.markAfter(from) : emulator.markBefore(from);
        if (line === undefined || !element) return;
        element.scrollTop = (line - fromLine) * cell.height;
        onScroll();
      },
      mark: (marked) => emulator.setMark(emulator.cursorLine, marked),
    }),
    [bounds, cell.height, emulator, fromLine, onScroll, scrollToLine, selectedText, selection],
  );

  /** A press on the lines, not on the scroll bar beside them. */
  const onLines = (target: EventTarget) =>
    target instanceof Element && target.closest(".mac-terminal-lines") !== null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onActivate?.();
    if (event.button !== 0 || !onLines(event.target)) return;
    pressedPointer.current = event.pointerId;
  };

  const pressIsOnSelection = (x: number, y: number) => {
    if (!hasSelection || !selection) return false;
    const at = positionAt(x, y);
    const { start, end } = bounds(selection);
    if (selection.rectangular) {
      const left = Math.min(selection.anchor.column, selection.head.column);
      const right = Math.max(selection.anchor.column, selection.head.column);
      return at.line >= start.line && at.line <= end.line && at.column >= left && at.column < right;
    }
    return comparePositions(start, at) <= 0 && comparePositions(at, end) < 0;
  };

  // A selection starts here rather than at the pointer's press: only a mouse event has the count of
  // clicks (`detail`), which is 0 on a pointer event.
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !onLines(event.target)) return;
    // The first press on the selected text may become a drag of it, which the rest would stop; a
    // second or third press is a double or triple click, whose word or line it then selects.
    const onSelected =
      event.detail <= 1 && !event.shiftKey && pressIsOnSelection(event.clientX, event.clientY);
    draggingText.current = onSelected;
    (event.target as Element)
      .closest(".mac-terminal-lines")
      ?.setAttribute("draggable", String(onSelected));
    if (onSelected) return;
    if (pressedPointer.current !== null) {
      event.currentTarget.setPointerCapture?.(pressedPointer.current);
    }
    // Keeps the keyboard in the text area, where a press elsewhere in the screen would take it.
    event.preventDefault();
    input.current?.focus({ preventScroll: true });
    const position = positionAt(event.clientX, event.clientY);
    if (isApple() ? event.metaKey : event.ctrlKey) {
      const { text, columns } = emulator.lineWithColumns(position.line);
      for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
        const start = match.index ?? 0;
        const column = position.column;
        if (
          column >= (columns[start] as number) &&
          column <= (columns[start + match[0].length] as number)
        ) {
          const address = linkAddress(match[0]);
          if (address) openUrl(address, "terminal");
          return;
        }
      }
    }
    const clicks = Math.min(event.detail, 3);
    const mode = clicks === 3 ? "line" : clicks === 2 ? "word" : "char";
    if (event.shiftKey && selection) {
      setSelection({ ...selection, head: position });
    } else {
      const column =
        mode === "char" ? position.column : cellAt(event.clientX, event.clientY).column;
      const at = { line: position.line, column };
      setSelection({ anchor: at, head: at, mode, rectangular: event.altKey });
    }
    dragging.current = true;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const element = viewport.current;
    const box = element?.getBoundingClientRect();
    if (element && box) {
      if (event.clientY < box.top) element.scrollTop -= cell.height;
      else if (event.clientY > box.bottom) element.scrollTop += cell.height;
    }
    const position = positionAt(event.clientX, event.clientY);
    setSelection((current) => (current ? { ...current, head: position } : current));
  };

  const onPointerUp = () => {
    dragging.current = false;
    // A press on the selected text that stayed a click ends the selection.
    if (draggingText.current) {
      draggingText.current = false;
      setSelection(null);
      input.current?.focus({ preventScroll: true });
      return;
    }
    setSelection((current) =>
      current && current.mode === "char" && comparePositions(current.anchor, current.head) === 0
        ? null
        : current,
    );
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    // On the alternate screen there is nothing to scroll: a program scrolls by the arrow keys.
    if (event.deltaY === 0 || !emulator.onAlternate) return;
    const steps = Math.min(8, Math.max(1, Math.round(Math.abs(event.deltaY) / cell.height)));
    const up = event.deltaY < 0;
    const code = `\x1b${emulator.applicationCursor ? "O" : "["}${up ? "A" : "B"}`;
    session.input(code.repeat(steps));
  };

  const send = (data: string) => {
    following.current = true;
    session.input(data);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onActivate?.();
    if (event.nativeEvent.isComposing) return;
    if (onCommandKey?.(event, hasSelection)) {
      event.preventDefault();
      return;
    }
    // Paste comes as the browser's own event, which alone may read the clipboard.
    if (matchesTerminalCommand(event.nativeEvent, "command+v", hasSelection)) return;
    const bytes = encodeKey(event.nativeEvent, {
      applicationCursor: emulator.applicationCursor,
      optionAsMeta,
    });
    if (bytes !== null) {
      event.preventDefault();
      setSelection(null);
      send(bytes);
    }
  };

  const onInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (composing.current) return;
    const text = event.currentTarget.value;
    event.currentTarget.value = "";
    if (text) {
      setSelection(null);
      send(text.replace(/\n/g, "\r"));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (text) send(pastedBytes(session, text));
  };

  const onCopy = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!hasSelection) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", selectedText());
  };

  const rowsShown = Math.max(emulator.rows, Math.ceil(viewHeight / cell.height)) + 1;
  const firstIndex = following.current
    ? Math.max(0, total - Math.max(emulator.rows, Math.floor(viewHeight / cell.height)))
    : Math.max(0, Math.floor(scrollTop / cell.height));
  const rows: ReactNode[] = [];
  for (let index = firstIndex; index < Math.min(total, firstIndex + rowsShown); index += 1) {
    const line = emulator.lineAt(fromLine + index);
    rows.push(
      <div
        key={index}
        className="mac-terminal-row"
        data-marked={line?.marked && showMarks ? "" : undefined}
        style={{ top: index * cell.height }}
      >
        {line ? runsOf(line.cells, cell.width) : null}
      </div>,
    );
  }

  const selections = useMemo(() => {
    if (!selection) return [];
    const { start, end } = bounds(selection);
    const shown: { line: number; left: number; width: number }[] = [];
    const lastVisible = fromLine + firstIndex + rowsShown;
    for (let line = Math.max(start.line, fromLine + firstIndex); line <= end.line; line += 1) {
      if (line > lastVisible) break;
      let left = line === start.line ? start.column : 0;
      let right = line === end.line ? end.column : emulator.cols;
      if (selection.rectangular) {
        left = Math.min(selection.anchor.column, selection.head.column);
        right = Math.max(selection.anchor.column, selection.head.column);
      }
      if (right > left) shown.push({ line, left, width: right - left });
    }
    return shown;
  }, [bounds, emulator.cols, firstIndex, fromLine, rowsShown, selection]);

  const cursorIndex = emulator.screenTop - fromLine + emulator.cursor.row;
  const style = {
    "--_cell-width": `${cell.width}px`,
    "--_cell-height": `${cell.height}px`,
    "--_font-size": `${fontSize}px`,
    ...(fontFamily ? { "--_font-family": fontFamily } : {}),
  } as CSSProperties;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a press only selects text; the keyboard's way in is the text area inside.
    <div
      className="mac-terminal-screen"
      style={style}
      data-bell={bell ? "" : undefined}
      data-reverse={emulator.reverseVideo ? "" : undefined}
      onPointerDown={onPointerDown}
      onMouseDown={onMouseDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onDragStart={(event) => {
        if (!draggingText.current) return;
        event.dataTransfer.setData("text/plain", selectedText());
        event.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => {
        draggingText.current = false;
        input.current?.focus({ preventScroll: true });
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/plain")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const text = event.dataTransfer.getData("text/plain");
        if (!text) return;
        event.preventDefault();
        send(pastedBytes(session, text));
        input.current?.focus({ preventScroll: true });
      }}
    >
      <span ref={setMeasure} className="mac-terminal-measure" aria-hidden="true">
        {"M".repeat(100)}
      </span>
      <ScrollView
        className="mac-terminal-scroller"
        knobStyle="default"
        viewportProps={{ ref: viewport, onScroll, className: "mac-terminal-viewport" }}
      >
        <div
          className="mac-terminal-lines"
          role="log"
          aria-label="Terminal output"
          style={{ height: total * cell.height }}
        >
          {selections.map((part) => (
            <div
              key={part.line}
              className="mac-terminal-selection"
              style={{
                top: (part.line - fromLine) * cell.height,
                left: PADDING + part.left * cell.width,
                width: part.width * cell.width,
              }}
            />
          ))}
          {rows}
          {emulator.cursorVisible ? (
            <div
              className="mac-terminal-cursor"
              data-shape={emulator.cursorShape}
              data-blink={emulator.cursorBlink ? "" : undefined}
              style={{
                top: cursorIndex * cell.height,
                left: PADDING + emulator.cursor.column * cell.width,
              }}
            />
          ) : null}
        </div>
      </ScrollView>
      <textarea
        ref={input}
        className="mac-terminal-input"
        aria-label="Terminal input"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          top: Math.max(0, emulator.cursor.row) * cell.height,
          left: PADDING + emulator.cursor.column * cell.width,
        }}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onPaste={onPaste}
        onCopy={onCopy}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onInput(event);
        }}
        onFocus={onActivate}
      />
    </div>
  );
}

/** Text as it goes down the line when pasted: marked for a program that asked, else as typed. */
export function pastedBytes(session: TerminalSession, text: string): string {
  // A paste that held the end marker would end itself early, and the rest would run as keys.
  const normal = text.replace(/\r\n?/g, "\n").replaceAll("\x1b[201~", "");
  return session.emulator.bracketedPaste
    ? `\x1b[200~${normal}\x1b[201~`
    : normal.replace(/\n/g, "\r");
}
