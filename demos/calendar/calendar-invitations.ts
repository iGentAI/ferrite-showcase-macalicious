import { useCallback, useEffect, useRef, useState } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { type CalendarEntry, INVITATIONS, type RepeatRule } from "./calendar-data";

/*
 * Invitations between accounts, on the desktop served by the Ferrite application
 * (ferrite-apps/desktop/src/apps/calendar/invites.rs). An event invites people by account name
 * (`invitees` in the person's own document, saved with it); the server sends each one an
 * invitation and keeps their answers. This file reads both sides: the answers to the person's
 * own invitations (`/sent`) and the invitations the person has (`/inbox`), and sends an answer.
 * Nothing here runs unless the page is served by the application.
 */

export const SENT_URL = "/api/calendar/sent";
export const INBOX_URL = "/api/calendar/inbox";
export const PEOPLE_URL = "/api/calendar/people";

/** An invitee's answer. */
export type AnswerStatus = "pending" | "accepted" | "declined";

/** Someone invited, and their answer. */
export interface Answer {
  name: string;
  fullName: string;
  status: AnswerStatus;
}

/** An event another account invited the person to. */
export interface Invitation {
  /** The invitation's id, which the answer names. */
  id: string;
  /** The version of the event the invitation shows, which the answer names too. */
  version: number;
  organizer: { name: string; fullName: string };
  /** The event, in the Invitations calendar, with the id `invitation-<id>`. */
  event: CalendarEntry;
  /** The person's own answer. */
  status: AnswerStatus;
  /** Everyone invited, the person among them, with their answers. */
  invitees: Answer[];
}

/** What a request to the server failed with: the HTTP status (0 when none came) and its word. */
export class InvitationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 8.64e15;
const STATUSES: readonly unknown[] = ["pending", "accepted", "declined"];

function answerOf(value: unknown): Answer | null {
  if (!isObject(value) || !isString(value.name) || !isString(value.full_name)) return null;
  if (!STATUSES.includes(value.status)) return null;
  return { name: value.name, fullName: value.full_name, status: value.status as AnswerStatus };
}

function answersOf(value: unknown): Answer[] | null {
  if (!Array.isArray(value)) return null;
  const answers = value.map(answerOf);
  return answers.every((answer) => answer !== null) ? (answers as Answer[]) : null;
}

/** Whether a `GET /sent` reply says some invitee is still to be told: the next read carries on. */
export const sentPending = (reply: unknown) => isObject(reply) && reply.pending === true;

/** The answers to the person's invitations, by event id; `null` for a reply that is not one. */
export function sentFromServer(reply: unknown): Record<string, Answer[]> | null {
  if (!isObject(reply) || !isObject(reply.events)) return null;
  const out: Record<string, Answer[]> = {};
  for (const [id, list] of Object.entries(reply.events)) {
    const answers = answersOf(list);
    if (!answers) return null;
    out[id] = answers;
  }
  return out;
}

/** One invitation as the window shows it, or `null` when the server's form is not one. */
function invitationOf(value: unknown): Invitation | null {
  if (!isObject(value) || !isString(value.id) || !/^[0-9a-f]{32}$/.test(value.id)) return null;
  const { organizer, event, version } = value;
  if (!Number.isSafeInteger(version) || (version as number) < 0) return null;
  if (!isObject(organizer) || !isString(organizer.name) || !isString(organizer.full_name)) {
    return null;
  }
  if (!STATUSES.includes(value.status)) return null;
  const invitees = answersOf(value.invitees);
  if (!invitees || !isObject(event) || !isString(event.title)) return null;
  if (!isTime(event.start) || !isTime(event.end)) return null;
  const entry: CalendarEntry = {
    id: `invitation-${value.id}`,
    title: event.title,
    start: new Date(event.start),
    end: new Date(event.end),
    calendar: INVITATIONS,
  };
  if (event.allDay === true) entry.allDay = true;
  if (isString(event.location) && event.location) entry.location = event.location;
  if (isString(event.notes) && event.notes) entry.notes = event.notes;
  if (isString(event.url) && event.url) entry.url = event.url;
  const repeat = event.repeat as Partial<RepeatRule> | undefined;
  if (isObject(repeat) && ["daily", "weekly", "monthly", "yearly"].includes(String(repeat.freq))) {
    entry.repeat = repeat as RepeatRule;
    if (Array.isArray(event.exdates) && event.exdates.every(isTime)) {
      entry.exdates = event.exdates as number[];
    }
  }
  return {
    id: value.id,
    version: version as number,
    organizer: { name: organizer.name, fullName: organizer.full_name },
    event: entry,
    status: value.status as AnswerStatus,
    invitees,
  };
}

/**
 * The invitations of a `GET /inbox` reply, the unreadable ones left out, and whether the person
 * may invite; `null` for a reply that is not one.
 */
export function inboxFromServer(
  reply: unknown,
): { invitations: Invitation[]; canInvite: boolean; me?: string } | null {
  if (!isObject(reply) || !Array.isArray(reply.invitations)) return null;
  return {
    invitations: reply.invitations
      .map(invitationOf)
      .filter((each): each is Invitation => each !== null),
    canInvite: reply.can_invite === true,
    ...(isString(reply.me) ? { me: reply.me } : {}),
  };
}

async function request(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await withDeadline((signal) =>
      sessionFetch(url, {
        credentials: "same-origin",
        ...init,
        headers: { accept: "application/json", ...(init?.headers ?? {}) },
        signal,
      }),
    );
  } catch {
    throw new InvitationError(0, "The desktop could not be reached. Try again.");
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const word = isObject(body) && isString(body.error) ? body.error : "";
    throw new InvitationError(response.status, word || "The desktop refused the request.");
  }
  return body;
}

