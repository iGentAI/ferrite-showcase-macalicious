import type { Contact, ContactGroup, SmartGroup } from "./contacts-data";
import {
  cardsFromServer,
  groupsFromServer,
  type StoredPicture,
  smartGroupsFromServer,
} from "./contacts-server";

/*
 * File > Export > Contacts Archive: everything the address book holds in one file, which File >
 * Import reads back in place of what is there. On a Mac it is a `.abbu` bundle of Apple's own
 * database; here it has that name and holds one JSON document.
 */

const FORMAT = "macalicious-contacts-archive";

/** The media type an archive is downloaded with. */
export const ARCHIVE_TYPE = "application/json";

/** What an archive holds. `pictures` are by card id. */
export interface ContactsArchive {
  cards: readonly Contact[];
  groups: readonly ContactGroup[];
  smartGroups: readonly SmartGroup[];
  pictures: Readonly<Record<string, StoredPicture>>;
}

/** The file's text. */
export const archiveText = (archive: ContactsArchive) =>
  JSON.stringify({ format: FORMAT, version: 1, ...archive });

/** The name Export gives the file: "Contacts - 2026-11-05.abbu". */
export const archiveFileName = (on: Date) =>
  `Contacts - ${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, "0")}-${String(
    on.getDate(),
  ).padStart(2, "0")}.abbu`;

/** Whether a file's name says it is an archive. */
export const isArchiveName = (name: string) => /\.abbu$/i.test(name);

/** What an archive's text holds, each part read as the server's own is; `null` if it is none. */
export function readArchive(text: string): ContactsArchive | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (parsed?.format !== FORMAT) return null;
  const cards = cardsFromServer({ cards: parsed.cards });
  if (!cards) return null;
  const named = (picture: unknown): picture is StoredPicture =>
    typeof (picture as StoredPicture | null)?.version === "string" &&
    typeof (picture as StoredPicture | null)?.image === "string";
  const pictures = Object.entries((parsed.pictures as Record<string, unknown> | null) ?? {}).filter(
    (entry): entry is [string, StoredPicture] => named(entry[1]),
  );
  return {
    cards,
    groups: groupsFromServer({ groups: parsed.groups }) ?? [],
    smartGroups: smartGroupsFromServer({ smart_groups: parsed.smartGroups }) ?? [],
    pictures: Object.fromEntries(pictures),
  };
}
