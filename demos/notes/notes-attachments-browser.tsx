"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { IconView } from "macalicious/icon-view";
import { MenuItem } from "macalicious/menu-item";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { useMemo, useState } from "react";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";
import { downloadBlob } from "../mail/mail-attachments";
import { PHOTO_THUMBNAIL, SCREENSHOT_THUMBNAIL } from "./notes-artwork";
import { type NoteFile, type NotesNote, summarize } from "./notes-data";
import { NoteFileIcon, noteFileKind, readNoteFile, useNoteFileUrl } from "./notes-files";

/** A section of the Attachments Browser. */
export type NotesAttachmentSection =
  | "photos"
  | "scans"
  | "maps"
  | "websites"
  | "audio"
  | "documents";

const SECTIONS: [NotesAttachmentSection, string][] = [
  ["photos", "Photos & Videos"],
  ["scans", "Scans"],
  ["maps", "Maps"],
  ["websites", "Websites"],
  ["audio", "Audio"],
  ["documents", "Documents"],
];

/** Why the Scans section stays empty. */
export const NO_SCANS =
  "A scan comes from an iPhone’s camera, and a web page can’t reach an iPhone.";

const MAP_HOSTS = /^(maps\.apple\.com|maps\.google\.[a-z.]+|www\.openstreetmap\.org)$/i;
const isMapAddress = (address: string) => {
  const { hostname, pathname } = new URL(address);
  return (
    MAP_HOSTS.test(hostname) ||
    (/(^|\.)google\.[a-z.]+$/i.test(hostname) && pathname.startsWith("/maps"))
  );
};

