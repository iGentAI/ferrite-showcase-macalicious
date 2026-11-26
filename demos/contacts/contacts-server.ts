import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  ACCOUNT_NAME,
  type Contact,
  type ContactGroup,
  type DesktopAccount,
  SMART_FIELDS,
  type SmartField,
  type SmartGroup,
  testsOf,
} from "./contacts-data";

/**
 * Contacts' cards as its module of the `macalicious-desktop` Ferrite application keeps them
 * (`ferrite-apps/desktop/src/apps/contacts`): `GET` and `PUT` of `{ cards }`, each card in the
 * shape of `Contact`.
 */
export const CONTACTS_CARDS_URL = "/api/contacts/cards";

/** The person's smart groups, a document of their own: `GET` and `PUT` of `{ smart_groups }`. */
export const CONTACTS_SMART_GROUPS_URL = "/api/contacts/smart-groups";

/** The person's own groups, a document of their own: `GET` and `PUT` of `{ groups }`. */
export const CONTACTS_GROUPS_URL = "/api/contacts/groups";

/** The cards' pictures, one per card, kept beside the cards. */
export const CONTACTS_PICTURES_URL = "/api/contacts/pictures";

/** The signed-in account, which My Card is made from. */
export const CONTACTS_ME_URL = "/api/contacts/me";

/** The accounts of the desktop, by name: `/api/contacts/users/<account name>`. */
export const CONTACTS_USERS_URL = "/api/contacts/users";

/** The most pictures one request reads (the module's `PICTURES_PER_REQUEST`). */
export const PICTURES_PER_REQUEST = 16;

/** The longest picture the module keeps, as its `data:` URL (its `MAX_IMAGE_CHARS`). */
export const MAX_IMAGE_CHARS = 65_536;

/** The `PUT` body for the window's cards. */
export function cardsToServer(cards: readonly Contact[]): { cards: readonly Contact[] } {
  return { cards };
}

const optionalString = (value: unknown) => value === undefined || typeof value === "string";
const optionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

const isField = (value: unknown): boolean => {
  const field = value as Record<string, unknown> | null;
  return (
    typeof field === "object" &&
    field !== null &&
    typeof field.label === "string" &&
    typeof field.value === "string" &&
    optionalString(field.service) &&
    optionalBoolean(field.private)
  );
};

const optionalFields = (value: unknown) =>
  value === undefined || (Array.isArray(value) && value.every(isField));

const isAddress = (value: unknown): boolean => {
  const address = value as Record<string, unknown> | null;
  return (
    typeof address === "object" &&
    address !== null &&
    typeof address.label === "string" &&
    typeof address.street === "string" &&
    typeof address.city === "string" &&
    typeof address.state === "string" &&
    typeof address.zip === "string" &&
    typeof address.country === "string"
  );
};

/** Whether a card holds what the card view reads, every optional field in its own shape. */
const isCard = (value: unknown): value is Contact => {
  const card = value as Record<string, unknown> | null;
  return (
    typeof card === "object" &&
    card !== null &&
    !Array.isArray(card) &&
    typeof card.id === "string" &&
    (card.account === "icloud" || card.account === "mac") &&
    typeof card.first === "string" &&
    typeof card.last === "string" &&
    optionalString(card.company) &&
    optionalBoolean(card.isCompany) &&
    optionalBoolean(card.me) &&
    (card.picture === undefined || card.picture === "monogram" || card.picture === "silhouette") &&
    optionalFields(card.phones) &&
    optionalFields(card.emails) &&
    optionalFields(card.urls) &&
    optionalFields(card.ims) &&
    optionalFields(card.relatedNames) &&
    optionalFields(card.dates) &&
    optionalFields(card.socials) &&
    (card.addresses === undefined ||
      (Array.isArray(card.addresses) && card.addresses.every(isAddress))) &&
    optionalString(card.phoneticFirst) &&
    optionalString(card.phoneticLast) &&
    optionalString(card.nickname) &&
    optionalString(card.jobTitle) &&
    optionalString(card.department) &&
    optionalString(card.ringtone) &&
    optionalString(card.textTone) &&
    optionalString(card.birthday) &&
    optionalString(card.note) &&
    (card.user === undefined || (typeof card.user === "string" && ACCOUNT_NAME.test(card.user))) &&
    optionalString(card.image)
  );
};

