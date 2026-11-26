"use client";

import { Label } from "macalicious/label";
import { richTextFromHtml } from "macalicious/lib/rich-text";
import { PushButton } from "macalicious/push-button";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { desktopValues, useDesktopValue } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { linkTextNodes } from "../messages/linked-text";
import { Mail, type MailMessageChange, type MailProps } from "./mail";
import {
  attachmentFiles,
  MAIL_DOWNLOAD_ATTACHMENTS,
  ReceivedAttachment,
  ReceivedAttachments,
  readDownloadAttachments,
  useOutgoingFiles,
} from "./mail-attachment-views";
import { MAIL_FILE_HTML, placeFiles, type SentAttachment } from "./mail-attachments";

const NO_ATTACHMENTS: readonly SentAttachment[] = [];

import {
  isOwnMailbox,
  type MailboxId,
  type MailDraft,
  type MailFlag,
  type MailMessage,
  type MailPriority,
  type OwnMailbox,
  type OwnMailboxId,
} from "./mail-data";
import { mailRunning, messageErased } from "./mail-downloads";
import type { ImportedMessage } from "./mail-import";
import { linkAddressNodes, mailLinkedText } from "./mail-links";
import {
  dropFromOutbox,
  dropSnapshot,
  forgetLeavingDraft,
  isOffline,
  keepInOutbox,
  keepLeavingDraft,
  keepSnapshot,
  leavingDraft,
  type OutboxEntry,
  onOutboxChange,
  readOutbox,
  readSnapshot,
  setOffline,
} from "./mail-outbox";
import { MAIL_HELP_UNAVAILABLE } from "./mail-preferences";
import {
  checkEvery,
  checksByChoice,
  MAIL_SETTINGS,
  mailDownloadsFolder,
  readMailSettings,
} from "./mail-saved";
import { forgetSendKey, sendKeyFor } from "./mail-send-keys";

/**
 * Mail on the desktop served by its Ferrite application (`ferrite-apps/desktop/src/apps/mail`):
 * real mail between the desktop's accounts. Everywhere else, the documentation site included, it
 * is the plain `Mail` window over its invented messages and asks no server anything.
 *
 * The mailboxes are the signed-in person's own. New Message sends to account names
 * (`martin`, `martin@macalicious`, or a contact card that names the account, which the address
 * fields complete from Contacts); the message arrives at once in each recipient's Inbox, with a
 * notification. Its text keeps the styles of the editor. The mailboxes are read when the window
 * opens, when it gains focus, when the person's Mail changes (their personal stream, through the
 * desktop's `SERVER_CHANGE_EVENT`: mail delivered to them, or a change in another browser), with
 * Get Mail and after the person's own sends and saves, one read at a time. Read, flags, mute,
 * moves, drafts and the Trash are kept on the server, so every browser of the person shows the
 * same mailboxes.
 *
 * Take All Accounts Offline (`mail-outbox.ts`) holds those reads: the window shows what it had, kept
 * in this browser across a reload, and a message sent waits in the Outbox under the idempotency key
 * it is sent with when Mail is taken online. Changes to messages already here, and drafts, still
 * reach the server: there is no second copy of them to reconcile.
 */
export function MailLive(props: MailProps) {
  if (!servedByDesktopApp()) return <Mail takesSharedLinks {...props} />;
  return <ServedMail {...props} />;
}

const API = "/api/mail";
const DOMAIN = "macalicious";
/** A further viewer's frame, as `app.ts` gives the first. */
const mailViewerSize = {
  defaultSize: { width: 1061, height: 711 },
  minSize: { width: 980, height: 360 },
};

interface ServerAddress {
  name: string;
  full_name: string;
}

/** A message as the server lists it (`Header` in `src/apps/mail/model.rs`). */
export interface ServerHeader {
  id: string;
  mailbox: MailboxId;
  from: ServerAddress;
  to: ServerAddress[];
  cc: ServerAddress[];
  bcc?: ServerAddress[];
  reply_to?: string;
  priority?: MailPriority;
  subject: string;
  at_ms: number;
  unread: boolean;
  flag?: MailFlag;
  muted: boolean;
  rules_pending?: boolean;
  text: string;
  html: boolean;
  attachments?: SentAttachment[];
}

interface ServerBody {
  text: string;
  html?: string | null;
}

/** How many pages of headers (each up to 500) a load reads at first; Load More adds one. */
const FIRST_PAGES = 2;
/** Pages enough for any history: the list then reads until the server has no more. */
const EVERY_PAGE = 100_000;

/** The headers of a `GET /messages` reply, or `null` when it is not one. */
export function headersOf(reply: unknown): ServerHeader[] | null {
  const messages = (reply as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) return null;
  return messages.filter(
    (each): each is ServerHeader =>
      typeof each === "object" &&
      each !== null &&
      typeof (each as ServerHeader).id === "string" &&
      typeof (each as ServerHeader).mailbox === "string" &&
      typeof (each as ServerHeader).subject === "string" &&
      typeof (each as ServerHeader).at_ms === "number" &&
      typeof (each as ServerHeader).from?.name === "string" &&
      Array.isArray((each as ServerHeader).to),
  );
}

/** The mailboxes the person made, from a `GET /messages` reply. */
export function ownMailboxesOf(reply: unknown): OwnMailbox[] {
  const mailboxes = (reply as { mailboxes?: unknown } | null)?.mailboxes;
  if (!Array.isArray(mailboxes)) return [];
  return mailboxes.filter(
    (each): each is OwnMailbox =>
      typeof each?.id === "string" && isOwnMailbox(each.id) && typeof each.name === "string",
  );
}

/** How a person is shown: the full name, or the account name. */
const label = (address: ServerAddress) => address.full_name || address.name;
/**
 * How an account is addressed: `Full Name <name@macalicious>`, or `name@macalicious` for one
 * with no full name, so that the same person always has the same mailbox.
 */
export const addressOf = (address: ServerAddress): string =>
  address.full_name
    ? `${address.full_name} <${address.name}@${DOMAIN}>`
    : `${address.name}@${DOMAIN}`;
/** A draft's recipient: kept as it was typed (the server resolves it when the draft is sent). */
const typedAddress = (address: ServerAddress): string => address.name;

