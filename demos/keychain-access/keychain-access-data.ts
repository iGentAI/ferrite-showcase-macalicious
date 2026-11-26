/**
 * The demo's data: four invented keychains, the items in them, and the pure functions that
 * choose, order and describe the items. Nothing here reads a keychain of the machine the page
 * runs on, and no item holds a secret: there are names, kinds and dates only. The rows of the
 * login keychain repeat what the reference screenshots list.
 */

/** Which stand-in drawing a keychain shows before its name. */
export type KeychainAccessKeychainIcon = "unlocked" | "locked" | "folder";

/** One keychain of the upper list. */
export interface KeychainAccessKeychain {
  /** What the keychain is selected by, and what an item names as its keychain. */
  id: string;
  name: string;
  icon: KeychainAccessKeychainIcon;
  /** The default keychain, where new items go: its name is set in bold. */
  default?: boolean;
}

/** The four keychains, in the order of the list. */
export const KEYCHAINS: readonly KeychainAccessKeychain[] = [
  { id: "login", name: "login", icon: "unlocked", default: true },
  { id: "local-items", name: "Local Items", icon: "unlocked" },
  { id: "system", name: "System", icon: "locked" },
  { id: "system-roots", name: "System Roots", icon: "folder" },
];

/** The six categories of the lower list. */
export type KeychainAccessCategory =
  | "all"
  | "passwords"
  | "secure-notes"
  | "my-certificates"
  | "keys"
  | "certificates";

/** Every category, in the order of the list, with its name. */
export const CATEGORIES: readonly { id: KeychainAccessCategory; name: string }[] = [
  { id: "all", name: "All Items" },
  { id: "passwords", name: "Passwords" },
  { id: "secure-notes", name: "Secure Notes" },
  { id: "my-certificates", name: "My Certificates" },
  { id: "keys", name: "Keys" },
  { id: "certificates", name: "Certificates" },
];

/** What an item is, as the Kind column names it. */
export type KeychainAccessKind =
  | "public key"
  | "private key"
  | "application password"
  | "Internet password"
  | "AirPort network password"
  | "Web form password"
  | "secure note"
  | "certificate";

/** One keychain item. Dates are `YYYY-MM-DDTHH:MM:SS` on the invented machine's own clock. */
export interface KeychainAccessItem {
  /** What a row is selected by. */
  id: string;
  name: string;
  kind: KeychainAccessKind;
  /** The `id` of the keychain that holds the item. */
  keychain: string;
  /** When the item last changed. Keys and certificates have no such date. */
  modified?: string;
  /** When a certificate stops being valid. */
  expires?: string;
  /** A key's algorithm and size, as the summary writes it after the kind. */
  algorithm?: string;
  /** What a key may be used for. */
  usage?: string;
  /** A password's account name. */
  account?: string;
  /** The service or address a password is for. */
  where?: string;
  /** Who issued a certificate. */
  issuer?: string;
  /** A certificate whose private key is in the keychain too: listed under My Certificates. */
  identity?: boolean;
}

/** A column of the item table. */
export type KeychainAccessColumnId = "name" | "kind" | "modified" | "expires" | "keychain";

/**
 * The five columns with the widths measured in the screenshots, each including its 1 pt
 * separator; Keychain takes what is left.
 */
export const COLUMNS: readonly { id: KeychainAccessColumnId; title: string; width?: number }[] = [
  { id: "name", title: "Name", width: 221 },
  { id: "kind", title: "Kind", width: 123 },
  { id: "modified", title: "Date Modified", width: 151 },
  { id: "expires", title: "Expires", width: 151 },
  { id: "keychain", title: "Keychain" },
];

/** The column the items are ordered by, and the direction. */
export interface KeychainAccessSort {
  column: string;
  direction: "ascending" | "descending";
}

/** The window opens sorted by name, as captured. */
export const DEFAULT_SORT: KeychainAccessSort = { column: "name", direction: "ascending" };

