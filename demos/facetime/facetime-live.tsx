"use client";

import { HudWindowText } from "macalicious/hud-window";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContactPeople } from "../contacts/contacts-people";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { useMainWindowItem } from "../desktop/desktop-main-window";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import {
  type AddressRequest,
  askToReach,
  onAddressRequest,
  takeAddressRequests,
} from "../desktop/desktop-reach";
import { sessionFetch } from "../desktop/desktop-server";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { useBlockedPeople } from "../messages/messages-blocked-list";
import { FaceTime, type FaceTimeProps } from "./facetime";
import { AddPerson } from "./facetime-add-person";
import {
  type FaceTimeCall,
  type FaceTimeCallKind,
  type FaceTimeFilter,
  type FaceTimeHeldCall,
  type FaceTimeIncomingCall,
  peopleName,
} from "./facetime-data";
import {
  canChooseOutput,
  DeviceSubmenu,
  FACETIME_DEVICES,
  idOf,
  NO_DEVICES,
  OUTPUT_UNAVAILABLE,
  readDevices,
  useLocalMedia,
} from "./facetime-devices";
import { LivePhotoButton, NO_LIVE_PHOTO } from "./facetime-live-photo";
import { FACETIME_OFF, FACETIME_RINGTONE, readOff, readRingtone } from "./facetime-preferences";
import { DEFAULT_RINGTONE, playRing } from "./facetime-ring";
import { AlwaysOnTop, WindowOrientation } from "./facetime-window";

/** Why Video > End Call is dimmed: no call is placed or on. */
export const END_CALL_UNAVAILABLE = "There is no call to end.";
/** Why Add Person is dimmed: this page holds no call, or the call has as many as it can hold. */
export const ADD_PERSON_NO_CALL = "There is no call to add a person to.";
export const ADD_PERSON_FULL = "A call holds at most 4 people.";
/** Why Enter Full Screen is dimmed: only the desktop's window manager has a full screen to enter. */
export const FULL_SCREEN_UNAVAILABLE = "This window is not on the desktop.";
/** Why Undo to Select All are dimmed. */
export const NO_TEXT_TO_EDIT = "Click in the recipient field to edit its text.";
/** How long a sentence that needs no answer stays over the picture. */
const SAID_MS = 4_000;

/*
 * FaceTime calls between accounts of the desktop's Ferrite application
 * (`ferrite-apps/desktop/src/apps/facetime`), when the page is built for it
 * (`VITE_MACALICIOUS_API=1`). Everywhere else it is the plain `FaceTime` model and asks for no
 * camera.
 *
 * Sound and picture go straight between the browsers over WebRTC, a group as a mesh: one
 * connection to each other person joined, each with its own failure budget. The server carries
 * only the signalling. The server is the window's record of every call: the window shows a call
 * as its own only while the server says this page holds a seat in it.
 *
 * - The page names itself with a random page token. Placing a call and answering one take a
 *   seat tied to that token, so a resend keeps the seat and a reload or a second tab takes a
 *   new one. Every hang-up and signal names this page's seat.
 * - One operation runs at a time (placing, or answering), bound to a token: End and Decline
 *   revoke it, and a revoked operation is never sent again. A reply that never came is an
 *   unknown outcome, not a failure: the window reads the person's calls again a few times, and
 *   takes up a call this page holds when it wants one, or leaves it when it no longer does.
 * - A ringing call, the other member's moves and the end of a call arrive through the person's
 *   own live stream (`SERVER_CHANGE_EVENT`); while a call rings or runs the window also reads
 *   it every few seconds, which keeps this page's seat alive on the server.
 * - In each pair of seats the later offers and the earlier answers, each description sent whole
 *   once its ICE candidates are gathered.
 *
 * Addresses are found with a public STUN server. There is no TURN relay, so two browsers that
 * cannot reach each other directly (both behind strict NAT) do not connect; the window says so.
 */
export const LIVE = import.meta.env.VITE_MACALICIOUS_API === "1";

/** The public STUN server the browsers ask for their own addresses. */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
/** How long a description waits for its ICE candidates before it is sent with those it has. */
const GATHER_MS = 3_000;
/** How often the window reads a call that rings or runs: below the server's 25 s for a seat. */
export const POLL_MS = 4_000;
/** The most people in a call: the server's `MAX_MEMBERS`. */
export const MAX_PEOPLE = 4;
/** How many times one connection is negotiated before the window gives up on it. */
const MAX_NEGOTIATIONS = 3;
/** How long an offer may wait for its answer before it is made again. */
const ANSWER_MS = 20_000;
/** The longest one request may take, its answer included. */
const ATTEMPT_MS = 8_000;
/** How many times one request is sent before its outcome is left to the next look. */
const ATTEMPTS = 5;
/**
 * After an operation that ended without an answer, or was cancelled, the window reads the
 * person's calls again after each of these delays: past the server's request deadline and its
 * redelivery, by when any request still on its way has landed.
 */
export const RECHECK_MS = [500, 1_500, 3_000, 6_000, 10_000, 16_000] as const;
const LOOKING = "Looking for the call…";

export type MemberState = "ringing" | "joined" | "declined" | "missed" | "left";

export interface CallMember {
  name: string;
  full_name: string;
  state: MemberState;
  /** The seat while joined; `page` only for this person's own seat. */
  seat: { n: number; page?: string } | null;
  joined_ms: number;
  left_ms: number;
  /** Whether this member is the person reading. */
  me: boolean;
}

export interface CallLink {
  from: number;
  to: number;
  offer: string;
  generation: number;
  revision: number;
  answer?: string;
}

/** A call as the server sends it. */
export interface CallDoc {
  id: string;
  kind: FaceTimeCallKind;
  created_ms: number;
  connected_ms: number;
  ended_ms: number;
  members: CallMember[];
  /** The links of this person's seat, one for each other seat that has one. */
  links: CallLink[];
}

/** One of the person's recent calls as the server sends it. */
export interface RecentCall {
  call: string;
  kind: FaceTimeCallKind;
  status: "outgoing" | "incoming" | "missed";
  with: { name: string; full_name: string };
  at_ms: number;
  duration_ms: number;
  done: boolean;
  /** How many more people the call had besides `with`. */
  with_more?: number;
}

interface Calls {
  recents: RecentCall[];
  incoming: { version: number; state: CallDoc } | null;
  active: { version: number; state: CallDoc } | null;
}

/** "9:41 AM" today, "Yesterday", a weekday within the week, else the date. */
export function whenOf(at: number, now: number = Date.now()): string {
  const then = new Date(at);
  const today = new Date(now);
  const days = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(then.toDateString()).getTime()) /
      86_400_000,
  );
  if (days <= 0) return then.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString("en-US", { weekday: "long" });
  return then.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

