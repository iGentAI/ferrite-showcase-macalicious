import {
  type DriveEntry,
  ensureDrive,
  SPECIAL_FOLDER_IDS,
  type SpecialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";

/**
 * Attachments of Mail and Messages on the desktop served by its Ferrite application
 * (`ferrite-apps/desktop/src/apps/attachments.rs`). A file is uploaded before its message is sent,
 * in pieces of `piece_bytes` (192 KiB, under the gateway's 256 KiB body cap), to the app's
 * `/attachments` routes; the message then names it, and every person the message reaches reads it
 * back in pieces through the message. A file chosen on the person's drive is read in the browser
 * first (`readFile`) and uploaded the same way as one from the computer.
 */

/** An attachment as a message carries it. */
export interface SentAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

/** The largest attachment, as the server allows it. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** One piece, as the server cuts them. */
export const ATTACHMENT_PIECE_BYTES = 192 * 1024;
/** Pieces one read asks for (the server's most). */
const READ_PIECES = 8;
/** Sends of one request before it fails. */
const ATTEMPTS = 4;

/** A request the server refused, with its own sentence; `status` 0 when no reply came. */
export class AttachmentError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AttachmentError";
    this.status = status;
  }
}

const errorOf = async (response: Response): Promise<AttachmentError> => {
  let message = `The server answered ${response.status}.`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // The status alone.
  }
  return new AttachmentError(response.status, message);
};

/**
 * Send one request, again after a failure that may pass (no reply, 5xx, 429), up to `tries`
 * times (`ATTEMPTS` by default), and hand the reply to `read`. A refusal (another 4xx) rejects at
 * once.
 */
async function attempt<T>(
  url: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  signal?: AbortSignal,
  tries: number = ATTEMPTS,
): Promise<T> {
  const limit = tries;
  let last: unknown = new AttachmentError(0, "The server could not be reached.");
  for (let tries = 0; tries < limit; tries++) {
    if (signal?.aborted) throw signal.reason;
    try {
      return await withDeadline(async (deadline) => {
        // One signal for the deadline and the caller's, held by plain listeners (not
        // `AbortSignal.any`, which WebKit was seen to leave hanging: messages-live.tsx).
        const both = new AbortController();
        const stop = () => both.abort();
        deadline.addEventListener("abort", stop, { once: true });
        signal?.addEventListener("abort", stop, { once: true });
        if (signal?.aborted) stop();
        try {
          const response = await sessionFetch(url, {
            credentials: "same-origin",
            ...init,
            signal: both.signal,
          });
          if (response.ok) return await read(response);
          const error = await errorOf(response);
          if (response.status < 500 && response.status !== 429) {
            throw Object.assign(error, { final: true });
          }
          throw error;
        } finally {
          deadline.removeEventListener("abort", stop);
          signal?.removeEventListener("abort", stop);
        }
      });
    } catch (error) {
      if ((error as { final?: boolean }).final || signal?.aborted) throw error;
      last = error;
    }
    if (tries + 1 >= limit) break;
    await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** tries));
  }
  throw last;
}

