"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Checkbox } from "macalicious/checkbox";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONTACTS_CARDS_URL, cardsFromServer, loadPictures } from "../contacts/contacts-server";
import { type DesktopDragItem, fileItemsOfDrag } from "../desktop/desktop-drag";
import { readFile } from "../desktop/desktop-files";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { MailGlyph } from "../mail/mail-artwork";
import { ReceivedAttachment } from "../mail/mail-attachment-views";
import { type SentAttachment, uploadAttachment } from "../mail/mail-attachments";
import { remindWhenMessaging } from "../reminders/reminders-details";
import { AudioMessageButton } from "./messages-audio";
import "../mail/mail.tokens.css";
import "../mail/mail.css";
import type { MessagesProps } from "./messages";
import {
  type MessagesConversation,
  type MessagesMessage,
  splitRecipients,
  stampOf,
} from "./messages-data";
import { readOutbox, writeOutbox } from "./messages-outbox";
import { MESSAGES_RECEIPTS, readConversationReceipts } from "./messages-saved";

/**
 * Conversations between the desktop's accounts, for the Messages window the desktop's Ferrite
 * application serves (`ferrite-apps/desktop/src/apps/messages/conversations.rs`): what
 * `useAccountConversations` gives the `Messages` window besides the shared Ferrite Room.
 *
 * The compose button starts a conversation with one or more account names (the To field
 * offers the person's contacts who are desktop users); its first message makes the
 * conversation on the server, one to one or a group. The person's conversations are listed
 * with an unread dot; the one that is open shows what the others type, their read receipts,
 * tapbacks and replies. It is read with the person's own session (`GET /conversations/<id>`,
 * members only), never through a public feed. The list and the open conversation are read
 * again when the person's Messages change (their personal stream, through the desktop's
 * `SERVER_CHANGE_EVENT`), when the window gains focus, and every `POLL_MS` while the page is
 * visible in case the stream is down, one read at a time (a tick while a read runs is skipped).
 * Older messages load with Load Earlier
 * Messages. A message is sent with a fresh `idempotency-key` and resent with the same key until
 * the server answers, so it is never stored twice. A group (three or more people) can be left
 * from its Details (`POST /conversations/<id>/leave`): it goes from the list once the server
 * says so, and a refusal shows under the transcript.
 */

const API = "/api/messages";
/**
 * How often the list and the open conversation are read again while the page is visible, when
 * no change has been heard: the personal stream tells of changes at once while it is connected.
 */
const POLL_MS = 15_000;
/**
 * The least time between two reads of the list that changes heard on the personal stream ask
 * for: typing, a read receipt or a tapback moves the count as a message does, and a list read
 * reads up to a hundred conversations, so the list follows them at this pace while the open
 * conversation follows them at once.
 */
const LIST_CHANGE_MS = 5_000;
/** The least time between two "typing" notes to the server. */
const TYPING_EVERY_MS = 3_000;
/** How long "is typing" shows after the last note heard. */
const TYPING_SHOWN_MS = 6_000;
/** Sends of one message before it is marked Not Delivered. */
const SEND_ATTEMPTS = 6;

const TAPBACKS: readonly [kind: string, label: string, mark: string][] = [
  ["love", "Love", "❤️"],
  ["like", "Like", "👍"],
  ["dislike", "Dislike", "👎"],
  ["laugh", "Laugh", "😂"],
  ["emphasize", "Emphasize", "‼️"],
  ["question", "Question", "❓"],
];

/** Why a message's tapbacks are dimmed when it was loaded with Load Earlier Messages (messages.mdx, Known limits). */
export const TAPBACK_OLDER =
  "Tapbacks change only on the newest messages: this one was loaded with Load Earlier Messages.";

/** Why Remove Tapback is dimmed on a message the person has given no tapback. */
export const NO_TAPBACK_TO_REMOVE = "You have given this message no tapback to remove.";

interface Person {
  name: string;
  full_name: string;
}

/** A message as the server keeps it (`ConvMessage`). */
export interface ConvMessage {
  seq: number;
  author: string;
  name: string;
  text: string;
  at_ms: number;
  key?: string;
  attachments?: SentAttachment[];
  reply_to?: number;
  tapbacks?: Record<string, string>;
}

/** A conversation as the server's list gives it. */
export interface ConvSummary {
  id: string;
  title?: string | null;
  members: Person[];
  /** Not the one conversation of its two people, however few are left in it. */
  group?: boolean;
  last?: ConvMessage | null;
  unread: number;
  at_ms: number;
}

/** A conversation as its feed sends it. */
export interface ConvState {
  id?: string;
  title?: string | null;
  members: Person[];
  messages: ConvMessage[];
  read: Record<string, number>;
  typing: Record<string, number>;
  pages: number;
  /** The newest page of older messages (`GET .../history?page=`), if any. */
  older?: string | null;
  last: number;
}

/** The older messages loaded for a conversation, and the page before them (`null`: none). */
interface Older {
  next: string | null;
  messages: ConvMessage[];
  /**
   * The conversation's newest page when this chain started. When the conversation names
   * another (more messages moved to history since), the chain starts again from the new one,
   * keeping what was loaded, so no page in between is skipped.
   */
  head: string | null;
}

/** `messages` with every number once (the later copy wins), in order. */
export function bySeq(messages: readonly ConvMessage[]): ConvMessage[] {
  const all = new Map<number, ConvMessage>();
  for (const message of messages) all.set(message.seq, message);
  return [...all.values()].sort((a, b) => a.seq - b.seq);
}

/** A message of this window on its way. */
interface Pending {
  key: string;
  text: string;
  at: string;
  replyTo?: number;
  /** The files it carries, already uploaded. */
  attachments?: string[];
  /** A file on its way up, named here until it can be sent: kept in the window only. */
  uploading?: string;
  failed?: boolean;
  /** The server said no: sent again only by Try Again, even after a reload. */
  refused?: boolean;
  written: number;
}

/** What a message on its way shows. */
const pendingText = (waiting: Pending) =>
  waiting.uploading ? `Sending ${waiting.uploading}…` : waiting.text || "Attachment";

const NO_RECEIPTS: Readonly<Record<string, boolean>> = {};

/** Whether `id` is a conversation of accounts (not the shared room). */
export const isAccountConversation = (id: string): boolean => /^c-[0-9a-f]{32}$/.test(id);

/** A group's name in its Details: what is typed is kept on Return or on leaving the field. */
function GroupName({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [typed, setTyped] = useState(title);
  // Typed since it was last kept: an answer or another member's name does not replace it.
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setTyped(title);
  }, [title]);
  const keep = () => {
    if (!edited.current) return;
    edited.current = false;
    onRename(typed);
  };
  return (
    <TextField
      aria-label="Group Name"
      placeholder="Group Name"
      size="small"
      value={typed}
      onValueChange={(next) => {
        edited.current = true;
        setTyped(next);
      }}
      onBlur={keep}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        keep();
      }}
    />
  );
}

/** Details > Add Member: an account's name, kept on Return or with Add; the contacts are offered. */
function AddMember({
  offered,
  onAdd,
}: {
  offered: readonly string[];
  onAdd: (to: string) => Promise<boolean>;
}) {
  const [typed, setTyped] = useState("");
  const list = useId();
  const add = () => {
    if (typed.trim() === "") return;
    void onAdd(typed).then((added) => {
      if (added) setTyped("");
    });
  };
  return (
    <>
      <TextField
        aria-label="Add Member"
        placeholder="Add Member"
        className="mac-messages-add-member"
        size="small"
        list={list}
        value={typed}
        onValueChange={setTyped}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          add();
        }}
      />
      <datalist id={list}>
        {offered.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <PushButton size="mini" onClick={add}>
        Add
      </PushButton>
    </>
  );
}

