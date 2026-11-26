"use client";

import { HudWindow } from "macalicious/hud-window";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PhotoBoothPicture } from "./photo-booth-data";

/** How long each picture stays, in milliseconds. */
const SLIDE_MS = 3000;

export interface PhotoBoothSlideshowProps {
  pictures: readonly PhotoBoothPicture[];
  /** Reads a picture at its full size. */
  readPicture: (picture: PhotoBoothPicture) => Promise<Blob>;
  onClose: () => void;
}

/**
 * View > Start Slideshow: the pictures one after another over the whole page, with Previous, Pause
 * and Next. A clip plays silently while its slide lasts. The arrow keys, Space and Escape work too.
 */
export function PhotoBoothSlideshow({ pictures, readPicture, onClose }: PhotoBoothSlideshowProps) {
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState<{ url: string; clip: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const picture = pictures[Math.min(at, pictures.length - 1)];
  const step = (by: number) =>
    setAt((now) => (now + by + pictures.length) % Math.max(1, pictures.length));

  useEffect(() => {
    root.current?.focus();
  }, []);

  const reading = useRef(picture);
  reading.current = picture;
  const pictureId = picture?.id;
  const pictureRev = picture?.rev;

  // biome-ignore lint/correctness/useExhaustiveDependencies: another picture or revision is a new image to read; the owner's list is rebuilt on every render.
  useEffect(() => {
    const shownNow = reading.current;
    if (!shownNow) return;
    let open = true;
    let url: string | null = null;
    readPicture(shownNow).then(
      (blob) => {
        if (!open) return;
        url = URL.createObjectURL(blob);
        setShown({ url, clip: shownNow.clip === true });
      },
      () => {
        if (open) setShown(null);
      },
    );
    return () => {
      open = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pictureId, pictureRev, readPicture]);

  const count = pictures.length;
  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setAt((now) => (now + 1) % count), SLIDE_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-label="Slideshow"
      aria-modal="true"
      tabIndex={-1}
      className="mac-photo-booth-slideshow"
      data-appearance="dark"
      onKeyDown={(event) => {
        const command = (
          {
            Escape: onClose,
            ArrowLeft: () => step(-1),
            ArrowRight: () => step(1),
            " ": () => setPaused((now) => !now),
          } as Record<string, () => void>
        )[event.key];
        if (!command) return;
        event.preventDefault();
        event.stopPropagation();
        command();
      }}
    >
      {shown ? (
        shown.clip ? (
          <video
            className="mac-photo-booth-slide"
            src={shown.url}
            aria-label={`Slide ${at + 1}`}
            autoPlay
            muted
            playsInline
          />
        ) : (
          <img className="mac-photo-booth-slide" src={shown.url} alt={`Slide ${at + 1}`} />
        )
      ) : null}
      <HudWindow aria-label="Slideshow controls" className="mac-photo-booth-slideshow-controls">
        <div className="mac-photo-booth-slideshow-buttons">
          <PushButton size="small" onClick={() => step(-1)}>
            Previous
          </PushButton>
          <PushButton size="small" onClick={() => setPaused((now) => !now)}>
            {paused ? "Play" : "Pause"}
          </PushButton>
          <PushButton size="small" onClick={() => step(1)}>
            Next
          </PushButton>
          <PushButton size="small" onClick={onClose}>
            Close
          </PushButton>
        </div>
      </HudWindow>
    </div>,
    document.body,
  );
}
