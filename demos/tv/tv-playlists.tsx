"use client";

import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import { cleanPlaylistName, LIMITS } from "./tv-youtube-data";

/** A sheet that names a playlist, new or already made. */
export function PlaylistNameSheet({
  anchor,
  title,
  action,
  initialName,
  onName,
  onCancel,
}: {
  anchor: Element | null;
  title: string;
  action: string;
  initialName: string;
  onName: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const clean = cleanPlaylistName(name);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={360}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (clean) onName(clean);
          }}
        >
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Playlists are kept with your library.</SheetDescription>
          <TextField
            aria-label="Playlist name"
            autoFocus
            maxLength={LIMITS.playlistName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={{ width: "100%", marginBlock: 12 }}
          />
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={!clean}>
              {action}
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