/** The web addresses in a note: those written in its lines and those of its links, each once. */
export function noteAddresses(note: Pick<NotesNote, "lines" | "html">): string[] {
  const written = note.lines.flatMap((line) =>
    [...line.matchAll(/https?:\/\/[^\s<>"]+/gi)].map(([each]) => each),
  );
  const linked = [...(note.html ?? "").matchAll(/href="([^"]+)"/gi)].map(([, each = ""]) =>
    each.replace(/&amp;/g, "&"),
  );
  const found = new Set<string>();
  for (const each of [...written, ...linked]) {
    const address = linkAddress(each);
    if (address) found.add(address);
  }
  return [...found];
}

/** One tile of the browser: a note's file, a stand-in picture or a web address. */
export interface NotesAttachmentItem {
  key: string;
  noteId: string;
  noteTitle: string;
  name: string;
  file?: NoteFile;
  /** The thumbnail known without reading a file. */
  thumbnail?: string;
  address?: string;
}

/** What the notes hold, in the sections of the Attachments Browser. Locked notes show nothing. */
export function attachmentsOf(
  notes: readonly NotesNote[],
): Record<NotesAttachmentSection, NotesAttachmentItem[]> {
  const sections: Record<NotesAttachmentSection, NotesAttachmentItem[]> = {
    photos: [],
    scans: [],
    maps: [],
    websites: [],
    audio: [],
    documents: [],
  };
  for (const note of notes) {
    if (note.deleted !== undefined || note.locked) continue;
    const noteId = note.id;
    const noteTitle = summarize(note).title;
    if (note.attachment) {
      sections.photos.push({
        key: `${noteId}:stand-in`,
        noteId,
        noteTitle,
        name: note.attachment === "photo" ? "Photograph" : "Screenshot",
        thumbnail: note.attachment === "photo" ? PHOTO_THUMBNAIL : SCREENSHOT_THUMBNAIL,
      });
    }
    for (const file of note.files ?? []) {
      const kind = noteFileKind(file);
      const section =
        kind === "picture" || kind === "video"
          ? "photos"
          : kind === "audio"
            ? "audio"
            : "documents";
      sections[section].push({
        key: `${noteId}:${file.id}`,
        noteId,
        noteTitle,
        name: file.name,
        file,
      });
    }
    for (const address of noteAddresses(note)) {
      const section = isMapAddress(address) ? "maps" : "websites";
      sections[section].push({
        key: `${noteId}:${address}`,
        noteId,
        noteTitle,
        name: new URL(address).hostname.replace(/^www\./, ""),
        address,
      });
    }
  }
  return sections;
}

function ItemImage({ item }: { item: NotesAttachmentItem }) {
  const picture = item.file && noteFileKind(item.file) === "picture" ? item.file : null;
  const url = useNoteFileUrl(picture);
  const source = url ?? item.thumbnail;
  if (source) return <img className="mac-notes-tile-picture" src={source} alt="" />;
  return <NoteFileIcon name={item.file?.name ?? ""} />;
}

export interface NotesAttachmentsBrowserProps {
  notes: readonly NotesNote[];
  /** Show in Note, and a double click: the note that holds the item, in the note list. */
  onShow: (noteId: string) => void;
  /** Quick Look of a file. */
  onQuickLook: (file: NoteFile) => void;
}

/**
 * View > Attachments Browser: every attachment of the person's notes, by kind, whichever folder
 * holds it. It takes the place of the note list and the note.
 */
export function NotesAttachmentsBrowser({
  notes,
  onShow,
  onQuickLook,
}: NotesAttachmentsBrowserProps) {
  const [section, setSection] = useState<NotesAttachmentSection>("photos");
  const [chosen, setChosen] = useState<string | null>(null);
  const sections = useMemo(() => attachmentsOf(notes), [notes]);
  const items = sections[section];
  const title = SECTIONS.find(([value]) => value === section)?.[1] ?? "";
  const item = items.find((each) => each.key === chosen);
  return (
    <div className="mac-notes-attachments">
      <div className="mac-notes-attachments-bar">
        <SegmentedControl
          aria-label="Kind of attachment"
          distribution="fit"
          value={[section]}
          onValueChange={(next) => {
            const value = SECTIONS.find(([each]) => each === next[0])?.[0];
            if (value) setSection(value);
          }}
        >
          {SECTIONS.map(([value, label]) => (
            <Segment key={value} value={value}>
              {label}
            </Segment>
          ))}
        </SegmentedControl>
      </div>
      {items.length === 0 ? (
        <EmptyState role="status" className="mac-notes-attachments-empty">
          No {title}
          {section === "scans" ? (
            <>
              <br />
              {NO_SCANS}
            </>
          ) : null}
        </EmptyState>
      ) : (
        <ContextualMenu>
          <ContextualMenuTrigger
            className="mac-notes-menu-area"
            onContextMenu={(event) => {
              const target = event.target instanceof Element ? event.target : null;
              const at = target?.closest<HTMLElement>("[data-index]");
              const pressed = items[Number(at?.dataset.index ?? -1)];
              if (!pressed) {
                event.preventBaseUIHandler();
                return;
              }
              setChosen(pressed.key);
            }}
          >
            <IconView
              aria-label={title}
              count={items.length}
              iconSize={84}
              cellWidth={136}
              renderIcon={(index) => {
                const each = items[index];
                return each ? (
                  <span className="mac-notes-tile">
                    <ItemImage item={each} />
                  </span>
                ) : null;
              }}
              getItemLabel={(index) => items[index]?.name ?? ""}
              getItemDetail={(index) => items[index]?.noteTitle}
              getItemId={(index) => items[index]?.key ?? index}
              value={item ? [item.key] : []}
              onValueChange={(next) => setChosen(typeof next[0] === "string" ? next[0] : null)}
              onItemAction={(index) => {
                const each = items[index];
                if (each) onShow(each.noteId);
              }}
              style={{ height: "100%", background: "var(--mac-notes-list-background)" }}
            />
          </ContextualMenuTrigger>
          <ContextualMenuPopup aria-label="Attachment commands">
            <MenuItem onClick={() => item && onShow(item.noteId)}>Show in Note</MenuItem>
            {item?.address ? (
              <MenuItem onClick={() => item.address && openUrl(item.address, "notes")}>
                Open Link
              </MenuItem>
            ) : null}
            {item?.file ? (
              <>
                <MenuItem onClick={() => item.file && onQuickLook(item.file)}>Quick Look</MenuItem>
                <MenuItem
                  onClick={() => {
                    const file = item.file;
                    if (file) void readNoteFile(file).then((blob) => downloadBlob(blob, file.name));
                  }}
                >
                  Save Attachment…
                </MenuItem>
              </>
            ) : null}
          </ContextualMenuPopup>
        </ContextualMenu>
      )}
    </div>
  );
}