/** A server message as the viewer shows it; `body` the loaded text, else the header's start. */
export function toMailMessage(header: ServerHeader, body?: ServerBody): MailMessage {
  const at = new Date(header.at_ms);
  // A draft's recipients are what was typed; everyone else on a message is an account.
  const recipient =
    header.mailbox === "drafts" || header.mailbox === "outbox" ? typedAddress : addressOf;
  return {
    id: header.id,
    mailbox: header.mailbox,
    from: label(header.from),
    fromAddress: addressOf(header.from),
    to: header.to.map(label),
    toAddresses: header.to.map(recipient),
    cc: (header.cc ?? []).map(recipient),
    bcc: (header.bcc ?? []).map(recipient),
    replyTo: header.reply_to,
    priority: header.priority,
    subject: header.subject,
    date: at.toLocaleDateString("en-US", { dateStyle: "short" }),
    received: `${at.toLocaleDateString("en-US", { dateStyle: "long" })} at ${at.toLocaleTimeString("en-US", { timeStyle: "short" })}`,
    time: header.at_ms,
    body: body?.text ?? header.text,
    unread: header.unread,
    flag: header.flag,
    muted: header.muted,
    rulesPending: header.rules_pending === true,
    html: body?.html ?? undefined,
    attachmentCount: header.attachments?.length ?? 0,
  };
}

/** A fresh random idempotency key (16 random bytes where `randomUUID` is missing). */
function randomKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** GET `url` as JSON within the request deadline, or reject. */
function getJson(url: string): Promise<unknown> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, { credentials: "same-origin", signal });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  });
}