/** The recent calls as the window's list shows them. */
export function rowsOf(recents: readonly RecentCall[], now: number = Date.now()): FaceTimeCall[] {
  return recents.map((recent) => ({
    id: recent.call,
    name: recent.with.full_name || recent.with.name || "Unknown",
    kind: recent.kind,
    status: recent.status,
    when: whenOf(recent.at_ms, now),
    to: recent.with.name,
    ...(recent.with_more ? { also: recent.with_more } : {}),
  }));
}

/** "0:42", "12:05", "1:02:03": how long a call has been connected. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  const h = Math.floor(seconds / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The person's own member of a call. */
export const mine = (call: CallDoc): CallMember | undefined =>
  call.members.find((member) => member.me);

/**
 * Who a call is with for the person reading: `shown` is who it names, those joined or else the
 * first it rings for, and `ringing` is whoever else it rings for.
 */
export function peopleOf(call: CallDoc): { shown: CallMember[]; ringing: CallMember[] } {
  const others = call.members.filter((member) => !member.me);
  const joined = others.filter((member) => member.state === "joined");
  const ringing = others.filter((member) => member.state === "ringing");
  if (joined.length > 0) return { shown: joined, ringing };
  return ringing.length > 0
    ? { shown: ringing.slice(0, 1), ringing: ringing.slice(1) }
    : { shown: others.slice(0, 1), ringing: [] };
}

/** The name a panel gives a call: "Martin", or "Martin and 1 other". */
export function callName(call: CallDoc): string | undefined {
  const [first, ...rest] = peopleOf(call).shown;
  return first && peopleName(first.full_name, rest.length);
}

/** Whether the page named `page` holds a seat in `call`, which goes on. */
export function heldBy(call: CallDoc, page: string): boolean {
  const me = mine(call);
  return call.ended_ms === 0 && me?.state === "joined" && me.seat?.page === page;
}

/** One connection a page makes in a call. */
export interface Connection {
  /** The pair of seats, the later first: the same on both pages. */
  key: string;
  mine: number;
  /** The other person's seat. */
  seat: number;
  /** Whether this page offers: its seat is the later one. */
  offers: boolean;
  /** Whose it is: their full name. */
  name: string;
}

/** The connections this page makes in `call`: one to each other person joined. */
export function plans(call: CallDoc, page: string): Connection[] {
  const own = mine(call)?.seat?.n;
  if (!heldBy(call, page) || own === undefined) return [];
  return call.members.flatMap((member) => {
    const seat = member.seat?.n;
    if (member.me || member.state !== "joined" || seat === undefined) return [];
    const offers = own > seat;
    return [
      {
        key: offers ? `${own}>${seat}` : `${seat}>${own}`,
        mine: own,
        seat,
        offers,
        name: member.full_name,
      },
    ];
  });
}

/**
 * The answer an offering connection should apply now: the link's answer to the offer this
 * connection sent, while it waits for one and has not taken that answer already; else `null`.
 */
export function answerToApply(
  peer: { offer: string | null; answer: string | null; state: RTCSignalingState },
  link: CallLink | null | undefined,
): string | null {
  if (!link?.answer || link.offer !== peer.offer) return null;
  if (peer.state !== "have-local-offer" || peer.answer === link.answer) return null;
  return link.answer;
}

async function getJson<T>(url: string): Promise<{ status: number; body: T | null } | null> {
  try {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(ATTEMPT_MS),
    });
    const body = response.ok ? ((await response.json()) as T) : null;
    return { status: response.status, body };
  } catch {
    return null;
  }
}

/**
 * POST JSON, sent again on a failure to send or a server error while `still()` holds, at most
 * `ATTEMPTS` times: its status and body, or `null` when no attempt was answered. An operation
 * that is cancelled stops being sent: `still()` is asked before every attempt.
 */
export async function postJson(
  url: string,
  body: unknown,
  still: () => boolean,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> | null } | null> {
  for (let attempt = 0; attempt < ATTEMPTS && still(); attempt++) {
    try {
      const response = await sessionFetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ATTEMPT_MS),
      });
      if (response.status < 500 && response.status !== 429) {
        const answer = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        return { status: response.status, body: answer };
      }
    } catch {
      // Sent again below.
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 250 * 2 ** attempt)));
  }
  return null;
}

/** Resolves once `pc` has gathered its ICE candidates, or after `GATHER_MS`. */
function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = setTimeout(done, GATHER_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

interface Peer {
  key: string;
  pc: RTCPeerConnection;
  name: string;
  /** The answer applied to this connection (offering side): applied once. */
  answer: string | null;
  /** The offer this connection sent, or was answered from. */
  offer: string | null;
  stream: MediaStream | null;
}

/**
 * A remote picture: a `<video>` that plays `stream`. A browser that holds back sound until the
 * person acts (Safari, above all when this browser has no camera or microphone of its own)
 * refuses to start it by itself; the call then shows a button that starts it.
 */
export function RemoteVideo({
  stream,
  name,
  kind,
  output,
  onOutput,
}: {
  stream: MediaStream;
  name: string;
  kind: FaceTimeCallKind;
  /** The device of Video > Output the sound plays through: none is the browser's default. */
  output?: string;
  /** Told the sink the picture has after asking for `output`, and whether the asking failed. */
  onOutput?: (sink: string, failed: boolean) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const start = useCallback(() => {
    const started = ref.current?.play?.();
    started?.then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, []);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    start();
  }, [stream, start]);
  useEffect(() => {
    const video = ref.current as
      | (HTMLVideoElement & { sinkId?: string; setSinkId?(id: string): Promise<void> })
      | null;
    video?.setSinkId?.(output ?? "").then(
      () => onOutput?.(video.sinkId ?? output ?? "", false),
      () => onOutput?.(video.sinkId ?? "", true),
    );
  }, [output, onOutput]);
  const what = kind === "audio" ? "sound" : "picture";
  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: a live call has no caption track to offer */}
      <video ref={ref} autoPlay playsInline aria-label={`${name}'s ${what}`} data-remote={name} />
      {blocked ? <PushButton onClick={start}>{`Play ${name}'s ${what}`}</PushButton> : null}
    </>
  );
}