/** The day the light screenshot was taken on the invented machine's calendar. */
export const DEFAULT_TODAY = "2019-10-07";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Moment {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * The calendar day as the machine's clock counts it, in UTC. Set through `setUTCFullYear`,
 * which takes the year as written: `Date.UTC` reads a year below 100 as one of the 1900s.
 */
function utcDay(year: number, month: number, day: number): Date {
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  return calendar;
}

/** The parts of a stamp, or nothing when it is not written as one or names no real moment. */
function parse(stamp: string): Moment | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(stamp);
  if (!match) return undefined;
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  // The calendar decides whether the day exists: a day it rolls over into another month
  // (the 31st of September, the 29th of February 2019) is no date, and neither is month 13.
  const calendar = utcDay(year, month, day);
  const real =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60;
  return real ? { year, month, day, hour, minute, second } : undefined;
}

/** Days since the epoch of a calendar day, whatever the time zone of the machine. */
function dayNumber(moment: Moment): number {
  return Math.round(utcDay(moment.year, moment.month, moment.day).getTime() / 86_400_000);
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * A date as the table writes it: "Today, 2:57 PM", "Yesterday, 8:59 AM", or
 * "Sep 29, 2019 at 6:21:11 PM" for any other day. No date, or one that cannot be read or
 * names a moment that does not exist (a 13th month, the 31st of September, 25 o'clock), is
 * two hyphens. `today` is the day the relative forms are counted from.
 */
export function formatDate(stamp: string | undefined, today: string = DEFAULT_TODAY): string {
  const at = stamp ? parse(stamp) : undefined;
  const now = parse(today);
  if (!at || !now) return "--";
  const time = `${at.hour % 12 || 12}:${twoDigits(at.minute)}`;
  const period = at.hour < 12 ? "AM" : "PM";
  const age = dayNumber(now) - dayNumber(at);
  if (age === 0) return `Today, ${time} ${period}`;
  if (age === 1) return `Yesterday, ${time} ${period}`;
  return `${MONTHS[at.month - 1]} ${at.day}, ${at.year} at ${time}:${twoDigits(at.second)} ${period}`;
}

const keychainName = (id: string) => KEYCHAINS.find((keychain) => keychain.id === id)?.name ?? id;

/** The text of one cell of the item table. */
export function cellText(
  item: KeychainAccessItem,
  column: string,
  today: string = DEFAULT_TODAY,
): string {
  if (column === "name") return item.name;
  if (column === "kind") return item.kind;
  if (column === "modified") return formatDate(item.modified, today);
  if (column === "expires") return formatDate(item.expires, today);
  return keychainName(item.keychain);
}

/** A date as a column orders by it: as it is stored, and nothing when it is no real date. */
const dateKey = (stamp: string | undefined) => (stamp && parse(stamp) ? stamp : "");

/** What a column orders by: text without regard to case, and dates as they are stored. */
function sortKey(item: KeychainAccessItem, column: string): string {
  if (column === "modified") return dateKey(item.modified);
  if (column === "expires") return dateKey(item.expires);
  return cellText(item, column).toLowerCase();
}

/** Whether the lower list's category holds the item. */
export function inCategory(item: KeychainAccessItem, category: KeychainAccessCategory): boolean {
  if (category === "all") return true;
  if (category === "passwords") return item.kind.endsWith("password");
  if (category === "secure-notes") return item.kind === "secure note";
  if (category === "keys") return item.kind === "public key" || item.kind === "private key";
  if (category === "certificates") return item.kind === "certificate";
  return item.kind === "certificate" && item.identity === true;
}

/** What the window shows of the items: one keychain, one category, a search and an order. */
export interface KeychainAccessView {
  keychain: string;
  category?: KeychainAccessCategory;
  /** Text the name or the kind must contain, whatever its case. */
  query?: string;
  sort?: KeychainAccessSort;
}

/**
 * The rows of the table: the items of the keychain that are in the category and match the
 * search, ordered by the sort column. Items that are equal in that column keep the order
 * they are given in, in both directions.
 */
export function arrange(
  items: readonly KeychainAccessItem[],
  { keychain, category = "all", query = "", sort = DEFAULT_SORT }: KeychainAccessView,
): KeychainAccessItem[] {
  const wanted = query.trim().toLowerCase();
  const sign = sort.direction === "descending" ? -1 : 1;
  return items
    .filter(
      (item) =>
        item.keychain === keychain &&
        inCategory(item, category) &&
        (wanted === "" ||
          item.name.toLowerCase().includes(wanted) ||
          item.kind.toLowerCase().includes(wanted)),
    )
    .sort((a, b) => {
      const first = sortKey(a, sort.column);
      const second = sortKey(b, sort.column);
      return first === second ? 0 : first < second ? -sign : sign;
    });
}

/** One line of the summary above the table: a label and what it says. */
export interface KeychainAccessDetail {
  label: string;
  value: string;
}

/** The lines the summary shows under an item's name. */
export function describe(
  item: KeychainAccessItem,
  today: string = DEFAULT_TODAY,
): KeychainAccessDetail[] {
  const lines: KeychainAccessDetail[] = [
    { label: "Kind:", value: item.algorithm ? `${item.kind}, ${item.algorithm}` : item.kind },
  ];
  if (item.usage) lines.push({ label: "Usage:", value: item.usage });
  if (item.account) lines.push({ label: "Account:", value: item.account });
  if (item.where) lines.push({ label: "Where:", value: item.where });
  if (item.issuer) lines.push({ label: "Issued by:", value: item.issuer });
  if (item.expires) lines.push({ label: "Expires:", value: formatDate(item.expires, today) });
  if (item.modified) lines.push({ label: "Modified:", value: formatDate(item.modified, today) });
  return lines;
}

/* The moments the screenshots show. The login keychain was set up on September 29 and its
   account tokens were renewed on the day of the capture. */
const SETUP = "2019-09-29";
const RENEWED = `${DEFAULT_TODAY}T14:57:00`;
const ACCOUNT = "com.apple.account.";

type Fields = Omit<KeychainAccessItem, "id" | "keychain">;

const password = (name: string, modified: string, more: Partial<Fields> = {}): Fields => ({
  name,
  kind: "application password",
  modified,
  account: "jordan",
  where: name,
  ...more,
});

const keyPair = (name: string, bits = "2,048"): Fields[] => [
  { name, kind: "public key", algorithm: `RSA, ${bits}-bit`, usage: "Encrypt, Derive, Verify" },
  { name, kind: "private key", algorithm: `RSA, ${bits}-bit`, usage: "Decrypt, Derive, Sign" },
];

const root = (name: string, expires: string): Fields => ({
  name,
  kind: "certificate",
  expires,
  issuer: name,
});

/** Numbers the items of a keychain: `login-1`, `login-2` and so on, in the order given. */
const hold = (keychain: string, items: readonly Fields[]): KeychainAccessItem[] =>
  items.map((item, index) => ({ id: `${keychain}-${index + 1}`, keychain, ...item }));

/**
 * The items the window opens with. The first twenty-four of the login keychain are the rows
 * of the light screenshot, whose long names are shown without their middle there; what the
 * ellipsis hides is invented, as is every item after them and in the other keychains.
 */
export const defaultItems: readonly KeychainAccessItem[] = [
  ...hold("login", [
    ...keyPair("<key>"),
    password("Apple Persistent State Encryption", `${DEFAULT_TODAY}T08:59:00`),
    password("BeaconStore", `${SETUP}T18:20:00`),
    password(`${ACCOUNT}AppleAccount.cloudkit-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.find-my-friends-app-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.find-my-iphone-app-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.find-my-iphone-siri-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.find-my-iphone-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.key-transparency-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.maps-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.search-party-token`, RENEWED),
    password(`${ACCOUNT}AppleAccount.token`, `${SETUP}T18:21:11`),
    password(`${ACCOUNT}DeviceLocator.find-my-iphone-app-token`, RENEWED),
    password(`${ACCOUNT}DeviceLocator.find-my-iphone-siri-token`, RENEWED),
    password(`${ACCOUNT}DeviceLocator.search-party-token`, RENEWED),
    password(`${ACCOUNT}DeviceLocator.token`, RENEWED),
    password(`${ACCOUNT}FindMyFriends.find-my-friends-app-token`, RENEWED),
    password(`${ACCOUNT}GameCenter.token`, `${SETUP}T18:21:06`),
    password(`${ACCOUNT}IdentityServices.token`, `${SETUP}T18:21:06`),
    password(`${ACCOUNT}idms.heartbeat-token`, `${SETUP}T18:21:05`),
    password(`${ACCOUNT}idms.token`, `${SETUP}T18:21:05`),
    password("com.apple.assistant", `${SETUP}T18:22:19`),
    password("com.apple.assistant", `${DEFAULT_TODAY}T08:54:00`),
    password("com.apple.cloudd.deviceIdentifier.Production", `${SETUP}T18:23:41`),
    {
      name: "example.com",
      kind: "Internet password",
      modified: "2019-10-02T09:12:30",
      account: "jordan@example.com",
      where: "https://example.com",
    },
    { name: "Garden shed inventory", kind: "secure note", modified: "2019-10-03T19:44:02" },
    password("ids: identity-rsa-key-pair-signature-v1", `${SETUP}T18:21:30`),
    ...keyPair("iMessage Encryption Key", "1,280"),
    ...keyPair("iMessage Signing Key", "1,280"),
    {
      name: "Local Signing Identity",
      kind: "certificate",
      expires: "2029-09-26T18:25:00",
      issuer: "Local Signing Identity",
      identity: true,
    },
    ...keyPair("Local Signing Identity"),
    password("Safari Session State Key", `${SETUP}T18:26:14`),
    { name: "Travel checklist", kind: "secure note", modified: "2019-10-05T07:30:51" },
  ]),
  ...hold("local-items", [
    {
      name: "accounts.example.org",
      kind: "Web form password",
      modified: "2019-10-01T21:05:12",
      account: "jordan",
      where: "https://accounts.example.org",
    },
    {
      name: "Harbour Cafe Guest",
      kind: "AirPort network password",
      modified: "2019-10-04T10:17:45",
      account: "Harbour Cafe Guest",
      where: "AirPort",
    },
    {
      name: "Home Network",
      kind: "AirPort network password",
      modified: `${SETUP}T18:19:02`,
      account: "Home Network",
      where: "AirPort",
    },
    password("Safari Forms AutoFill Encryption Key", `${SETUP}T18:27:40`),
    {
      name: "shop.example.net",
      kind: "Web form password",
      modified: "2019-10-06T16:48:09",
      account: "jordan@example.com",
      where: "https://shop.example.net",
    },
  ]),
  ...hold("system", [
    {
      name: "com.apple.kerberos.kdc",
      kind: "certificate",
      expires: "2039-09-24T18:14:20",
      issuer: "com.apple.kerberos.kdc",
      identity: true,
    },
    ...keyPair("com.apple.kerberos.kdc"),
    {
      name: "com.apple.systemdefault",
      kind: "certificate",
      expires: "2039-09-24T18:14:19",
      issuer: "com.apple.systemdefault",
      identity: true,
    },
    ...keyPair("com.apple.systemdefault"),
    {
      name: "Office Network",
      kind: "AirPort network password",
      modified: "2019-09-30T08:02:36",
      account: "Office Network",
      where: "AirPort",
    },
  ]),
  ...hold("system-roots", [
    root("Aldgate Trust Root CA", "2031-11-09T23:59:59"),
    root("Borealis Global Root G2", "2038-01-15T12:00:00"),
    root("Cascade Public Primary Root", "2036-07-16T23:59:59"),
    root("Dunmore Secure Root CA 3", "2029-03-17T18:33:33"),
    root("Evergreen Root Authority", "2034-06-28T17:39:16"),
    root("Fjord Networks Root X1", "2035-06-04T11:04:38"),
    root("Greyfriars Root Certification Authority", "2040-12-31T23:59:59"),
    root("Halcyon TLS Root 2014", "2039-10-05T08:00:00"),
  ]),
];

/** The day the dark screenshot was taken: the day after the light one. */
export const darkCaptureToday = "2019-10-08";

/**
 * The items as the dark screenshot lists them: the same, a day later, after the account
 * tokens were renewed again that morning.
 */
export const darkCaptureItems: readonly KeychainAccessItem[] = defaultItems.map((item) =>
  item.modified === RENEWED ? { ...item, modified: `${darkCaptureToday}T10:21:00` } : item,
);