/**
 * Whether a `GET` reply is a document Contacts can read: `cards` is a list, or `null` before
 * the session has saved any. Anything else is stored data that must not be saved over.
 */
export function cardsReadable(reply: unknown): boolean {
  const cards = (reply as { cards?: unknown } | null)?.cards;
  return cards === null || Array.isArray(cards);
}

/**
 * The cards of a `GET` reply, or `undefined` when it holds none: the session has not saved
 * any yet (`{ cards: null }`), or the reply is not the module's.
 */
export function cardsFromServer(reply: unknown): Contact[] | undefined {
  const cards = (reply as { cards?: unknown } | null)?.cards;
  return Array.isArray(cards) ? cards.filter(isCard) : undefined;
}

/** The `PUT` body for the person's smart groups. */
export function smartGroupsToServer(groups: readonly SmartGroup[]): {
  smart_groups: readonly SmartGroup[];
} {
  return { smart_groups: groups };
}

const isSmartCondition = (value: unknown): boolean => {
  const condition = value as Record<string, unknown> | null;
  return (
    typeof condition === "object" &&
    condition !== null &&
    typeof condition.value === "string" &&
    SMART_FIELDS.some(([field]) => field === condition.field) &&
    testsOf(condition.field as SmartField).some(([test]) => test === condition.test)
  );
};

const isSmartGroup = (value: unknown): value is SmartGroup => {
  const group = value as Record<string, unknown> | null;
  return (
    typeof group === "object" &&
    group !== null &&
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    (group.rule === "desktop-user" ||
      (group.rule === "contains" && typeof group.text === "string") ||
      (group.rule === "rules" &&
        Array.isArray(group.conditions) &&
        group.conditions.length > 0 &&
        group.conditions.every(isSmartCondition))) &&
    optionalString(group.text)
  );
};

/** Whether a `GET` reply of the smart groups can be read: a list, or `null` before any. */
export function smartGroupsReadable(reply: unknown): boolean {
  const groups = (reply as { smart_groups?: unknown } | null)?.smart_groups;
  return groups === null || Array.isArray(groups);
}

/** The smart groups of a `GET` reply, or `undefined` before the person has made any. */
export function smartGroupsFromServer(reply: unknown): SmartGroup[] | undefined {
  const groups = (reply as { smart_groups?: unknown } | null)?.smart_groups;
  return Array.isArray(groups) ? groups.filter(isSmartGroup) : undefined;
}

/** The `PUT` body for the person's own groups. */
export function groupsToServer(groups: readonly ContactGroup[]): {
  groups: readonly ContactGroup[];
} {
  return { groups };
}

const isContactGroup = (value: unknown): value is ContactGroup => {
  const group = value as Record<string, unknown> | null;
  return (
    typeof group === "object" &&
    group !== null &&
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    Array.isArray(group.members) &&
    group.members.every((member) => typeof member === "string")
  );
};

/** Whether a `GET` reply of the groups can be read: a list, or `null` before any. */
export function groupsReadable(reply: unknown): boolean {
  const groups = (reply as { groups?: unknown } | null)?.groups;
  return groups === null || Array.isArray(groups);
}

/** The groups of a `GET` reply, or `undefined` before the person has made any. */
export function groupsFromServer(reply: unknown): ContactGroup[] | undefined {
  const groups = (reply as { groups?: unknown } | null)?.groups;
  return Array.isArray(groups) ? groups.filter(isContactGroup) : undefined;
}

/** A request to the module that failed: `status` is 0 when no reply came. */
export class ContactsServerError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ContactsServerError";
    this.status = status;
  }
}

