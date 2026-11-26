"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import type { TapeLine } from "./calculator-tape";

/** Lines as they go on the clipboard: each calculation over its result, as the window writes them. */
export const copiedTapeText = (lines: readonly TapeLine[]) =>
  lines.map((line) => `${line.expression}\n= ${line.result}`).join("\n");

export interface PaperTapeProps extends Omit<WindowProps, "children"> {
  /** The calculations, oldest first. */
  lines: readonly TapeLine[];
  /** What went wrong with the last Clear, shown above the button. */
  error?: string | null;
  /** Called by the Clear button. */
  onClear?: () => void;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Calculator's Paper Tape window: every finished calculation, as `12 + 3` over `= 15`, and a
 * Clear button. Calculator opens it on the desktop of the Ferrite application only.
 */
export function PaperTape({
  lines,
  error,
  onClear,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  className,
  ...windowProps
}: PaperTapeProps) {
  const list = useRef<HTMLOListElement>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const selected = lines.filter((line) => picked.has(line.id));
  const canCopy = lines.length > 0 && typeof navigator !== "undefined" && !!navigator.clipboard;
  /** The lines picked, or the whole tape when none is. */
  const copy = () => {
    if (!canCopy) return;
    void navigator.clipboard
      .writeText(copiedTapeText(selected.length > 0 ? selected : lines))
      .catch(() => {});
  };
  const pick = (id: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (event.shiftKey && anchor.current !== null) {
      const from = lines.findIndex((line) => line.id === anchor.current);
      const to = lines.findIndex((line) => line.id === id);
      if (from >= 0 && to >= 0) {
        const [first, last] = from < to ? [from, to] : [to, from];
        setPicked(new Set(lines.slice(first, last + 1).map((line) => line.id)));
        return;
      }
    }
    anchor.current = id;
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(picked);
      if (!next.delete(id)) next.add(id);
      setPicked(next);
    } else {
      setPicked(new Set([id]));
    }
  };
  const lineAt = (target: EventTarget) =>
    target instanceof Element
      ? target.closest<HTMLElement>(".mac-calculator-tape-line")?.dataset.line
      : undefined;
  const handleKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const native = event.nativeEvent;
    if (matchesMenuKeyEquivalent(native, "command+c")) {
      event.preventDefault();
      event.stopPropagation();
      copy();
    } else if (matchesMenuKeyEquivalent(native, "command+a")) {
      event.preventDefault();
      event.stopPropagation();
      setPicked(new Set(lines.map((line) => line.id)));
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const at = lines.findIndex((line) => line.id === anchor.current);
      const next = lines[event.key === "ArrowUp" ? Math.max(at - 1, 0) : at + 1];
      if (next) pick(next.id, { shiftKey: false, metaKey: false, ctrlKey: false });
    }
  };
  // The newest calculation stays in view, as on a roll of paper.
  useEffect(() => {
    const element = list.current;
    if (element && lines.length > 0) element.scrollTop = element.scrollHeight;
  }, [lines.length]);

  return (
    <Window
      aria-label="Paper Tape"
      {...windowProps}
      className={className ? `mac-calculator-tape ${className}` : "mac-calculator-tape"}
    >
      <TitleBar
        title="Paper Tape"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody className="mac-calculator-tape-body">
        <ContextualMenu>
          <ContextualMenuTrigger
            className="mac-calculator-tape-menu-area"
            onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
              const id = lineAt(event.target);
              if (id && !picked.has(id))
                pick(id, { shiftKey: false, metaKey: false, ctrlKey: false });
            }}
          >
            <ol
              ref={list}
              className="mac-calculator-tape-lines"
              aria-label="Calculations"
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              onClick={(event) => {
                const id = lineAt(event.target);
                if (id) pick(id, event);
                else setPicked(new Set());
              }}
            >
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="mac-calculator-tape-line"
                  aria-current={picked.has(line.id) ? "true" : undefined}
                  data-line={line.id}
                  data-unsaved={line.unsaved ? "" : undefined}
                >
                  <span className="mac-calculator-tape-expression">{line.expression}</span>
                  <span className="mac-calculator-tape-result">= {line.result}</span>
                </li>
              ))}
            </ol>
          </ContextualMenuTrigger>
          <ContextualMenuPopup aria-label="Paper Tape">
            <MenuItem disabled={!canCopy} onClick={copy}>
              Copy
            </MenuItem>
            <MenuItem disabled={lines.length === 0} onClick={onClear}>
              Clear
            </MenuItem>
          </ContextualMenuPopup>
        </ContextualMenu>
        <div className="mac-calculator-tape-buttons">
          {error ? (
            <span className="mac-calculator-tape-error" role="alert">
              {error}
            </span>
          ) : null}
          <PushButton disabled={lines.length === 0} onClick={onClear}>
            Clear
          </PushButton>
        </div>
      </WindowBody>
    </Window>
  );
}

/** The gap between Calculator and its tape when the tape opens beside it, in points. */
const BESIDE = 12;

/**
 * On the desktop: when the tape window opens, set it beside the Calculator window (to the
 * right, or to the left where there is no room), and leave the keyboard with Calculator, which
 * the tape opened from. `ref` holds the tape's root, rendered by a managed window whose id is
 * `<app>:tape`; the Calculator window's id is the app's.
 */
function usePlaceBeside(ref: RefObject<HTMLDivElement | null>) {
  const store = useWindowManagerStore();
  // Once per mount of the window (Strict Mode mounts it twice, and the second registration
  // starts from the default frame again).
  useEffect(() => {
    const host = ref.current?.parentElement;
    const ownId = host?.getAttribute("data-window-id");
    const appId = ownId?.endsWith(":tape") ? ownId.slice(0, -":tape".length) : null;
    const own = ownId ? store.get(ownId) : undefined;
    const app = appId ? store.get(appId) : undefined;
    if (!ownId || !appId || !own || !app) return;
    // A stage not laid out (no width) puts no bound on the right.
    const stage = host?.closest(".mac-window-manager")?.clientWidth || Number.POSITIVE_INFINITY;
    let x = app.frame.x + app.frame.width + BESIDE;
    if (x + own.frame.width > stage) x = app.frame.x - own.frame.width - BESIDE;
    if (x >= 0) store.patch(ownId, { frame: { ...own.frame, x, y: app.frame.y } });
    // Opened in front of Calculator: its keys go on working, so Calculator stays key.
    if (store.list().at(-1)?.id === ownId) store.focus(appId);
  }, [store, ref]);
}

/** The Paper Tape window as Calculator opens it on a desktop: placed beside Calculator. */
export function DesktopPaperTape(props: PaperTapeProps) {
  const ref = useRef<HTMLDivElement>(null);
  usePlaceBeside(ref);
  return <PaperTape {...props} ref={ref} />;
}
