"use client";

import { MenuItem } from "macalicious/menu-item";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";
import { useEffect, useState } from "react";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { type LibraryPhoto, loadLibrary } from "../photos/photos-library";
import { titleOf } from "../photos/photos-served-data";
import { MailGlyph } from "./mail-artwork";

/** The most recent photos the pull-down names. */
const SHOWN = 24;

/** A photo of the person's library as a file a message can take. */
export const photoFile = (photo: LibraryPhoto): DesktopDragItem => {
  const extension = (photo.mime.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
  const title = titleOf(photo);
  return {
    id: photo.file,
    name: title.includes(".") ? title : `${title}.${extension}`,
    kind: "file",
    type: photo.mime,
    size: photo.bytes,
  };
};

/** The newest pictures of the library: a movie is not offered, and neither is what was deleted. */
export const recentPhotos = (photos: readonly LibraryPhoto[]) =>
  photos
    .filter(
      (photo) => photo.deleted_ms === null && !photo.hidden && photo.mime.startsWith("image/"),
    )
    .sort((a, b) => b.taken_ms - a.taken_ms)
    .slice(0, SHOWN);

/** New Message's Photo Browser: the person's Photos library, a picture to a row, attached when chosen. */
export function MailPhotoBrowser({
  disabled,
  onChoose,
}: {
  disabled: boolean;
  onChoose: (file: DesktopDragItem) => void;
}) {
  const [photos, setPhotos] = useState<readonly LibraryPhoto[] | null>(null);
  useEffect(() => {
    let current = true;
    loadLibrary().then(
      (library) => {
        if (current) setPhotos(recentPhotos(library.photos));
      },
      () => {
        if (current) setPhotos([]);
      },
    );
    return () => {
      current = false;
    };
  }, []);
  return (
    <ToolbarPullDown
      image={<MailGlyph name="photo" size={14} />}
      aria-label="Photo Browser"
      disabled={disabled}
    >
      {photos === null || photos.length === 0 ? (
        <MenuItem disabled>{photos === null ? "Reading Photos…" : "No Photos"}</MenuItem>
      ) : (
        photos.map((photo) => (
          <MenuItem key={photo.id} onClick={() => onChoose(photoFile(photo))}>
            {titleOf(photo)}
          </MenuItem>
        ))
      )}
    </ToolbarPullDown>
  );
}
