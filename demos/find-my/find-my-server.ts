/*
 * What the served Find My window asks the desktop's Ferrite application
 * (`ferrite-apps/desktop/src/apps/find_my`), and how it reads the answers: this browser's
 * report of where it is, the person's devices with their last positions, Play Sound and
 * Remove. Also how a browser names itself, how long ago a device was seen, and the sound a
 * device plays.
 */

import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import type { Located } from "../maps/maps-location";
import type { FindMyDeviceKind } from "./find-my-data";

export const ME_URL = "/api/find-my/me";
export const DEVICES_URL = "/api/find-my/devices";
/** How often the window reads the devices while it is open. */
export const POLL_MS = 10_000;
/** A browser reports again after this long, or after moving `REPORT_MOVE_M`. */
export const REPORT_EVERY_MS = 60_000;
export const REPORT_MOVE_M = 50;

/** A device as the module lists it. */
export interface ServedDevice {
  id: string;
  label: string;
  lat: number;
  lon: number;
  accuracy_m: number;
  /** When it last reported, epoch milliseconds. */
  at: number;
  /** Whether it is the browser showing the window. */
  this: boolean;
  /** Whether Play Sound waits for it. */
  sound_pending: boolean;
  /**
   * The id of the Play Sound request waiting for it, when one does: acknowledging names it, so a
   * newer request asked meanwhile is not cleared with it.
   */
  sound_request: string | null;
}

const DEVICE_ID = /^[0-9a-f]{16}$/;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** One device of a reply, or `undefined` when it is not in the module's shape. */
export function deviceFromServer(value: unknown): ServedDevice | undefined {
  const device = value as Record<string, unknown> | null;
  if (
    typeof device !== "object" ||
    device === null ||
    typeof device.id !== "string" ||
    !DEVICE_ID.test(device.id) ||
    typeof device.label !== "string" ||
    device.label === "" ||
    !finite(device.lat) ||
    !finite(device.lon) ||
    Math.abs(device.lat) > 90 ||
    Math.abs(device.lon) > 180 ||
    !finite(device.accuracy_m) ||
    !finite(device.at) ||
    typeof device.this !== "boolean" ||
    typeof device.sound_pending !== "boolean"
  )
    return undefined;
  const request = device.sound_request;
  // A pending sound always names its request, which is what the device acknowledges once it
  // has played it: a pending sound without one is not the module's.
  if (device.sound_pending && !(typeof request === "string" && DEVICE_ID.test(request)))
    return undefined;
  return {
    id: device.id,
    label: device.label,
    lat: device.lat,
    lon: device.lon,
    accuracy_m: device.accuracy_m,
    at: device.at,
    this: device.this,
    sound_pending: device.sound_pending,
    sound_request: device.sound_pending ? (request as string) : null,
  };
}

/**
 * The devices of a reply, or `undefined` when it is not the module's: one device it cannot read
 * makes the whole list unreadable, as the window must not show a list silently short of one.
 */
export function devicesFromServer(reply: unknown): ServedDevice[] | undefined {
  const devices = (reply as { devices?: unknown } | null)?.devices;
  if (!Array.isArray(devices)) return undefined;
  const read: ServedDevice[] = [];
  for (const item of devices) {
    const device = deviceFromServer(item);
    if (!device) return undefined;
    read.push(device);
  }
  return read;
}

/** How a browser names itself from its user agent: "Firefox on Mac", "Safari on iPhone". */
export function deviceLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /HeadlessChrome|Chromium\//.test(userAgent)
          ? "Chromium"
          : /Chrome\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : "Browser";
  const system = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /CrOS/.test(userAgent)
          ? "ChromeOS"
          : /Macintosh|Mac OS X/.test(userAgent)
            ? "Mac"
            : /Windows/.test(userAgent)
              ? "Windows"
              : /Linux/.test(userAgent)
                ? "Linux"
                : "this computer";
  return `${browser} on ${system}`;
}

/** The glyph of a device, from its name. */
export function deviceKind(label: string): FindMyDeviceKind {
  if (/iPhone|Android/.test(label)) return "phone";
  if (/iPad/.test(label)) return "tablet";
  return "laptop";
}

/** When a device was last seen, as Find My writes it. */
export function lastSeen(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

type Reply = { status: number; body: unknown } | null;

/** Send one request to the module: its status and JSON body, or `null` when none came. */
async function request(url: string, method = "GET", body?: unknown): Promise<Reply> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        method,
        credentials: "same-origin",
        headers:
          body === undefined
            ? { accept: "application/json" }
            : { accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    });
  } catch {
    return null;
  }
}

