"use client";

import { PushButton } from "macalicious/push-button";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toggleCharacterViewer } from "../desktop/desktop-characters";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { currentDrive } from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import {
  type OpenItemRequest,
  onOpenItemRequest,
  takeOpenItemRequests,
} from "../desktop/desktop-open-item";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { onAddressRequest, takeAddressRequests } from "../desktop/desktop-reach";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  onSharedFiles,
  onSharedLink,
  type SharedLink,
  takeSharedFiles,
  takeSharedLinks,
} from "../desktop/desktop-share-link";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { openFile, showInFinder } from "../finder/finder-open";
import { Messages, type MessagesProps } from "./messages";
import { useAccountConversations } from "./messages-accounts";
import { BlockedPeoplePane } from "./messages-blocked-list";
import {
  DEFAULT_VIEW,
  type MessagesConversation,
  type MessagesMessage,
  type MessagesView,
  stampOf,
} from "./messages-data";
import { useDoNotDisturb } from "./messages-do-not-disturb";
import { readOutbox, writeOutbox } from "./messages-outbox";
import {
  MessagesPreferences,
  type MessagesPreferencesProps,
  SERVED_UNAVAILABLE,
} from "./messages-preferences";
import {
  MESSAGES_SELECTED,
  MESSAGES_SETTINGS,
  MESSAGES_VIEW,
  readMessagesSettings,
  readMessagesView,
  readSelected,
  readUnsent,
  writeUnsent,
} from "./messages-saved";
import { useMainWindowOpens, useSeparateConversation } from "./messages-separate";

/**
 * Messages with a shared conversation, when the desktop is served by its Ferrite application
 * (`ferrite-apps/desktop`, which builds the page with `VITE_MACALICIOUS_API=1`). Everywhere
 * else, the documentation site included, it is the plain `Messages` window and asks no
 * server anything.
 *
 * The shared conversation, "Ferrite Room", is first in the list. What is sent to it goes to
 * the server (`POST /api/messages/rooms/<room>`, the room `desktop` unless the address names
 * another with `?room=`) with a fresh `idempotency-key`, and is resent with the same key for
 * up to ten minutes, so a message is neither lost when a request fails nor added twice when a
 * resend arrives after all; one still unanswered then says Not Delivered, with Try Again. Every browser on the desktop
 * hears the room through the live feed (`/live/messages/<room>`, server-sent events), whose
 * every event carries the whole room; the feed opens once the page's first request has been
 * answered, so the browser holds the session's cookie before anything else is asked. A feed
 * that falls silent (its server process restarted) is opened again. The room is public to every
 * session on the desktop, by design; conversations between accounts never use this feed
 * (`messages-accounts.tsx`). What is on its way to the room is kept in this browser with its key
 * (`messages-outbox.ts`), and goes on being sent when Messages next opens.
 */
export const LIVE = import.meta.env.VITE_MACALICIOUS_API === "1";

/** The room on the server, and the conversation that shows it. */
export const LIVE_ROOM = "desktop";

/**
 * The room this page talks in: `?room=<id>` in the page's address (1 to 40 lowercase letters,
 * digits or `-`), so separate groups or test runs can each have their own, or `LIVE_ROOM`.
 */
export function roomOf(search: string): string {
  const room = new URLSearchParams(search).get("room");
  return room && /^[a-z0-9-]{1,40}$/.test(room) ? room : LIVE_ROOM;
}
export const LIVE_CONVERSATION: MessagesConversation = {
  id: "ferrite-room",
  name: "Ferrite Room",
  messages: [],
};

/** The records of what `author` has on its way to a room: apart from their conversations' outbox. */
export const roomOutbox = (author: string, room: string) => `${author}#room/${room}`;

/** A message as the server keeps it. */
export interface RoomMessage {
  seq: number;
  author: string;
  name: string;
  text: string;
  at_ms: number;
  key?: string;
}

/** A message sent from this window that the room does not show yet. */
interface Pending {
  /** Its idempotency key, fixed for its whole life: every send of it, Try Again included. */
  key: string;
  text: string;
  at: string;
  /** When it was created (`Date.now()`): automatic resends stop `RESEND_MS` after it. */
  sentAt: number;
  /** The server refused it, or it went unanswered: it says Not Delivered, with Try Again. */
  failed?: boolean;
}

/** A feed that has said nothing for this long, pings included, is opened again. */
const SILENCE_MS = 12_000;

