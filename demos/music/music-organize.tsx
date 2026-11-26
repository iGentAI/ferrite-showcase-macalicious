"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { useState } from "react";
import {
  type Drive,
  type DriveEntry,
  ensureDrive,
  ensureFolder,
  pathOf,
  runOps,
  SPECIAL_FOLDER_IDS,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import { type LibrarySong, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "./music-server";

/** What File > Library > Organize Library was asked to do. */
export interface OrganizeChoice {
  consolidate: boolean;
  reorganize: boolean;
}

/** Whether a drive entry is in the Music folder, however deep. */
export function inMusicFolder(drive: Drive, entry: DriveEntry): boolean {
  return pathOf(drive, entry.id).some((step) => step.id === SPECIAL_FOLDER_IDS.Music);
}

/** A name a drive folder or file may take: no slash, and something left of it. */
const safeName = (name: string, otherwise: string) =>
  name.replace(/[/\\:]/g, "-").trim() || otherwise;

/** Where Reorganize puts a song: its artist's folder, its album's folder, and `01 Title.mp3`. */
export function organizedPlace(song: LibrarySong): {
  artist: string;
  album: string;
  name: string;
} {
  const fileName = song.source.kind === "file" ? song.source.name : "";
  const extension = /\.[^./]{1,5}$/.exec(fileName)?.[0] ?? "";
  const number = song.track ? `${String(song.track).padStart(2, "0")} ` : "";
  return {
    artist: safeName(song.artist, UNKNOWN_ARTIST),
    album: safeName(song.album, UNKNOWN_ALBUM),
    name: `${number}${safeName(song.title, "Untitled")}${extension}`,
  };
}

/**
 * Carries out Organize Library on the drive, a song at a time, and tells `changed` where each file
 * now is, so a failure partway leaves every song naming a file that exists. Running it again finds
 * the files already in place and leaves them. Answers how many files it copied or moved.
 */
export async function organizeLibrary(
  songs: readonly LibrarySong[],
  choice: OrganizeChoice,
  changed: (song: string, file: string, name: string) => void,
): Promise<number> {
  let done = 0;
  const session = currentDesktopSession();
  let drive = await ensureDrive();
  for (const song of songs) {
    if (song.source.kind !== "file") continue;
    const { file, name } = song.source;
    let id = file;
    let entry = drive.entries.find((each) => each.id === id);
    if (!entry) continue;
    if (choice.consolidate && !inMusicFolder(drive, entry)) {
      drive = await runOps(
        [{ op: "copy", id, parent: SPECIAL_FOLDER_IDS.Music, existing: "rename" }],
        undefined,
        session,
      );
      const copy = drive.created?.[0];
      entry = drive.entries.find((each) => each.id === copy);
      if (!entry) continue;
      id = entry.id;
      changed(song.id, id, entry.name);
      done += 1;
    }
    if (choice.reorganize && inMusicFolder(drive, entry)) {
      const place = organizedPlace(song);
      const artist = await ensureFolder(SPECIAL_FOLDER_IDS.Music, place.artist, session);
      const album = await ensureFolder(artist.id, place.album, session);
      if (entry.parent !== album.id || (entry.name !== place.name && entry.name !== name)) {
        drive = await runOps(
          [{ op: "move", id, parent: album.id, name: place.name, existing: "rename" }],
          undefined,
          session,
        );
        const moved = drive.entries.find((each) => each.id === id);
        changed(song.id, id, moved?.name ?? place.name);
        done += 1;
      } else {
        drive = await ensureDrive();
      }
    }
  }
  return done;
}

/** File > Library > Organize Library: the two things it can do to the files of the library. */
export function MusicOrganize({
  anchor,
  onOrganize,
  onCancel,
}: {
  anchor: Element | null;
  onOrganize: (choice: OrganizeChoice) => void;
  onCancel: () => void;
}) {
  const [consolidate, setConsolidate] = useState(false);
  const [reorganize, setReorganize] = useState(false);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Organize Library</SheetTitle>
        <div className="mac-music-organize">
          <Checkbox checked={consolidate} onCheckedChange={setConsolidate}>
            Consolidate files
          </Checkbox>
          <p>Copies the files of your songs kept elsewhere on your drive into Music.</p>
          <Checkbox checked={reorganize} onCheckedChange={setReorganize}>
            Reorganize files in the folder “Music”
          </Checkbox>
          <p>Moves them into folders by artist and album, named by track and title.</p>
        </div>
        <SheetActions>
          <SheetClose render={<PushButton />}>Cancel</SheetClose>
          <DefaultButton
            disabled={!consolidate && !reorganize}
            onClick={() => onOrganize({ consolidate, reorganize })}
          >
            OK
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
