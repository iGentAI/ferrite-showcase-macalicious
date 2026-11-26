"use client";

import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useRef, useState } from "react";
import {
  downloadBlob,
  readAttachment,
  type SentAttachment,
  sizeLabel,
  uploadAttachment,
} from "../mail/mail-attachments";

const CALENDAR_API = "/api/calendar";

/** Sends a file to the server, for an event to name: files dropped on an event's block in a view. */
export const uploadEventFile = (file: File) => uploadAttachment(CALENDAR_API, file, file.name);

/** An event's files, each read whole from its address and handed to the browser as a download. */
export function EventFileList({
  files,
  onRemove,
}: {
  files: readonly SentAttachment[];
  /** Given while the event is being edited: each file then has a button that takes it off. */
  onRemove?: (file: SentAttachment) => void;
}) {
  const [refused, setRefused] = useState<string | null>(null);
  const save = async (file: SentAttachment) => {
    setRefused(null);
    try {
      downloadBlob(await readAttachment(`${CALENDAR_API}/attachments/${file.id}`, file), file.name);
    } catch {
      setRefused(`\u201c${file.name}\u201d could not be read. Try again.`);
    }
  };
  return (
    <div className="mac-calendar-files" data-row="attachments">
      {files.map((file) => (
        <div key={file.id} className="mac-calendar-file">
          <button
            type="button"
            className="mac-calendar-file-name"
            title={`Download ${file.name}`}
            // The row around it opens the event's notes: a press on the name is only the file's.
            onClick={(event) => {
              event.stopPropagation();
              void save(file);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {file.name}
          </button>
          <span className="mac-calendar-file-size">{sizeLabel(file.size)}</span>
          {onRemove ? (
            <PushButton
              size="mini"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemove(file)}
            >
              Remove
            </PushButton>
          ) : null}
        </div>
      ))}
      {refused ? (
        <Label role="alert" color="secondary">
          {refused}
        </Label>
      ) : null}
    </div>
  );
}

/**
 * Add Attachment: the file panel, or files dropped on the event's popover through `upload`. A file goes
 * to the server first, and the event names it once it has all arrived.
 */
export function useEventUploads(
  files: readonly SentAttachment[] | undefined,
  onChange: (files: SentAttachment[]) => void,
) {
  const [uploading, setUploading] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  const held = useRef(files);
  held.current = files;
  const change = useRef(onChange);
  change.current = onChange;
  const upload = async (chosen: readonly File[]) => {
    setRefused(null);
    setUploading((count) => count + chosen.length);
    for (const file of chosen) {
      try {
        const sent = await uploadAttachment(CALENDAR_API, file, file.name);
        const next = [...(held.current ?? []), sent];
        held.current = next;
        change.current(next);
      } catch (error) {
        setRefused(
          error instanceof Error && error.message
            ? error.message
            : `\u201c${file.name}\u201d could not be attached.`,
        );
      } finally {
        setUploading((count) => count - 1);
      }
    }
  };
  return { upload, uploading, refused };
}