/** Details: the conversation's pictures and files, read from the server, the newest first. */
function ConversationFiles({ id, last }: { id: string; last: number }) {
  const [files, setFiles] = useState<{
    found: readonly { attachment: SentAttachment }[];
    more: boolean;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new message may carry a new file
  useEffect(() => {
    let stopped = false;
    getJson(`${API}/conversations/${id}/files`).then(
      (reply) => {
        if (stopped) return;
        const { files: found, more } = reply as {
          files: { attachment: SentAttachment }[];
          more: boolean;
        };
        setFiles({ found, more });
        setFailed(false);
      },
      () => {
        if (!stopped) setFailed(true);
      },
    );
    return () => {
      stopped = true;
    };
  }, [id, last]);
  if (failed) {
    return (
      <Label textStyle="small" color="secondary" role="status">
        The pictures and files could not be read.
      </Label>
    );
  }
  if (!files) return null;
  if (files.found.length === 0) {
    return (
      <Label textStyle="small" color="secondary">
        No Pictures or Files
      </Label>
    );
  }
  return (
    <>
      <ul aria-label="Pictures and Files" className="mac-mail-live-received mac-messages-files">
        {files.found.map(({ attachment }) => (
          <ReceivedAttachment
            key={attachment.id}
            url={`${API}/conversations/${id}/attachments/${attachment.id}`}
            attachment={attachment}
          />
        ))}
      </ul>
      {files.more ? (
        <Label textStyle="small" color="secondary">
          Older ones are in the transcript.
        </Label>
      ) : null}
    </>
  );
}

/** The one other person of a conversation between two, not of a group left down to two. */
function otherPerson(
  members: readonly Person[],
  me: string | null,
  group: boolean | undefined,
): Person | null {
  if (group) return null;
  const others = members.filter((member) => member.name !== me);
  return others.length === 1 ? (others[0] ?? null) : null;
}

/** The conversation's name: its group name, or the other members' names. */
export function titleOf(
  conversation: { title?: string | null; members: Person[] },
  me: string | null,
): string {
  if (conversation.title) return conversation.title;
  const others = conversation.members.filter((member) => member.name !== me);
  return others.map((member) => member.full_name || member.name).join(", ") || "Me";
}

/**
 * The account names typed into the To field: `Name (user)`, `user@macalicious` or `user`. A
 * comma inside a contact's name (`Lee, Ann (ann)`) does not part it from its account.
 */
export function recipientsOf(typed: string): string[] {
  return splitRecipients(typed)
    .map((part) => /\(([^()]+)\)\s*$/.exec(part)?.[1] ?? part)
    .map((part) => part.replace(/@macalicious$/i, "").trim())
    .filter(Boolean);
}

/** The status under one's last message: Read when every other member shows they read it. */
export function statusOf(state: ConvState, me: string | null, seq: number): string {
  const others = state.members.filter((member) => member.name !== me);
  const readers = others.filter((member) => (state.read[member.name] ?? 0) >= seq);
  if (others.length > 0 && readers.length === others.length) return "Read";
  if (others.length > 1 && readers.length > 0) {
    return `Read by ${readers.map((member) => member.full_name || member.name).join(", ")}`;
  }
  return "Delivered";
}

/** A server message as the transcript shows it. */
export function toMessage(
  message: ConvMessage,
  me: string | null,
  group: boolean,
): MessagesMessage {
  return {
    id: `c${message.seq}`,
    from: message.author === me ? "me" : "them",
    // A file alone is a message: its bubble names it.
    text: message.text || (message.attachments ?? []).map((each) => each.name).join(", "),
    at: stampOf(new Date(message.at_ms)),
    sender: group && message.author !== me ? message.name || message.author : undefined,
  };
}

function randomKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function getJson(url: string): Promise<unknown> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, { credentials: "same-origin", signal });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  });
}

async function sendJson(
  url: string,
  method: string,
  body: unknown,
  key?: string,
): Promise<{ status: number; body: unknown }> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          ...(key ? { "idempotency-key": key } : {}),
        },
        body: JSON.stringify(body),
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

const errorOf = (body: unknown, fallback: string) => {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" && error ? error : fallback;
};

/** Why a refresh runs: a change heard on the personal stream, the window's focus, or the poll. */
type RefreshReason = "change" | "focus" | "poll";

/**
 * Call `refresh` when the person's Messages change, when the window gains focus and every
 * `POLL_MS` while the page is visible, until `active` turns false.
 */
function useRefresh(active: boolean, refresh: (reason: RefreshReason) => void) {
  const handler = useRef(refresh);
  handler.current = refresh;
  useEffect(() => {
    if (!active) return;
    const focus = () => handler.current("focus");
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") handler.current("poll");
    }, POLL_MS);
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: unknown }>).detail?.app === "messages") {
        handler.current("change");
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", focus);
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
    };
  }, [active]);
}

/**
 * Read the open conversation when it opens and on every refresh (`useRefresh`), one read of a
 * conversation at a time, whichever conversations were opened meanwhile, so two answers for one
 * conversation never race; an answer for a conversation no longer open is dropped. A change heard
 * or a focus while a read of it runs is read once that read is over (the read under way may have
 * been answered before the change); a poll then is skipped. A conversation `skip` names (one being
 * left) is not read: the server would answer that the person is no longer in it.
 */
