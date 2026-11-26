"use client";

import { PushButton } from "macalicious/push-button";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** How long each page stands while the slideshow plays. */
const PAGE_MS = 5000;

export interface PreviewSlideshowProps {
  /** How many pages it shows, and the page it starts at, from 1. */
  count: number;
  page: number;
  /** Called as it goes to another page. */
  onPageChange: (page: number) => void;
  /** Called when it ends: Escape, End Slideshow, or leaving full screen. */
  onEnd: () => void;
  /** Draws `page` to fit within the room it is given. */
  renderPage: (page: number, room: { width: number; height: number }) => ReactNode;
}

/**
 * View > Slideshow: the document's pages one at a time on black, in full screen where the browser
 * allows it and over the whole page where it does not. The arrow keys and the space bar step; it
 * plays on by itself until paused.
 */
export function PreviewSlideshow({
  count,
  page,
  onPageChange,
  onEnd,
  renderPage,
}: PreviewSlideshowProps) {
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [room, setRoom] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const step = (by: number) => {
    const next = page + by;
    if (next >= 1 && next <= count) onPageChange(next);
  };

  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.focus();
    void element.requestFullscreen?.()?.catch?.(() => {});
    const resized = () => setRoom({ width: window.innerWidth, height: window.innerHeight });
    // Leaving full screen (the browser's own Escape) ends it.
    const left = () => {
      if (!document.fullscreenElement) end.current();
    };
    window.addEventListener("resize", resized);
    element.addEventListener("fullscreenchange", left);
    return () => {
      window.removeEventListener("resize", resized);
      element.removeEventListener("fullscreenchange", left);
      if (document.fullscreenElement === element) void document.exitFullscreen?.();
    };
  }, []);

  useEffect(() => {
    if (!playing || page >= count) return;
    const timer = setTimeout(() => onPageChange(page + 1), PAGE_MS);
    return () => clearTimeout(timer);
  }, [playing, page, count, onPageChange]);

  return createPortal(
    <div
      ref={root}
      className="mac-preview mac-preview-app-slideshow"
      role="dialog"
      aria-label="Slideshow"
      tabIndex={-1}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onEnd();
        else if (event.key === "ArrowRight" || event.key === " ") step(1);
        else if (event.key === "ArrowLeft") step(-1);
        else return;
        event.preventDefault();
      }}
    >
      {renderPage(page, room)}
      <div className="mac-preview-app-slideshow-controls">
        <PushButton disabled={page <= 1} onClick={() => step(-1)}>
          Previous
        </PushButton>
        <PushButton onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</PushButton>
        <PushButton disabled={page >= count} onClick={() => step(1)}>
          Next
        </PushButton>
        <PushButton onClick={onEnd}>End Slideshow</PushButton>
      </div>
    </div>,
    document.body,
  );
}
