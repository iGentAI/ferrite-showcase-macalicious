"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";
import { useEffect, useState } from "react";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { photoFile, recentPhotos } from "../mail/mail-photo-browser";
import { type LibraryPhoto, loadLibrary, readThumbs } from "../photos/photos-library";
import { titleOf } from "../photos/photos-served-data";

/**
 * Media > Photos…: the person's Photos library, the newest first. A picture chosen goes into the
 * note, and From This Computer… takes one from a file instead.
 */
export function NotesPhotos({
  anchor,
  onChoose,
  onFromComputer,
  onClose,
}: {
  anchor: HTMLElement | null;
  onChoose: (file: DesktopDragItem) => void;
  onFromComputer: () => void;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<readonly LibraryPhoto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [thumbs, setThumbs] = useState<ReadonlyMap<string, string>>(() => new Map());
  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    loadLibrary()
      .then(async (library) => {
        const recent = recentPhotos(library.photos);
        if (!current) return;
        setPhotos(recent);
        const read = await readThumbs(recent.map((photo) => photo.id));
        if (!current) return;
        const shown = new Map<string, string>();
        for (const [id, blob] of read) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          shown.set(id, url);
        }
        setThumbs(shown);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  return (
    <Sheet open onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Photos</SheetTitle>
        {failed ? (
          <Label role="alert">Your Photos library could not be read.</Label>
        ) : photos === null ? (
          <Label color="secondary">Reading Photos…</Label>
        ) : photos.length === 0 ? (
          <Label color="secondary">No Photos</Label>
        ) : (
          <div className="mac-notes-photos">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className="mac-notes-photo"
                aria-label={titleOf(photo)}
                title={titleOf(photo)}
                onClick={() => {
                  onChoose(photoFile(photo));
                  onClose();
                }}
              >
                {thumbs.has(photo.id) ? <img alt="" src={thumbs.get(photo.id)} /> : null}
              </button>
            ))}
          </div>
        )}
        <SheetActions>
          <PushButton onClick={onFromComputer}>From This Computer…</PushButton>
          <PushButton onClick={onClose}>Cancel</PushButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
