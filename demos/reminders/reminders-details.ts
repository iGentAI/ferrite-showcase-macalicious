import { useSyncExternalStore } from "react";
import { forgetKeptText, keepText, readKeptText } from "../desktop/desktop-kept-text";
import { desktopValues, subscribeDesktopValues } from "../desktop/desktop-personal";
import { sessionFetch } from "../desktop/desktop-server";

/*
 * What a reminder holds that its document on the server has no field for: the place of At a
 * Location, the person of When Messaging a Person and the pictures. They are kept with the person's
 * desktop values, by the reminder's id, so they come back after a reload and in another browser of
 * the same account, and another member of a shared list does not see them.
 */

/** A person from Contacts: the name on their card and their account name. */
export interface ReminderPerson {
  name: string;
  to: string;
  /** The alert has been raised: it is raised once. */
  told?: boolean;
}

export interface ReminderDetail {
  place?: string;
  /** The alert comes on leaving the place, not on arriving. */
  leaving?: boolean;
  /** Where Maps' geocoder found the place. */
  point?: { lat: number; lon: number };
  /** The geocoder has no such place. */
  notFound?: boolean;
  /** Whether the last position heard was at the place. */
  inside?: boolean;
  /** When the alert of the place last fired, and the firing that was closed. */
  firedAt?: number;
  closedAt?: number;
  person?: ReminderPerson;
}

type Details = Readonly<Record<string, ReminderDetail>>;

const DETAILS = "reminders.details";
const PICTURES = "reminders.picture.";

/** The longest side of a kept picture, in pixels: what the row and the pop-up button draw. */
const PICTURE_SIDE = 240;
const PICTURE_QUALITY = 0.7;

const NO_PICTURES: readonly string[] = [];

const pictureKey = (id: string) => `${PICTURES}${id.replaceAll("/", "__")}`;

function parsed(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function readDetails(): Details {
  const stored = parsed(readKeptText(DETAILS));
  return typeof stored === "object" && stored !== null ? (stored as Details) : {};
}

function readPictures(id: string): readonly string[] {
  const stored = parsed(readKeptText(pictureKey(id)));
  return Array.isArray(stored)
    ? stored.filter((each): each is string => typeof each === "string")
    : NO_PICTURES;
}

/** Follows every kept value, so a row or a popover draws what is kept now. */
export const useDetailsVersion = () =>
  useSyncExternalStore(subscribeDesktopValues, desktopValues, desktopValues);

export const reminderDetail = (id: string): ReminderDetail => readDetails()[id] ?? {};

export const reminderPictures = (id: string) => readPictures(id);

/** Changes a reminder's place or person. False when the details no longer fit: nothing changes. */
export function changeReminderDetail(id: string, change: ReminderDetail): boolean {
  const details = readDetails();
  return keepText(DETAILS, JSON.stringify({ ...details, [id]: { ...details[id], ...change } }));
}

/**
 * The person has started messaging `to`: each of their unfinished reminders set for that person
 * raises its alert, once.
 */
export async function remindWhenMessaging(to: string, fullName: string): Promise<void> {
  const waiting = Object.entries(readDetails()).filter(
    ([, detail]) => detail.person?.to === to && !detail.person.told,
  );
  if (waiting.length === 0) return;
  const response = await sessionFetch("/api/reminders/data", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  }).catch(() => null);
  const reply = response?.ok ? await response.json().catch(() => null) : null;
  const reminders: readonly { id?: unknown; title?: unknown; completed?: unknown }[] =
    reply?.data?.reminders ?? [];
  for (const [id, detail] of waiting) {
    const reminder = reminders.find((each) => each.id === id);
    if (!reminder || reminder.completed === true || !detail.person) continue;
    const sent = await sessionFetch("/api/notification-center/notify", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "idempotency-key": `reminder-messaging-${id}`,
      },
      body: JSON.stringify({
        app: "reminders",
        title: String(reminder.title ?? "") || "Reminder",
        body: `When messaging ${fullName}`,
      }),
    }).catch(() => null);
    if (sent?.ok) changeReminderDetail(id, { person: { ...detail.person, told: true } });
  }
}

/** Adds a picture as `pictureData` made it. False when the reminder has no room left for it. */
export function addReminderPicture(id: string, picture: string): boolean {
  return keepText(pictureKey(id), JSON.stringify([...readPictures(id), picture]));
}

export function removeReminderPicture(id: string, index: number): void {
  const left = readPictures(id).filter((_, at) => at !== index);
  if (left.length === 0) forgetKeptText(pictureKey(id));
  else keepText(pictureKey(id), JSON.stringify(left));
}

/** A pasted reminder holds what its original does. */
export function copyReminderDetails(from: string, to: string): void {
  const detail = readDetails()[from];
  if (detail) changeReminderDetail(to, detail);
  const pictures = readPictures(from);
  if (pictures.length > 0) keepText(pictureKey(to), JSON.stringify(pictures));
}

/** Lets go of what was kept for reminders that are gone. Shared lists' reminders are left alone. */
export function forgetGoneDetails(known: ReadonlySet<string>): void {
  const details = readDetails();
  const kept = Object.entries(details).filter(([id]) => id.includes("/") || known.has(id));
  if (kept.length !== Object.keys(details).length) {
    keepText(DETAILS, JSON.stringify(Object.fromEntries(kept)));
  }
  for (const key of Object.keys(desktopValues())) {
    if (!key.startsWith(PICTURES)) continue;
    const id = key.slice(PICTURES.length);
    // A key with a dot is a piece of a long value, and one with `__` a shared list's reminder.
    if (id.includes(".") || id.includes("__") || known.has(id)) continue;
    forgetKeptText(key);
  }
}

/** A picture file made small enough to keep, as a data address. Rejects what is no picture. */
export async function pictureData(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PICTURE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PICTURE_QUALITY);
}

export const PICTURE_UNREADABLE = "This file could not be read as a picture.";
export const PICTURE_NO_ROOM = "This reminder has no room for another picture.";

/** Makes `file` small and keeps it: why it could not be, or `null`. */
export async function attachPicture(id: string, file: File): Promise<string | null> {
  let picture: string;
  try {
    picture = await pictureData(file);
  } catch {
    return PICTURE_UNREADABLE;
  }
  return addReminderPicture(id, picture) ? null : PICTURE_NO_ROOM;
}