const problemOf = (reply: Reply): string => {
  if (!reply) return "the desktop's server could not be reached";
  const error = (reply.body as { error?: unknown } | null)?.error;
  return typeof error === "string" && error !== "" ? error : `HTTP ${reply.status}`;
};

/**
 * Report where this browser is, stamped with when the report is made (`reportedAt`, this browser's
 * clock): the module keeps a device's newest report by that time, so a report that reaches it
 * after a later one changes nothing. Resolves with the device as the module now holds it (the
 * later report's, in that case), or why the report was not recorded.
 */
export async function reportLocation(
  at: Located,
  label: string,
  reportedAt: number = Date.now(),
): Promise<{ device: ServedDevice } | { problem: string }> {
  const reply = await request(ME_URL, "PUT", {
    lat: Number(at.lat.toFixed(6)),
    lon: Number(at.lon.toFixed(6)),
    accuracy_m: Math.min(100_000, Math.max(0, Math.round(at.accuracy_m * 10) / 10)),
    label: label.slice(0, 64),
    reported_at: Math.max(0, Math.floor(reportedAt)),
  });
  const device = deviceFromServer((reply?.body as { device?: unknown } | null)?.device);
  return reply?.status === 200 && device ? { device } : { problem: problemOf(reply) };
}

/** The person's devices, or `null` when they could not be read. */
export async function readDevices(): Promise<ServedDevice[] | null> {
  const reply = await request(DEVICES_URL);
  return reply?.status === 200 ? (devicesFromServer(reply.body) ?? null) : null;
}

/** Ask a device to play its sound: `null`, or why it could not be asked. */
export async function askForSound(id: string): Promise<string | null> {
  const reply = await request(`${DEVICES_URL}/${id}/sound`, "POST", {});
  return reply?.status === 200 ? null : problemOf(reply);
}

/**
 * Say this device played the sound of request `requestId`. Only that request is cleared: one
 * asked after it stays pending and is played next.
 */
export async function clearSound(id: string, requestId: string): Promise<boolean> {
  const query = `?request=${encodeURIComponent(requestId)}`;
  const reply = await request(`${DEVICES_URL}/${id}/sound${query}`, "DELETE");
  return reply?.status === 200;
}

/** Forget a device: `null`, or why it was not forgotten. */
export async function removeDevice(id: string): Promise<string | null> {
  const reply = await request(`${DEVICES_URL}/${id}`, "DELETE");
  return reply?.status === 200 ? null : problemOf(reply);
}

export const PEOPLE_URL = "/api/find-my/people";

/** Where someone who shares with this person last was. */
export interface ServedPosition {
  lat: number;
  lon: number;
  accuracy_m: number;
  /** When they last reported, epoch milliseconds. */
  at: number;
}

/** A rule on someone who shares with this person: tell me when they arrive or leave. */
export interface ServedRule {
  kind: "arrive" | "leave";
  label: string;
  repeat: boolean;
}

/** Another account Find My links this person with, in whichever direction. */
export interface ServedPerson {
  /** The account's name, which addresses it. */
  name: string;
  full_name: string;
  /** This person shares their location with them. */
  sharing: boolean;
  /** They share their location with this person. */
  following: boolean;
  position: ServedPosition | null;
  /** This person asked to follow them and has not been answered. */
  asked: boolean;
  /** They asked to follow this person, who has not answered. */
  asks_me: boolean;
  rule: ServedRule | null;
  /** This person's rule on themselves: tell them when I arrive or leave. */
  tell: ServedRule | null;
}

function positionFromServer(value: unknown): ServedPosition | null | undefined {
  if (value === null) return null;
  const at = value as Record<string, unknown> | undefined;
  return at && finite(at.lat) && finite(at.lon) && finite(at.accuracy_m) && finite(at.at)
    ? { lat: at.lat, lon: at.lon, accuracy_m: at.accuracy_m, at: at.at }
    : undefined;
}

function ruleFromServer(value: unknown): ServedRule | null | undefined {
  if (value === null) return null;
  const rule = value as Record<string, unknown> | undefined;
  return rule &&
    (rule.kind === "arrive" || rule.kind === "leave") &&
    typeof rule.label === "string" &&
    typeof rule.repeat === "boolean"
    ? { kind: rule.kind, label: rule.label, repeat: rule.repeat }
    : undefined;
}

