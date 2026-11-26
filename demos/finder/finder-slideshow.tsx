"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import { ItemIcon } from "./finder-artwork";
import { displayName, type FinderEntry } from "./finder-data";
import { useDriveFile } from "./finder-drive";

/** How long a slide shows while the slideshow plays. */
const SLIDE_MS = 3000;

function Slide({ entry }: { entry: FinderEntry }) {
  const { node } = entry;
  // Only a picture shows its bytes; anything else its icon.
  const id = node.kind === "image" ? node.id : undefined;
  const file = useDriveFile(
    id,
    node.kind,
    id !== undefined,
    node.revision === undefined ? undefined : String(node.revision),
  );
  const url = file && !(file instanceof Error) ? file.url : undefined;
  return node.kind === "image" && url ? (
    <img className="mac-finder-slide-picture" src={url} alt={displayName(node)} />
  ) : (
    <ItemIcon node={node} size={256} />
  );
}

export interface FinderSlideshowProps {
  /** What the slideshow shows, in order. */
  entries: readonly FinderEntry[];
  /** Where it goes: over the whole desktop. */
  container: HTMLElement;
  onClose: () => void;
}

/**
 * The slideshow of the items selected: each as large as the screen allows, stepping by itself until
 * paused, with an index sheet of them all. Option-Command-Y, or Quick Look's full-screen button.
 */
export function FinderSlideshow({ entries, container, onClose }: FinderSlideshowProps) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(entries.length > 1);
  const [sheet, setSheet] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = entries.length;
  const step = (by: number) => setAt((now) => (now + by + count) % count);
  // What had the keyboard goes away with the sheet: the slideshow keeps it.
  const leaveSheet = () => {
    root.current?.focus();
    setSheet(false);
  };
  useEffect(() => {
    if (!playing || sheet || count < 2) return;
    const timer = setTimeout(() => setAt((now) => (now + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  });
  const shown = entries[Math.min(at, count - 1)];
  if (!shown) return null;
  return (
    <Dialog.Root
      open
      modal
      disablePointerDismissal
      onOpenChange={(open) => {
        if (open) return;
        if (sheet) leaveSheet();
        else onClose();
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Popup
          ref={root}
          className="mac-finder-slideshow"
          data-appearance="dark"
          aria-label="Slideshow"
          initialFocus={root}
          finalFocus={false}
          onKeyDown={(event) => {
            // The desktop's and Finder's keys wait until the slideshow is over.
            event.stopPropagation();
            if (event.key === "Tab") {
              // Stays inside: the desktop around a full-screen slideshow takes no keys.
              event.preventDefault();
              const buttons = [
                ...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)"),
              ];
              const from = buttons.indexOf(document.activeElement as HTMLElement);
              const by = event.shiftKey ? -1 : 1;
              buttons[
                (Math.max(from, by > 0 ? -1 : 0) + by + buttons.length) % buttons.length
              ]?.focus();
            } else if (event.key === "ArrowRight") step(1);
            else if (event.key === "ArrowLeft") step(-1);
            else if (event.key === " " && event.target === event.currentTarget) {
              event.preventDefault();
              setPlaying(!playing);
            }
          }}
        >
          {sheet ? (
            <ul className="mac-finder-slideshow-sheet" aria-label="Index Sheet">
              {entries.map((entry, index) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    className="mac-finder-slideshow-cell"
                    data-current={index === at ? "" : undefined}
                    onClick={() => {
                      setAt(index);
                      leaveSheet();
                    }}
                  >
                    <ItemIcon node={entry.node} size={96} />
                    <span>{displayName(entry.node)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mac-finder-slideshow-stage">
              <Slide key={shown.path} entry={shown} />
              <p className="mac-finder-slideshow-name">{displayName(shown.node)}</p>
            </div>
          )}
          <div className="mac-finder-slideshow-controls">
            <PushButton size="small" disabled={count < 2} onClick={() => step(-1)}>
              Previous
            </PushButton>
            <PushButton size="small" disabled={count < 2} onClick={() => setPlaying(!playing)}>
              {playing ? "Pause" : "Play"}
            </PushButton>
            <PushButton size="small" disabled={count < 2} onClick={() => step(1)}>
              Next
            </PushButton>
            <PushButton
              size="small"
              disabled={count < 2}
              onClick={() => (sheet ? leaveSheet() : setSheet(true))}
            >
              Index Sheet
            </PushButton>
            <span className="mac-finder-slideshow-count" role="status">
              {at + 1} of {count}
            </span>
            <PushButton size="small" onClick={onClose}>
              Exit
            </PushButton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