/** Window > Connection Doctor: whether the server answers, how fast, and for whom. */
export async function checkConnection(): Promise<{ ok: boolean; detail: string }> {
  const began = performance.now();
  try {
    const reply = (await getJson(`${API}/me`)) as { name?: unknown } | null;
    const took = Math.round(performance.now() - began);
    return {
      ok: true,
      detail: `answered in ${took} ms${typeof reply?.name === "string" ? `, signed in as ${reply.name}` : ""}.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `no answer: ${error instanceof Error ? error.message : "the request failed"}.`,
    };
  }
}

/** The most a request that outlives the page may carry: browsers allow 64 KiB in all. */
const KEEPALIVE_BYTES = 60_000;

/** Send `body` as JSON to `url` with `method`: the status and the parsed answer (0 if none). */
async function sendJson(
  url: string,
  method: string,
  body: unknown,
  key?: string,
  leaving = false,
): Promise<{ status: number; body: unknown }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          ...(key ? { "idempotency-key": key } : {}),
        },
        body: payload,
        // Outlives the page, within the browser's limit for such a request: a larger message may
        // not arrive, and what its last save held remains (mail.mdx).
        keepalive: leaving && new TextEncoder().encode(payload ?? "").length < KEEPALIVE_BYTES,
        signal,
      });
      let answer: unknown = null;
      try {
        answer = await response.json();
      } catch {
        // No JSON body.
      }
      return { status: response.status, body: answer };
    });
  } catch {
    return { status: 0, body: null };
  }
}

const errorText = (body: unknown, fallback: string) => {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" && error ? error : fallback;
};

const outboxId = (entry: OutboxEntry) => `outbox-${entry.key}`;
const typed = (name: string): ServerAddress => ({ name, full_name: "" });

/** A message waiting in the Outbox, as the list shows a message from the server. */
export function outboxHeader(entry: OutboxEntry, me: ServerAddress): ServerHeader {
  return {
    id: outboxId(entry),
    mailbox: "outbox",
    from: me,
    to: entry.body.to.map(typed),
    cc: entry.body.cc.map(typed),
    bcc: (entry.body.bcc ?? []).map(typed),
    subject: entry.body.subject.trim() || "(No Subject)",
    at_ms: entry.at,
    unread: false,
    muted: false,
    text: entry.body.text,
    html: Boolean(entry.body.html),
  };
}

const flushing = new Map<string, Promise<number>>();

/** What a message says that waits in the Outbox with no known outcome. */
const TRIES_AGAIN =
  "Mail could not tell whether it was sent. Get Mail tries again, and it is never delivered twice.";
/** How often what `TRIES_AGAIN` says of is tried, when nobody asks. */
const SEND_LATER_EVERY_MS = 60_000;

/**
 * Sends what waits in the person's Outbox, oldest first, each under its own key: an answer lost, a
 * crash before its entry goes, or a second tab flushing too sends the same key, and the server
 * delivers it once. A refusal stays in the Outbox with its reason, and the rest go on; an unknown
 * outcome stops here until the next Get Mail or start. How many left the Outbox.
 */
export function flushOutbox(me: string): Promise<number> {
  const running = flushing.get(me);
  if (running) return running;
  const flush = (async () => {
    let sent = 0;
    for (const entry of await readOutbox(me)) {
      if (isOffline(me)) break;
      const reply = await sendJson(`${API}/send`, "POST", entry.body, entry.key);
      // 409: sent by an earlier try, and that copy has since been erased.
      if (reply.status === 200 || reply.status === 201 || reply.status === 409) {
        await forgetSendKey(me, entry.body);
        await dropFromOutbox(me, entry.key);
        sent += 1;
        continue;
      }
      const unknown = reply.status === 0 || reply.status >= 500;
      await keepInOutbox(me, {
        ...entry,
        error: unknown ? TRIES_AGAIN : errorText(reply.body, "The server refused it."),
      });
      if (unknown) break;
    }
    return sent;
  })()
    .catch(() => 0)
    .finally(() => flushing.delete(me));
  flushing.set(me, flush);
  return flush;
}

/**
 * Changes to several messages go at most this many at a time: a request waiting behind the
 * browser's own limit would run out its deadline without having been sent.
 */
const REQUESTS_AT_ONCE = 6;
let requestsRunning = 0;
const requestsWaiting: (() => void)[] = [];

export async function inTurn<T>(request: () => Promise<T>): Promise<T> {
  // A request that ends hands its place to the next waiting, so a new one never slips in.
  if (requestsRunning >= REQUESTS_AT_ONCE) {
    await new Promise<void>((turn) => requestsWaiting.push(turn));
  } else {
    requestsRunning += 1;
  }
  try {
    return await request();
  } finally {
    const next = requestsWaiting.shift();
    if (next) next();
    else requestsRunning -= 1;
  }
}

/** Why a message's text is not shown while Mail is offline. */
const NOT_DOWNLOADED =
  "This message has not been downloaded. Take All Accounts Online to read all of it.";

/** The Preferences' choice of when to look for mail is other than as the server announces it. */
const checkingByChoice = () => checksByChoice(readMailSettings(desktopValues()[MAIL_SETTINGS]));

function ServedMail(props: MailProps) {
  useEffect(mailRunning, []);
  const [viewers, setViewers] = useState<readonly number[]>([]);
  const openViewer = () => setViewers((all) => [...all, (all.at(-1) ?? 0) + 1]);
  const [headers, setHeaders] = useState<readonly ServerHeader[] | null>(null);
  const [bodies, setBodies] = useState<ReadonlyMap<string, ServerBody>>(() => new Map());
  const [me, setMe] = useState<{ name: string; full_name: string } | null>(null);
  const [people, setPeople] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  // Counts the mailbox loads (Get Mail, focus, the person's own changes): a body that could not
  // be read is asked for again with each.
  const [attempts, setAttempts] = useState(0);
  // Whether the server holds older headers than the pages read (Load More reads one more page).
  const [more, setMore] = useState(false);
  const [ownMailboxes, setOwnMailboxes] = useState<readonly OwnMailbox[]>([]);
  // When the list of mailboxes last changed here, on the same count as `clock`: a load begun
  // before that holds the list as it was.
  const ownChanged = useRef(0);
  const pages = useRef(FIRST_PAGES);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [sending, setSending] = useState(false);
  // The idempotency key of the New Message window's send whose outcome is unknown (no answer, or
  // a 5xx), if one is: the window's message is held as it is (`held`) and Send sends it again
  // under the same key, so it is never delivered twice, whatever was answered. A window that
  // opens or closes starts with none.
  const unsure = useRef<string | null>(null);
  const [held, setHeld] = useState(false);
  const outgoing = useOutgoingFiles(sending || held);
  // The files of drafts read for opening, by draft: a window opened from that draft takes them.
  const draftFiles = useRef(new Map<string, readonly SentAttachment[]>());
  // One load at a time: a load asked for while one runs is made once that one has finished.
  const running = useRef(false);
  const queued = useRef(false);
  const gone = useRef(false);
  // Changes and erasures sent and not yet answered, by message, and when each message was last
  // changed here, on the same count as the start of each load (`clock`). A load keeps the
  // window's own copy of a message with a change pending, or changed after the load began.
  const pending = useRef(new Map<string, number>());
  const touched = useRef(new Map<string, number>());
  const clock = useRef(0);
  const touch = (id: string) => touched.current.set(id, ++clock.current);
  // Set by Don't Save after a draft could not be saved: the next close discards the message.
  const discardNext = useRef(false);
  // The idempotency key of a draft save whose outcome is unknown (no answer, or a 5xx), with the
  // body it carried: closing the window again with the same draft saves it under the same key,
  // so the server stores it once. A draft that changed meanwhile is a new save, with a new key.
  const unsureDraft = useRef<{ key: string; body: string } | null>(null);

  // The pages of the mailboxes, following the server's cursor, and whether older ones remain.
  // The person's own address is asked for with every load until it is known.
  const meKnown = useRef(false);
  const meName = useRef<string | null>(null);
  const offlineNow = () => meName.current !== null && isOffline(meName.current);
  // Whether this window has yet looked for what a reload left: a snapshot, or a draft too large for
  // the request that outlived its page.
  const startedOffline = useRef(false);
  const leavingChecked = useRef(false);
  const loadMe = useCallback(async () => {
    try {
      const body = (await getJson(`${API}/me`)) as { name?: unknown; full_name?: unknown };
      if (typeof body.name === "string" && typeof body.full_name === "string") {
        meKnown.current = true;
        meName.current = body.name;
        setMe({ name: body.name, full_name: body.full_name });
      }
    } catch {
      // Asked again with the next load.
    }
  }, []);
  const load = useCallback(
    async function run(): Promise<void> {
      if (running.current) {
        queued.current = true;
        return;
      }
      running.current = true;
      const began = ++clock.current;
      setAttempts((count) => count + 1);
      try {
        // Whose Mail this is decides whether it may be read: offline is the person's.
        if (!meKnown.current) await loadMe();
        const name = meName.current;
        if (name && !leavingChecked.current) {
          leavingChecked.current = true;
          const leaving = leavingDraft(name);
          if (leaving) {
            const reply = await sendJson(`${API}/drafts`, "POST", leaving.body, leaving.key);
            if (reply.status !== 0 && reply.status < 500) forgetLeavingDraft(name);
            else leavingChecked.current = false;
          }
        }
        if (name && isOffline(name)) {
          if (startedOffline.current) return;
          startedOffline.current = true;
          const kept = await readSnapshot<ServerHeader, ServerBody, OwnMailbox>(name);
          if (kept && !gone.current) {
            setHeaders((shown) => shown ?? kept.headers);
            setBodies((shown) => (shown.size > 0 ? shown : new Map(kept.bodies)));
            setOwnMailboxes((shown) => (shown.length > 0 ? shown : kept.mailboxes));
          }
          return;
        }
        startedOffline.current = true;
        const all: ServerHeader[] = [];
        let after: string | null = null;
        let older = false;
        let listedMailboxes: OwnMailbox[] = [];
        for (let page = 0; page < pages.current; page += 1) {
          const reply: unknown = await getJson(
            after ? `${API}/messages?after=${encodeURIComponent(after)}` : `${API}/messages`,
          );
          if (gone.current) return;
          const listed = headersOf(reply);
          if (!listed) throw new Error("not a mailbox");
          if (page === 0) listedMailboxes = ownMailboxesOf(reply);
          all.push(...listed);
          const next = (reply as { next?: unknown } | null)?.next;
          older = typeof next === "string" && next !== "";
          if (!older) break;
          after = next as string;
        }
        const held = (id: string) =>
          pending.current.has(id) || (touched.current.get(id) ?? 0) > began;
        setHeaders((shown) => {
          const own = new Map((shown ?? []).map((header) => [header.id, header]));
          return all.flatMap((header) => {
            if (!held(header.id)) return [header];
            const mine = own.get(header.id);
            return mine ? [mine] : [];
          });
        });
        setMore(older);
        if (ownChanged.current <= began) setOwnMailboxes(listedMailboxes);
        const ids = new Set(all.map((header) => header.id));
        setBodies((cached) =>
          [...cached.keys()].every((id) => ids.has(id))
            ? cached
            : new Map([...cached].filter(([id]) => ids.has(id))),
        );
        setFailure(null);
      } catch {
        if (!gone.current) setFailure("Mail could not load your mailboxes.");
      } finally {
        running.current = false;
        if (queued.current && !gone.current) {
          queued.current = false;
          void run();
        }
      }
    },
    [loadMe],
  );

  const loadPeople = useCallback(() => {
    if (meName.current && isOffline(meName.current)) return;
    getJson("/api/contacts/people").then(
      (reply) => {
        const list = (reply as { people?: unknown } | null)?.people;
        if (!Array.isArray(list)) return;
        setPeople(
          list.flatMap((person) => {
            const { user, full_name: full } = (person ?? {}) as {
              user?: unknown;
              full_name?: unknown;
            };
            if (typeof user !== "string") return [];
            const name = typeof full === "string" && full ? full : user;
            return [`${name} <${user}@${DOMAIN}>`];
          }),
        );
      },
      () => {},
    );
  }, []);

  // Read when the window opens and when it gains focus: mail that arrived, and a change made in
  // another browser of the person, show then (and with Get Mail).
  useEffect(() => {
    gone.current = false;
    const refresh = () => {
      void load().then(loadPeople);
    };
    // The person's Mail changed: mail delivered to them, or a change in another browser.
    const changed = (event: Event) => {
      if (checkingByChoice()) return;
      if ((event as CustomEvent<{ app?: unknown }>).detail?.app === "mail") void load();
    };
    const focused = () => {
      if (!checkingByChoice()) refresh();
    };
    // Preferences > General > Check for new messages, looked at once a minute so that a change to it
    // takes effect without opening Mail again.
    let looked = Date.now();
    const clock = setInterval(() => {
      const every = checkEvery(readMailSettings(desktopValues()[MAIL_SETTINGS]));
      if (every === null || Date.now() - looked < every) return;
      looked = Date.now();
      void load();
    }, 60_000);
    refresh();
    window.addEventListener("focus", focused);
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      clearInterval(clock);
      window.removeEventListener("focus", focused);
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
      gone.current = true;
    };
  }, [load, loadPeople]);

  const name = me?.name ?? null;
  const offline = useSyncExternalStore(
    onOutboxChange,
    () => name !== null && isOffline(name),
    () => false,
  );
  const [outbox, setOutbox] = useState<readonly OutboxEntry[]>([]);
  useEffect(() => {
    if (name === null) return;
    let live = true;
    const read = () => {
      void readOutbox(name).then((entries) => {
        if (live) setOutbox(entries);
      });
    };
    read();
    const stop = onOutboxChange(read);
    return () => {
      live = false;
      stop();
    };
  }, [name]);
  // Online again, here or in another tab, or started with something still waiting (a tab closed
  // part way through sending): what waits goes, and the mailboxes are read.
  const wasOffline = useRef(false);
  useEffect(() => {
    if (name === null) return;
    if (offline) {
      wasOffline.current = true;
      return;
    }
    void dropSnapshot(name);
    void flushOutbox(name).then((sent) => {
      if (sent === 0 && !wasOffline.current) return;
      wasOffline.current = false;
      void load().then(loadPeople);
    });
  }, [name, offline, load, loadPeople]);
  useEffect(() => {
    if (name === null || offline || !outbox.some((entry) => entry.error === TRIES_AGAIN)) return;
    const clock = setInterval(() => {
      void flushOutbox(name).then((sent) => {
        if (sent > 0) void load();
      });
    }, SEND_LATER_EVERY_MS);
    return () => clearInterval(clock);
  }, [name, offline, outbox, load]);
  useEffect(() => {
    if (name === null || !offline || !headers) return;
    void keepSnapshot(name, { headers, bodies: [...bodies], mailboxes: ownMailboxes });
  }, [name, offline, headers, bodies, ownMailboxes]);

  const messages = useMemo(() => {
    // A message on its way is not also a draft: the send erases what it was written in.
    const inOutbox = new Set(outbox.map((entry) => entry.body.draft));
    return [
      ...(headers ?? [])
        .filter((header) => !inOutbox.has(header.id))
        .map((header) => toMailMessage(header, bodies.get(header.id))),
      ...(me
        ? outbox.map((entry) => ({
            ...toMailMessage(outboxHeader(entry, me)),
            attachmentCount: entry.body.attachments.length,
          }))
        : []),
    ];
  }, [headers, bodies, outbox, me]);
  const meAddress = me ? addressOf(me) : undefined;
  // The newest change sent for each message, after which the next one is sent.
  const patching = useRef(new Map<string, Promise<void>>());
  const begin = (id: string) => {
    pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    touch(id);
  };
  // Whether this was the message's last change under way.
  const settle = (id: string): boolean => {
    const left = (pending.current.get(id) ?? 1) - 1;
    if (left > 0) pending.current.set(id, left);
    else pending.current.delete(id);
    touch(id);
    return left <= 0;
  };

  // Deleted from the Outbox: it will not be sent, and any draft it was written in shows again.
  const dropWaiting = (id: string) => {
    const entry = outbox.find((each) => outboxId(each) === id);
    if (!entry || !name) return;
    void forgetSendKey(name, entry.body).then(() => dropFromOutbox(name, entry.key));
  };

  const change = (id: string, next: MailMessageChange) => {
    if (id.startsWith("outbox-")) {
      if (next.mailbox !== undefined) dropWaiting(id);
      return;
    }
    const patch: Record<string, unknown> = {};
    if (next.unread !== undefined) patch.unread = next.unread;
    if (next.muted !== undefined) patch.muted = next.muted;
    if (next.mailbox !== undefined) patch.mailbox = next.mailbox;
    if ("flag" in next) patch.flag = next.flag ?? null;
    if ("priority" in next) patch.priority = next.priority ?? null;
    if (next.rulesPending === false) patch.rules_ran = true;
    setHeaders(
      (all) =>
        all?.map((header) =>
          header.id === id
            ? {
                ...header,
                ...(next.unread !== undefined ? { unread: next.unread } : {}),
                ...(next.muted !== undefined ? { muted: next.muted } : {}),
                ...(next.mailbox !== undefined ? { mailbox: next.mailbox } : {}),
                ...("flag" in next ? { flag: next.flag } : {}),
                ...("priority" in next ? { priority: next.priority } : {}),
                ...(next.rulesPending === false ? { rules_pending: false } : {}),
              }
            : header,
        ) ?? null,
    );
    // One message's changes reach the server in the order they were made. The server's copy
    // replaces the window's only once its last change is answered.
    begin(id);
    const before = patching.current.get(id) ?? Promise.resolve();
    const after = before.then(() =>
      inTurn(() => sendJson(`${API}/messages/${id}`, "PATCH", patch)).then((reply) => {
        const last = settle(id);
        if (reply.status >= 300 || reply.status === 0) {
          void load();
          return;
        }
        const header = headersOf({
          messages: [(reply.body as { message?: unknown } | null)?.message],
        })?.[0];
        if (last && header) {
          setHeaders((all) => all?.map((each) => (each.id === id ? header : each)) ?? null);
        }
      }),
    );
    patching.current.set(id, after);
    void after.then(() => {
      if (patching.current.get(id) === after) patching.current.delete(id);
    });
  };

  // A mailbox made or renamed: `null`, or why not. The server answers a name it has already with
  // that mailbox, so a request sent again makes nothing twice.
  const nameMailbox = async (
    url: string,
    method: string,
    name: string,
    fallback: string,
  ): Promise<string | null> => {
    const reply = await sendJson(url, method, { name });
    if (reply.status !== 200) return errorText(reply.body, fallback);
    const [mailbox] = ownMailboxesOf({
      mailboxes: [(reply.body as { mailbox?: unknown } | null)?.mailbox],
    });
    if (mailbox) {
      ownChanged.current = ++clock.current;
      setOwnMailboxes((all) =>
        all.some((each) => each.id === mailbox.id)
          ? all.map((each) => (each.id === mailbox.id ? mailbox : each))
          : [...all, mailbox],
      );
    }
    return null;
  };
  // Deleted a run of the history at a time, as long as the server asks; asked again, a mailbox
  // already gone changes nothing.
  const deleteMailbox = async (id: OwnMailboxId) => {
    let after: string | null = null;
    for (;;) {
      const query: string = after ? `?after=${encodeURIComponent(after)}` : "";
      const reply = await sendJson(`${API}/mailboxes/${id}${query}`, "DELETE", undefined);
      if (reply.status !== 200) {
        setFailure(errorText(reply.body, "Mail could not delete the mailbox."));
        return;
      }
      const answer = reply.body as { more?: unknown; next?: unknown } | null;
      if (answer?.more !== true || typeof answer.next !== "string") break;
      after = answer.next;
    }
    ownChanged.current = ++clock.current;
    setOwnMailboxes((all) => all.filter((each) => each.id !== id));
    void load();
  };

  // Copy to: each message once under a key of this request's, the list then read again for the copies.
  const copyMessages = async (chosen: readonly MailMessage[], to: MailboxId) => {
    for (const message of chosen) {
      const reply = await sendJson(
        `${API}/messages/${encodeURIComponent(message.id)}/copy`,
        "POST",
        {
          mailbox: to,
          key: randomKey(),
        },
      );
      if (reply.status !== 200) {
        setFailure(errorText(reply.body, "Mail could not copy the message."));
        break;
      }
    }
    void load();
  };

  // Message > Remove Attachments: a message's files off it, one message at a time.
  const removeAttachments = async (chosen: readonly MailMessage[]) => {
    for (const message of chosen) {
      const reply = await sendJson(`${API}/messages/${encodeURIComponent(message.id)}`, "PATCH", {
        remove_attachments: true,
      });
      if (reply.status !== 200) {
        setFailure(errorText(reply.body, "Mail could not remove the attachments."));
        break;
      }
    }
    void load();
  };

  // File > Import Mailboxes: a mailbox named for the file, then each message under the key the file
  // gives it, so importing the same file again adds nothing. What the server refuses is counted.
  const importMailbox = async (
    name: string,
    imported: readonly ImportedMessage[],
  ): Promise<{ made: number; refused: number } | string> => {
    const reply = await sendJson(`${API}/mailboxes`, "POST", { name });
    if (reply.status !== 200) return errorText(reply.body, "Mail could not make the mailbox.");
    const [mailbox] = ownMailboxesOf({
      mailboxes: [(reply.body as { mailbox?: unknown } | null)?.mailbox],
    });
    if (!mailbox) return "Mail could not make the mailbox.";
    const answers = await Promise.all(
      imported.map((message) =>
        inTurn(() =>
          sendJson(`${API}/import`, "POST", {
            mailbox: mailbox.id,
            key: message.key,
            from: message.from,
            to: message.to,
            cc: message.cc,
            subject: message.subject,
            at_ms: message.time,
            text: message.text,
          }),
        ),
      ),
    );
    await load();
    const made = answers.filter((each) => each.status === 200).length;
    return { made, refused: imported.length - made };
  };

  const send = async (
    draft: MailDraft,
    from: { draftId?: string; sentBox?: string },
  ): Promise<boolean | "kept"> => {
    const waiting = outgoing.notReady();
    if (waiting) {
      setNotice(waiting);
      return false;
    }
    const body = {
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      reply_to: draft.replyTo,
      priority: draft.priority,
      subject: draft.subject,
      text: draft.body,
      html: draft.html,
      attachments: outgoing.ids(),
      draft: from.draftId,
      sent_box: from.sentBox,
    };
    if (name && isOffline(name)) {
      try {
        await keepInOutbox(name, {
          key: await sendKeyFor(name, body, randomKey()),
          at: Date.now(),
          body,
        });
      } catch {
        setNotice("This browser could not keep the message for the Outbox. Try sending it again.");
        return false;
      }
      forgetLeavingDraft(name);
      outgoing.sent();
      return true;
    }
    // While the window is held the message cannot have changed: the same key sends the same
    // message. So does the same message sent later from what the window left behind.
    const key = unsure.current ?? (me ? await sendKeyFor(me.name, body, randomKey()) : randomKey());
    setSending(true);
    setNotice(null);
    const reply = await sendJson(`${API}/send`, "POST", body, key);
    setSending(false);
    const unknown = reply.status === 0 || reply.status >= 500;
    // Preferences > General > Automatically try sending later: it waits in the Outbox under its key.
    if (unknown && name && readMailSettings(desktopValues()[MAIL_SETTINGS])?.sendLater === true) {
      const kept = await keepInOutbox(name, { key, at: Date.now(), body, error: TRIES_AGAIN }).then(
        () => true,
        () => false,
      );
      if (kept) {
        unsure.current = null;
        setHeld(false);
        forgetLeavingDraft(name);
        outgoing.sent();
        return "kept";
      }
    }
    unsure.current = unknown ? key : null;
    setHeld(unknown);
    if (!unknown && me) await forgetSendKey(me.name, body);
    if (reply.status === 200 || reply.status === 201) {
      outgoing.sent();
      void load();
      return true;
    }
    const answer = reply.body as { unknown?: unknown; outside?: unknown } | null;
    if (reply.status === 422 && Array.isArray(answer?.unknown)) {
      setNotice(`No account on this desktop is called ${answer.unknown.join(", ")}.`);
    } else if (reply.status === 422 && Array.isArray(answer?.outside)) {
      setNotice(
        `This desktop delivers mail only to its own accounts (name@${DOMAIN}); it has no internet mail provider for ${answer.outside.join(", ")}.`,
      );
    } else if (unknown) {
      setNotice(
        <>
          Mail could not tell whether the message was sent. Send again: it is never delivered twice.
          Until then it cannot be changed or closed, or{" "}
          <PushButton
            size="mini"
            onClick={() => {
              // The person lets it go: kept as a draft and sent later, it may arrive twice.
              unsure.current = null;
              if (me) void forgetSendKey(me.name, body);
              setHeld(false);
              setNotice(
                "The message can be changed again. If the first send went through, sending it again delivers it twice.",
              );
            }}
          >
            Edit Anyway
          </PushButton>
        </>,
      );
    } else {
      setNotice(errorText(reply.body, "The message could not be sent."));
    }
    return false;
  };

  // A save stores the draft under a new id: the list holds that id from the answer on, since a row
  // left with the old one answers 404 until the list is read again.
  const draftStored = (replaced: string | undefined, answer: unknown): string | undefined => {
    const header = headersOf({
      messages: [(answer as { message?: unknown } | null)?.message],
    })?.[0];
    if (replaced) {
      touch(replaced);
      forgetBody(replaced);
    }
    if (header) {
      touch(header.id);
      setHeaders((all) => [
        header,
        ...(all ?? []).filter((each) => each.id !== replaced && each.id !== header.id),
      ]);
    }
    void load();
    return header?.id;
  };

  // Closing the New Message window keeps what it holds as a draft. The window closes only once
  // the draft is kept; when it cannot be, it stays open with a notice, and Don't Save lets the
  // next close discard it.
  const saveDraft = async (draft: MailDraft, draftId?: string): Promise<boolean> => {
    if (discardNext.current) {
      discardNext.current = false;
      return true;
    }
    const waiting = outgoing.notReady();
    if (waiting) {
      setNotice(`${waiting} Then close the window.`);
      return false;
    }
    const files = outgoing.ids();
    const worth =
      draft.to.length + draft.cc.length + (draft.bcc?.length ?? 0) > 0 ||
      draft.subject.trim() !== "" ||
      (draft.replyTo ?? "") !== "" ||
      draft.priority !== undefined ||
      draft.body.trim() !== "" ||
      files.length > 0;
    // Nothing to keep. A saved draft emptied of everything is erased, so what was removed does
    // not come back.
    if (!worth) {
      if (!draftId) return true;
      const erased = await sendJson(
        `${API}/messages/${encodeURIComponent(draftId)}`,
        "DELETE",
        undefined,
      );
      if (erased.status === 200) {
        void load();
        return true;
      }
      setNotice("The emptied draft could not be removed. Close the window again to try again.");
      return false;
    }
    // Saved with an idempotency key: a save whose answer was lost and is made again (closing the
    // window again) carries the same key, and the server stores the draft once.
    const body = {
      id: draftId,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      reply_to: draft.replyTo,
      priority: draft.priority,
      subject: draft.subject,
      text: draft.body,
      html: draft.html,
      attachments: files,
    };
    const serialized = JSON.stringify(body);
    const key = unsureDraft.current?.body === serialized ? unsureDraft.current.key : randomKey();
    const reply = await sendJson(`${API}/drafts`, "POST", body, key);
    unsureDraft.current =
      reply.status === 0 || reply.status >= 500 ? { key, body: serialized } : null;
    if (reply.status === 200) {
      if (name) forgetLeavingDraft(name);
      outgoing.held(files);
      draftStored(draftId, reply.body);
      return true;
    }
    setNotice(
      <>
        {errorText(reply.body, "The draft could not be saved.")} Close the window again to try
        again, or{" "}
        <PushButton
          size="mini"
          onClick={() => {
            discardNext.current = true;
            setNotice("Close the window to discard this message.");
          }}
        >
          Don’t Save
        </PushButton>
      </>,
    );
    return false;
  };

  // What an open New Message window holds, kept as it is written: nothing typed is lost when the
  // window, Mail or the page goes away. Says nothing when a save fails: it rejects, the window
  // tries again, and closing the window says so. A draft emptied of everything is removed, so what
  // was taken out does not come back.
  const autosaveDraft = async (draft: MailDraft, draftId: string | undefined, leaving: boolean) => {
    const files = outgoing.ids();
    const body = {
      id: draftId,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      reply_to: draft.replyTo,
      priority: draft.priority,
      subject: draft.subject,
      text: draft.body,
      html: draft.html,
      attachments: files,
    };
    const worth =
      draft.to.length + draft.cc.length + (draft.bcc?.length ?? 0) > 0 ||
      draft.subject.trim() !== "" ||
      (draft.replyTo ?? "") !== "" ||
      draft.priority !== undefined ||
      draft.body.trim() !== "" ||
      files.length > 0;
    if (!worth) {
      // Nothing to keep yet, but a file on its way: the draft stays until it is known.
      if (!draftId || outgoing.notReady()) return draftId;
      const erased = await sendJson(
        `${API}/messages/${encodeURIComponent(draftId)}`,
        "DELETE",
        undefined,
        undefined,
        leaving,
      );
      if (erased.status !== 200) throw new Error("the emptied draft was not removed");
      void load();
      return undefined;
    }
    const key = randomKey();
    // Too large for a request that outlives the page: kept here too, for the next start to save.
    if (
      leaving &&
      name &&
      new TextEncoder().encode(JSON.stringify(body)).length >= KEEPALIVE_BYTES
    ) {
      keepLeavingDraft(name, { key, body });
    }
    const reply = await sendJson(`${API}/drafts`, "POST", body, key, leaving);
    if (reply.status !== 200) throw new Error("the draft was not saved");
    if (name) forgetLeavingDraft(name);
    const stored = draftStored(draftId, reply.body) ?? draftId;
    outgoing.held(files, stored);
    return stored;
  };

  // A saved draft opens with all of it, read now: its whole text and styles.
  const resolveDraft = async (message: MailMessage): Promise<MailDraft | null> => {
    try {
      const reply = (
        offlineNow()
          ? {
              message: listedNow.current.get(message.id),
              text: bodies.get(message.id)?.text,
              html: bodies.get(message.id)?.html,
            }
          : await getJson(`${API}/messages/${encodeURIComponent(message.id)}`)
      ) as {
        message?: ServerHeader;
        text?: unknown;
        html?: unknown;
      } | null;
      const header = reply?.message;
      if (!header || typeof reply?.text !== "string") throw new Error("not a draft");
      const body: ServerBody = {
        text: reply.text,
        html: typeof reply.html === "string" ? reply.html : null,
      };
      setBodies((all) => new Map(all).set(header.id, body));
      draftFiles.current.set(header.id, header.attachments ?? []);
      return {
        to: header.to.map(typedAddress),
        cc: (header.cc ?? []).map(typedAddress),
        bcc: (header.bcc ?? []).map(typedAddress),
        replyTo: header.reply_to,
        priority: header.priority,
        subject: header.subject === "(No Subject)" ? "" : header.subject,
        body: body.text,
        html: body.html ?? undefined,
      };
    } catch {
      // Another browser of the person may have changed the draft: the list shows what is there now.
      void load();
      setFailure(offlineNow() ? NOT_DOWNLOADED : "The draft could not be opened. Try again.");
      return null;
    }
  };

  const forgetBody = (id: string) =>
    setBodies((all) => {
      if (!all.has(id)) return all;
      const next = new Map(all);
      next.delete(id);
      return next;
    });

  const erase = (id: string) => {
    if (id.startsWith("outbox-")) {
      dropWaiting(id);
      return;
    }
    begin(id);
    setHeaders((all) => all?.filter((header) => header.id !== id) ?? null);
    forgetBody(id);
    // After any change of it still on its way: Erase Junk Mail moves a message to the Trash first.
    const before = patching.current.get(id) ?? Promise.resolve();
    void before
      .then(() => inTurn(() => sendJson(`${API}/messages/${id}`, "DELETE", undefined)))
      .then((reply) => {
        settle(id);
        if (reply.status !== 200) setFailure("A message could not be erased. Try again.");
        else void messageErased(id);
        void load();
      });
  };

  // A message's whole text, read now, for a reply or a forward to quote.
  const resolveBody = async (message: MailMessage): Promise<string | null> => {
    const cached = bodies.get(message.id);
    if (cached) return cached.text;
    const waiting = outbox.find((each) => outboxId(each) === message.id);
    if (waiting) return waiting.body.text;
    if (offlineNow()) {
      setFailure(NOT_DOWNLOADED);
      return null;
    }
    try {
      const reply = (await getJson(`${API}/messages/${encodeURIComponent(message.id)}`)) as {
        text?: unknown;
        html?: unknown;
      } | null;
      if (typeof reply?.text !== "string") throw new Error("no text");
      const text = reply.text;
      setBodies((all) =>
        new Map(all).set(message.id, {
          text,
          html: typeof reply.html === "string" ? reply.html : null,
        }),
      );
      return text;
    } catch {
      setFailure("The message could not be read. Try again.");
      return null;
    }
  };

  const byId = useMemo(
    () => new Map((headers ?? []).map((header) => [header.id, header])),
    [headers],
  );
  const listedNow = useRef(byId);
  listedNow.current = byId;
  const searchWholeText = useCallback(
    async (words: string): Promise<readonly string[]> => {
      if (meName.current && isOffline(meName.current)) return [];
      const ids: string[] = [];
      let after: string | null = null;
      do {
        const reply = (await getJson(
          `${API}/search?q=${encodeURIComponent(words)}${after ? `&after=${after}` : ""}`,
        )) as { ids?: unknown; next?: unknown } | null;
        if (Array.isArray(reply?.ids))
          ids.push(...reply.ids.filter((id) => typeof id === "string"));
        after = typeof reply?.next === "string" ? reply.next : null;
      } while (after);
      // A hit older than the pages read so far: the list reads on until it holds it.
      if (ids.some((id) => !listedNow.current.has(id))) {
        pages.current = EVERY_PAGE;
        void load();
      }
      return ids;
    },
    [load],
  );

  const renderBody = (message: MailMessage) => {
    const waiting = outbox.find((each) => outboxId(each) === message.id);
    if (waiting && me) {
      const files = waiting.body.attachments.length;
      return (
        <>
          <ServedBody
            header={outboxHeader(waiting, me)}
            body={{ text: waiting.body.text, html: waiting.body.html ?? null }}
            attempt={attempts}
            onLoaded={() => {}}
            onFailed={() => {}}
          />
          <Label color="secondary" role="status">
            {waiting.error ?? "Waiting in the Outbox: it is sent when Mail is taken online."}
            {files > 0
              ? ` ${files} attached ${files === 1 ? "file goes" : "files go"} with it.`
              : ""}
          </Label>
        </>
      );
    }
    const header = byId.get(message.id);
    if (!header) return null;
    return (
      <ServedBody
        key={header.id}
        header={header}
        body={bodies.get(header.id)}
        attempt={attempts}
        offline={offline}
        onLoaded={(body) => setBodies((all) => new Map(all).set(header.id, body))}
        onFailed={() => setFailure("The message could not be read. Try again.")}
      />
    );
  };

  return (
    <>
      <Mail
        keepsView
        {...props}
        // This desktop has no help book for Mail: a host fact, passed in.
        helpUnavailable={MAIL_HELP_UNAVAILABLE}
        messages={[]}
        defaultMessage={null}
        heldMessages={messages}
        heldMailboxes={ownMailboxes}
        onCreateMailbox={(name) =>
          nameMailbox(`${API}/mailboxes`, "POST", name, "Mail could not make the mailbox.")
        }
        onRenameMailbox={(id, name) =>
          nameMailbox(`${API}/mailboxes/${id}`, "PATCH", name, "Mail could not rename the mailbox.")
        }
        onDeleteMailbox={(id) => void deleteMailbox(id)}
        onCopyMessages={(chosen, to) =>
          void copyMessages(
            chosen.filter((each) => each.mailbox !== "outbox"),
            to,
          )
        }
        onRemoveAttachments={(chosen) =>
          void removeAttachments(chosen.filter((each) => each.mailbox !== "outbox"))
        }
        onImportMailbox={importMailbox}
        onSearchWholeText={searchWholeText}
        moreToLoad={more}
        contacts={people}
        me={meAddress ?? ""}
        notice={
          failure ??
          (offline ? (
            <>
              Mail is offline. What you send waits in the Outbox.{" "}
              <PushButton size="mini" onClick={() => name && setOffline(name, false)}>
                Take All Accounts Online
              </PushButton>
            </>
          ) : more ? (
            <>
              Older messages are not loaded.{" "}
              <PushButton
                size="mini"
                onClick={() => {
                  pages.current += 1;
                  void load();
                }}
              >
                Load More
              </PushButton>
            </>
          ) : null)
        }
        onMessageChange={change}
        onSend={send}
        onSaveDraft={saveDraft}
        onAutosaveDraft={autosaveDraft}
        resolveDraft={resolveDraft}
        resolveBody={resolveBody}
        onErase={erase}
        onGetMail={() => (name ? flushOutbox(name).then(load) : load())}
        offline={offline}
        onToggleOffline={name ? () => setOffline(name, !offline) : undefined}
        attachmentFiles={(message) =>
          attachmentFiles(message.id, byId.get(message.id)?.attachments ?? [])
        }
        onRebuild={() => {
          setBodies(new Map());
          return load();
        }}
        onCheckConnection={checkConnection}
        renderMessageBody={renderBody}
        onComposeChange={(open, draftId) => {
          setNotice(null);
          unsure.current = null;
          setHeld(false);
          discardNext.current = false;
          unsureDraft.current = null;
          if (open) outgoing.begin((draftId && draftFiles.current.get(draftId)) || [], draftId);
          else outgoing.closed();
        }}
        composeProps={{ notice, sending, held, attaching: outgoing.attaching }}
        onNewViewer={props.onNewViewer ?? (props.DesktopWindow ? openViewer : undefined)}
        takesSharedLinks={props.secondViewer !== true}
      />
      {props.DesktopWindow
        ? viewers.map((viewer) => (
            <SecondViewer
              key={viewer}
              id={`viewer-${viewer}`}
              DesktopWindow={props.DesktopWindow as ComponentType<DesktopSecondaryWindowProps>}
              onNewViewer={openViewer}
              onClose={() => setViewers((all) => all.filter((each) => each !== viewer))}
            />
          ))
        : null}
    </>
  );
}

/** A further viewer: a window of the desktop, whose own windows are told apart from the first's. */
function SecondViewer({
  id,
  DesktopWindow,
  onNewViewer,
  onClose,
}: {
  id: string;
  DesktopWindow: ComponentType<DesktopSecondaryWindowProps>;
  onNewViewer: () => void;
  onClose: () => void;
}) {
  const Own = useMemo(
    () => (window: DesktopSecondaryWindowProps) => (
      <DesktopWindow {...window} id={`${id}-${window.id}`} />
    ),
    [id, DesktopWindow],
  );
  return (
    <DesktopWindow
      id={id}
      title="Mail"
      defaultSize={mailViewerSize.defaultSize}
      minSize={mailViewerSize.minSize}
      onClose={onClose}
      render={(window) => (
        <ServedMail {...window} DesktopWindow={Own} onNewViewer={onNewViewer} secondViewer />
      )}
    />
  );
}

/**
 * A message's text in the message pane, read once it is shown. A text that could not be read is
 * asked for again whenever `attempt` changes (Get Mail, a load); one being read is left alone.
 */
export function ServedBody({
  header,
  body,
  attempt,
  offline = false,
  onLoaded,
  onFailed,
}: {
  header: ServerHeader;
  body?: ServerBody;
  attempt: number;
  /** Mail is offline: a text not yet read stays unread, and says so. */
  offline?: boolean;
  onLoaded: (body: ServerBody) => void;
  /** The text could not be read: the owner says so over the message list too. */
  onFailed: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;
  const failedNow = useRef(onFailed);
  failedNow.current = onFailed;
  // Whether the text has been asked for, and whether a request for it is under way.
  const asked = useRef(false);
  const busy = useRef(false);
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` asks again for a text that could not be read; `failed` is read as it stands
  useEffect(() => {
    if (offline || body || busy.current || (asked.current && !failed)) return;
    asked.current = true;
    busy.current = true;
    const fail = () => {
      busy.current = false;
      if (gone.current) return;
      setFailed(true);
      failedNow.current();
    };
    getJson(`${API}/messages/${header.id}`)
      .then((reply) => {
        const answer = reply as { text?: unknown; html?: unknown } | null;
        if (typeof answer?.text !== "string") {
          fail();
          return;
        }
        busy.current = false;
        if (gone.current) return;
        setFailed(false);
        loaded.current({
          text: answer.text,
          html: typeof answer.html === "string" ? answer.html : null,
        });
      })
      .catch(fail);
  }, [header.id, body, attempt, offline]);

  const styled = useRef<HTMLDivElement>(null);
  const html = body?.html;
  const attachments = header.attachments ?? NO_ATTACHMENTS;
  const downloads = useDesktopValue(MAIL_DOWNLOAD_ATTACHMENTS, readDownloadAttachments, true);
  const [placed, setPlaced] = useState<readonly { node: Element; file: SentAttachment }[]>([]);
  const placedIds = new Set(placed.map(({ file }) => file.id));
  const fileIds = attachments.map((each) => each.id).join();
  const latestFiles = useRef(attachments);
  latestFiles.current = attachments;
  // The styled text, rebuilt from what formatting writes alone: nothing in it runs or loads. A file
  // the sender placed in the text goes there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fileIds says when the files changed; a reload gives equal ones anew
  useLayoutEffect(() => {
    const node = styled.current;
    if (node && html) {
      node.replaceChildren(richTextFromHtml(html, node.ownerDocument, MAIL_FILE_HTML));
      setPlaced(placeFiles(node, latestFiles.current));
      // Its web addresses open in Safari; nothing else in it becomes a link.
      linkTextNodes(node, "mail");
      linkAddressNodes(node);
    } else setPlaced([]);
  }, [html, fileIds]);

  const text = body?.text ?? header.text;
  return (
    <>
      {html ? (
        <div ref={styled} className="mac-mail-live-styled" />
      ) : (
        text.split("\n\n").map((paragraph, index) => (
          <Label
            // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one message never reorder
            key={index}
            render={<p />}
            color="text"
            selectable
            className="mac-mail-paragraph"
          >
            {mailLinkedText(paragraph)}
          </Label>
        ))
      )}
      {offline && !body ? (
        <Label color="secondary" role="status">
          {NOT_DOWNLOADED}
        </Label>
      ) : null}
      {failed ? (
        <Label color="secondary" role="status">
          The rest of this message could not be loaded.
        </Label>
      ) : null}
      {placed.map(({ node, file }) =>
        createPortal(
          <ul className="mac-mail-live-placed" aria-label="Attachments">
            <ReceivedAttachment
              url={`${API}/messages/${header.id}/attachments/${file.id}`}
              messageId={header.id}
              attachment={file}
              askFirst={!downloads}
              folder={mailDownloadsFolder()}
            />
          </ul>,
          node,
          file.id,
        ),
      )}
      <ReceivedAttachments
        messageId={header.id}
        attachments={
          // Until the body is here it is unknown which files sit in its text; moving a picture there would read it twice.
          body || offline || failed
            ? attachments.filter((each) => !placedIds.has(each.id))
            : NO_ATTACHMENTS
        }
        askFirst={!downloads}
        folder={mailDownloadsFolder()}
      />
    </>
  );
}