/** The account `name` names, to invite: `{name, fullName}`, or an `InvitationError` (404: none). */
export async function lookupInvitee(name: string): Promise<{ name: string; fullName: string }> {
  const body = await request(`${PEOPLE_URL}/${encodeURIComponent(name)}`);
  if (!isObject(body) || !isString(body.name) || !isString(body.full_name)) {
    throw new InvitationError(0, "The account could not be looked up.");
  }
  return { name: body.name, fullName: body.full_name };
}

/**
 * Send the person's answer to the version `version` of an invitation; resolves with the
 * invitation as it now stands. An `InvitationError` of 409: the event changed since.
 */
export async function answerInvitation(
  id: string,
  version: number,
  accept: boolean,
): Promise<Invitation | null> {
  const body = await request(`${INBOX_URL}/${id}/${version}/${accept ? "accept" : "decline"}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return invitationOf(body);
}

export interface CalendarInvitations {
  /** The invitations the person has, the declined ones among them. */
  invitations: readonly Invitation[];
  /** The answers to the person's own invitations, by event id. */
  answers: Readonly<Record<string, Answer[]>>;
  /** Whether the person may invite: signed in to an account that is not a Guest User. */
  canInvite: boolean;
  /** The person's own account name, when signed in. */
  me?: string;
  /** Read both again: after a save that changed who is invited. */
  refresh: () => void;
  /** Answer an invitation; resolves when the server has it, or rejects with why not. */
  respond: (id: string, accept: boolean) => Promise<void>;
}

const NONE: readonly Invitation[] = [];
const NO_ANSWERS: Readonly<Record<string, Answer[]>> = {};
/** How long the window waits before reading again: while the server says invitees are still to
 * be told, or after a read that failed; and how many times in a row it does so for each. Each
 * read carries the telling on, so a long one is followed for longer. */
const AGAIN_MS = 2000;
const AGAIN_TIMES = 10;
const PENDING_TIMES = 150;

/**
 * Both sides of the person's invitations, while `enabled`: read when the window opens, when the
 * person's calendar changed elsewhere (`SERVER_CHANGE_EVENT`), and on `refresh`. A read that
 * fails keeps what was read last and is made again a little later, a few times; so is a read of
 * the answers while the server is still telling invitees, which each read carries on with.
 */
export function useCalendarInvitations(enabled: boolean): CalendarInvitations {
  const [invitations, setInvitations] = useState<readonly Invitation[]>(NONE);
  const [answers, setAnswers] = useState<Readonly<Record<string, Answer[]>>>(NO_ANSWERS);
  const [canInvite, setCanInvite] = useState(false);
  const [me, setMe] = useState<string | undefined>(undefined);
  // Counts the reads, so that an older read answered late changes nothing.
  const reads = useRef(0);
  // The read made again later, and how many times in a row one was.
  const again = useRef<{
    timer?: ReturnType<typeof setTimeout>;
    times: number;
    pending: number;
  }>({ times: 0, pending: 0 });
  // Whether the window is open: a read asked for after it closed is not made.
  const open = useRef(false);

  const read = useCallback(
    (retry: boolean) => {
      if (!enabled || !open.current) return;
      const state = again.current;
      clearTimeout(state.timer);
      // A read asked for afresh has its own few tries.
      if (!retry) {
        state.times = 0;
        state.pending = 0;
      }
      const now = ++reads.current;
      let failed = false;
      let pending = false;
      const inbox = request(INBOX_URL)
        .then((reply) => {
          const inbox = inboxFromServer(reply);
          if (!inbox) failed = true;
          else if (now === reads.current) {
            setInvitations(inbox.invitations);
            setCanInvite(inbox.canInvite);
            setMe(inbox.me);
          }
        })
        .catch(() => {
          failed = true;
        });
      const sent = request(SENT_URL)
        .then((reply) => {
          const sent = sentFromServer(reply);
          if (!sent) failed = true;
          else if (sentPending(reply)) pending = true;
          if (sent && now === reads.current) setAnswers(sent);
        })
        .catch(() => {
          failed = true;
        });
      void Promise.all([inbox, sent]).then(() => {
        if (now !== reads.current || !open.current) return;
        if (failed ? state.times >= AGAIN_TIMES : !pending || state.pending >= PENDING_TIMES)
          return;
        if (failed) state.times += 1;
        else state.pending += 1;
        state.timer = setTimeout(() => readRef.current(true), AGAIN_MS);
      });
    },
    [enabled],
  );
  // The newest `read`, for the read made again later.
  const readRef = useRef(read);
  readRef.current = read;
  const refresh = useCallback(() => read(false), [read]);

  useEffect(() => {
    if (!enabled) return;
    open.current = true;
    refresh();
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === "calendar") refresh();
    };
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    const state = again.current;
    return () => {
      open.current = false;
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
      clearTimeout(state.timer);
      // A read answered after this is not taken.
      reads.current += 1;
    };
  }, [enabled, refresh]);

  const respond = useCallback(
    async (id: string, accept: boolean) => {
      const invitation = invitations.find((each) => each.id === id);
      if (!invitation) throw new InvitationError(404, "This invitation was taken back.");
      try {
        const now = await answerInvitation(id, invitation.version, accept);
        if (now) {
          setInvitations((list) => list.map((each) => (each.id === id ? now : each)));
        }
      } finally {
        // An answer refused because the event changed shows the event as it now is.
        refresh();
      }
    },
    [invitations, refresh],
  );

  return { invitations, answers, canInvite, me, refresh, respond };
}