/**
 * How long after a message's creation it is resent on its own. The server keeps a key's
 * receipt for longer (15 minutes, `KEY_RETENTION_MS` in `ferrite-apps/desktop/src/apps/messages`).
 */
const RESEND_MS = 10 * 60_000;

/** The longest one attempt may take, its answer's body included, before it counts as failed. */
const ATTEMPT_MS = 10_000;

/** What the transcript says while the server cannot read the room. */
const UNREADABLE = "The server cannot read this conversation, so nothing sent to it is delivered.";

/**
 * The messages of a feed state, or `null` when it has no messages array: the server sends
 * `{"unreadable": true}` for a stored room it cannot read, and anything else without the array
 * is treated the same way.
 */
export function roomMessagesOf(state: unknown): RoomMessage[] | null {
  if (!state || typeof state !== "object") return null;
  const { messages } = state as { messages?: unknown };
  return Array.isArray(messages) ? (messages as RoomMessage[]) : null;
}

/**
 * A fresh random idempotency key. `crypto.randomUUID` exists only on secure pages (HTTPS or
 * localhost); a desktop served over plain HTTP on another host gets 16 random bytes in hex.
 */
function randomKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * A signal for one request: aborted when any of `parents` is, or after `ms`, with `done` to
 * clear its timer and its listeners once the request has ended. It is a plain `AbortController`
 * that the timer and the parents' listeners hold, not `AbortSignal.any` with
 * `AbortSignal.timeout`: in WebKit a request the server left unanswered, given such a combined
 * signal, was seen never to end, neither when the room confirmed its message nor after
 * `ATTEMPT_MS`, and it held the queue for good (`messages-live.browser.test.tsx`).
 */
function bounded(ms: number, ...parents: AbortSignal[]): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, ms);
  for (const parent of parents) {
    if (parent.aborted) abort();
    else parent.addEventListener("abort", abort, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      for (const parent of parents) parent.removeEventListener("abort", abort);
    },
  };
}

/**
 * POST `body` as JSON with the idempotency key `key`: its status and body. An attempt fails
 * when it cannot be sent, answers 5xx or 429, or does not deliver its whole JSON answer within
 * `ATTEMPT_MS`: `withDeadline` settles the attempt by then even if it never leaves the
 * first-request gate, and its signal (with the window's, see `bounded`) aborts the request. A failed
 * attempt is followed by another with the same key, with backoff. No attempt starts at or after
 * `until`, which answers status 0. A Try Again (`once`) is exactly one attempt, whatever the
 * deadline: the user's own request to send the message again; if it fails, the answer is
 * status 0 and the user may try again. Answers null once `stop` is aborted (the window is
 * gone), which also abandons the attempt under way.
 */
async function post(
  url: string,
  body: unknown,
  key: string,
  stop: AbortSignal,
  until: number,
  once: boolean,
): Promise<{ status: number; body: unknown } | null> {
  for (let attempt = 0; ; attempt++) {
    if (stop.aborted) return null;
    if (once ? attempt > 0 : Date.now() >= until) return { status: 0, body: null };
    try {
      const answer = await withDeadline(async (deadline) => {
        const bound = bounded(ATTEMPT_MS, stop, deadline);
        try {
          const response = await sessionFetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json", "idempotency-key": key },
            body: JSON.stringify(body),
            signal: bound.signal,
          });
          if (response.status >= 500 || response.status === 429) return null;
          return { status: response.status, body: (await response.json()) as unknown };
        } finally {
          bound.done();
        }
      }, ATTEMPT_MS);
      if (answer) return answer;
    } catch {
      // Not sent, not answered, an unreadable answer, or too slow: a failed attempt.
    }
    if (stop.aborted) return null;
    await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 250 * 2 ** attempt)));
  }
}

/**
 * The present as a `stampOf` stamp: `now` when given, otherwise the clock, read again at the
 * start of every minute, so times written against it stay right across an idle hour or
 * midnight.
 */