export interface UploadAttachmentOptions {
  /** Called as pieces arrive, with the bytes sent and the file's size. */
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload `file` as an attachment of the app at `base` (`/api/mail` or `/api/messages`) and answer
 * it once every piece has arrived. A file over `ATTACHMENT_MAX_BYTES` is refused here, without a
 * request. A failed upload is given up on the server, which deletes its bytes.
 */
export async function uploadAttachment(
  base: string,
  file: Blob,
  name: string,
  options: UploadAttachmentOptions = {},
): Promise<SentAttachment> {
  const { onProgress, signal } = options;
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new AttachmentError(413, `${name} is larger than 10 MB, the most an attachment can be.`);
  }
  const started = await attempt(
    `${base}/attachments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, type: file.type, size: file.size }),
    },
    async (response) =>
      (await response.json()) as {
        attachment: SentAttachment;
        piece_bytes: number;
        pieces: number;
      },
    signal,
    // Staging is asked once: a retry after a lost answer would stage (and charge) the file
    // twice. A failed staging fails the upload, and the person attaches the file again.
    1,
  );
  const { attachment, piece_bytes: pieceBytes, pieces } = started;
  try {
    let sent = 0;
    onProgress?.(0, file.size);
    for (let index = 0; index < pieces; index++) {
      const part = file.slice(index * pieceBytes, Math.min(file.size, (index + 1) * pieceBytes));
      const body = await part.arrayBuffer();
      await attempt(
        `${base}/attachments/${attachment.id}/${index}`,
        { method: "PUT", headers: { "content-type": "application/octet-stream" }, body },
        async (response) => {
          await response.text();
        },
        signal,
      );
      sent += part.size;
      onProgress?.(sent, file.size);
    }
    const sealed = await attempt(
      `${base}/attachments/${attachment.id}/complete`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      async (response) => (await response.json()) as { attachment: SentAttachment },
      signal,
    );
    return sealed.attachment;
  } catch (error) {
    cancelAttachment(base, attachment.id);
    throw error;
  }
}

/** Give up an attachment that was uploaded and will not be sent. A failure is ignored: the server
 * lets it expire after a day. */
export function cancelAttachment(base: string, id: string): void {
  void sessionFetch(`${base}/attachments/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
    .then((response) => response.text())
    .catch(() => {});
}

/**
 * Read an attachment whole from `url` (the message's own address for it, without a query), as a
 * `Blob` of its type. Anything but its whole size is an error: never hand back a short file.
 */
export async function readAttachment(
  url: string,
  attachment: SentAttachment,
  signal?: AbortSignal,
): Promise<Blob> {
  const pieces = Math.max(1, Math.ceil(attachment.size / ATTACHMENT_PIECE_BYTES));
  const parts: ArrayBuffer[] = [];
  let received = 0;
  for (let first = 0; first < pieces; first += READ_PIECES) {
    const part = await attempt(
      `${url}?piece=${first}&count=${READ_PIECES}`,
      {},
      (response) => response.arrayBuffer(),
      signal,
    );
    parts.push(part);
    received += part.byteLength;
  }
  if (received !== attachment.size) {
    throw new AttachmentError(503, `${attachment.name} could not be read whole; try again.`);
  }
  return new Blob(parts, { type: attachment.type || "application/octet-stream" });
}

/** Hand `blob` to the browser as a download named `name`. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Save `blob` to the Downloads folder of the person's drive: the new file. */
export async function saveToDownloads(
  blob: Blob,
  name: string,
  folder: SpecialFolder = "Downloads",
): Promise<DriveEntry> {
  await ensureDrive();
  return uploadFile(blob, SPECIAL_FOLDER_IDS[folder], { name, existing: "rename" });
}

/**
 * Where a file sits in a message's text, when Insert Attachments at End of Message is off: an element
 * naming the file, holding the name as text for whatever does not know the mark. What
 * `richTextFromHtml` must keep of it is `MAIL_FILE_HTML`; a reader puts the file there by its name.
 */
export const MAIL_FILE_MARK = "data-mail-file";
export const MAIL_FILE_HTML = { attributes: { [MAIL_FILE_MARK]: /^[^\0]{1,255}$/ } };

/** Makes the marks in `root` empty places, each with the file it names; each file takes one place. */
export function placeFiles<File extends { name: string }>(
  root: Element,
  files: readonly File[],
): { node: Element; file: File }[] {
  const free = [...files];
  return [...root.querySelectorAll(`[${MAIL_FILE_MARK}]`)].flatMap((node) => {
    const at = free.findIndex((each) => each.name === node.getAttribute(MAIL_FILE_MARK));
    const [file] = at < 0 ? [] : free.splice(at, 1);
    if (!file) return [];
    node.replaceChildren();
    return [{ node, file }];
  });
}

/** A size as Finder writes it: "12 bytes", "3 KB", "1.2 MB". */
export function sizeLabel(bytes: number): string {
  if (bytes < 1000) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Whether the browser can show the attachment as a picture. */
/** Whether a file is an iCalendar event or calendar, by its type or its name. */
export const isCalendarFile = (file: { type?: string; name: string }): boolean =>
  /text\/calendar/i.test(file.type ?? "") || /\.(ics|ical|icalendar)$/i.test(file.name);

export const isPicture = (attachment: { type: string }): boolean =>
  /^image\/(png|jpeg|gif|webp)$/.test(attachment.type);

/** Whether the browser can play the attachment as a recording. */
export const isAudio = (attachment: { type: string }): boolean =>
  /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a)$/.test(
    (attachment.type.split(";")[0] ?? "").trim().toLowerCase(),
  );