/** One person of a reply, or `undefined` when they are not in the module's shape. */
export function personFromServer(value: unknown): ServedPerson | undefined {
  const person = value as Record<string, unknown> | null;
  if (typeof person !== "object" || person === null) return undefined;
  const position = positionFromServer(person.position);
  const rule = ruleFromServer(person.rule);
  const tell = ruleFromServer(person.tell ?? null);
  if (
    typeof person.name !== "string" ||
    typeof person.full_name !== "string" ||
    typeof person.sharing !== "boolean" ||
    typeof person.following !== "boolean" ||
    typeof person.asked !== "boolean" ||
    typeof person.asks_me !== "boolean" ||
    position === undefined ||
    rule === undefined ||
    tell === undefined
  )
    return undefined;
  return {
    name: person.name,
    full_name: person.full_name,
    sharing: person.sharing,
    following: person.following,
    position,
    asked: person.asked,
    asks_me: person.asks_me,
    rule,
    tell,
  };
}

/** The people this person is linked with and whether they are signed in, or `null` unread. */
export async function readPeople(): Promise<{ people: ServedPerson[]; signedIn: boolean } | null> {
  const reply = await request(PEOPLE_URL);
  const answer = reply?.body as { people?: unknown; signed_in?: unknown } | null;
  const listed = answer?.people;
  if (reply?.status !== 200 || !Array.isArray(listed)) return null;
  const read: ServedPerson[] = [];
  for (const item of listed) {
    const person = personFromServer(item);
    if (!person) return null;
    read.push(person);
  }
  return { people: read, signedIn: answer?.signed_in === true };
}

/** The account name in what was typed: `Martin Klein (martin)`, `martin@macalicious` or `martin`. */
export function accountToken(typed: string): string {
  const trimmed = typed.trim();
  const inBrackets = /[(<]([^()<>]+)[)>]$/.exec(trimmed)?.[1] ?? trimmed;
  return inBrackets.replace(/@macalicious$/, "").toLowerCase();
}

/** A change to a link with `name`: `null`, or why it was not made. */
export async function changePerson(
  name: string,
  action: "share" | "ask" | "notify" | "tell" | null,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<string | null> {
  const url = `${PEOPLE_URL}/${encodeURIComponent(name)}${action ? `/${action}` : ""}`;
  const reply = await request(url, method, body);
  return reply?.status === 200 ? null : problemOf(reply);
}

/** A card of Contacts, as far as Find My needs one. */
export interface ContactCard {
  id: string;
  /** The account the card is of, when it names one. */
  user: string | null;
  /** How Find My names the card when it has no account. */
  name: string;
}

/** The person's Contacts cards, or none when they could not be read. */
export async function readContactCards(): Promise<ContactCard[]> {
  const reply = await request("/api/contacts/cards");
  const cards = (reply?.body as { cards?: unknown } | null)?.cards;
  if (!Array.isArray(cards)) return [];
  return cards.flatMap((card: Record<string, unknown>) =>
    typeof card?.id === "string"
      ? [
          {
            id: card.id,
            user: typeof card.user === "string" && card.user !== "" ? card.user : null,
            name: [card.first, card.last].filter((part) => typeof part === "string").join(" "),
          },
        ]
      : [],
  );
}

type AudioContextClass = typeof AudioContext;

/**
 * Play Find My's sound with Web Audio: three rising tones over about a second. Resolves with
 * whether the browser let the page play it (a page the person has not yet clicked may not).
 */
export async function playFindMySound(): Promise<boolean> {
  const Context: AudioContextClass | undefined =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext);
  if (!Context) return false;
  let context: AudioContext;
  try {
    context = new Context();
  } catch {
    return false;
  }
  if (context.state !== "running") {
    // A resume the browser holds back can stay pending: give it a second.
    await Promise.race([
      context.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
  }
  if (context.state !== "running") {
    void context.close().catch(() => {});
    return false;
  }
  const start = context.currentTime + 0.05;
  const tones = [880, 1175, 1568].map((frequency, index) => {
    const at = start + index * 0.32;
    const tone = context.createOscillator();
    const level = context.createGain();
    tone.type = "sine";
    tone.frequency.value = frequency;
    level.gain.setValueAtTime(0.0001, at);
    level.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    level.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    tone.connect(level);
    level.connect(context.destination);
    tone.start(at);
    tone.stop(at + 0.3);
    return tone;
  });
  // Played once the last tone has ended, not when the tones are scheduled: a page closed or
  // an audio context suspended before then has not played the sound, and the request stays.
  const last = tones[tones.length - 1];
  const ended = await Promise.race([
    new Promise<boolean>((resolve) => {
      if (last) last.onended = () => resolve(context.state !== "closed");
      else resolve(false);
    }),
    // A context the browser suspends never ends its tones: the sound counts as not played.
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
  ]);
  void context.close().catch(() => {});
  return ended;
}