export function useLiveClock(now: string | undefined): string {
  const [clock, setClock] = useState(() => stampOf(new Date()));
  useEffect(() => {
    if (now !== undefined) return;
    setClock(stampOf(new Date()));
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(
        () => {
          setClock(stampOf(new Date()));
          next();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    next();
    return () => clearTimeout(timer);
  }, [now]);
  return now ?? clock;
}

/** Hear `url`'s `state` events, reopening the feed when it falls silent. */
function useFeed(url: string | null, onState: (state: unknown) => void) {
  const handler = useRef(onState);
  handler.current = onState;
  useEffect(() => {
    if (!url) return;
    let source: EventSource | null = null;
    let heard = Date.now();
    const open = () => {
      source?.close();
      heard = Date.now();
      source = new EventSource(url);
      source.addEventListener("state", (event) => {
        heard = Date.now();
        handler.current(
          (JSON.parse((event as MessageEvent<string>).data) as { state: unknown }).state,
        );
      });
      source.addEventListener("ping", () => {
        heard = Date.now();
      });
    };
    open();
    const watchdog = setInterval(() => {
      if (Date.now() - heard > SILENCE_MS) open();
    }, 1_000);
    return () => {
      clearInterval(watchdog);
      source?.close();
    };
  }, [url]);
}

/**
 * The Messages window of the desktop: `Messages`, with the shared conversation when the page
 * is served by the desktop's Ferrite application. It takes every prop of `Messages`.
 */
export function MessagesLive(props: MessagesProps) {
  if (!LIVE) return <PlainMessages {...props} />;
  return <SharedMessages {...props} />;
}

/**
 * The Preferences window a desktop hosts as a window of its own (`app.ts`). Served by the
 * desktop's Ferrite application, its Help buttons open Help Viewer, it names the person's account,
 * and what has nothing to act on there is dimmed and says why; elsewhere it is
 * `MessagesPreferences`, drawn as captured.
 */
export function MessagesPreferencesLive(props: MessagesPreferencesProps) {
  if (!LIVE) return <MessagesPreferences {...props} />;
  return <ServedPreferences {...props} />;
}

/** Preferences' Help buttons, as the menu bar's Messages Help: Help Viewer, on Messages. */
const askMessagesHelp = () => requestHelp("Messages");

function ServedPreferences({ settings, onSettingsChange, ...props }: MessagesPreferencesProps) {
  const kept = useDesktopValue(MESSAGES_SETTINGS, readMessagesSettings, undefined);
  const [account, setAccount] = useState<string>();
  useEffect(() => {
    let stopped = false;
    sessionFetch("/api/messages/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { name?: unknown } | null) => {
        if (!stopped && typeof body?.name === "string") setAccount(body.name);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, []);
  return (
    <MessagesPreferences
      {...props}
      onHelp={askMessagesHelp}
      unavailable={SERVED_UNAVAILABLE}
      account={account}
      blockedPane={<BlockedPeoplePane />}
      settings={kept ?? settings}
      onSettingsChange={(next) => {
        onSettingsChange?.(next);
        changeDesktopValue(MESSAGES_SETTINGS, next);
      }}
    />
  );
}

/** `Messages` on a page not served by the application, taking shared links all the same. */
function PlainMessages(props: MessagesProps) {
  const sharedMessage = useSharedMessage();
  return <Messages {...props} composeText={props.composeText ?? sharedMessage} />;
}

/** The text a link shared with Messages starts a message with: its title, then its address. */
export function sharedMessageText(link: Pick<SharedLink, "url" | "title">): string {
  // One line: a feed's headline may carry line breaks.
  const title = link.title.replace(/\s+/g, " ").trim();
  return title && title !== link.url ? `${title} ${link.url}` : link.url;
}

/**
 * Links shared with Messages (Share > Messages in Safari, News and Stocks: `desktop-share-link.tsx`):
 * those kept while the window was closed, and each one shared while it is open, as the message to
 * start (`composeText`). Several kept at once go into one message.
 */
export function useSharedMessage(listening = true): { key: number; text: string } | undefined {
  const [shared, setShared] = useState<{ key: number; text: string }>();
  const count = useRef(0);
  useEffect(() => {
    const start = (links: readonly SharedLink[]) => {
      if (links.length === 0) return;
      count.current += 1;
      setShared({ key: count.current, text: links.map(sharedMessageText).join(" ") });
    };
    if (!listening) return;
    start(takeSharedLinks("messages"));
    return onSharedLink("messages", (link) => start([link]));
  }, [listening]);
  return shared;
}

/** Where the files new messages carry are kept for the person, in the desktop's settings. */
export const MESSAGES_SHARED_FILES = "messages.sharedFiles";
const NO_FILES: readonly DesktopDragItem[] = [];

/** The drive files kept for new messages, with whatever of them reads. */
export function readSharedFiles(stored: unknown): readonly DesktopDragItem[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((each) => {
    if (typeof each !== "object" || each === null) return [];
    const { id, name, type, size } = each as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") return [];
    return [
      {
        id,
        name,
        kind: "file" as const,
        ...(typeof type === "string" ? { type } : {}),
        ...(typeof size === "number" ? { size } : {}),
      },
    ];
  });
}

/**
 * Files shared with Messages from Finder and Quick Look (`composeFiles`): every share so far, in
 * order, each with its own key, so two in one moment are both seen; those kept from before a
 * reload start a new message of their own. `keep` is told what new messages carry now. Only drive
 * files are kept: a file that is not on the drive has nothing a later page could read.
 */
export function useSharedFiles(listening = true): {
  shares: readonly { key: number; items: readonly DesktopDragItem[] }[];
  keep: (files: readonly DesktopDragItem[]) => void;
} {
  const [shares, setShares] = useState<
    readonly { key: number; items: readonly DesktopDragItem[] }[]
  >([]);
  const count = useRef(0);
  const kept = useDesktopValue(MESSAGES_SHARED_FILES, readSharedFiles, NO_FILES);
  // Set once the kept files are in a message, or the window has carried files of its own.
  const settled = useRef(false);
  const written = useRef("[]");
  const start = useCallback((items: readonly DesktopDragItem[]) => {
    if (items.length === 0) return;
    count.current += 1;
    const key = count.current;
    setShares((all) => [...all, { key, items }]);
  }, []);
  useEffect(() => {
    if (!listening) return;
    start(takeSharedFiles("messages").flatMap(({ items }) => items));
    return onSharedFiles("messages", ({ items }) => start(items));
  }, [listening, start]);
  useEffect(() => {
    if (!listening || settled.current || kept.length === 0) return;
    settled.current = true;
    const entries = currentDrive()?.entries;
    start(entries ? kept.filter((item) => entries.some((each) => each.id === item.id)) : kept);
  }, [listening, kept, start]);
  const keep = useCallback(
    (files: readonly DesktopDragItem[]) => {
      if (!listening) return;
      const onDrive = files
        .filter((item) => !item.bytes)
        .map(({ id, name, kind, type, size }) => ({ id, name, kind, type, size }));
      // Before anything is carried, an empty list says nothing of what the settings hold.
      if (onDrive.length === 0 && !settled.current) return;
      settled.current = true;
      const text = JSON.stringify(onDrive);
      if (text === written.current) return;
      written.current = text;
      changeDesktopValue(MESSAGES_SHARED_FILES, onDrive);
    },
    [listening],
  );
  return { shares, keep };
}

/**
 * Contacts' message button and Siri: a message to that person, for each request. It waits for the
 * list of conversations, since the one already open with them is shown rather than a new one.
 */
function useAddressedMessage(
  listening: boolean,
): { key: number; to: string; text?: string } | undefined {
  const [addressed, setAddressed] = useState<{ key: number; to: string; text?: string }>();
  const count = useRef(0);
  useEffect(() => {
    const start = (to: string, text?: string) => {
      count.current += 1;
      setAddressed({ key: count.current, to, text });
    };
    if (!listening) return;
    for (const request of takeAddressRequests("messages")) start(request.to, request.text);
    return onAddressRequest("messages", (request) => start(request.to, request.text));
  }, [listening]);
  return addressed;
}

/**
 * The conversation an item of Messages belongs to. Spotlight asks with the conversation's id; a
 * notification says `<conversation or room>#<what>` (messages/mod.rs, conversations.rs), and the
 * page's room is shown by a conversation of its own.
 */
export function conversationOfItem(item: string, room: string): string {
  const conversation = item.split("#")[0] ?? item;
  return conversation === room ? LIVE_CONVERSATION.id : conversation;
}

/** What Spotlight and Notification Center ask this window to show, for each request a new key. */
function useOpenedConversation(listening: boolean, room: string) {
  const [opened, setOpened] = useState<{ key: number; id: string }>();
  const count = useRef(0);
  useEffect(() => {
    if (!listening) return;
    const show = (request: OpenItemRequest) => {
      count.current += 1;
      setOpened({ key: count.current, id: conversationOfItem(request.id, room) });
    };
    for (const request of takeOpenItemRequests("messages")) show(request);
    return onOpenItemRequest("messages", show);
  }, [listening, room]);
  return opened;
}

function SharedMessages({
  // The served desktop shows real conversations only: the shared room and the person's own.
  defaultConversations = [],
  onConversationChange,
  settings: reported,
  onSettingsChange,
  defaultConversation = LIVE_CONVERSATION.id,
  onSend,
  now,
  heldMessages: ownerHeld,
  notices: ownerNotices,
  opening,
  ...props
}: MessagesProps) {
  const [windowElement, setWindowElement] = useState<HTMLDivElement | null>(null);
  const only = useSeparateConversation(opening, windowElement);
  // What other applications send to Messages starts a new message, which only the main window can.
  // Whether this is the main window is known once it has its element.
  const startsMessages = windowElement !== null && !only;
  useMainWindowOpens(startsMessages, windowElement !== null && only !== undefined);
  // A separate window's View menu changes that window alone.
  const [ownView, setOwnView] = useState<MessagesView>();
  // Both windows write what they change here, so it is the newest whichever changed it.
  const kept = useDesktopValue(MESSAGES_SETTINGS, readMessagesSettings, undefined);
  const settings = kept ?? reported;
  const returnTo = useDesktopValue(MESSAGES_SELECTED, readSelected, undefined);
  const view = useDesktopValue(MESSAGES_VIEW, readMessagesView, DEFAULT_VIEW);
  const [author, setAuthor] = useState<string | null>(null);
  const [roomId] = useState(() => roomOf(window.location.search));
  // What the room holds, by number: every event carries the room's newest messages, and they
  // are added to what is known, so an event that comes late takes nothing away.
  const [room, setRoom] = useState<ReadonlyMap<number, RoomMessage>>(() => new Map());
  const [pending, setPending] = useState<readonly Pending[]>([]);
  // The pending messages as last rendered, for a queued send to see whether it is still wanted.
  const pendingNow = useRef(pending);
  pendingNow.current = pending;
  // What this account left on its way to this room is read once it is known; nothing is written back
  // until then, so the records wait for that.
  const [outboxRead, setOutboxRead] = useState(false);
  const outboxKeys = useRef(new Set<string>());
  // File > Open…: the drive's Open panel; what is chosen opens in its own application.
  const [openPanel, setOpenPanel] = useState(false);
  // Set while the server cannot read the room: the transcript says so.
  const [unreadable, setUnreadable] = useState(false);
  const present = useLiveClock(now);
  // Conversations with the desktop's other accounts, with read receipts unless the
  // Preferences say not to send them.
  const accounts = useAccountConversations(true, settings?.readReceipts ?? true);
  const keptTexts = useMemo(
    () => (accounts.me ? readUnsent(accounts.me) : undefined),
    [accounts.me],
  );
  const keepsConversation = (id: string) => id === LIVE_CONVERSATION.id || accounts.owns(id);
  // What the person changes before the account is known goes in as soon as it is, clears included.
  const typedEarly = useRef(new Map<string, string>());
  useEffect(() => {
    if (!accounts.me) return;
    for (const [id, text] of typedEarly.current) writeUnsent(accounts.me, id, text);
    typedEarly.current.clear();
  }, [accounts.me]);
  // Do Not Disturb, kept on the server for this person: the room and their conversations.
  const doNotDisturb = useDoNotDisturb(true, { id: LIVE_CONVERSATION.id, room: roomId });
  // A link shared with Messages starts a new message holding it, for the person to address; files
  // shared from Finder start one that carries them.
  const sharedMessage = useSharedMessage(startsMessages);
  const sharedFiles = useSharedFiles(startsMessages);
  const addressed = useAddressedMessage(startsMessages && accounts.listRead);
  const opened = useOpenedConversation(startsMessages, roomId);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Aborted once the window is gone: its sends stop, the one under way included.
  const stop = useRef(new AbortController());
  useEffect(() => {
    if (stop.current.signal.aborted) stop.current = new AbortController();
    const controller = stop.current;
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    const ask = async (attempt: number): Promise<void> => {
      try {
        const body = await withDeadline(async (signal) => {
          const response = await sessionFetch("/api/messages/me", {
            credentials: "same-origin",
            signal,
          });
          return response.ok ? ((await response.json()) as { author: string }) : null;
        }, ATTEMPT_MS);
        if (body) {
          if (!stopped) setAuthor(body.author);
          return;
        }
      } catch {
        // Asked again below.
      }
      if (stopped) return;
      await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 250 * 2 ** attempt)));
      return ask(attempt + 1);
    };
    void ask(0);
    return () => {
      stopped = true;
    };
  }, []);

  // Reading the room once makes this person one of its members, whom the server tells of what
  // others write there next (Notification Center); the transcript itself comes from the feed.
  useEffect(() => {
    const visit = new AbortController();
    const timer = setTimeout(() => visit.abort(), ATTEMPT_MS);
    sessionFetch(`/api/messages/rooms/${roomId}`, {
      credentials: "same-origin",
      signal: visit.signal,
    })
      // Read to the end: a reply whose body is cancelled shows as an aborted request.
      .then((response) => response.text())
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      visit.abort();
    };
  }, [roomId]);

  // The keys of the room's messages seen so far, and an abort for each send under way, by key:
  // a message the room shows is stored, so its send stops at once and the queue moves on.
  const roomKeys = useRef(new Set<string>());
  const sending = useRef(new Map<string, AbortController>());
  const learn = useCallback((messages: readonly RoomMessage[]) => {
    const confirmed = messages.flatMap((message) => (message.key ? [message.key] : []));
    for (const key of confirmed) {
      roomKeys.current.add(key);
      sending.current.get(key)?.abort();
    }
    if (confirmed.length > 0) {
      const done = new Set(confirmed);
      setPending((all) =>
        all.some((waiting) => done.has(waiting.key))
          ? all.filter((waiting) => !done.has(waiting.key))
          : all,
      );
    }
    setRoom((known) => {
      if (messages.every((message) => known.get(message.seq)?.text === message.text)) return known;
      const next = new Map(known);
      for (const message of messages) next.set(message.seq, message);
      return next;
    });
  }, []);

  // Opened once `/api/messages/me` has answered: the browser then holds the session's cookie, so
  // a fresh browser does not start a second session beside the first request's.
  useFeed(author === null ? null : `/live/messages/${roomId}`, (state) => {
    // A state without a messages array is a room the server cannot read: say so, with Reload.
    const messages = roomMessagesOf(state);
    setUnreadable(messages === null);
    if (messages) learn(messages);
  });

  // The room's messages in order, then this window's own that are still on their way.
  const held = useMemo(() => {
    const sent = [...room.values()].sort((a, b) => a.seq - b.seq);
    const arrived = new Set(sent.flatMap((message) => (message.key ? [message.key] : [])));
    const messages: MessagesMessage[] = sent.map((message) => ({
      id: `room-${message.seq}`,
      from: message.author === author ? "me" : "them",
      text: message.text,
      at: stampOf(new Date(message.at_ms)),
    }));
    for (const waiting of pending) {
      if (!arrived.has(waiting.key)) {
        messages.push({
          id: `pending-${waiting.key}`,
          from: "me",
          text: waiting.text,
          at: waiting.at,
          undelivered: waiting.failed === true,
          pending: waiting.failed !== true,
        });
      }
    }
    return new Map([...(ownerHeld ?? []), ...accounts.held, [LIVE_CONVERSATION.id, messages]]);
  }, [room, pending, author, ownerHeld, accounts.held]);

  const conversations = useMemo(
    () =>
      defaultConversations.some((conversation) => conversation.id === LIVE_CONVERSATION.id)
        ? defaultConversations
        : [LIVE_CONVERSATION, ...defaultConversations],
    [defaultConversations],
  );

  // One at a time, in the order typed, so the room keeps this window's order even when a
  // message has to be resent. A message the server stored leaves the pending ones; one it
  // refused (an answer below 500 without the message, such as 400 for an overlong text) stays,
  // marked as failed, so its text is not lost and Try Again can send it again, with the same
  // key. A message's automatic sends end `RESEND_MS` after its creation, whether or not its turn
  // in the queue has come: a timer marks it failed then (see `onSend`), a queued send whose
  // deadline has passed is skipped, and `post` starts no attempt after it. Every attempt is
  // bounded by `ATTEMPT_MS`, so a stalled request never holds the queue.
  const fail = (key: string) =>
    setPending((all) =>
      all.map((waiting) => (waiting.key === key ? { ...waiting, failed: true } : waiting)),
    );
  const deliver = (waiting: Pending, retry: boolean) => {
    const { key, text, sentAt } = waiting;
    const until = sentAt + RESEND_MS;
    queue.current = queue.current.then(() => {
      if (stop.current.signal.aborted) return;
      const current = pendingNow.current.find((each) => each.key === key);
      // Stored meanwhile, or (an automatic send) already marked failed: nothing to send.
      if (!current || roomKeys.current.has(key) || (!retry && current.failed)) return;
      if (!retry && Date.now() >= until) {
        fail(key);
        return;
      }
      // Aborted when the window goes, or when the room shows the message (see `learn`). The
      // window's own signal aborts it through a listener, not `AbortSignal.any` (see `bounded`).
      const confirmed = new AbortController();
      sending.current.set(key, confirmed);
      const gone = stop.current.signal;
      const leave = () => confirmed.abort();
      if (gone.aborted) leave();
      else gone.addEventListener("abort", leave, { once: true });
      const stopped = confirmed.signal;
      const url = `/api/messages/rooms/${roomId}`;
      // A Try Again first asks the room whether the message is there after all: its key's
      // receipt on the server lasts only 15 minutes, so the key alone stops a duplicate only
      // that long. A message found by its key is taken as stored; one the room cannot be read
      // for stays failed, and the user may try again. The room holds only its newest 200
      // messages, so a Try Again more than 15 minutes on, in a room that has moved on by more
      // than that, can still send a stored message twice (documented in messages.mdx and
      // `ferrite-apps/desktop/src/apps/messages/mod.rs`).
      const check: Promise<"send" | "stored" | "failed" | null> = retry
        ? withDeadline(async (deadline) => {
            const reading = bounded(ATTEMPT_MS, stopped, deadline);
            try {
              const response = await sessionFetch(url, {
                credentials: "same-origin",
                signal: reading.signal,
              });
              if (!response.ok) return "failed" as const;
              const body = (await response.json()) as { state?: unknown };
              const messages = roomMessagesOf(body?.state);
              if (!messages) return "failed" as const;
              const found = messages.filter((message) => message.key === key);
              if (found.length === 0) return "send" as const;
              learn(found);
              return "stored" as const;
            } finally {
              reading.done();
            }
          }, ATTEMPT_MS).catch(() => (stopped.aborted ? null : ("failed" as const)))
        : Promise.resolve("send" as const);
      return check
        .then((found) => {
          if (found === null || stopped.aborted) return;
          if (found === "failed") return fail(key);
          if (found === "stored") {
            setPending((all) => all.filter((waiting) => waiting.key !== key));
            return;
          }
          return post(url, { text }, key, stopped, until, retry).then((reply) => {
            if (!reply) return;
            const sent = (reply.body as { message?: RoomMessage } | null)?.message;
            if (reply.status < 300 && sent) {
              learn([sent]);
              setPending((all) => all.filter((waiting) => waiting.key !== key));
            } else {
              fail(key);
            }
          });
        })
        .finally(() => {
          gone.removeEventListener("abort", leave);
          if (sending.current.get(key) === confirmed) sending.current.delete(key);
        });
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the account is known; `deliver` only reads what is current
  useEffect(() => {
    if (author === null) return;
    const kept: Pending[] = readOutbox(roomOutbox(author, roomId)).map((entry) => ({
      key: entry.key,
      text: entry.text,
      at: entry.at,
      sentAt: entry.written,
      failed: entry.failed,
    }));
    const here = new Set(pendingNow.current.map((waiting) => waiting.key));
    const restored = kept.filter((waiting) => !here.has(waiting.key));
    for (const waiting of restored) outboxKeys.current.add(waiting.key);
    pendingNow.current = [...restored, ...pendingNow.current];
    setPending(pendingNow.current);
    setOutboxRead(true);
    // Past its automatic sends (`RESEND_MS` after it was written), `deliver` marks it Not Delivered.
    for (const waiting of restored) if (!waiting.failed) deliver(waiting, false);
  }, [author]);
  useEffect(() => {
    if (author === null || !outboxRead) return;
    for (const waiting of pending) outboxKeys.current.add(waiting.key);
    writeOutbox(
      roomOutbox(author, roomId),
      pending.map((waiting) => ({
        conversation: LIVE_CONVERSATION.id,
        key: waiting.key,
        text: waiting.text,
        at: waiting.at,
        failed: waiting.failed,
        written: waiting.sentAt,
      })),
      outboxKeys.current,
    );
  }, [pending, author, roomId, outboxRead]);

  // What each transcript ends with: the account conversations' lines, a Do Not Disturb change the
  // server did not keep, then the owner's notices, or the room's unreadable line with Reload.
  const notices = new Map<string, ReactNode>(accounts.notices);
  for (const [id, refusal] of doNotDisturb.refusals) {
    notices.set(
      id,
      <>
        {accounts.notices.get(id)}
        <span role="alert">{refusal}</span>
      </>,
    );
  }
  for (const [id, notice] of ownerNotices ?? []) notices.set(id, notice);
  if (unreadable) {
    notices.set(
      LIVE_CONVERSATION.id,
      <>
        {UNREADABLE}{" "}
        <PushButton size="mini" onClick={() => window.location.reload()}>
          Reload
        </PushButton>
      </>,
    );
  }

  return (
    <>
      {openPanel
        ? createPortal(
            <div className="mac-mail-panel-layer">
              <DriveOpenPanel
                onOpen={(entry) => {
                  setOpenPanel(false);
                  if (!openFile(entry)) showInFinder({ id: entry.id });
                }}
                onCancel={() => setOpenPanel(false)}
              />
            </div>,
            document.body,
          )
        : null}
      <Messages
        {...props}
        {...accounts.props}
        onHelp={askMessagesHelp}
        onOpenFile={() => setOpenPanel(true)}
        settings={settings}
        onSettingsChange={(next) => {
          onSettingsChange?.(next);
          changeDesktopValue(MESSAGES_SETTINGS, next);
        }}
        returnTo={only ? undefined : returnTo}
        view={only ? (ownView ?? view) : view}
        onlyConversation={only}
        onWindowElement={setWindowElement}
        onOpenSeparately={(conversation) =>
          requestDesktopEffects([{ newWindow: "messages", opening: { conversation } }])
        }
        onViewChange={(next) => {
          if (only) setOwnView(next);
          else changeDesktopValue(MESSAGES_VIEW, next);
        }}
        onEmojiPalette={props.onEmojiPalette ?? toggleCharacterViewer}
        keptTexts={keptTexts}
        onTextChange={(id, text) => {
          if (accounts.me) writeUnsent(accounts.me, id, text);
          else typedEarly.current.set(id, text);
        }}
        onConversationChange={(id) => {
          onConversationChange?.(id);
          accounts.onConversationChange(id);
          if (!only && id && keepsConversation(id)) changeDesktopValue(MESSAGES_SELECTED, id);
        }}
        defaultConversations={conversations}
        defaultConversation={defaultConversation}
        composeText={sharedMessage}
        composeFiles={sharedFiles.shares}
        onDraftFilesChange={sharedFiles.keep}
        composeTo={addressed}
        openConversation={opened}
        now={present}
        heldMessages={held}
        mutedConversations={doNotDisturb.muted}
        onMutedChange={doNotDisturb.setMuted}
        notices={notices}
        onSend={(id, message) => {
          onSend?.(id, message);
          if (id !== LIVE_CONVERSATION.id) {
            accounts.send(id, message);
            return;
          }
          const waiting: Pending = {
            key: randomKey(),
            text: message.text,
            // The moment it was sent, not the last render's present.
            at: now ?? stampOf(new Date()),
            sentAt: Date.now(),
          };
          setPending((all) => [...all, waiting]);
          deliver(waiting, false);
          // The end of its automatic sends, even if it is still waiting for its turn.
          setTimeout(() => {
            if (stop.current.signal.aborted) return;
            setPending((all) =>
              all.map((each) =>
                each.key === waiting.key && !each.failed ? { ...each, failed: true } : each,
              ),
            );
          }, RESEND_MS);
        }}
        onRetry={(id, message) => {
          props.onRetry?.(id, message);
          if (accounts.owns(id)) {
            accounts.retry(id, message);
            return;
          }
          if (id !== LIVE_CONVERSATION.id || !message.id.startsWith("pending-")) return;
          const key = message.id.slice("pending-".length);
          const waiting = pending.find((each) => each.key === key);
          if (!waiting?.failed) return;
          // The same key, always: a message stored after all is recognised, not added twice.
          setPending((all) =>
            all.map((each) => (each.key === key ? { ...each, failed: false } : each)),
          );
          deliver(waiting, true);
        }}
      />
    </>
  );
}
