"use client";

import { Label } from "macalicious/label";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { PushButton } from "macalicious/push-button";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { beginDesktopDrag, type DesktopDragItem, fileItemsOfDrag } from "../desktop/desktop-drag";
import { readFile } from "../desktop/desktop-files";
import { FileShareItems } from "../desktop/desktop-share-link";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { openFile, showInFinder } from "../finder/finder-open";
import {
  cancelAttachment,
  downloadBlob,
  isAudio,
  isCalendarFile,
  isPicture,
  readAttachment,
  type SentAttachment,
  saveToDownloads,
  sizeLabel,
  uploadAttachment,
} from "./mail-attachments";
import type { MailComposeAttaching } from "./mail-compose";
import { noteMailDownload } from "./mail-downloads";
import { MailMarkup } from "./mail-markup";

const API = "/api/mail";
/** The most attachments of one message, as the server allows it. */
const MAX_ATTACHMENTS = 10;
/** The largest attachment shown as a picture without being asked for. */
const PREVIEW_BYTES = 4 * 1024 * 1024;

/** A file of the New Message window: uploading, uploaded, or failed. */
interface OutgoingFile {
  key: string;
  name: string;
  size: number;
  sent: number;
  /** The bytes of a picture: what Markup reads, of a reopened draft's once Markup asks for them. */
  picture?: Blob;
  /** What Markup's read of a reopened draft's picture has to say. */
  note?: string;
  attachment?: SentAttachment;
  /** A saved draft holds it: removing it from the window leaves its bytes. */
  held?: boolean;
  error?: string;
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * The files of the one New Message window: what it uploads, what its message names, and what goes
 * into its window. A file is uploaded as soon as it is chosen; one the window gives up is given up
 * on the server too, unless a saved draft or a sent message holds it.
 */
export function useOutgoingFiles(sendFrozen: boolean) {
  // The window says when its own saves freeze it.
  const [windowFrozen, setWindowFrozen] = useState(false);
  const frozen = sendFrozen || windowFrozen;
  const [files, setFiles] = useState<readonly OutgoingFile[]>([]);
  const [picking, setPicking] = useState(false);
  // As it is now, for answers that arrive before a render.
  const filesNow = useRef(files);
  const nextKey = useRef(0);
  // The saved draft a window's held files are read through: every save of a draft gives it a new id.
  const holder = useRef<string | null>(null);
  const computer = useRef<HTMLInputElement>(null);
  // While the message may not change nothing is added, whichever way it comes, and the panel goes.
  const frozenNow = useRef(frozen);
  frozenNow.current = frozen;
  if (frozen && picking) setPicking(false);
  const write = (change: (all: readonly OutgoingFile[]) => readonly OutgoingFile[]) => {
    filesNow.current = change(filesNow.current);
    setFiles(filesNow.current);
  };
  const set = (key: string, change: Partial<OutgoingFile>) =>
    write((all) => all.map((each) => (each.key === key ? { ...each, ...change } : each)));
  const add = (name: string) => {
    nextKey.current += 1;
    const key = `file-${nextKey.current}`;
    const full = filesNow.current.length >= MAX_ATTACHMENTS;
    write((all) => [
      ...all,
      {
        key,
        name,
        size: 0,
        sent: 0,
        error: full ? "A message has at most 10 attachments." : undefined,
      },
    ]);
    return full ? null : key;
  };
  const upload = (file: Blob, name: string, key: string) => {
    if (!filesNow.current.some((each) => each.key === key)) return;
    set(key, { size: file.size, ...(file.type.startsWith("image/") ? { picture: file } : {}) });
    uploadAttachment(API, file, name, { onProgress: (sent) => set(key, { sent }) }).then(
      (attachment) => {
        // Removed while it was uploading, or its window closed: given up at once.
        if (!filesNow.current.some((each) => each.key === key)) {
          cancelAttachment(API, attachment.id);
          return;
        }
        set(key, { attachment, sent: file.size });
      },
      (error: unknown) => set(key, { error: errorText(error, "The file could not be uploaded.") }),
    );
  };
  const takeFile = (file: File) => {
    if (frozenNow.current) return;
    const key = add(file.name);
    if (key) upload(file, file.name, key);
  };
  const takeEntry = (entry: {
    id: string;
    name: string;
    type?: string;
    bytes?: () => Promise<Blob>;
  }) => {
    if (frozenNow.current) return;
    const key = add(entry.name);
    if (!key) return;
    (entry.bytes ? entry.bytes() : readFile(entry.id)).then(
      (blob) =>
        upload(new File([blob], entry.name, { type: blob.type || entry.type }), entry.name, key),
      (error: unknown) => set(key, { error: errorText(error, "The file could not be read.") }),
    );
  };
  const remove = (key: string) => {
    const each = filesNow.current.find((item) => item.key === key);
    if (each?.attachment && !each.held) cancelAttachment(API, each.attachment.id);
    write((all) => all.filter((item) => item.key !== key));
  };
  const placed = useMemo(
    () => files.flatMap(({ key, name, held, error }) => (error ? [] : [{ key, name, held }])),
    [files],
  );
  const [marking, setMarking] = useState<string | null>(null);
  const beingMarked = files.find((each) => each.key === marking);
  const canMark = ({ attachment, picture, held }: OutgoingFile) =>
    attachment !== undefined && (picture !== undefined || (held && isPicture(attachment)));
  const markable = [...files].reverse().find(canMark);
  const markUp = (key: string) => {
    const each = filesNow.current.find((item) => item.key === key);
    if (!each?.attachment) return;
    if (each.picture) {
      setMarking(key);
      return;
    }
    set(key, { note: "Reading…" });
    const url = `${API}/messages/${encodeURIComponent(holder.current ?? "")}/attachments/${each.attachment.id}`;
    readAttachment(url, each.attachment).then(
      (picture) => {
        set(key, { picture, note: undefined });
        setMarking(key);
      },
      (error: unknown) => set(key, { note: errorText(error, "The picture could not be read.") }),
    );
  };

  const strip: ReactNode =
    files.length > 0 ? (
      <ul className="mac-mail-live-attachments" aria-label="Attachments">
        {files.map((each) => (
          <li key={each.key} className="mac-mail-live-attachment">
            <Label truncate>{each.name}</Label>
            <Label textStyle="small" color="secondary" role={each.error ? "alert" : undefined}>
              {each.error
                ? each.error
                : (each.note ??
                  (each.attachment
                    ? sizeLabel(each.size)
                    : `Uploading ${Math.round((100 * each.sent) / Math.max(1, each.size))}%`))}
            </Label>
            {canMark(each) ? (
              <PushButton size="mini" disabled={frozen} onClick={() => markUp(each.key)}>
                Markup
              </PushButton>
            ) : null}
            <PushButton size="mini" disabled={frozen} onClick={() => remove(each.key)}>
              Remove
            </PushButton>
          </li>
        ))}
      </ul>
    ) : null;

  const panel = (
    <>
      <input
        ref={computer}
        type="file"
        multiple
        hidden
        aria-label="Files from this computer"
        onChange={(event) => {
          const chosen = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = "";
          setPicking(false);
          for (const file of chosen) takeFile(file);
        }}
      />
      {picking
        ? createPortal(
            <div className="mac-mail-panel-layer">
              <DriveOpenPanel
                leading={
                  <PushButton onClick={() => computer.current?.click()}>
                    From This Computer…
                  </PushButton>
                }
                onOpen={(entry) => {
                  setPicking(false);
                  takeEntry(entry);
                }}
                onCancel={() => setPicking(false)}
              />
            </div>,
            document.body,
          )
        : null}
      {beingMarked?.picture
        ? createPortal(
            <div className="mac-mail-panel-layer">
              <MailMarkup
                picture={beingMarked.picture}
                name={beingMarked.name}
                onCancel={() => setMarking(null)}
                onDone={(marked) => {
                  const name = beingMarked.name.replace(/(\.[^.]*)?$/, ".png");
                  setMarking(null);
                  remove(beingMarked.key);
                  takeFile(new File([marked], name, { type: marked.type }));
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );

  const attaching: MailComposeAttaching = {
    choose: () => {
      if (!frozenNow.current) setPicking(true);
    },
    available: !frozen,
    setFrozen: setWindowFrozen,
    takeFiles: (chosen) => {
      for (const file of chosen) takeFile(file);
    },
    drop: (items: readonly DesktopDragItem[]) => {
      for (const item of fileItemsOfDrag(items)) takeEntry(item);
    },
    strip,
    panel,
    placed,
    revision: files.flatMap((each) => each.attachment?.id ?? []).join(","),
    markup: markable && !frozen ? () => markUp(markable.key) : null,
  };

  return {
    attaching,
    /** What the message names: every file that has finished uploading. */
    ids: () => filesNow.current.flatMap((each) => each.attachment?.id ?? []),
    /** Why the message cannot go yet, or be kept as it stands. */
    notReady: () => {
      if (filesNow.current.some((each) => each.error)) {
        return "Remove the attachments that could not be uploaded first.";
      }
      return filesNow.current.some((each) => !each.attachment)
        ? "Wait until every attachment has finished uploading."
        : null;
    },
    /** A saved draft holds these now: `draftId`, when it is known. */
    held: (ids: readonly string[], draftId?: string) => {
      if (draftId) holder.current = draftId;
      write((all) =>
        all.map((each) =>
          each.attachment && ids.includes(each.attachment.id) ? { ...each, held: true } : each,
        ),
      );
    },
    /** A window opens with the files of the draft it was opened from. */
    begin: (from: readonly SentAttachment[], draftId?: string) => {
      holder.current = draftId ?? null;
      setPicking(false);
      setWindowFrozen(false);
      write(() =>
        from.map((attachment) => {
          nextKey.current += 1;
          return {
            key: `file-${nextKey.current}`,
            name: attachment.name,
            size: attachment.size,
            sent: attachment.size,
            attachment,
            held: true,
          };
        }),
      );
    },
    /** The message was sent: what it named is its own. */
    sent: () => write(() => []),
    /** The window closed: what no draft holds is given up. */
    closed: () => {
      setPicking(false);
      setWindowFrozen(false);
      for (const each of filesNow.current) {
        if (each.attachment && !each.held) cancelAttachment(API, each.attachment.id);
      }
      write((all) => all.filter((each) => each.held));
    },
  };
}

/** One attachment of a message that was sent or received: a picture shown, and its commands. */
export function ReceivedAttachment({
  url,
  messageId,
  attachment,
  askFirst = false,
  folder = "Downloads",
}: {
  url: string;
  /** In Mail, the message it came with, which Remove unedited downloads goes by. */
  messageId?: string;
  attachment: SentAttachment;
  /** Download attachments automatically is off: nothing is read until the person asks. */
  askFirst?: boolean;
  /** Where the file goes on the drive. */
  folder?: "Downloads" | "Desktop";
}) {
  const [picture, setPicture] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const blob = useRef<Promise<Blob> | null>(null);
  // The attachment as last given: a reload of the mailboxes gives an equal one anew, which
  // must neither read the bytes again nor replace (and revoke) the picture shown.
  const current = useRef(attachment);
  current.current = attachment;
  const read = useCallback(() => {
    blob.current ??= readAttachment(url, current.current);
    blob.current.catch(() => {
      blob.current = null;
    });
    return blob.current;
  }, [url]);

  // A long recording is read only when it is asked for, as Play does.
  const [playAsked, setPlayAsked] = useState(false);
  const audio = isAudio(attachment);
  const preview =
    playAsked ||
    (!askFirst && (audio || isPicture(attachment)) && attachment.size <= PREVIEW_BYTES);
  useEffect(() => {
    if (!preview) return;
    let address: string | null = null;
    let stopped = false;
    read().then(
      (data) => {
        if (stopped) return;
        address = URL.createObjectURL(data);
        setPicture(address);
      },
      () => {
        if (!stopped) setStatus("The picture could not be loaded.");
      },
    );
    return () => {
      stopped = true;
      if (address) URL.revokeObjectURL(address);
    };
  }, [preview, read]);

  const run = (what: "open" | "save" | "download" | "calendar") => {
    setStatus(
      what === "open" || what === "calendar"
        ? "Opening…"
        : what === "save"
          ? "Saving…"
          : "Downloading…",
    );
    read()
      .then(async (data) => {
        if (what === "download") {
          downloadBlob(data, attachment.name);
          setStatus(null);
          return;
        }
        const entry = await saveToDownloads(data, attachment.name, folder);
        if (messageId) noteMailDownload(entry, messageId);
        if (what === "save") {
          setStatus(`Saved to ${folder} as ${entry.name}.`);
          return;
        }
        if (what === "calendar") {
          openFile(entry, "calendar");
          setStatus(`Opened in Calendar from ${folder}, as ${entry.name}.`);
          return;
        }
        // An application opens what is on the drive, so the file goes to the downloads folder first.
        // One that no application opens shows in Quick Look, as in Finder.
        if (!openFile(entry)) showInFinder({ id: entry.id, show: "quick-look" });
        setStatus(`Opened from ${folder}, as ${entry.name}.`);
      })
      .catch((error: unknown) => setStatus(errorText(error, "The attachment could not be read.")));
  };

  return (
    <li
      className="mac-mail-live-attachment"
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest("button")) return;
        beginDesktopDrag(event.nativeEvent, {
          from: "mail",
          items: () => [
            {
              id: url,
              name: attachment.name,
              kind: "file",
              type: attachment.type,
              size: attachment.size,
              bytes: read,
            },
          ],
        });
      }}
    >
      {picture && audio ? (
        // biome-ignore lint/a11y/useMediaCaption: a person's recording has no captions
        <audio
          className="mac-mail-live-audio"
          controls
          autoPlay={playAsked}
          src={picture}
          aria-label={attachment.name}
        />
      ) : picture ? (
        <div className="mac-mail-live-figure">
          <img className="mac-mail-live-picture" src={picture} alt={attachment.name} />
        </div>
      ) : null}
      <Label truncate>{attachment.name}</Label>
      <Label textStyle="small" color="secondary">
        {sizeLabel(attachment.size)}
      </Label>
      <PushButton size="mini" onClick={() => run("open")}>
        Open
      </PushButton>
      {isCalendarFile(attachment) ? (
        <PushButton size="mini" onClick={() => run("calendar")}>
          Add to Calendar
        </PushButton>
      ) : null}
      {audio && !preview ? (
        <PushButton size="mini" onClick={() => setPlayAsked(true)}>
          Play
        </PushButton>
      ) : null}
      {askFirst && !audio && !preview && isPicture(attachment) ? (
        <PushButton size="mini" onClick={() => setPlayAsked(true)}>
          Show Picture
        </PushButton>
      ) : null}
      <PushButton size="mini" onClick={() => run("save")}>
        Save to {folder}
      </PushButton>
      <Menu>
        <MenuTrigger render={<PushButton size="mini">Share</PushButton>} />
        <MenuPopup>
          <FileShareItems
            items={[
              {
                id: url,
                name: attachment.name,
                kind: "file",
                type: attachment.type,
                size: attachment.size,
                bytes: read,
              },
            ]}
            from="mail"
          />
        </MenuPopup>
      </Menu>
      <PushButton size="mini" onClick={() => run("download")}>
        Download
      </PushButton>
      {status ? (
        <Label textStyle="small" color="secondary" role="status">
          {status}
        </Label>
      ) : null}
    </li>
  );
}

/** What came with a message, as files a command can read: saved, looked at or attached again. */
export const attachmentFiles = (
  messageId: string,
  attachments: readonly SentAttachment[],
): readonly DesktopDragItem[] =>
  attachments.map((attachment) => {
    const url = `${API}/messages/${messageId}/attachments/${attachment.id}`;
    return {
      id: url,
      name: attachment.name,
      kind: "file",
      type: attachment.type,
      size: attachment.size,
      bytes: () => readAttachment(url, attachment),
    };
  });

/** What came with a message, under its text. */
export function ReceivedAttachments({
  messageId,
  attachments,
  askFirst,
  folder,
}: {
  messageId: string;
  attachments: readonly SentAttachment[];
  askFirst?: boolean;
  folder?: "Downloads" | "Desktop";
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mac-mail-live-received" aria-label="Attachments">
      {attachments.map((attachment) => (
        <ReceivedAttachment
          key={attachment.id}
          url={`${API}/messages/${messageId}/attachments/${attachment.id}`}
          messageId={messageId}
          attachment={attachment}
          askFirst={askFirst}
          folder={folder}
        />
      ))}
    </ul>
  );
}

/** Preferences > Accounts > Download attachments automatically, kept with the person's settings. */
export const MAIL_DOWNLOAD_ATTACHMENTS = "mail.downloadAttachments";
export const readDownloadAttachments = (stored: unknown) =>
  typeof stored === "boolean" ? stored : undefined;