/** One request to the module, read as JSON; a refusal rejects with the server's own sentence. */
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let reply: { response: Response; body: unknown };
  try {
    reply = await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        ...init,
        credentials: "same-origin",
        headers: { accept: "application/json", ...(init.headers ?? {}) },
        signal,
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { response, body };
    });
  } catch (error) {
    throw new ContactsServerError(0, error instanceof Error ? error.message : String(error));
  }
  const { response, body } = reply;
  if (!response.ok) {
    const said = (body as { error?: unknown } | null)?.error;
    throw new ContactsServerError(
      response.status,
      typeof said === "string" ? said : `The desktop answered ${response.status}.`,
    );
  }
  return body as T;
}

/** The signed-in account, or `null` before anyone signs in (or when it cannot be asked). */
export async function fetchDesktopAccount(): Promise<DesktopAccount | null> {
  try {
    const body = await request<{ name?: unknown; full_name?: unknown; guest?: unknown }>(
      CONTACTS_ME_URL,
    );
    if (typeof body?.name !== "string") return null;
    return {
      name: body.name,
      fullName: typeof body.full_name === "string" ? body.full_name : body.name,
      guest: body.guest === true,
    };
  } catch {
    return null;
  }
}

/**
 * The account named `name` on the desktop: its account name and full name. Rejects with a
 * `ContactsServerError`: 404 when no account has the name, 400 when it cannot be one, 401
 * before anyone signs in.
 */
export async function lookupDesktopUser(name: string): Promise<{ name: string; fullName: string }> {
  const trimmed = name.trim().toLowerCase();
  if (!ACCOUNT_NAME.test(trimmed)) {
    throw new ContactsServerError(
      400,
      "An account name is 1 to 32 lower-case letters, digits, “.”, “_” or “-”, starting with a letter.",
    );
  }
  const body = await request<{ name?: unknown; full_name?: unknown }>(
    `${CONTACTS_USERS_URL}/${trimmed}`,
  );
  if (typeof body?.name !== "string") throw new ContactsServerError(502, "No account came back.");
  return {
    name: body.name,
    fullName: typeof body.full_name === "string" ? body.full_name : body.name,
  };
}

/** One card's picture as the module keeps it. */
export interface StoredPicture {
  /** The version the card names in its `image`. */
  version: string;
  /** The picture, a `data:image/jpeg;base64,` or `data:image/png;base64,` URL. */
  image: string;
}

/** The pictures of the cards `ids`, by card id, read `PICTURES_PER_REQUEST` at a time. */
export async function loadPictures(ids: readonly string[]): Promise<Record<string, StoredPicture>> {
  const found: Record<string, StoredPicture> = {};
  for (let at = 0; at < ids.length; at += PICTURES_PER_REQUEST) {
    const batch = ids.slice(at, at + PICTURES_PER_REQUEST);
    // Card ids are letters, digits, `-`, `_` and `.`: nothing to encode.
    const body = await request<{ pictures?: Record<string, unknown> }>(
      `${CONTACTS_PICTURES_URL}?ids=${batch.join(",")}`,
    );
    for (const [id, value] of Object.entries(body?.pictures ?? {})) {
      const picture = value as Partial<StoredPicture> | null;
      if (typeof picture?.version === "string" && typeof picture.image === "string") {
        found[id] = { version: picture.version, image: picture.image };
      }
    }
  }
  return found;
}

/** Keep `image` as the picture of card `id`, under `version`. */
export async function savePicture(id: string, version: string, image: string): Promise<void> {
  await request(`${CONTACTS_PICTURES_URL}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version, image }),
  });
}

/** Forget the picture of card `id`: only version `version`, when given (one chosen since stays). */
export async function deletePicture(id: string, version?: string): Promise<void> {
  const only = version ? `?version=${encodeURIComponent(version)}` : "";
  await request(`${CONTACTS_PICTURES_URL}/${id}${only}`, { method: "DELETE" });
}
