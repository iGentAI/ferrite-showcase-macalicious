"use client";

import { ImageButton } from "macalicious/image-button";
import {
  Popover,
  PopoverPopup,
  PopoverSeparator,
  PopoverTitle,
  PopoverTrigger,
} from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { ToolbarButton } from "macalicious/toolbar-button";
import { createContext, useContext } from "react";
import { beginDesktopDrag } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { requestOpenFile } from "../finder/finder-open";

/** A file Safari saved into the Downloads folder. */
export interface SafariDownloadEntry {
  /** The file on the person's drive. */
  id: string;
  name: string;
  url: string;
  at: number;
}

export const DOWNLOADS_KEPT = 50;

/** The list kept with the person's settings, leaving out what is not a download. */
export function readDownloads(stored: unknown): readonly SafariDownloadEntry[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.filter(
    (entry): entry is SafariDownloadEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.id === "string" &&
      typeof entry.name === "string" &&
      typeof entry.url === "string" &&
      typeof entry.at === "number",
  );
}

/** The list with a new download at its head; the same file again is one row. */
export function withDownload(
  list: readonly SafariDownloadEntry[],
  entry: SafariDownloadEntry,
): readonly SafariDownloadEntry[] {
  return [entry, ...list.filter((other) => other.id !== entry.id)].slice(0, DOWNLOADS_KEPT);
}

/** Tells the window a page belongs to that the page saved a file. */
export const SafariDownloadsContext = createContext<(entry: SafariDownloadEntry) => void>(() => {});
export const useNoteDownload = () => useContext(SafariDownloadsContext);

/** Finder opens on the Downloads folder with the file selected. */
export function showDownloadInFinder(entry: { id: string; name: string }) {
  requestOpenFile({ app: "finder", id: entry.id, name: entry.name });
  requestDesktopEffects([{ open: "finder" }]);
}

function DownloadsGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1v8.5M3.500 6L7 9.500 10.500 6M1.500 12.500h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.200"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RevealGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="5" cy="5" r="3.500" fill="none" stroke="currentColor" strokeWidth="1.200" />
      <path
        d="M7.500 7.500L11 11"
        stroke="currentColor"
        strokeWidth="1.500"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The toolbar's Downloads button, which is there once a file has been downloaded, and its list.
 * Clear and a row's own button take rows off the list; the files stay in the Downloads folder.
 */
export function SafariDownloadsButton({
  downloads,
  open,
  onOpenChange,
  onChange,
}: {
  downloads: readonly SafariDownloadEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (next: readonly SafariDownloadEntry[]) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<ToolbarButton aria-label="Downloads" style={{ width: 37 }} />}>
        <DownloadsGlyph />
      </PopoverTrigger>
      <PopoverPopup className="mac-safari-downloads" side="bottom">
        <div className="mac-safari-downloads-head">
          <PopoverTitle>Downloads</PopoverTitle>
          <PushButton size="small" onClick={() => onChange([])}>
            Clear
          </PushButton>
        </div>
        <PopoverSeparator />
        <ul className="mac-safari-downloads-list">
          {downloads.map((entry) => (
            <li
              key={entry.id}
              className="mac-safari-downloads-row"
              onPointerDown={(event) => {
                if ((event.target as Element).closest("button")) return;
                beginDesktopDrag(event.nativeEvent, {
                  from: "safari",
                  items: () => [{ id: entry.id, name: entry.name, kind: "file" }],
                });
              }}
            >
              <span className="mac-safari-downloads-name" title={entry.url}>
                {entry.name}
              </span>
              <ImageButton
                aria-label={`Show ${entry.name} in Finder`}
                onClick={() => showDownloadInFinder(entry)}
              >
                <RevealGlyph />
              </ImageButton>
              <PushButton
                size="small"
                aria-label={`Remove ${entry.name} from the list`}
                onClick={() => onChange(downloads.filter((other) => other.id !== entry.id))}
              >
                Remove
              </PushButton>
            </li>
          ))}
        </ul>
      </PopoverPopup>
    </Popover>
  );
}
