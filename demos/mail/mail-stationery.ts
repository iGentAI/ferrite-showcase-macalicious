import type { MailDraft } from "./mail-data";

/** A message kept to start others from: File > Save as Stationery. */
export interface MailStationery {
  name: string;
  subject: string;
  /** The message's styled text, or its plain text when `plain`. */
  html: string;
  plain?: boolean;
}

/** What a person's settings keep under one name, less room for the rest of the record. */
const STATIONERY_BYTES = 3_800;

/** Why a message cannot be kept: what the setting holds is about 4 KB. */
export const STATIONERY_TOO_LARGE =
  "Stationery is kept with your settings, which hold about 4 KB. Make the message shorter.";

/** The stationery as stored, keeping only what Mail wrote. */
export function readMailStationery(stored: unknown): readonly MailStationery[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.filter(
    (each): each is MailStationery =>
      typeof each === "object" &&
      each !== null &&
      typeof each.name === "string" &&
      typeof each.subject === "string" &&
      typeof each.html === "string",
  );
}

/**
 * `list` with `draft` kept under `name`, replacing one of that name, or `null` when the setting
 * would not hold it.
 */
export function withStationery(
  list: readonly MailStationery[],
  name: string,
  draft: MailDraft,
): readonly MailStationery[] | null {
  const made: MailStationery = {
    name,
    subject: draft.subject,
    html: draft.html ?? draft.body,
    ...(draft.html === undefined ? { plain: true } : {}),
  };
  const next = [...list.filter((each) => each.name !== name), made];
  return new TextEncoder().encode(JSON.stringify(next)).length > STATIONERY_BYTES ? null : next;
}