function useConversationReads(
  id: string | null,
  onState: (state: ConvState) => void,
  skip: (id: string) => boolean = () => false,
) {
  const handler = useRef(onState);
  handler.current = onState;
  const skipped = useRef(skip);
  skipped.current = skip;
  const open = useRef(id);
  open.current = id;
  // The conversations being read, and those to read again once that read is over.
  const busy = useRef(new Set<string>());
  const again = useRef(new Set<string>());
  const load = useCallback(
    async function run(reason: RefreshReason | "open" = "open"): Promise<void> {
      if (!id || skipped.current(id)) return;
      if (busy.current.has(id)) {
        if (reason === "change" || reason === "focus") again.current.add(id);
        return;
      }
      busy.current.add(id);
      try {
        const reply = (await getJson(`${API}/conversations/${id}`)) as { state?: unknown };
        if (open.current !== id) return;
        const value = reply.state as ConvState | null;
        if (value && Array.isArray(value.members) && Array.isArray(value.messages)) {
          handler.current({ ...value, id });
        }
      } catch {
        // The next refresh reads it again.
      } finally {
        busy.current.delete(id);
        if (again.current.delete(id) && open.current === id) void run("change");
      }
    },
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(
    () => () => {
      open.current = null;
    },
    [],
  );
  useRefresh(id !== null, (reason) => void load(reason));
}

/** What the hook adds to the `Messages` window. */
export interface AccountConversations {
  /** The account's name, once it is known. */
  me: string | null;
  /** Whether the list of conversations has been read, or the read has failed. */
  listRead: boolean;
  props: Pick<
    MessagesProps,
    | "extraConversations"
    | "onStartConversation"
    | "recipientSuggestions"
    | "renderMessageExtras"
    | "renderMessageMenu"
    | "renderDetails"
    | "onSendFile"
    | "renderAudioButton"
    | "isNewMessage"
    | "renderInputAccessory"
    | "onDropFiles"
    | "canTakeFiles"
    | "faceTimeWith"
    | "conversationWith"
    | "transcriptStart"
    | "onTyping"
    | "canLeaveConversation"
    | "onLeaveConversation"
    | "canDeleteConversation"
    | "onDeleteConversation"
    | "onClearTranscript"
    | "canDeleteMessage"
    | "onDeleteMessage"
    | "blockedPerson"
    | "onBlockChange"
  >;
  /** The transcript of the open account conversation, by id, for `heldMessages`. */
  held: ReadonlyMap<string, readonly MessagesMessage[]>;
  /** Lines under transcripts (typing, a reply being written, a refusal), by id. */
  notices: ReadonlyMap<string, ReactNode>;
  /** Whether `id` is one of the account conversations (its sends come here). */
  owns: (id: string) => boolean;
  /** A message the window sent to an account conversation. */
  send: (id: string, message: MessagesMessage) => void;
  /** Try Again on a message marked Not Delivered. */
  retry: (id: string, message: MessagesMessage) => void;
  /** The conversation the window shows now. */
  onConversationChange: (id: string | null) => void;
}

/**
 * The person's conversations with other accounts. `enabled` is false where the page is not
 * served by the desktop's Ferrite application; `receipts` is the Send read receipts setting.
 */
export function useAccountConversations(enabled: boolean, receipts: boolean): AccountConversations {
  const [me, setMe] = useState<string | null>(null);
  const meNow = useRef(me);
  meNow.current = me;
  const [list, setList] = useState<readonly ConvSummary[]>([]);
  const [listRead, setListRead] = useState(false);
  // Only the open conversation is kept (and the one just started), with its older messages.
  const [states, setStates] = useState<ReadonlyMap<string, ConvState>>(() => new Map());
  const [older, setOlder] = useState<ReadonlyMap<string, Older>>(() => new Map());
  const olderNow = useRef(older);
  olderNow.current = older;
  // Conversations whose earlier messages are being loaded: one page at a time each.
  const loadingEarlier = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlyMap<string, readonly Pending[]>>(() => new Map());
  const pendingNow = useRef(pending);
  pendingNow.current = pending;
  const [refusals, setRefusals] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [replying, setReplying] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [people, setPeople] = useState<readonly string[]>([]);
  const [cardPictures, setCardPictures] = useState<ReadonlyMap<string, string>>(() => new Map());
  const picturesTurn = useRef(0);
  const startedAt = useRef<ReadonlyMap<string, number> | null>(null);
  // The accounts on the person's cards, once read: everyone else is an unknown sender.
  const [known, setKnown] = useState<ReadonlySet<string> | null>(null);
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => new Set());
  // What this person cleared or deleted: a read that started before it does not bring it back.
  const removed = useRef(new Map<string, { through: number; seqs: Set<number> }>());
  const ownReceipts = useDesktopValue(MESSAGES_RECEIPTS, readConversationReceipts, NO_RECEIPTS);
  const [openId, setOpenId] = useState<string | null>(null);
  const talkingIn = openId ? states.get(openId) : undefined;
  const messaging = talkingIn
    ? otherPerson(talkingIn.members, me, list.find((each) => each.id === openId)?.group)
    : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new person to message raises it, not a new read.
  useEffect(() => {
    if (messaging) void remindWhenMessaging(messaging.name, messaging.full_name || messaging.name);
  }, [messaging?.name]);
  // When each member was last heard typing, by conversation and name (this page's clock).
  const [typingSeen, setTypingSeen] = useState<ReadonlyMap<string, ReadonlyMap<string, number>>>(
    () => new Map(),
  );
  const lastTypingSent = useRef(new Map<string, number>());
  const [now, setNow] = useState(() => Date.now());
  const stopped = useRef(false);
  // Each conversation's last send under way: the next one waits for it.
  const sending = useRef(new Map<string, Promise<void>>());

  // One read of the list at a time. A read asked for by the person's own action while one runs
  // is made once that one has finished; a refresh tick then is skipped.
  const listBusy = useRef(false);
  const listQueued = useRef(false);
  const loadList = useCallback(async function run(queue = true): Promise<void> {
    if (listBusy.current) {
      if (queue) listQueued.current = true;
      return;
    }
    listBusy.current = true;
    try {
      const reply = (await getJson(`${API}/conversations`)) as { conversations?: unknown };
      if (stopped.current) return;
      if (Array.isArray(reply.conversations)) {
        const read = reply.conversations as ConvSummary[];
        // Where each conversation stood when Messages first read them: only what comes after is new.
        startedAt.current ??= new Map(read.map((each) => [each.id, each.last?.seq ?? 0]));
        setList(read);
      }
    } catch {
      // The list stays as it is; the next refresh reads it again.
    } finally {
      listBusy.current = false;
      setListRead(true);
      if (listQueued.current && !stopped.current) {
        listQueued.current = false;
        void run();
      }
    }
  }, []);

  // Who the person is decides which messages are theirs, their statuses and what they have
  // read: asked on every refresh until it is known.
  const loadMe = useCallback(() => {
    if (meNow.current !== null) return;
    getJson(`${API}/me`).then(
      (reply) => {
        const name = (reply as { name?: unknown }).name;
        if (typeof name === "string" && !stopped.current) setMe(name);
      },
      () => {},
    );
  }, []);

  const loadPeople = useCallback(() => {
    getJson("/api/contacts/people").then(
      (reply) => {
        const found = (reply as { people?: unknown }).people;
        if (!Array.isArray(found) || stopped.current) return;
        setKnown(new Set(found.map((person) => (person as { user?: string } | null)?.user ?? "")));
        setPeople(
          found.flatMap((person) => {
            const { user, full_name: full } = (person ?? {}) as {
              user?: unknown;
              full_name?: unknown;
            };
            if (typeof user !== "string") return [];
            const name = typeof full === "string" && full ? full : user;
            // A name with a comma is quoted, so the To field reads it as one person.
            const shown = name.includes(",") ? `"${name.replaceAll('"', "")}"` : name;
            return [`${shown} (${user})`];
          }),
        );
      },
      () => {},
    );
    // The pictures of the person's contact cards, by the account each card names. A read started
    // before a later one says what was before it.
    const turn = ++picturesTurn.current;
    getJson(CONTACTS_CARDS_URL)
      .then(async (reply) => {
        const cards = (cardsFromServer(reply) ?? []).filter((card) => card.user && card.image);
        const pictures = await loadPictures(cards.map((card) => card.id));
        if (stopped.current || turn !== picturesTurn.current) return;
        setCardPictures(
          new Map(
            cards.flatMap((card) => {
              const image = pictures[card.id]?.image;
              return card.user && image ? [[card.user, image] as const] : [];
            }),
          ),
        );
      })
      .catch(() => {});
  }, []);

  // A read started before a block changed says what was before it.
  const blockedTurn = useRef(0);
  // The latest change asked for of each person.
  const blockedAsked = useRef(new Map<string, number>());
  const loadBlocked = useCallback(() => {
    const turn = blockedTurn.current;
    getJson(`${API}/blocked`).then(
      (reply) => {
        const found = (reply as { blocked?: { name: string }[] }).blocked;
        if (Array.isArray(found) && !stopped.current && turn === blockedTurn.current) {
          setBlocked(new Set(found.map((each) => each.name)));
        }
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stopped.current = false;
    loadMe();
    void loadList();
    loadPeople();
    loadBlocked();
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    // A contact card or its picture changed, here or in another browser of the person.
    const contactsChanged = (event: Event) => {
      if ((event as CustomEvent<{ app?: unknown }>).detail?.app === "contacts") loadPeople();
    };
    window.addEventListener(SERVER_CHANGE_EVENT, contactsChanged);
    return () => {
      stopped.current = true;
      clearInterval(tick);
      window.removeEventListener(SERVER_CHANGE_EVENT, contactsChanged);
    };
  }, [enabled, loadList, loadMe, loadPeople, loadBlocked]);

  // A change heard reads the list at most every `LIST_CHANGE_MS`, the last change of a burst
  // included; a focus reads it at once, after a read under way; a poll skips a read under way.
  const listTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listChangedAt = useRef(0);
  useEffect(
    () => () => {
      if (listTimer.current) clearTimeout(listTimer.current);
    },
    [],
  );
  useRefresh(enabled, (reason) => {
    loadMe();
    if (reason === "change") {
      if (listTimer.current) return;
      const wait = Math.max(0, listChangedAt.current + LIST_CHANGE_MS - Date.now());
      listTimer.current = setTimeout(() => {
        listTimer.current = null;
        listChangedAt.current = Date.now();
        void loadList();
      }, wait);
      return;
    }
    void loadList(reason === "focus");
    loadPeople();
    loadBlocked();
  });

  // Clearing or deleting reads a conversation's files again, leaving any read still on its way.
  const [filesRound, setFilesRound] = useState(0);
  const take = useCallback((read: ConvState) => {
    const id = read.id;
    if (!id) return;
    const gone = removed.current.get(id);
    const state = gone
      ? {
          ...read,
          messages: read.messages.filter((m) => m.seq > gone.through && !gone.seqs.has(m.seq)),
        }
      : read;
    setStates((all) => {
      const before = all.get(id);
      // Typing heard now: a time that moved forward is a new note.
      for (const [name, until] of Object.entries(state.typing ?? {})) {
        if ((before?.typing?.[name] ?? 0) < until) {
          setTypingSeen((seen) => {
            const next = new Map(seen);
            next.set(id, new Map(seen.get(id) ?? []).set(name, Date.now()));
            return next;
          });
        }
      }
      // Messages this window was told are stored, and that a read started before them does not
      // hold yet, stay until a read holds them.
      const acknowledged = (before?.messages ?? []).filter((m) => m.seq > state.last);
      const merged =
        acknowledged.length > 0
          ? { ...state, messages: bySeq([...state.messages, ...acknowledged]) }
          : state;
      return new Map([[id, merged]]);
    });
    // What the server shows stored leaves this window's queue.
    const keys = new Set(read.messages.flatMap((message) => (message.key ? [message.key] : [])));
    setPending((all) => {
      const waiting = all.get(id);
      if (!waiting?.some((each) => keys.has(each.key))) return all;
      return new Map(all).set(
        id,
        waiting.filter((each) => !keys.has(each.key)),
      );
    });
  }, []);

  const open = openId && isAccountConversation(openId) ? openId : null;
  // Conversations being left, or left: never read again by this window.
  const leaving = useRef(new Set<string>());
  useConversationReads(enabled ? open : null, take, (id) => leaving.current.has(id));

  // The open conversation is read: up to its last message, with a receipt when the setting asks,
  // once the page is in view, so that nothing counts as read that nobody could see.
  // What this window last told the server (the number and whether it was shown) is kept apart
  // from what it has read, so that turning receipts on publishes the receipt of a conversation
  // already read privately. A failed acknowledgement is sent again when the next refresh brings
  // the conversation again.
  const openState = open ? states.get(open) : undefined;
  const published = useRef(new Map<string, { seq: number; shown: boolean }>());
  const [pageInView, setPageInView] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  useEffect(() => {
    const changed = () => setPageInView(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (!open || !openState || !me || !pageInView) return;
    const last = openState.messages.at(-1)?.seq ?? 0;
    if (last === 0) return;
    const shown = ownReceipts[open] ?? receipts;
    const told = published.current.get(open);
    if (told && told.seq >= last && told.shown === shown) return;
    // Another window of this person already showed a receipt this far.
    if (shown && (openState.read[me] ?? 0) >= last && told === undefined) {
      published.current.set(open, { seq: last, shown: true });
      return;
    }
    published.current.set(open, { seq: last, shown });
    void sendJson(`${API}/conversations/${open}/read`, "POST", {
      seq: last,
      receipt: shown,
    }).then((reply) => {
      if (reply.status === 200) {
        void loadList();
        return;
      }
      if (published.current.get(open)?.seq === last) published.current.delete(open);
    });
  }, [open, openState, me, receipts, ownReceipts, loadList, pageInView]);

  const deliver = useCallback(
    (id: string, waiting: Pending) => {
      const attempt = async (tries: number): Promise<void> => {
        if (stopped.current) return;
        const reply = await sendJson(
          `${API}/conversations/${id}/messages`,
          "POST",
          { text: waiting.text, attachments: waiting.attachments, reply_to: waiting.replyTo },
          waiting.key,
        );
        if (reply.status === 200 || reply.status === 201) {
          const message = (reply.body as { message?: ConvMessage } | null)?.message;
          setPending((all) =>
            new Map(all).set(
              id,
              (all.get(id) ?? []).filter((each) => each.key !== waiting.key),
            ),
          );
          if (message) {
            setStates((all) => {
              const state = all.get(id);
              if (!state || state.messages.some((each) => each.seq === message.seq)) return all;
              return new Map(all).set(id, {
                ...state,
                messages: [...state.messages, message].sort((a, b) => a.seq - b.seq),
              });
            });
          }
          void loadList();
          return;
        }
        const temporary = reply.status === 0 || reply.status >= 500 || reply.status === 429;
        if (temporary && tries + 1 < SEND_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 300 * 2 ** tries)));
          return attempt(tries + 1);
        }
        setPending((all) =>
          new Map(all).set(
            id,
            (all.get(id) ?? []).map((each) =>
              each.key === waiting.key
                ? { ...each, failed: true, ...(temporary ? {} : { refused: true }) }
                : each,
            ),
          ),
        );
        if (!temporary) {
          setRefusals((all) =>
            new Map(all).set(id, errorOf(reply.body, "The message was refused.")),
          );
        }
      };
      // One conversation's messages are sent one after another, in the order they were written.
      const before = sending.current.get(id) ?? Promise.resolve();
      const run = before.then(() => attempt(0));
      sending.current.set(id, run);
      void run.then(() => {
        if (sending.current.get(id) === run) sending.current.delete(id);
      });
    },
    [loadList],
  );

  // What waits to be sent is kept in this browser (`messages-outbox.ts`): once the person is known,
  // what a closed or reloaded window left comes back and is sent again under its own key, and
  // every change is written.
  const outboxKeys = useRef(new Set<string>());
  // Set in the update that brings back what was left, so no write can come before it and lose it.
  const [adoptedFor, setAdoptedFor] = useState<string | null>(null);
  const [outboxRefused, setOutboxRefused] = useState(false);
  useEffect(() => {
    if (!enabled || !me || adoptedFor === me) return;
    setAdoptedFor(me);
    const left = readOutbox(me);
    if (left.length === 0) return;
    const waiting = new Map<string, Pending[]>();
    for (const { conversation, ...entry } of left) {
      outboxKeys.current.add(entry.key);
      // What only ran out of attempts goes out again; what the server refused waits for Try Again.
      const again: Pending = entry.refused ? entry : { ...entry, failed: false };
      waiting.set(conversation, [...(waiting.get(conversation) ?? []), again]);
    }
    setPending((all) => {
      const next = new Map(all);
      for (const [id, entries] of waiting) {
        const held = new Set((all.get(id) ?? []).map((each) => each.key));
        next.set(id, [...(all.get(id) ?? []), ...entries.filter((each) => !held.has(each.key))]);
      }
      return next;
    });
    for (const [id, entries] of waiting) {
      for (const entry of entries) if (!entry.failed) deliver(id, entry);
    }
  }, [enabled, me, deliver, adoptedFor]);
  useEffect(() => {
    if (!me || adoptedFor !== me) return;
    const mine = [...pending].flatMap(([conversation, entries]) =>
      entries.filter((entry) => !entry.uploading).map((entry) => ({ ...entry, conversation })),
    );
    setOutboxRefused(!writeOutbox(me, mine, outboxKeys.current));
    outboxKeys.current = new Set(mine.map((entry) => entry.key));
  }, [me, pending, adoptedFor]);
  const queue = useCallback(
    (id: string, text: string, attachments?: string[]) => {
      const replyTo = replying.get(id);
      const waiting: Pending = {
        key: randomKey(),
        text,
        at: stampOf(new Date()),
        replyTo,
        attachments,
        written: Date.now(),
      };
      setPending((all) => new Map(all).set(id, [...(all.get(id) ?? []), waiting]));
      setRefusals((all) => {
        if (!all.has(id)) return all;
        const next = new Map(all);
        next.delete(id);
        return next;
      });
      if (replyTo !== undefined) {
        setReplying((all) => {
          const next = new Map(all);
          next.delete(id);
          return next;
        });
      }
      deliver(id, waiting);
    },
    [deliver, replying],
  );

  // A file for a conversation is uploaded, then sent as a message of its own.
  const [picking, setPicking] = useState<string | null>(null);
  const computer = useRef<HTMLInputElement>(null);
  const attachTo = useRef<string | null>(null);
  const refuseFile = (id: string, error: unknown, fallback: string) =>
    setRefusals((all) => new Map(all).set(id, error instanceof Error ? error.message : fallback));
  const attach = (id: string, file: Blob, name: string) => {
    const marker: Pending = {
      key: randomKey(),
      text: "",
      at: stampOf(new Date()),
      uploading: name,
      written: Date.now(),
    };
    setPending((all) => new Map(all).set(id, [...(all.get(id) ?? []), marker]));
    const drop = () =>
      setPending((all) =>
        new Map(all).set(
          id,
          (all.get(id) ?? []).filter((each) => each.key !== marker.key),
        ),
      );
    uploadAttachment(API, file, name).then(
      (attachment) => {
        drop();
        queue(id, "", [attachment.id]);
      },
      (error: unknown) => {
        drop();
        refuseFile(id, error, "The file could not be uploaded.");
      },
    );
  };
  const attachEntry = (
    id: string,
    entry: { id: string; name: string; bytes?: () => Promise<Blob> },
  ) => {
    (entry.bytes ? entry.bytes() : readFile(entry.id)).then(
      (blob) => attach(id, blob, entry.name),
      (error: unknown) => refuseFile(id, error, "The file could not be read."),
    );
  };

  // One page at a time per conversation, each following the page before it; what arrives is
  // merged by number, so nothing shows twice.
  const loadEarlier = useCallback(
    async (id: string) => {
      const state = states.get(id);
      if (!state || loadingEarlier.current.has(id)) return;
      const head = state.older ?? null;
      const loaded = olderNow.current.get(id);
      // The chain goes on from where it stopped while the conversation's newest page is the
      // one it started from; otherwise it starts again from the new one.
      const page = loaded && loaded.head === head ? loaded.next : head;
      if (!page) return;
      loadingEarlier.current.add(id);
      try {
        const reply = (await getJson(
          `${API}/conversations/${id}/history?page=${encodeURIComponent(page)}`,
        )) as { messages?: ConvMessage[]; prev?: string | null };
        const gone = removed.current.get(id);
        const messages = (Array.isArray(reply.messages) ? reply.messages : []).filter(
          (each) => !gone || (each.seq > gone.through && !gone.seqs.has(each.seq)),
        );
        setOlder(
          (all) =>
            new Map([
              [
                id,
                {
                  next: typeof reply.prev === "string" ? reply.prev : null,
                  messages: bySeq([...messages, ...(all.get(id)?.messages ?? [])]),
                  head,
                },
              ],
            ]),
        );
      } catch {
        setRefusals((all) => new Map(all).set(id, "Earlier messages could not be loaded."));
      } finally {
        loadingEarlier.current.delete(id);
      }
    },
    [states],
  );

  const tapback = useCallback((id: string, seq: number, kind: string | null) => {
    void sendJson(`${API}/conversations/${id}/messages/${seq}/tapback`, "POST", { kind }).then(
      (reply) => {
        if (reply.status >= 300 || reply.status === 0) {
          setRefusals((all) =>
            new Map(all).set(id, errorOf(reply.body, "The tapback was not kept.")),
          );
        }
      },
    );
  }, []);

  const byConversation = useMemo(() => {
    const out = new Map<string, Map<string, ConvMessage>>();
    for (const [id, state] of states) {
      const all = new Map<string, ConvMessage>();
      for (const message of [...(older.get(id)?.messages ?? []), ...state.messages]) {
        all.set(`c${message.seq}`, message);
      }
      out.set(id, all);
    }
    return out;
  }, [states, older]);

  const held = useMemo(() => {
    const out = new Map<string, MessagesMessage[]>();
    for (const [id, state] of states) {
      // Only the open conversation shows its transcript; the others show the list's summary,
      // which is kept current for every conversation.
      if (id !== open) continue;
      const group = state.members.length > 2;
      const stored = bySeq([...(older.get(id)?.messages ?? []), ...state.messages]);
      const shown = stored.map((message) => toMessage(message, me, group));
      const lastMine = stored.findLast((message) => message.author === me);
      if (lastMine) {
        const index = shown.findIndex((message) => message.id === `c${lastMine.seq}`);
        const entry = shown[index];
        if (entry) shown[index] = { ...entry, status: statusOf(state, me, lastMine.seq) };
      }
      const stamped = new Set(stored.flatMap((message) => (message.key ? [message.key] : [])));
      for (const waiting of pending.get(id) ?? []) {
        if (stamped.has(waiting.key)) continue;
        shown.push({
          id: `pending-${waiting.key}`,
          from: "me",
          text: pendingText(waiting),
          at: waiting.at,
          pending: !waiting.failed,
          undelivered: waiting.failed === true,
        });
      }
      out.set(id, shown);
    }
    // The open conversation before its transcript has loaded (or while it cannot be): the list's
    // last message, and what this window is sending to it, so a message sent meanwhile shows,
    // and shows Not Delivered with Try Again if it fails.
    if (open && !states.has(open)) {
      const waiting = pending.get(open) ?? [];
      if (waiting.length > 0) {
        const summary = list.find((each) => each.id === open);
        const shown: MessagesMessage[] = summary?.last
          ? [toMessage(summary.last, me, summary.members.length > 2)]
          : [];
        for (const each of waiting) {
          shown.push({
            id: `pending-${each.key}`,
            from: "me",
            text: pendingText(each),
            at: each.at,
            pending: !each.failed,
            undelivered: each.failed === true,
          });
        }
        out.set(open, shown);
      }
    }
    return out;
  }, [states, older, pending, me, open, list]);

  const extraConversations = useMemo<MessagesConversation[]>(
    () =>
      list.map((summary) => ({
        id: summary.id,
        name: titleOf(summary, me),
        messages: summary.last ? [toMessage(summary.last, me, summary.members.length > 2)] : [],
        unread: summary.unread > 0 && summary.id !== open,
        unknown:
          known !== null &&
          summary.members.some((member) => member.name !== me) &&
          summary.members.every((member) => member.name === me || !known.has(member.name)),
        people: summary.members
          .filter((member) => member.name !== me)
          .map((member) => ({
            name: member.full_name || member.name,
            image: cardPictures.get(member.name),
          })),
      })),
    [list, me, open, known, cardPictures],
  );

  const notices = useMemo(() => {
    const out = new Map<string, ReactNode>();
    for (const [id, state] of states) {
      const lines: ReactNode[] = [];
      const seen = typingSeen.get(id);
      const typing = state.members.filter(
        (member) =>
          member.name !== me &&
          now - (seen?.get(member.name) ?? 0) < TYPING_SHOWN_MS &&
          (state.typing?.[member.name] ?? 0) > 0,
      );
      if (typing.length > 0) {
        lines.push(
          <span key="typing" role="status" className="mac-messages-typing">
            {typing.map((member) => member.full_name || member.name).join(", ")}{" "}
            {typing.length === 1 ? "is" : "are"} typing…
          </span>,
        );
      }
      const replyTo = replying.get(id);
      if (replyTo !== undefined) {
        const quoted = byConversation.get(id)?.get(`c${replyTo}`);
        lines.push(
          <span key="reply">
            Replying to “{(quoted?.text || "an earlier message").slice(0, 60)}”{" "}
            <BorderlessButton
              color="link"
              onClick={() =>
                setReplying((all) => {
                  const next = new Map(all);
                  next.delete(id);
                  return next;
                })
              }
            >
              Cancel Reply
            </BorderlessButton>
          </span>,
        );
      }
      const other = otherPerson(state.members, me, list.find((each) => each.id === id)?.group);
      if (other && blocked.has(other.name)) {
        lines.push(
          <span key="blocked">
            You have blocked {other.full_name || other.name}: what they send does not reach you.
          </span>,
        );
      }
      const refusal = refusals.get(id);
      if (outboxRefused && pending.get(id)?.length)
        lines.push(
          <span key="unsaved" role="alert">
            This browser could not keep your message: closing this window before it is sent will
            lose it.
          </span>,
        );
      if (refusal)
        lines.push(
          <span key="refusal" role="alert">
            {refusal}
          </span>,
        );
      if (lines.length > 0) out.set(id, lines);
    }
    // A refusal of a new conversation (its draft has no state yet).
    for (const [id, refusal] of refusals) {
      if (!states.has(id)) out.set(id, <span role="alert">{refusal}</span>);
    }
    return out;
  }, [
    states,
    typingSeen,
    me,
    now,
    replying,
    byConversation,
    refusals,
    pending,
    outboxRefused,
    blocked,
    list,
  ]);

  const transcriptStart = useMemo(() => {
    const out = new Map<string, ReactNode>();
    for (const [id, state] of states) {
      const loaded = older.get(id);
      const head = state.older ?? null;
      const more = loaded && loaded.head === head ? loaded.next !== null : head !== null;
      if (more) {
        out.set(
          id,
          <BorderlessButton color="link" onClick={() => void loadEarlier(id)}>
            Load Earlier Messages
          </BorderlessButton>,
        );
      }
    }
    return out;
  }, [states, older, loadEarlier]);

  // A message's commands, in the pull-down after it and on a right click on its bubble.
  const messageCommands = (conversationId: string, stored: ConvMessage): ReactNode => {
    const mine = me ? stored.tapbacks?.[me] : undefined;
    // Tapbacks change only on the newest messages (messages.mdx, Known limits): one loaded with
    // Load Earlier Messages offers none.
    const recent =
      states.get(conversationId)?.messages.some((each) => each.seq === stored.seq) === true;
    return (
      <>
        {TAPBACKS.map(([kind, label, mark]) => (
          <MenuItem
            key={kind}
            disabled={!recent}
            title={recent ? undefined : TAPBACK_OLDER}
            onClick={() => tapback(conversationId, stored.seq, kind)}
          >
            {mark} {label}
          </MenuItem>
        ))}
        <MenuItem
          disabled={!mine || !recent}
          title={!recent ? TAPBACK_OLDER : !mine ? NO_TAPBACK_TO_REMOVE : undefined}
          onClick={() => tapback(conversationId, stored.seq, null)}
        >
          Remove Tapback
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onClick={() => setReplying((all) => new Map(all).set(conversationId, stored.seq))}
        >
          Reply
        </MenuItem>
      </>
    );
  };
  const renderMessageMenu = (conversationId: string, message: MessagesMessage): ReactNode => {
    if (!isAccountConversation(conversationId)) return null;
    const stored = byConversation.get(conversationId)?.get(message.id);
    if (!stored) return null;
    return (
      <>
        <MenuSeparator />
        {messageCommands(conversationId, stored)}
      </>
    );
  };

  const renderMessageExtras = (conversationId: string, message: MessagesMessage): ReactNode => {
    if (!isAccountConversation(conversationId)) return null;
    const stored = byConversation.get(conversationId)?.get(message.id);
    if (!stored) return null;
    const direction = message.from === "me" ? "sent" : "received";
    const quoted =
      stored.reply_to !== undefined
        ? byConversation.get(conversationId)?.get(`c${stored.reply_to}`)
        : undefined;
    const marks = Object.entries(stored.tapbacks ?? {});
    return (
      <div className="mac-messages-extras" data-direction={direction}>
        {stored.reply_to !== undefined ? (
          <Label textStyle="small" color="secondary">
            Reply to “{(quoted?.text || "an earlier message").slice(0, 60)}”
          </Label>
        ) : null}
        {(stored.attachments ?? []).length > 0 ? (
          <ul aria-label="Attachments" className="mac-mail-live-received">
            {(stored.attachments ?? []).map((attachment) => (
              <ReceivedAttachment
                key={attachment.id}
                url={`${API}/conversations/${conversationId}/attachments/${attachment.id}`}
                attachment={attachment}
              />
            ))}
          </ul>
        ) : null}
        {marks.length > 0 ? (
          <Label textStyle="small" color="secondary" aria-label="Tapbacks">
            {marks
              .map(([name, kind]) => {
                const mark = TAPBACKS.find(([each]) => each === kind)?.[2] ?? kind;
                return `${mark} ${name === me ? "You" : name}`;
              })
              .join("  ")}
          </Label>
        ) : null}
        <PullDownButton
          bordered={false}
          title="…"
          aria-label={`Tapback or reply to message ${stored.seq}`}
        >
          {messageCommands(conversationId, stored)}
        </PullDownButton>
      </div>
    );
  };

  // The key a draft's conversation is started with, kept while the answer is unknown (a lost
  // reply): sending again with the same recipients finds the conversation made the first time
  // rather than make another group.
  const startKeys = useRef(new Map<string, { to: string; key: string }>());
  const onStartConversation = async (
    recipients: string,
    message: MessagesMessage,
    draftId: string,
    files: readonly DesktopDragItem[] = [],
  ): Promise<string | null> => {
    const to = recipientsOf(recipients);
    if (to.length === 0) return null;
    const asked = to.join(",");
    const kept = startKeys.current.get(draftId);
    const key = kept?.to === asked ? kept.key : randomKey();
    startKeys.current.set(draftId, { to: asked, key });
    const reply = await sendJson(`${API}/conversations`, "POST", { to }, key);
    const state = (reply.body as { state?: ConvState } | null)?.state;
    const started = (reply.status === 200 || reply.status === 201) && state?.id ? state : null;
    // The key is kept until the outcome is known: a conversation named in a readable answer, or
    // a refusal. A 2xx whose answer cannot be read may have made the conversation, so a resend
    // with the same key must find it rather than make another.
    const refused = reply.status >= 400 && reply.status < 500 && reply.status !== 429;
    if (started || refused) startKeys.current.delete(draftId);
    if (started?.id) {
      const id = started.id;
      // Beside the conversation shown now, which may be another one opened meanwhile.
      setStates((all) => new Map(all).set(id, started));
      setList((all) =>
        all.some((summary) => summary.id === id)
          ? all
          : [
              {
                id,
                title: started.title,
                members: started.members,
                last: null,
                unread: 0,
                at_ms: Date.now(),
              },
              ...all,
            ],
      );
      setRefusals((all) => {
        const next = new Map(all);
        next.delete(draftId);
        return next;
      });
      // The window shows it, and says so (`onConversationChange`), only if the draft is still
      // the conversation shown.
      if (message.text) queue(id, message.text);
      for (const item of fileItemsOfDrag(files)) attachEntry(id, item);
      return id;
    }
    const unknown = (reply.body as { unknown?: unknown } | null)?.unknown;
    setRefusals((all) =>
      new Map(all).set(
        draftId,
        Array.isArray(unknown)
          ? `No account on this desktop is called ${unknown.join(", ")}.`
          : errorOf(reply.body, "The conversation could not be started; send again."),
      ),
    );
    return null;
  };

  const onTyping = (id: string) => {
    if (!isAccountConversation(id)) return;
    const last = lastTypingSent.current.get(id) ?? 0;
    if (Date.now() - last < TYPING_EVERY_MS) return;
    lastTypingSent.current.set(id, Date.now());
    void sendJson(`${API}/conversations/${id}/typing`, "POST", {});
  };

  const owns = (id: string) => isAccountConversation(id);

  // Only a group can be left: a conversation of two would be one person's.
  // A group's name, once the server has kept it; a refusal stays under its transcript. One write
  // at a time per conversation, and the newest name typed meanwhile goes next.
  const renaming = useRef(new Map<string, string | null>());
  const renameConversation = async (id: string, title: string) => {
    if (renaming.current.has(id)) {
      renaming.current.set(id, title);
      return;
    }
    let next: string | null | undefined = title;
    while (typeof next === "string") {
      renaming.current.set(id, null);
      const reply = await sendJson(`${API}/conversations/${id}/title`, "PUT", { title: next });
      next = renaming.current.get(id);
      if (reply.status !== 200) {
        setRefusals((all) =>
          new Map(all).set(id, errorOf(reply.body, "The group's name was not kept; try again.")),
        );
        continue;
      }
      if (typeof next === "string") continue;
      const kept = (reply.body as { title?: string | null }).title ?? null;
      setList((all) => all.map((each) => (each.id === id ? { ...each, title: kept } : each)));
      setStates((all) => {
        const state = all.get(id);
        return state ? new Map(all).set(id, { ...state, title: kept }) : all;
      });
    }
    renaming.current.delete(id);
  };

  // Someone added once the server has kept it; a refusal stays under the transcript.
  const addMember = async (id: string, to: string): Promise<boolean> => {
    const reply = await sendJson(`${API}/conversations/${id}/members`, "POST", { to });
    if (reply.status !== 200 && reply.status !== 201) {
      const unknown = (reply.body as { unknown?: unknown } | null)?.unknown;
      setRefusals((all) =>
        new Map(all).set(
          id,
          Array.isArray(unknown)
            ? `No account on this desktop is called ${unknown.join(", ")}.`
            : errorOf(reply.body, "They were not added; try again."),
        ),
      );
      return false;
    }
    const { members } = reply.body as { members: Person[] };
    setRefusals((all) => {
      if (!all.has(id)) return all;
      const next = new Map(all);
      next.delete(id);
      return next;
    });
    setList((all) => all.map((each) => (each.id === id ? { ...each, members } : each)));
    setStates((all) => {
      const state = all.get(id);
      return state ? new Map(all).set(id, { ...state, members }) : all;
    });
    return true;
  };

  const renderDetails = (id: string): ReactNode => {
    if (!isAccountConversation(id)) return null;
    const known = states.get(id) ?? list.find((each) => each.id === id);
    if (!known) return null;
    const group = known.members.length > 2 || list.find((each) => each.id === id)?.group === true;
    return (
      <>
        {group ? (
          <GroupName
            key={id}
            title={known.title ?? ""}
            onRename={(title) => void renameConversation(id, title)}
          />
        ) : null}
        <Checkbox
          checked={ownReceipts[id] ?? receipts}
          onCheckedChange={(on) =>
            changeDesktopValue(MESSAGES_RECEIPTS, { ...ownReceipts, [id]: on })
          }
        >
          Send Read Receipts
        </Checkbox>
        {group ? <AddMember offered={people} onAdd={(to) => addMember(id, to)} /> : null}
        <ul aria-label="Members" className="mac-messages-members">
          {known.members.map((member) => (
            <li key={member.name}>
              <Label textStyle="small" color="secondary">
                {member.name === me
                  ? `${member.full_name || member.name} (you)`
                  : member.full_name || member.name}
              </Label>
            </li>
          ))}
        </ul>
        <ConversationFiles key={`${id}:${filesRound}`} id={id} last={states.get(id)?.last ?? 0} />
      </>
    );
  };

  const canLeaveConversation = (id: string) => {
    if (!isAccountConversation(id)) return false;
    const members = states.get(id)?.members ?? list.find((each) => each.id === id)?.members;
    return (members?.length ?? 0) > 2;
  };

  // Left once the server says so (or says the person is no longer in it, `404`, as when another
  // window left it first): it goes from the list and its transcript is dropped. Any other answer
  // keeps it, with the refusal under its transcript.
  const onLeaveConversation = async (id: string): Promise<boolean> => {
    if (!canLeaveConversation(id)) return false;
    leaving.current.add(id);
    const reply = await sendJson(`${API}/conversations/${id}/leave`, "POST", {});
    if (reply.status === 200 || reply.status === 404) {
      setList((all) => all.filter((each) => each.id !== id));
      setStates((all) => {
        if (!all.has(id)) return all;
        const next = new Map(all);
        next.delete(id);
        return next;
      });
      setRefusals((all) => {
        if (!all.has(id)) return all;
        const next = new Map(all);
        next.delete(id);
        return next;
      });
      void loadList();
      return true;
    }
    leaving.current.delete(id);
    setRefusals((all) =>
      new Map(all).set(id, errorOf(reply.body, "You did not leave the conversation; try again.")),
    );
    return false;
  };

  // Delete Conversation, for this person alone: through the newest message known here. Anything
  // said since brings it back with only that.
  const canDeleteConversation = isAccountConversation;
  const onDeleteConversation = async (id: string): Promise<boolean> => {
    if (!isAccountConversation(id)) return false;
    const known = [states.get(id)?.last ?? 0, list.find((each) => each.id === id)?.last?.seq ?? 0];
    const seq = Math.max(...known);
    const reply = await sendJson(`${API}/conversations/${id}/clear`, "POST", { seq });
    if (reply.status !== 200 && reply.status !== 404) {
      setRefusals((all) =>
        new Map(all).set(id, errorOf(reply.body, "The conversation could not be deleted.")),
      );
      return false;
    }
    setList((all) => all.filter((each) => each.id !== id));
    setStates((all) => {
      if (!all.has(id)) return all;
      const next = new Map(all);
      next.delete(id);
      return next;
    });
    // Something said while the request was on its way brings it back at once.
    void loadList();
    return true;
  };

  // Clear Chat Transcript, for this person alone: it stays in the list, empty.
  const onClearTranscript = async (id: string): Promise<boolean> => {
    if (!isAccountConversation(id)) return false;
    const known = [states.get(id)?.last ?? 0, list.find((each) => each.id === id)?.last?.seq ?? 0];
    const seq = Math.max(...known);
    const reply = await sendJson(`${API}/conversations/${id}/clear`, "POST", { seq, listed: true });
    if (reply.status !== 200) {
      setRefusals((all) =>
        new Map(all).set(id, errorOf(reply.body, "The transcript could not be cleared.")),
      );
      return false;
    }
    const through = (reply.body as { cleared: number }).cleared;
    setFilesRound((round) => round + 1);
    const held = removed.current.get(id);
    const seqs = held?.seqs ?? new Set<number>();
    removed.current.set(id, { through: Math.max(through, held?.through ?? 0), seqs });
    setStates((all) => {
      const state = all.get(id);
      if (!state) return all;
      return new Map(all).set(id, {
        ...state,
        older: null,
        messages: state.messages.filter((each) => each.seq > through),
      });
    });
    setOlder((all) => {
      if (!all.has(id)) return all;
      const next = new Map(all);
      next.delete(id);
      return next;
    });
    void loadList();
    return true;
  };

  const canDeleteMessage = (id: string, message: MessagesMessage) =>
    byConversation.get(id)?.has(message.id) === true;
  // Delete… on a bubble, for this person alone.
  const onDeleteMessage = async (id: string, message: MessagesMessage): Promise<boolean> => {
    const seq = byConversation.get(id)?.get(message.id)?.seq;
    if (seq === undefined) return false;
    const reply = await sendJson(`${API}/conversations/${id}/messages/${seq}/hide`, "POST", {});
    if (reply.status !== 200) {
      setRefusals((all) =>
        new Map(all).set(id, errorOf(reply.body, "The message could not be deleted.")),
      );
      return false;
    }
    const kept = removed.current.get(id) ?? { through: 0, seqs: new Set<number>() };
    setFilesRound((round) => round + 1);
    kept.seqs.add(seq);
    removed.current.set(id, kept);
    const without = (messages: ConvMessage[]) => messages.filter((each) => each.seq !== seq);
    setStates((all) => {
      const state = all.get(id);
      return state ? new Map(all).set(id, { ...state, messages: without(state.messages) }) : all;
    });
    setOlder((all) => {
      const loaded = all.get(id);
      return loaded ? new Map(all).set(id, { ...loaded, messages: without(loaded.messages) }) : all;
    });
    void loadList();
    return true;
  };

  const otherOf = (id: string): Person | null => {
    const listed = list.find((each) => each.id === id);
    return otherPerson(states.get(id)?.members ?? listed?.members ?? [], me, listed?.group);
  };
  const onBlockChange = (id: string, block: boolean) => {
    const other = otherOf(id);
    if (!other) return;
    blockedTurn.current += 1;
    const turn = (blockedAsked.current.get(other.name) ?? 0) + 1;
    blockedAsked.current.set(other.name, turn);
    void sendJson(`${API}/blocked/${encodeURIComponent(other.name)}`, "PUT", {
      blocked: block,
    }).then((reply) => {
      // A later change of this person was asked for meanwhile: that one's answer says what holds.
      if (turn !== blockedAsked.current.get(other.name)) return;
      if (reply.status !== 200) {
        setRefusals((all) =>
          new Map(all).set(id, errorOf(reply.body, "That could not be kept; try again.")),
        );
        return;
      }
      blockedTurn.current += 1;
      const holds = (reply.body as { blocked?: unknown } | null)?.blocked === true;
      setBlocked((all) => {
        const next = new Set(all);
        if (holds) next.add(other.name);
        else next.delete(other.name);
        return next;
      });
      void loadList();
    });
  };

  const onSendFile = (id: string) => {
    if (!isAccountConversation(id)) return;
    attachTo.current = id;
    setPicking(id);
  };

  const renderAudioButton = (id: string): ReactNode =>
    isAccountConversation(id) ? (
      <AudioMessageButton
        key={id}
        onSend={(recording, name) => attach(id, recording, name)}
        onProblem={(message) => refuseFile(id, new Error(message), message)}
      />
    ) : null;

  const renderInputAccessory = (id: string | null): ReactNode =>
    id && isAccountConversation(id) ? (
      <>
        <ImageButton
          aria-label="Attach a file"
          onClick={() => {
            attachTo.current = id;
            setPicking(id);
          }}
        >
          <MailGlyph name="attach" size={16} />
        </ImageButton>
        <input
          ref={computer}
          type="file"
          multiple
          hidden
          aria-label="Send files from this computer"
          onChange={(event) => {
            const to = attachTo.current ?? id;
            for (const file of event.currentTarget.files ?? []) attach(to, file, file.name);
            event.currentTarget.value = "";
            setPicking(null);
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
                    setPicking(null);
                    attachEntry(picking, entry);
                  }}
                  onCancel={() => setPicking(null)}
                />
              </div>,
              document.body,
            )
          : null}
      </>
    ) : null;

  return {
    listRead,
    props: enabled
      ? {
          extraConversations,
          onStartConversation,
          recipientSuggestions: people,
          renderMessageExtras,
          renderMessageMenu,
          renderDetails,
          onSendFile,
          renderInputAccessory,
          renderAudioButton,
          isNewMessage: (id, message) => {
            const seq = /^c(\d+)$/.exec(message.id)?.[1];
            return (
              startedAt.current !== null &&
              seq !== undefined &&
              Number(seq) > (startedAt.current.get(id) ?? 0)
            );
          },
          canTakeFiles: isAccountConversation,
          conversationWith: (account) =>
            list.find(
              ({ group, members }) =>
                !group && members.length === 2 && members.some((member) => member.name === account),
            )?.id ?? null,
          faceTimeWith: (id) => {
            const others = states.get(id)?.members.filter((member) => member.name !== me) ?? [];
            return others.length === 1 ? (others[0]?.name ?? null) : null;
          },
          onDropFiles: (id, items) => {
            for (const item of fileItemsOfDrag(items)) attachEntry(id, item);
          },
          transcriptStart,
          onTyping,
          canLeaveConversation,
          onLeaveConversation,
          canDeleteConversation,
          onDeleteConversation,
          onClearTranscript,
          canDeleteMessage,
          onDeleteMessage,
          blockedPerson: (id) => {
            const other = otherOf(id);
            return other
              ? { name: other.full_name || other.name, blocked: blocked.has(other.name) }
              : null;
          },
          onBlockChange,
        }
      : {},
    held,
    me,
    notices,
    owns,
    send: (id, message) => {
      if (owns(id)) queue(id, message.text);
    },
    retry: (id, message) => {
      if (!owns(id) || !message.id.startsWith("pending-")) return;
      const key = message.id.slice("pending-".length);
      const waiting = pendingNow.current.get(id)?.find((each) => each.key === key);
      if (!waiting?.failed) return;
      setPending((all) =>
        new Map(all).set(
          id,
          (all.get(id) ?? []).map((each) =>
            each.key === key ? { ...each, failed: false, refused: false } : each,
          ),
        ),
      );
      deliver(id, { ...waiting, failed: false });
    },
    // The open conversation is read by `useConversationReads`, the one place that reads it, so
    // an older answer never replaces a newer one.
    onConversationChange: (id) => setOpenId(id),
  };
}
