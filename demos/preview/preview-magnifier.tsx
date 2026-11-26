"use client";

import { useEffect, useRef, useState } from "react";

/** The lens's side in points, and how much larger it shows what is under it. */
const SIDE = 160;
const ENLARGE = 2.5;

/**
 * Tools > Show Magnifier: a lens that follows the pointer over `viewport`, showing the page's
 * canvases (the page, its highlights and its marks) enlarged. It takes no pointer itself.
 */
export function PreviewMagnifier({ viewport }: { viewport: HTMLElement | null }) {
  const lens = useRef<HTMLCanvasElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!viewport) return;
    const move = (event: PointerEvent) => {
      const canvas = lens.current;
      const page = (event.target as Element).closest?.("[data-page]");
      const within = canvas?.parentElement?.getBoundingClientRect();
      if (!canvas || !page || !within) {
        setAt(null);
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      canvas.width = SIDE * ratio;
      canvas.height = SIDE * ratio;
      const context = canvas.getContext("2d");
      const box = page.getBoundingClientRect();
      if (context && box.width > 0) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        for (const source of page.querySelectorAll("canvas")) {
          const scale = source.width / box.width;
          const take = (SIDE / ENLARGE) * scale;
          context.globalCompositeOperation = source.classList.contains("mac-preview-app-page-tint")
            ? "multiply"
            : "source-over";
          context.drawImage(
            source,
            (event.clientX - box.left) * scale - take / 2,
            (event.clientY - box.top) * scale - take / 2,
            take,
            take,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        }
      }
      setAt({
        left: event.clientX - within.left - SIDE / 2,
        top: event.clientY - within.top - SIDE / 2,
      });
    };
    const leave = () => setAt(null);
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerleave", leave);
    return () => {
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerleave", leave);
    };
  }, [viewport]);
  return (
    <canvas
      ref={lens}
      className="mac-preview-app-magnifier"
      role="img"
      aria-label="Magnifier"
      hidden={at === null}
      style={at ?? undefined}
    />
  );
}