/** The camera's own picture. */
function SelfView({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted aria-label="Your camera" data-self="" />;
}

/**
 * The FaceTime window of the desktop: real calls on the desktop's Ferrite application, the
 * plain model elsewhere. It takes every prop of `FaceTime`.
 */
export function FaceTimeLive(props: FaceTimeProps) {
  if (!LIVE) return <FaceTime {...props} />;
  return <CallingFaceTime {...props} />;
}

/** One operation of the window: placing a call or answering one, until the server answers. */
interface Operation {
  token: object;
  kind: "place" | "join";
}

/** All or Missed, kept with the person's desktop settings. */
const FACETIME_FILTER = "facetime.filter";
const FACETIME_ON_TOP = "facetime.alwaysOnTop";
const FACETIME_PORTRAIT = "facetime.portrait";
const readOn = (stored: unknown) => stored === true;
/** Why Picture in Picture is dimmed. */
export const NO_PICTURE_IN_PICTURE =
  "Picture in Picture needs the other person's picture in a call.";
export const PICTURE_IN_PICTURE_UNAVAILABLE = "This browser does not offer Picture in Picture.";
const readFilter = (stored: unknown): FaceTimeFilter | undefined =>
  stored === "all" || stored === "missed" ? stored : undefined;

function CallingFaceTime(props: FaceTimeProps) {
  const [page] = useState(() => crypto.randomUUID());
  const alive = useRef(true);
  const [me, setMe] = useState<{ name: string | null; full_name?: string } | null>(null);
  const [recents, setRecents] = useState<RecentCall[]>([]);
  const people = useContactPeople();
  // The call ringing for the person, and a call they are in from another page.
  const [incoming, setIncoming] = useState<CallDoc | null>(null);
  const [elsewhere, setElsewhere] = useState<CallDoc | null>(null);
  const devices = useDesktopValue(FACETIME_DEVICES, readDevices, NO_DEVICES);
  const off = useDesktopValue(FACETIME_OFF, readOff, false) === true;
  const ringtone = useDesktopValue(FACETIME_RINGTONE, readRingtone, DEFAULT_RINGTONE);
  const blockedPeople = useBlockedPeople();
  const blocked = useMemo(
    () => new Set(blockedPeople.people.map((person) => person.name)),
    [blockedPeople.people],
  );
  // The sink a remote picture has now: `null` while no picture holds one.
  const [sink, setSink] = useState<string | null>(null);
  const windowElementNow = useRef<HTMLElement | null>(null);
  const sinkChanged = useCallback((id: string, failed: boolean) => {
    setSink(id);
    if (failed) setNotice("The sound could not move to that output. It plays where it did.");
  }, []);
  const op = useRef<Operation | null>(null);
  // A call being placed, shown as calling while its request is on its way.
  const [placing, setPlacing] = useState<{ name: string; kind: FaceTimeCallKind } | null>(null);
  // Whether the person wants to be in a call: set by placing and answering, cleared by End,
  // Decline and closing the window. A call this page holds while it is clear is left.
  const wanted = useRef(false);
  // The hang-ups on their way, by call.
  const leaving = useRef(new Map<string, number>());
  const [callId, setCallId] = useState<string | null>(null);
  const callRef = useRef<string | null>(null);
  const [call, setCall] = useState<CallDoc | null>(null);
  const callDoc = useRef<CallDoc | null>(null);
  callDoc.current = call;
  const latest = useRef({ id: "", version: -1 });
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [streams, setStreams] = useState<{ key: string; name: string; stream: MediaStream }[]>([]);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // The connections of the call, by the pair of seats each joins.
  const peers = useRef(new Map<string, Peer>());
  const offerRevision = useRef(0);
  const failures = useRef(new Map<string, number>());
  const [nudge, setNudge] = useState(0);
  const {
    local,
    settled: mediaSettled,
    lists: deviceLists,
  } = useLocalMedia(
    devices,
    () => [...peers.current.values()].flatMap((each) => each.pc.getSenders()),
    setNotice,
    off,
  );
  const outputId = idOf(deviceLists.outputs, devices.output);
  const localRef = useRef<MediaStream | null>(null);
  localRef.current = local;

  const hangUpPeers = useCallback(() => {
    for (const each of peers.current.values()) each.pc.close();
    peers.current.clear();
    setStreams([]);
    setConnected(false);
  }, []);

  /** Show `id` as this window's call. */
  const adopt = (id: string) => {
    if (callRef.current === id) return;
    hangUpPeers();
    failures.current.clear();
    callRef.current = id;
    latest.current = { id, version: -1 };
    setCallId(id);
    setCall(null);
    callDoc.current = null;
  };

  /** Let the call shown go: it ended, or another page holds it now. */
  const drop = (message?: string) => {
    hangUpPeers();
    callRef.current = null;
    setCallId(null);
    setCall(null);
    callDoc.current = null;
    if (message) setNotice(message);
  };

  /** Take a call the server sent, unless it is not the call shown or is older. */
  const take = (version: unknown, state: unknown) => {
    const doc = state as CallDoc | null;
    if (!doc || typeof doc !== "object" || !Array.isArray(doc.members)) return;
    if (doc.id !== callRef.current || typeof version !== "number") return;
    if (latest.current.id === doc.id && version < latest.current.version) return;
    latest.current = { id: doc.id, version };
    setCall(doc);
    callDoc.current = doc;
  };

  /** Hang up seat `seat` of call `id`, until the server has it (or says it is over). */
  const leave = async (id: string, seat: number) => {
    leaving.current.set(id, seat);
    const reply = await postJson(`/api/facetime/calls/${id}/leave`, { seat }, () => true);
    leaving.current.delete(id);
    return reply !== null && reply.status < 500;
  };

  /**
   * Bring the window in line with the call the server says the person is in: one this page
   * holds is shown while the person wants a call, and left when they do not; one another page
   * holds is offered to take up here, and stops being shown here.
   */
  const reconcile = (active: Calls["active"]) => {
    const doc = active?.state;
    if (doc?.ended_ms !== 0) {
      setElsewhere(null);
      return;
    }
    const own = mine(doc);
    if (own?.state !== "joined" || !own.seat) {
      setElsewhere(null);
      return;
    }
    if (own.seat.page === page) {
      setElsewhere(null);
      // The call shown is read on its own (its descriptions are not in the list). While an
      // operation is on its way, its reply decides.
      if (callRef.current === doc.id || op.current) return;
      if (wanted.current && !callRef.current) {
        // A placing or an answer whose reply was lost: the call is taken up.
        adopt(doc.id);
        take(active?.version, doc);
        void readCallRef.current();
      } else if (!wanted.current) {
        void leave(doc.id, own.seat.n);
      }
      return;
    }
    if (callRef.current === doc.id) drop("This call goes on in another window.");
    setElsewhere(doc);
  };

  const refresh = async () => {
    const reply = await getJson<Calls>("/api/facetime/calls");
    const body = reply?.body;
    if (!body || !alive.current) return null;
    setRecents(body.recents);
    setIncoming(body.incoming?.state ?? null);
    reconcile(body.active);
    return body;
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Remove from Recents and Remove All Recents, on the server; a call still in progress stays.
  const removeCalls = async (id: string | null) => {
    setRecents((all) => all.filter((each) => !each.done || (id !== null && each.call !== id)));
    try {
      const response = await sessionFetch(
        id === null ? "/api/facetime/calls" : `/api/facetime/calls/${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "same-origin", signal: AbortSignal.timeout(ATTEMPT_MS) },
      );
      if (!response.ok) setNotice("The call could not be removed from your recent calls.");
    } catch {
      setNotice("The call could not be removed from your recent calls.");
    }
    await refresh();
  };

  // After an operation whose outcome is not known, or that was cancelled, the calls are read
  // again a few times: whatever request was still on its way has landed by the last.
  const rechecks = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recheck = () => {
    for (const timer of rechecks.current) clearTimeout(timer);
    rechecks.current = RECHECK_MS.map((delay, at) =>
      setTimeout(async () => {
        if (!alive.current) return;
        await refreshRef.current();
        // The last look, and the call asked for has not turned up: it was not made, and one that
        // lands later still is left by the next look, since nobody wants it any more.
        if (at !== RECHECK_MS.length - 1 || !alive.current) return;
        if (!wanted.current || callRef.current || op.current) return;
        wanted.current = false;
        setNotice((now) =>
          now?.endsWith(LOOKING) ? "FaceTime could not reach the server. Try again." : now,
        );
      }, delay),
    );
  };

  /** Read the call shown, as this page's sign of life on its seat. */
  const readCall = async () => {
    const id = callRef.current;
    if (!id) return;
    const seat = callDoc.current ? mine(callDoc.current)?.seat?.n : undefined;
    const reply = await getJson<{ version: number; state: CallDoc }>(
      `/api/facetime/calls/${id}${seat === undefined ? "" : `?seat=${seat}`}`,
    );
    if (!alive.current || callRef.current !== id || !reply) return;
    if (reply.status === 404) {
      drop();
      void refresh();
      return;
    }
    if (reply.body) take(reply.body.version, reply.body.state);
  };
  const readCallRef = useRef(readCall);
  readCallRef.current = readCall;

  /** Hang up seat `seat` of call `id` once, in a request that outlives the page going away. */
  const leaveAway = (id: string, seat: number) => {
    void sessionFetch(`/api/facetime/calls/${id}/leave`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seat }),
      keepalive: true,
    }).catch(() => {});
  };

  /**
   * A reply that came after the window closed: a call it says this page holds is left at once,
   * since a closed window makes no more looks to leave it.
   */
  const leaveLate = (reply: { body: Record<string, unknown> | null } | null) => {
    const doc = reply?.body?.state as CallDoc | undefined;
    if (!doc || !Array.isArray(doc.members) || !heldBy(doc, page)) return;
    const seat = mine(doc)?.seat?.n;
    if (seat !== undefined) leaveAway(doc.id, seat);
  };

  // Closing the window, or the page going away, leaves the call this page holds.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the window opens
  useEffect(() => {
    alive.current = true;
    const leaveNow = () => {
      wanted.current = false;
      op.current = null;
      const doc = callDoc.current;
      const seat = doc && heldBy(doc, page) ? mine(doc)?.seat?.n : undefined;
      if (doc && seat !== undefined) leaveAway(doc.id, seat);
      // A hang-up the server has not answered would die with the page: it goes once more, in a
      // request that outlives it.
      for (const [id, held] of leaving.current) leaveAway(id, held);
    };
    window.addEventListener("pagehide", leaveNow);
    return () => {
      window.removeEventListener("pagehide", leaveNow);
      alive.current = false;
      for (const timer of rechecks.current) clearTimeout(timer);
      leaveNow();
    };
  }, []);

  // Who this is, then the calls.
  useEffect(() => {
    let stopped = false;
    void (async () => {
      for (let attempt = 0; !stopped; attempt++) {
        const reply = await getJson<{ name: string | null; full_name?: string }>(
          "/api/facetime/me",
        );
        if (stopped) return;
        if (reply?.body) {
          setMe(reply.body);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 250 * 2 ** attempt)));
      }
      if (!stopped) void refreshRef.current();
    })();
    return () => {
      stopped = true;
    };
  }, []);

  // A change the server counts in the person's FaceTime (a ring, an answer, the other member's
  // description, a hang-up), and the page coming back into view, read the calls again.
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app !== "facetime") return;
      void refreshRef.current();
      void readCallRef.current();
    };
    const visible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshRef.current();
      void readCallRef.current();
    };
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  // While a call rings or runs, it is read every few seconds: the call shown keeps this page's
  // seat alive, and a ringing call that the caller hangs up or that rings out stops ringing.
  const watching = callId !== null || incoming !== null || elsewhere !== null;
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(() => {
      if (callRef.current) void readCallRef.current();
      else void refreshRef.current();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [watching]);

  useEffect(() => () => hangUpPeers(), [hangUpPeers]);

  const updateStreams = () => {
    const current = [...peers.current.values()];
    setStreams(current.flatMap(({ key, name, stream }) => (stream ? [{ key, name, stream }] : [])));
    setConnected(current.some((each) => each.pc.connectionState === "connected"));
  };

  /** A connection to `name`, carrying this browser's sound and, in a video call, picture. */
  const connect = (key: string, name: string, kind: FaceTimeCallKind): Peer => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const made: Peer = { key, pc, name, answer: null, offer: null, stream: null };
    for (const track of localRef.current?.getTracks() ?? []) {
      if (kind === "audio" && track.kind === "video") continue;
      pc.addTrack(track, localRef.current as MediaStream);
    }
    // Receive the other's picture and sound even when this browser has nothing to send.
    if (!localRef.current?.getAudioTracks().length)
      pc.addTransceiver("audio", { direction: "recvonly" });
    if (kind === "video" && !localRef.current?.getVideoTracks().length) {
      pc.addTransceiver("video", { direction: "recvonly" });
    }
    pc.addEventListener("track", (event) => {
      made.stream = event.streams[0] ?? made.stream ?? new MediaStream([event.track]);
      if (!event.streams[0] && !made.stream.getTracks().includes(event.track)) {
        made.stream.addTrack(event.track);
      }
      if (peers.current.get(key) === made) updateStreams();
    });
    pc.addEventListener("connectionstatechange", () => {
      if (peers.current.get(key) !== made) return;
      updateStreams();
      if (pc.connectionState === "connected") failures.current.delete(key);
      if (pc.connectionState === "failed") {
        setNotice(
          `Could not connect to ${name}. Your two networks may need a relay server, which this desktop does not have.`,
        );
      }
    });
    peers.current.set(key, made);
    return made;
  };

  /**
   * A connection whose negotiation failed: closed, and made again a little later, a few times.
   * The others of a group are not touched: the call goes on without this person.
   */
  const failed = (made: Peer, final = false) => {
    if (peers.current.get(made.key) !== made) return;
    made.pc.close();
    peers.current.delete(made.key);
    updateStreams();
    const count = final ? MAX_NEGOTIATIONS : (failures.current.get(made.key) ?? 0) + 1;
    failures.current.set(made.key, count);
    if (count >= MAX_NEGOTIATIONS) {
      setNotice(
        `Could not connect to ${made.name}. ${
          peers.current.size > 0
            ? "The call goes on with the others."
            : "Hang up and call again to try once more."
        }`,
      );
      return;
    }
    setTimeout(() => {
      if (alive.current) setNudge((n) => n + 1);
    }, 1_000 * count);
  };

  /** Whether the server took a signal, sent while this page still shows the call. */
  /**
   * Send a signal while this page still shows the call: `"taken"`, `"refused"` when the server
   * says it is out of date (a newer offer replaced the one it answers, or this seat was given
   * up), which is no failure of the connection, or `"failed"` when it never got through.
   */
  const signalled = async (id: string, body: unknown) => {
    const reply = await postJson(
      `/api/facetime/calls/${id}/signal`,
      body,
      () => alive.current && callRef.current === id,
    );
    if (reply?.body && callRef.current === id) take(reply.body.version, reply.body.state);
    if (reply === null) return "failed" as const;
    if (reply.status < 300) return "taken" as const;
    return reply.status === 409 ? ("refused" as const) : ("failed" as const);
  };

  /** Make the connection `wanted` asks for in `doc`, answer its offer, or apply its answer. */
  const negotiate = (doc: CallDoc, wanted: Connection) => {
    const linkOf = (from: number, to: number) =>
      doc.links.find((each) => each.from === from && each.to === to) ?? null;
    const existing = peers.current.get(wanted.key);
    if (!existing && (failures.current.get(wanted.key) ?? 0) >= MAX_NEGOTIATIONS) return;
    if (wanted.offers) {
      if (!existing) {
        const made = connect(wanted.key, wanted.name, doc.kind);
        const id = doc.id;
        void (async () => {
          try {
            await made.pc.setLocalDescription(await made.pc.createOffer());
            await gathered(made.pc);
            const sdp = made.pc.localDescription?.sdp ?? "";
            made.offer = sdp;
            const revision = ++offerRevision.current;
            const body = { from: wanted.mine, to: wanted.seat, offer: sdp, revision };
            const sent = await signalled(id, body);
            // Out of date (a newer offer, or a seat given up): negotiated afresh in a moment,
            // a few times at most, rather than given up for good.
            if (sent === "refused") {
              failed(made);
              return;
            }
            if (sent === "failed") {
              failed(made, true);
              return;
            }
            // An offer nobody answers in time is made again, within the retry budget.
            setTimeout(() => {
              if (!alive.current || peers.current.get(made.key) !== made) return;
              if (made.pc.signalingState === "have-local-offer") failed(made);
            }, ANSWER_MS);
          } catch {
            failed(made);
          }
        })();
      } else {
        const sdp = answerToApply(
          { offer: existing.offer, answer: existing.answer, state: existing.pc.signalingState },
          linkOf(wanted.mine, wanted.seat),
        );
        if (sdp === null) return;
        // Marked before it is applied, so a read arriving meanwhile does not apply it again.
        existing.answer = sdp;
        void existing.pc
          .setRemoteDescription({ type: "answer", sdp })
          .catch(() => failed(existing));
      }
      return;
    }
    const link = linkOf(wanted.seat, wanted.mine);
    if (!link) return;
    if (existing && existing.offer === link.offer) return;
    if (existing) {
      existing.pc.close();
      peers.current.delete(wanted.key);
    }
    const made = connect(wanted.key, wanted.name, doc.kind);
    made.offer = link.offer;
    const id = doc.id;
    void (async () => {
      try {
        await made.pc.setRemoteDescription({ type: "offer", sdp: link.offer });
        await made.pc.setLocalDescription(await made.pc.createAnswer());
        await gathered(made.pc);
        const sdp = made.pc.localDescription?.sdp ?? "";
        const body = {
          from: wanted.mine,
          to: wanted.seat,
          answer: sdp,
          generation: link.generation,
        };
        const sent = await signalled(id, body);
        // An answer to an offer that was replaced: the newer offer is answered instead.
        if (sent === "refused") failed(made);
        else if (sent === "failed") failed(made, true);
      } catch {
        failed(made);
      }
    })();
  };

  // Follow the call shown: let it go once it has ended or another page holds it, and make,
  // answer or drop its connections as it changes. Nothing is negotiated before the camera and
  // microphone have been asked for and answered, so a connection carries this browser's own
  // sound and picture when it has them; letting a call go comes before that wait.
  // biome-ignore lint/correctness/useExhaustiveDependencies: driven by the call as it changes
  useEffect(() => {
    if (!call || call.id !== callId) return;
    if (!heldBy(call, page)) {
      const own = mine(call);
      drop(
        call.ended_ms === 0 && own?.state === "joined"
          ? "This call goes on in another window."
          : undefined,
      );
      void refresh();
      return;
    }
    if (!mediaSettled) return;
    const wanted = plans(call, page);
    const unwanted = [...peers.current].filter(([key]) => !wanted.some((each) => each.key === key));
    for (const [key, each] of unwanted) {
      each.pc.close();
      peers.current.delete(key);
    }
    if (unwanted.length > 0) updateStreams();
    for (const each of wanted) negotiate(call, each);
  }, [call, callId, mediaSettled, nudge]);

  // The call's clock ticks while connected.
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [connected]);

  /** Begin an operation, unless one is under way or a call is shown: its token, or `null`. */
  const begin = (kind: Operation["kind"]) => {
    if (op.current || callRef.current) return null;
    const started: Operation = { token: {}, kind };
    op.current = started;
    wanted.current = true;
    setNotice(undefined);
    return started;
  };
  const current = (started: Operation) => () => alive.current && op.current === started;

  // A call asked for before the server has said who this is: placed as soon as it has.
  const placeWhenKnown = useRef<[string, FaceTimeCallKind, string] | null>(null);
  const place = async (to: string, kind: FaceTimeCallKind, name: string) => {
    if (off) {
      setNotice("FaceTime is off. Turn it on to make calls.");
      return;
    }
    if (me === null) {
      placeWhenKnown.current = [to, kind, name];
      setPlacing({ name, kind });
      return;
    }
    if (!me.name) {
      setNotice("Sign in to make FaceTime calls.");
      return;
    }
    const started = begin("place");
    if (!started) return;
    setPlacing({ name, kind });
    const still = current(started);
    // One key for the whole placing, resent with every retry, so a lost reply never rings a
    // second call.
    const key = { "idempotency-key": crypto.randomUUID() };
    const send = () => postJson("/api/facetime/calls", { to, kind, page }, still, key);
    let reply = await send();
    // A call this page still holds (one whose hang-up the server never had) is left first.
    const busy = reply?.status === 409 ? (reply.body?.state as CallDoc | undefined) : undefined;
    const busySeat = busy ? mine(busy)?.seat : undefined;
    if (busy && busySeat?.page === page && still()) {
      await leave(busy.id, busySeat.n);
      if (still()) reply = await send();
    }
    if (!still()) {
      // Hung up while it was being placed: a call the request made after all is left by the
      // next looks, which find it held by this page while no call is wanted. A window that closed
      // meanwhile makes no more looks, so it leaves the call the reply names at once.
      if (!alive.current) leaveLate(reply);
      recheck();
      return;
    }
    op.current = null;
    setPlacing(null);
    const placed = reply?.body?.state as CallDoc | undefined;
    if (reply && (reply.status === 201 || reply.status === 200) && placed?.id) {
      adopt(placed.id);
      take(reply.body?.version, placed);
      void refresh();
      return;
    }
    if (reply) {
      wanted.current = false;
      setNotice(
        busy && busySeat?.page !== page
          ? "You are in a call in another window."
          : ((reply.body?.error as string | undefined) ?? "The call could not be placed."),
      );
      void refresh();
      return;
    }
    // No answer: the call may have been placed. The next looks take it up if it was.
    setNotice(`FaceTime could not reach the server. ${LOOKING}`);
    recheck();
  };

  /** Answer the call `id` here: one ringing for the person, or one held by another page. */
  const join = async (id: string) => {
    const started = begin("join");
    if (!started) return;
    const still = current(started);
    // One key for the whole answer, resent with every retry: a join delivered again after
    // another page has taken the seat is recognised and takes nothing back.
    const key = { "idempotency-key": crypto.randomUUID() };
    const reply = await postJson(`/api/facetime/calls/${id}/join`, { page }, still, key);
    if (!still()) {
      // Declined, or the window closed, while answering: a join that landed is left by the
      // next looks, or at once when the window closed (it makes no more looks).
      if (!alive.current) leaveLate(reply);
      recheck();
      return;
    }
    op.current = null;
    if (reply?.status === 200 && reply.body?.state) {
      adopt(id);
      take(reply.body.version, reply.body.state);
      setIncoming(null);
      setElsewhere(null);
      return;
    }
    if (reply) {
      wanted.current = false;
      setNotice((reply.body?.error as string | undefined) ?? "The call could not be answered.");
      void refresh();
      return;
    }
    setNotice(`FaceTime could not reach the server to answer. ${LOOKING}`);
    recheck();
  };

  const decline = async () => {
    const ringing = incoming;
    if (!ringing) return;
    // An answer on its way is cancelled: it is sent no more, and left if it landed.
    if (op.current?.kind === "join") op.current = null;
    wanted.current = false;
    setIncoming(null);
    await postJson(`/api/facetime/calls/${ringing.id}/decline`, {}, () => alive.current);
    void refresh();
    recheck();
  };

  const hangUp = async () => {
    // A call being placed is cancelled: its request is sent no more, and a call it made is
    // left by the next looks.
    const cancelled = op.current !== null;
    op.current = null;
    placeWhenKnown.current = null;
    wanted.current = false;
    setPlacing(null);
    const doc = callDoc.current;
    const seat = doc && heldBy(doc, page) ? mine(doc)?.seat?.n : undefined;
    drop();
    if (doc && seat !== undefined) await leave(doc.id, seat);
    void refresh();
    if (cancelled || seat === undefined) recheck();
  };

  /** Ring one more person in the call shown; a refusal is said as the server words it. */
  const addPerson = async (to: string) => {
    const id = callRef.current;
    if (!id) return;
    setNotice(undefined);
    const reply = await postJson(
      `/api/facetime/calls/${id}/add`,
      { to },
      () => alive.current && callRef.current === id,
    );
    if (!alive.current || callRef.current !== id) return;
    if (reply?.body?.state) take(reply.body.version, reply.body.state);
    if (reply && reply.status < 300) {
      setAdding(false);
      return;
    }
    setNotice(
      reply
        ? ((reply.body?.error as string | undefined) ?? `${to} could not be added to the call.`)
        : "FaceTime could not reach the server to add that person.",
    );
  };

  /** End the call the person is in from another page. */
  const endElsewhere = async () => {
    const doc = elsewhere;
    const seat = doc ? mine(doc)?.seat?.n : undefined;
    setElsewhere(null);
    if (doc && seat !== undefined) await leave(doc.id, seat);
    void refresh();
  };

  const other = call ? peopleOf(call).shown[0] : undefined;
  const held: FaceTimeHeldCall | null = placing
    ? { name: placing.name, kind: placing.kind, status: "Calling…" }
    : callId
      ? {
          name: (call && callName(call)) ?? "FaceTime",
          kind: call?.kind ?? "video",
          status: connected
            ? formatDuration(now - (call?.connected_ms || now))
            : other?.state === "joined"
              ? "Connecting…"
              : other?.state === "ringing"
                ? "Calling…"
                : "Waiting…",
        }
      : null;
  const ringingFor: FaceTimeIncomingCall | null = off
    ? null
    : incoming
      ? {
          name: callName(incoming) ?? "Someone",
          kind: incoming.kind,
        }
      : elsewhere
        ? {
            name: callName(elsewhere) ?? "Someone",
            kind: elsewhere.kind,
            detail: "In a call in another window",
            acceptLabel: "Join Here",
            declineLabel: "End",
          }
        : null;
  // A ringing call rings until it is answered, every few seconds, with the person's ringtone.
  const ringingNow = !off && incoming !== null;
  useEffect(() => {
    if (!ringingNow) return;
    let stop = playRing(ringtone);
    const timer = setInterval(() => {
      stop();
      stop = playRing(ringtone);
    }, 3_000);
    return () => {
      clearInterval(timer);
      stop();
    };
  }, [ringingNow, ringtone]);

  // The menu bar's Video menu: End, as the window's End button, while a call is placed or on.
  // The row changes only with whether there is a call; the command is read when it is chosen.
  const videoCommands = useRef({ hangUp });
  videoCommands.current = { hangUp };
  const callUnderway = call !== null || placing !== null;
  const videoMenu = useMemo(
    () => (
      <MenuItem
        disabled={!callUnderway}
        title={callUnderway ? undefined : END_CALL_UNAVAILABLE}
        onClick={() => void videoCommands.current.hangUp()}
      >
        End Call
      </MenuItem>
    ),
    [callUnderway],
  );
  // Mute and Pause Video: the local tracks stay in the call and stop carrying anything, for the
  // length of the call. The server is not told; the other person hears silence or sees black.
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    for (const track of local?.getAudioTracks() ?? []) track.enabled = !muted;
    for (const track of local?.getVideoTracks() ?? []) track.enabled = !paused;
  }, [local, muted, paused]);
  // Video > Add Person… and the panel's button open the same field, while the call has room.
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (callUnderway) return;
    setMuted(false);
    setPaused(false);
    setAdding(false);
  }, [callUnderway]);
  const callHeld = call !== null && heldBy(call, page);
  const inTheCall = (call?.members ?? []).filter(
    (member) => member.state === "joined" || member.state === "ringing",
  ).length;
  const cannotAdd = !callHeld
    ? ADD_PERSON_NO_CALL
    : inTheCall >= MAX_PEOPLE
      ? ADD_PERSON_FULL
      : undefined;
  const hasVideo = (call?.kind ?? placing?.kind) === "video";
  const noPicture = streams.length === 0;
  useEffect(() => {
    if (noPicture) setSink(null);
  }, [noPicture]);
  const onTop = useDesktopValue(FACETIME_ON_TOP, readOn, false);
  const portrait = useDesktopValue(FACETIME_PORTRAIT, readOn, false);
  // Set once the person has changed the orientation here: a window that opens in landscape, as it
  // was left or as new, keeps the frame it was given.
  const [orientationChosen, setOrientationChosen] = useState(false);
  const turn = () => {
    setOrientationChosen(true);
    changeDesktopValue(FACETIME_PORTRAIT, !portrait);
  };
  const [floating, setFloating] = useState(false);
  const pictureInPicture = typeof document !== "undefined" && document.pictureInPictureEnabled;
  const noFloat = !pictureInPicture
    ? PICTURE_IN_PICTURE_UNAVAILABLE
    : noPicture || !hasVideo
      ? NO_PICTURE_IN_PICTURE
      : undefined;
  // The picture goes with the call: its floating window must not stay behind, empty.
  useEffect(() => {
    if (!noPicture) return;
    setFloating(false);
    if (document.pictureInPictureElement?.hasAttribute("data-remote")) {
      void document.exitPictureInPicture().catch(() => {});
    }
  }, [noPicture]);
  useEffect(
    () => () => {
      if (document.pictureInPictureElement?.hasAttribute("data-remote")) {
        void document.exitPictureInPicture().catch(() => {});
      }
    },
    [],
  );
  const floatPicture = () => {
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => {});
      return;
    }
    const video = windowElementNow.current?.querySelector<HTMLVideoElement>("video[data-remote]");
    if (!video) return;
    // On the element: once it is out of the page, its events no longer reach the window.
    video.addEventListener("leavepictureinpicture", () => setFloating(false), { once: true });
    video.requestPictureInPicture().then(
      () => setFloating(true),
      () => setNotice(PICTURE_IN_PICTURE_UNAVAILABLE),
    );
  };
  const fullScreen = props.zoomRole === "exit-full-screen";
  const canFullScreen = fullScreen || props.zoomRole === "full-screen";
  const livePhotoTaken = (sentence: string) => {
    setNotice(sentence);
    setTimeout(() => {
      if (alive.current) setNotice((now) => (now === sentence ? undefined : now));
    }, SAID_MS);
  };
  const editMenu = useMemo(() => <EditRows nothing={NO_TEXT_TO_EDIT} say={setNotice} />, []);
  useDesktopAppMenu("facetime", "Edit", editMenu);
  const mediaMenu = (
    <>
      <MenuItem
        disabled={!callUnderway}
        keyEquivalent="shift+command+m"
        onClick={() => setMuted((now) => !now)}
      >
        {muted ? "Unmute" : "Mute"}
      </MenuItem>
      <MenuItem disabled={!callUnderway || !hasVideo} onClick={() => setPaused((now) => !now)}>
        {paused ? "Resume Video" : "Pause Video"}
      </MenuItem>
      <MenuItem disabled={noFloat !== undefined} title={noFloat} onClick={floatPicture}>
        {floating ? "Exit Picture in Picture" : "Enter Picture in Picture"}
      </MenuItem>
      <MenuItem keyEquivalent="command+r" onClick={turn}>
        {portrait ? "Use Landscape" : "Use Portrait"}
      </MenuItem>
      <MenuItem
        keyEquivalent="control+command+f"
        disabled={!canFullScreen}
        title={canFullScreen ? undefined : FULL_SCREEN_UNAVAILABLE}
        onClick={(event) => props.onZoom?.(event)}
      >
        {fullScreen ? "Exit Full Screen" : "Enter Full Screen"}
      </MenuItem>
      <MenuSeparator />
      {videoMenu}
      <MenuItem
        disabled={cannotAdd !== undefined}
        title={cannotAdd}
        onClick={() => setAdding(true)}
      >
        Add Person…
      </MenuItem>
      <MenuSeparator />
      <DeviceSubmenu
        title="Camera"
        devices={deviceLists.cameras}
        value={local?.getVideoTracks()[0]?.label}
        onChoose={(camera) => changeDesktopValue(FACETIME_DEVICES, { ...devices, camera })}
      />
      <DeviceSubmenu
        title="Microphone"
        devices={deviceLists.microphones}
        value={local?.getAudioTracks()[0]?.label}
        onChoose={(microphone) => changeDesktopValue(FACETIME_DEVICES, { ...devices, microphone })}
      />
      <DeviceSubmenu
        title="Output"
        devices={deviceLists.outputs}
        value={
          sink === null
            ? outputId
              ? devices.output
              : deviceLists.outputs[0]?.label
            : (deviceLists.outputs.find((each) => each.deviceId === (sink || "default"))?.label ??
              deviceLists.outputs[0]?.label)
        }
        unavailable={canChooseOutput() ? undefined : OUTPUT_UNAVAILABLE}
        onChoose={(output) => changeDesktopValue(FACETIME_DEVICES, { ...devices, output })}
      />
    </>
  );
  useDesktopAppMenu("facetime", "Video", mediaMenu);
  useMainWindowItem(
    "facetime",
    "FaceTime",
    undefined,
    <MenuCheckboxItem
      checked={onTop}
      onCheckedChange={(checked) => changeDesktopValue(FACETIME_ON_TOP, checked)}
    >
      Always on Top
    </MenuCheckboxItem>,
  );
  // The Dock's menu: the people called lately, newest first, one row each.
  const callAgain = useRef(place);
  callAgain.current = place;
  const lately = rowsOf(recents).filter(
    (each, at, all) => each.to && all.findIndex((other) => other.to === each.to) === at,
  );
  useDesktopAppMenu(
    "facetime",
    "Dock",
    <>
      {lately.slice(0, 5).map((each) => (
        <MenuItem
          key={each.to}
          disabled={off || callUnderway}
          onClick={() => void callAgain.current(each.to ?? "", each.kind, each.name)}
        >
          {each.name}
        </MenuItem>
      ))}
    </>,
  );
  // FaceTime off, from here, Preferences or another browser: a call under way ends.
  const turnOff = () => changeDesktopValue(FACETIME_OFF, !off);
  useEffect(() => {
    if (off && callUnderway) void videoCommands.current.hangUp();
  }, [off, callUnderway]);
  useDesktopAppMenu(
    "facetime",
    "FaceTime",
    <>
      <MenuItem keyEquivalent="command+k" onClick={turnOff}>
        {off ? "Turn FaceTime On" : "Turn FaceTime Off"}
      </MenuItem>
      <MenuSeparator />
    </>,
  );
  const [windowElement, setWindowElement] = useState<HTMLElement | null>(null);
  windowElementNow.current = windowElement;
  useWindowKeys(windowElement, (props.state ?? "key") === "key", [
    { equivalent: "command+r", run: turn },
    { equivalent: "shift+command+m", run: () => callUnderway && setMuted((now) => !now) },
    { equivalent: "command+k", run: turnOff },
  ]);
  // Contacts' call buttons: asked while FaceTime was closed, then each new one, once the person is
  // known, which a window that opens only now learns a moment later.
  const placeAsked = useRef(place);
  placeAsked.current = place;
  const known = me !== null;
  useEffect(() => {
    const asked = placeWhenKnown.current;
    if (!known || !asked) return;
    placeWhenKnown.current = null;
    setPlacing(null);
    void placeAsked.current(...asked);
  }, [known]);
  const signedIn = Boolean(me?.name);
  const keptFilter = useDesktopValue(FACETIME_FILTER, readFilter, undefined);
  useEffect(() => {
    if (!signedIn) return;
    const asked = (request: AddressRequest) =>
      void placeAsked.current(request.to, request.kind ?? "video", request.name);
    for (const request of takeAddressRequests("facetime")) asked(request);
    return onAddressRequest("facetime", asked);
  }, [signedIn]);
  const face = (
    <FaceTime
      {...props}
      ref={setWindowElement}
      off={off}
      onTurnOn={() => changeDesktopValue(FACETIME_OFF, false)}
      blocked={blocked}
      onBlock={(to, block) => {
        void blockedPeople.set(to, block).then((why) => why && setNotice(why));
      }}
      filter={keptFilter}
      onFilterChange={(next) => changeDesktopValue(FACETIME_FILTER, next)}
      data-call-state={
        placing || callId ? (connected ? "connected" : "calling") : incoming ? "ringing" : "idle"
      }
      calls={rowsOf(recents)}
      recipientSuggestions={people}
      call={held}
      callControls={
        <>
          <PushButton size="small" aria-pressed={muted} onClick={() => setMuted((now) => !now)}>
            {muted ? "Unmute" : "Mute"}
          </PushButton>
          {hasVideo ? (
            <PushButton size="small" aria-pressed={paused} onClick={() => setPaused((now) => !now)}>
              {paused ? "Resume" : "Pause"}
            </PushButton>
          ) : null}
        </>
      }
      callPeople={
        callHeld ? (
          <div className="mac-facetime-hud-people">
            {peopleOf(call).ringing.map((member) => (
              <HudWindowText key={member.name} className="mac-facetime-hud-line">
                {member.full_name} · Ringing…
              </HudWindowText>
            ))}
            <div className="mac-facetime-hud-tools">
              <AddPerson
                people={people}
                taken={call.members.map((member) => member.name)}
                open={adding && cannotAdd === undefined}
                unavailable={cannotAdd}
                onOpenChange={setAdding}
                onAdd={(to) => void addPerson(to)}
              />
              {hasVideo ? (
                <LivePhotoButton
                  video={() =>
                    windowElementNow.current?.querySelector<HTMLVideoElement>(
                      "video[data-remote]",
                    ) ?? null
                  }
                  unavailable={noPicture ? NO_LIVE_PHOTO : undefined}
                  tell={async () => {
                    const id = callRef.current;
                    if (!id) return "the call has ended";
                    const told = await postJson(
                      `/api/facetime/calls/${id}/live-photo`,
                      {},
                      () => alive.current,
                    );
                    if (told && told.status < 300) return null;
                    return typeof told?.body?.error === "string"
                      ? told.body.error
                      : "the others in the call could not be told";
                  }}
                  onTaken={livePhotoTaken}
                />
              ) : null}
              {canFullScreen ? (
                <PushButton
                  size="small"
                  aria-pressed={fullScreen}
                  onClick={(event) => props.onZoom?.(event)}
                >
                  {fullScreen ? "Exit Full Screen" : "Full Screen"}
                </PushButton>
              ) : null}
            </div>
          </div>
        ) : null
      }
      incoming={ringingFor}
      notice={notice}
      onCallStart={(outgoing) => {
        props.onCallStart?.(outgoing);
        void place(outgoing.to ?? outgoing.name, outgoing.kind, outgoing.name);
      }}
      onHangUp={() => void hangUp()}
      onRemoveCalls={(id) => void removeCalls(id)}
      onAddToContacts={(to, name) => askToReach({ app: "contacts", to, name })}
      onShowContact={(to, name) => askToReach({ app: "contacts", to, name })}
      onAccept={() => {
        const id = incoming?.id ?? elsewhere?.id;
        if (id) void join(id);
      }}
      onDecline={() => void (incoming ? decline() : endElsewhere())}
      stage={
        callId && streams.length > 0
          ? streams.map((each) => (
              <div key={each.key} className="mac-facetime-tile">
                <RemoteVideo
                  stream={each.stream}
                  name={each.name}
                  kind={call?.kind ?? "video"}
                  output={outputId}
                  onOutput={sinkChanged}
                />
                {streams.length > 1 || (call && peopleOf(call).shown.length > 1) ? (
                  <span className="mac-facetime-tile-name">{each.name}</span>
                ) : null}
              </div>
            ))
          : undefined
      }
    >
      {local && local.getVideoTracks().length > 0 ? <SelfView stream={local} /> : props.children}
    </FaceTime>
  );
  // Only in a window the desktop manages, which is what gives the drag region's callback.
  return props.onDragRegionPointerDown ? (
    <>
      {face}
      {onTop ? <AlwaysOnTop /> : null}
      {portrait || orientationChosen ? <WindowOrientation portrait={portrait} /> : null}
    </>
  ) : (
    face
  );
}
