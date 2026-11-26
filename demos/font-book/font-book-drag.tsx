"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type DesktopDragItem, type DropLanding, landingAt } from "../desktop/desktop-drag";
import type { FontFamily } from "./font-book-data";

/** How far, in points, a press moves before it is a drag: under this it is a click. */
const THRESHOLD = 4;

interface FontDragCommands {
  /** The families a press on font `id` drags. */
  families: (id: string) => readonly FontFamily[];
  /** Whether a collection takes fonts: the person's own do, the fixed ones do not. */
  accepts: (collection: string) => boolean;
  onDrop: (collection: string, families: readonly FontFamily[]) => void;
  /** The press on font `id` ended without a drag. */
  onRelease: (id: string) => void;
  /** The files of `families` as the desktop's drag items, for what is outside the window. */
  files: (families: readonly FontFamily[]) => readonly DesktopDragItem[];
}

function collectionUnder(x: number, y: number): string | null {
  return (
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-font-collection]")?.dataset
      .fontCollection ?? null
  );
}

/**
 * Dragging fonts to a collection. The outline is a table view, and a table view prevents the
 * default of every press to keep the focus on itself, which keeps the browser's own drag from
 * starting (Chromium, measured), so the drag follows the pointer instead. It ends on a collection,
 * on another application that takes the fonts' files (Finder keeps copies), or nowhere; Escape takes
 * it back.
 */
export function useFontDrag(commands: FontDragCommands) {
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    families: readonly FontFamily[];
    target: string | null;
  } | null>(null);
  const now = useRef(commands);
  now.current = commands;
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const onPress = (event: PointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return;
    stop.current?.();
    const { clientX: startX, clientY: startY } = event;
    let families: readonly FontFamily[] | null = null;
    let target: string | null = null;
    let outside: DropLanding | undefined;
    let marked: Element | null = null;
    const mark = (element: Element | null, accepted: boolean) => {
      if (marked !== element) marked?.removeAttribute("data-desktop-drop");
      marked = element;
      element?.setAttribute("data-desktop-drop", accepted ? "accept" : "refuse");
    };
    const landingUnder = (x: number, y: number, dragged: readonly FontFamily[]) => {
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit.closest(".mac-font-book")) return undefined;
      const items = now.current.files(dragged);
      return items.length > 0
        ? landingAt(hit, { from: "font-book", items, copy: true })
        : undefined;
    };
    const move = (next: globalThis.PointerEvent) => {
      if (!families) {
        if (Math.hypot(next.clientX - startX, next.clientY - startY) < THRESHOLD) return;
        families = now.current.families(id);
      }
      const under = collectionUnder(next.clientX, next.clientY);
      target = under && now.current.accepts(under) ? under : null;
      outside = landingUnder(next.clientX, next.clientY, families);
      mark(outside?.element ?? null, !outside?.refusal);
      setDrag({ x: next.clientX, y: next.clientY, families, target });
    };
    const up = () => {
      const dropped = families;
      const landing = outside;
      stop.current?.();
      if (!dropped) now.current.onRelease(id);
      else if (target) now.current.onDrop(target, dropped);
      else if (landing?.refusal) landing.sayRefusal?.(landing.refusal);
      else landing?.drop();
    };
    const key = (next: KeyboardEvent) => {
      if (next.key !== "Escape") return;
      next.preventDefault();
      stop.current?.();
    };
    const end = () => stop.current?.();
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", key, true);
      mark(null, true);
      stop.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", key, true);
  };

  return {
    onPress,
    dropTarget: drag?.target ?? null,
    ghost: drag
      ? createPortal(
          <div
            className="mac-font-book-drag"
            style={{ insetInlineStart: drag.x + 10, insetBlockStart: drag.y + 10 }}
          >
            {drag.families.length === 1 ? drag.families[0]?.name : `${drag.families.length} Fonts`}
          </div>,
          document.body,
        )
      : null,
  };
}
