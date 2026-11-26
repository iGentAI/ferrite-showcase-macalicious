import {
  ACCOUNT_NAME,
  addressIsEmpty,
  type Contact,
  type ContactAddress,
  type ContactField,
  type ContactFieldKind,
  FIELD_KINDS,
  FIELD_ORDER,
  fieldsOf,
  IM_SERVICES,
  labelOf,
  namesOf,
  socialUrl,
} from "./contacts-data";

/*
 * vCard 3.0 (RFC 2426), read and written in the browser. A card is written as `N` and `FN`,
 * `NICKNAME`, `TITLE`, `ORG` with the department, Apple's `X-ABShowAs:COMPANY` for a company's
 * card and its `X-PHONETIC-FIRST-NAME` and `X-PHONETIC-LAST-NAME`, one `TEL`, `EMAIL`, `URL`,
 * `IMPP`, `X-ABRELATEDNAMES`, `X-ABDATE`, `X-SOCIALPROFILE` and `ADR` per field, `BDAY`, `NOTE`,
 * the desktop user as `X-MACALICIOUS-USER` and the picture as
 * `PHOTO;ENCODING=b`. A label vCard has a type for (home, work, mobile…) is written as that
 * type; any other label in Apple's way, an `itemN.` group with an `X-ABLabel`. Reading takes
 * those and what other address books write: vCard 2.1's bare types and quoted-printable text,
 * vCard 4's `data:` photos, `X-AIM`-style messaging names and Apple's `_$!<Label>!$_` labels.
 * The account (iCloud or On My Mac), the tones and the monogram choice are the window's own
 * and are not written.
 */

/** A card read from a vCard: everything but its `id` and account, and its picture. */
export interface ImportedCard {
  card: Omit<Contact, "id" | "account">;
  /** The picture, as a `data:image/jpeg;base64,` or `data:image/png;base64,` URL. */
  photo?: string;
  /** The card has a `PHOTO` of any kind, read into `photo` or not. */
  hadPhoto?: true;
}

/** A card to write, with its picture as a `data:` URL when it has one. */
export interface ExportedCard {
  contact: Contact;
  photo?: string;
}

/** The media type of a vCard file. */
export const VCARD_TYPE = "text/vcard";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The vCard property of each kind of field. */
const PROPERTY: Record<ContactFieldKind, string> = {
  phone: "TEL",
  email: "EMAIL",
  url: "URL",
  im: "IMPP",
  related: "X-ABRELATEDNAMES",
  date: "X-ABDATE",
  social: "X-SOCIALPROFILE",
};

/** The labels a vCard type stands for, per kind; any other label is written with X-ABLabel. */
const TYPES: Record<ContactFieldKind, Record<string, string>> = {
  phone: { iPhone: "IPHONE", mobile: "CELL", home: "HOME", work: "WORK", main: "MAIN" },
  email: { home: "HOME", work: "WORK" },
  url: { home: "HOME", work: "WORK" },
  im: { home: "HOME", work: "WORK" },
  related: {},
  date: {},
  social: {
    Twitter: "TWITTER",
    LinkedIn: "LINKEDIN",
    Facebook: "FACEBOOK",
    Flickr: "FLICKR",
    Myspace: "MYSPACE",
    "Sina Weibo": "SINAWEIBO",
  },
};

/** The labels of a postal address that vCard has a type for. */
const ADDRESS_TYPES: Record<string, string> = { home: "HOME", work: "WORK" };

/** The URI scheme an IMPP value of a service is written with. */
const SCHEMES: Record<string, string> = {
  Jabber: "xmpp",
  AIM: "aim",
  ICQ: "icq",
  Skype: "skype",
};

/** Text as a vCard value: backslash, newline, comma and semicolon escaped. */
const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const encoder = new TextEncoder();

/**
 * A content line folded at 75 octets (RFC 2425, 5.8.1): each further line starts with one
 * space. A character is never cut in two.
 */
function fold(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const lines: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const room = lines.length === 0 ? 75 : 74;
    if (octets + size > room) {
      lines.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  lines.push(current);
  return lines.join("\r\n ");
}

/** A birthday as typed, as a vCard date: `1990-10-07`, `--03-14`; `undefined` if it is none. */
export function birthdayToVCard(text: string): string | undefined {
  const trimmed = text.trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = (month: number, day: number, year?: number) =>
    month >= 1 && month <= 12 && day >= 1 && day <= 31
      ? `${year === undefined ? "-" : String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`
      : undefined;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (match) return date(Number(match[2]), Number(match[3]), Number(match[1]));
  match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(trimmed);
  if (match)
    return date(Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : undefined);
  match = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(trimmed);
  if (match) {
    const name = (match[1] ?? "").toLowerCase();
    const month = MONTHS.findIndex(
      (each) => each.toLowerCase() === name || each.slice(0, 3).toLowerCase() === name,
    );
    if (month >= 0)
      return date(month + 1, Number(match[2]), match[3] ? Number(match[3]) : undefined);
  }
  return undefined;
}

/** A vCard date as the card shows a birthday: "March 14", "October 7, 1990". */
export function birthdayFromVCard(value: string): string {
  const trimmed = value.trim();
  const match =
    /^(\d{4}|--)-?(\d{2})-?(\d{2})(?:T.*)?$/.exec(trimmed) ?? /^--(\d{2})(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  const [year, month, day] =
    match.length === 4 ? [match[1], match[2], match[3]] : ["--", match[1], match[2]];
  const name = MONTHS[Number(month) - 1];
  if (!name) return trimmed;
  const text = `${name} ${Number(day)}`;
  return year && year !== "--" ? `${text}, ${Number(year)}` : text;
}

/** The lines of one card. */
function cardLines({ contact, photo }: ExportedCard): string[] {
  const first = contact.first.trim();
  const last = contact.last.trim();
  const company = contact.company?.trim() ?? "";
  const person = `${first} ${last}`.trim();
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//Macalicious//Contacts//EN",
    `N:${escapeText(last)};${escapeText(first)};;;`,
    `FN:${escapeText(contact.isCompany && company ? company : person || company)}`,
  ];
  const department = contact.department?.trim() ?? "";
  if (company || department) lines.push(`ORG:${escapeText(company)};${escapeText(department)}`);
  if (contact.isCompany) lines.push("X-ABShowAs:COMPANY");
  const texts: readonly [string, string | undefined][] = [
    ["NICKNAME", contact.nickname],
    ["TITLE", contact.jobTitle],
    ["X-PHONETIC-FIRST-NAME", contact.phoneticFirst],
    ["X-PHONETIC-LAST-NAME", contact.phoneticLast],
  ];
  for (const [name, text] of texts) {
    if (text?.trim()) lines.push(`${name}:${escapeText(text.trim())}`);
  }
  let item = 0;
  for (const kind of FIELD_ORDER) {
    for (const field of fieldsOf(contact, kind)) {
      if (field.value.trim() === "") continue;
      const label = labelOf(field);
      const type = TYPES[kind][label];
      const params = kind === "email" ? ["TYPE=INTERNET"] : [];
      if (type) params.push(`TYPE=${type}`);
      let value = escapeText(field.value.trim());
      if (kind === "date") {
        const date = birthdayToVCard(field.value);
        if (date) value = date;
        else params.push("VALUE=text");
      }
      if (kind === "social") {
        const typed = field.value.trim();
        const page = socialUrl(field);
        if (page && page !== typed && /^[\w.@-]+$/.test(typed)) params.push(`X-USER=${typed}`);
        value = escapeText(page ?? typed);
      }
      if (kind === "im") {
        const service = field.service ?? IM_SERVICES[0] ?? "Jabber";
        params.unshift(`X-SERVICE-TYPE=${service}`);
        value = `${SCHEMES[service] ?? "x-apple"}:${value}`;
      }
      const head = [PROPERTY[kind], ...params].join(";");
      if (type) {
        lines.push(`${head}:${value}`);
      } else {
        item += 1;
        lines.push(`item${item}.${head}:${value}`, `item${item}.X-ABLabel:${escapeText(label)}`);
      }
    }
  }
  for (const address of contact.addresses ?? []) {
    if (addressIsEmpty(address)) continue;
    const parts = [address.street, address.city, address.state, address.zip, address.country];
    const value = `;;${parts.map((part) => escapeText(part.trim())).join(";")}`;
    const label = labelOf(address);
    const type = ADDRESS_TYPES[label];
    if (type) {
      lines.push(`ADR;TYPE=${type}:${value}`);
    } else {
      item += 1;
      lines.push(`item${item}.ADR:${value}`, `item${item}.X-ABLabel:${escapeText(label)}`);
    }
  }
  const birthday = contact.birthday?.trim();
  if (birthday) {
    const date = birthdayToVCard(birthday);
    lines.push(date ? `BDAY:${date}` : `BDAY;VALUE=text:${escapeText(birthday)}`);
  }
  if (contact.note?.trim()) lines.push(`NOTE:${escapeText(contact.note)}`);
  if (contact.user) lines.push(`X-MACALICIOUS-USER:${contact.user}`);
  const picture = photo && /^data:image\/(jpeg|png);base64,(.+)$/.exec(photo);
  if (picture) lines.push(`PHOTO;ENCODING=b;TYPE=${picture[1]?.toUpperCase()}:${picture[2]}`);
  lines.push("END:VCARD");
  return lines;
}

/** The formats Preferences > vCard offers. */
export type VCardFormat = "3.0" | "2.1";
/** The encodings of a 2.1 file: UTF-8, or Windows Latin 1, which Outlook reads. */
export type VCardEncoding = "utf-8" | "windows-1252";

const qpByte = (byte: number) => `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;

/** What Windows Latin 1 keeps in 0x80 to 0x9F, where it differs from Unicode; a space is no character. */
const WINDOWS_1252_HIGH = "€ ‚ƒ„…†‡ˆ‰Š‹Œ Ž  ‘’“”•–—˜™š›œ žŸ";

/** `text` in Windows Latin 1, or `null` when it holds a character that has no place there. */
function windows1252Bytes(text: string): number[] | null {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else {
      const at = WINDOWS_1252_HIGH.indexOf(char);
      if (at < 0) return null;
      bytes.push(0x80 + at);
    }
  }
  return bytes;
}

/** These bytes as quoted-printable: every one but plain ASCII is written as =XX. */
const toQuotedPrintable = (bytes: Iterable<number>) =>
  [...bytes]
    .map((byte) =>
      byte >= 33 && byte <= 126 && byte !== 61 ? String.fromCharCode(byte) : qpByte(byte),
    )
    .join("");

/**
 * A line of `cardLines` as vCard 2.1 writes it (versit, 1996): bare types, and no text escapes but
 * `;`. A value Windows Latin 1 cannot hold stays in UTF-8, which its CHARSET says.
 */
function lineIn21(line: string, encoding: VCardEncoding): string {
  if (line === "VERSION:3.0") return "VERSION:2.1";
  const colon = line.indexOf(":");
  if (colon < 0 || line.startsWith("BEGIN:") || line.startsWith("END:")) return line;
  const head = line
    .slice(0, colon)
    .replace(/;ENCODING=b;TYPE=/, ";ENCODING=BASE64;")
    .replaceAll(";TYPE=", ";");
  const value = line
    .slice(colon + 1)
    .replaceAll("\\n", "\n")
    .replaceAll("\\,", ",")
    .replaceAll("\\\\", "\\");
  if (!/[^\x20-\x7e]/.test(value)) return `${head}:${value}`;
  // Outlook's lines end in CRLF.
  const latin =
    encoding === "windows-1252" ? windows1252Bytes(value.replaceAll("\n", "\r\n")) : null;
  const charset = latin ? "WINDOWS-1252" : "UTF-8";
  const quoted = toQuotedPrintable(latin ?? new TextEncoder().encode(value)).replaceAll("=20", " ");
  return `${head};ENCODING=QUOTED-PRINTABLE;CHARSET=${charset}:${quoted}`;
}

/** A 2.1 line folded: a quoted-printable one by `=` at the end of a line, any other by a leading space. */
function fold21(line: string): string {
  if (line.length <= 75) return line;
  const quoted = /^[^:]*ENCODING=QUOTED-PRINTABLE/.test(line);
  const pieces: string[] = [];
  for (let from = 0; from < line.length; ) {
    let to = Math.min(line.length, from + 72);
    // An =XX is not cut in two.
    if (quoted && line[to - 1] === "=") to -= 1;
    else if (quoted && line[to - 2] === "=") to -= 2;
    pieces.push(line.slice(from, to));
    from = to;
  }
  return quoted ? pieces.join("=\r\n") : pieces.join("\r\n ");
}

/**
 * The cards as one vCard file, lines folded and ended with CRLF: 3.0, or 2.1 for older programs, in
 * the `encoding` chosen for those.
 */
export function cardsToVCard(
  cards: readonly ExportedCard[],
  format: VCardFormat = "3.0",
  encoding: VCardEncoding = "utf-8",
): string {
  if (format === "2.1") {
    return `${cards.flatMap((card) => cardLines(card).map((line) => fold21(lineIn21(line, encoding)))).join("\r\n")}\r\n`;
  }
  return `${cards.flatMap((card) => cardLines(card).map(fold)).join("\r\n")}\r\n`;
}

/** The name of the file the cards are saved as: the card's name, or "N Contacts". */
export function vCardFileName(cards: readonly Contact[]): string {
  const [only] = cards;
  if (cards.length === 1 && only) {
    const company = only.company?.trim() ?? "";
    const person = `${only.first.trim()} ${only.last.trim()}`.trim();
    const name = (only.isCompany && company ? company : person || company).replace(
      /[/\\:*?"<>|]/g,
      "-",
    );
    return `${name || "Contact"}.vcf`;
  }
  return `${cards.length} Contacts.vcf`;
}

/** One content line, read. */
interface Property {
  group: string;
  name: string;
  params: Map<string, string[]>;
  types: Set<string>;
  value: string;
}

/** Splits `text` at `separator` where it is not escaped with a backslash. */
function splitUnescaped(text: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === "\\" && at + 1 < text.length) {
      current += char + text[at + 1];
      at += 1;
    } else if (char === separator) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

/** A vCard value as text: its escapes undone. */
const unescapeText = (text: string) =>
  text.replace(/\\([\\,;nN:])/g, (_, char: string) => (char === "n" || char === "N" ? "\n" : char));

/** Quoted-printable text (vCard 2.1) in the charset it names, UTF-8 if none or one not known. */
function quotedPrintable(text: string, charset = "utf-8"): string {
  const bytes: number[] = [];
  const joined = text.replace(/=\r?\n/g, "");
  for (let at = 0; at < joined.length; at += 1) {
    const hex = joined.slice(at + 1, at + 3);
    if (joined[at] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      at += 2;
    } else {
      for (const char of joined[at] ?? "") bytes.push(...encoder.encode(char));
    }
  }
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder();
  }
  return decoder.decode(new Uint8Array(bytes)).replaceAll("\r\n", "\n");
}

/** Reads one unfolded content line, or `null` when it is not one. */
function readLine(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let at = 0; at < line.length; at += 1) {
    if (line[at] === '"') quoted = !quoted;
    else if (line[at] === ":" && !quoted) {
      colon = at;
      break;
    }
  }
  if (colon <= 0) return null;
  const [head = "", ...rawParams] = line.slice(0, colon).split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const dot = head.lastIndexOf(".");
  const group = dot >= 0 ? head.slice(0, dot).toLowerCase() : "";
  const name = head.slice(dot + 1).toUpperCase();
  const params = new Map<string, string[]>();
  const types = new Set<string>();
  for (const param of rawParams) {
    const equals = param.indexOf("=");
    // vCard 2.1 writes a type alone: `TEL;CELL:`.
    const key = equals < 0 ? "TYPE" : param.slice(0, equals).trim().toUpperCase();
    const values = (equals < 0 ? param : param.slice(equals + 1))
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""));
    params.set(key, [...(params.get(key) ?? []), ...values]);
    if (key === "TYPE") for (const value of values) types.add(value.toLowerCase());
  }
  let value = line.slice(colon + 1);
  if (params.get("ENCODING")?.some((each) => each.toUpperCase() === "QUOTED-PRINTABLE")) {
    value = quotedPrintable(value, params.get("CHARSET")?.[0]);
  }
  return { group, name, params, types, value };
}

/** The content lines of a file, unfolded: a line that starts with a space or tab continues. */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)) {
    const last = lines.length - 1;
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && last >= 0) {
      lines[last] += raw.slice(1);
    } else if (
      last >= 0 &&
      lines[last]?.endsWith("=") &&
      /ENCODING=QUOTED-PRINTABLE/i.test(lines[last]?.split(":")[0] ?? "")
    ) {
      // A quoted-printable soft line break.
      lines[last] = `${lines[last]?.slice(0, -1)}${raw}`;
    } else {
      lines.push(raw);
    }
  }
  return lines.filter((line) => line.trim() !== "");
}

/** An Apple label, `_$!<HomePage>!$_`, as the card's own: "home page". */
function appleLabel(label: string): string {
  const match = /^_\$!<(.+)>!\$_$/.exec(label.trim());
  if (!match) return label.trim();
  return (match[1] ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^iphone$/, "iPhone");
}

/** The label a field read with `types` has, when no X-ABLabel names one. */
function labelFrom(kind: ContactFieldKind, types: Set<string>): string {
  if (kind === "phone") {
    if (types.has("fax")) return types.has("home") ? "home fax" : "work fax";
    if (types.has("pager")) return "pager";
  }
  for (const [label, type] of Object.entries(TYPES[kind])) {
    if (types.has(type.toLowerCase())) return label;
  }
  return "other";
}

/** The messaging services a property of its own names (vCard 3.0's `X-AIM`, …). */
const IM_PROPERTIES: Record<string, string> = {
  "X-JABBER": "Jabber",
  "X-AIM": "AIM",
  "X-ICQ": "ICQ",
  "X-SKYPE": "Skype",
  "X-SKYPE-USERNAME": "Skype",
};

/** A picture read from a `PHOTO` property, as a `data:` URL, if it is a JPEG or PNG. */
function photoOf(property: Property): string | undefined {
  const value = property.value.trim();
  const uri = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (uri) {
    const kind = (uri[1] ?? "").toLowerCase() === "png" ? "png" : "jpeg";
    return `data:image/${kind};base64,${(uri[2] ?? "").replace(/\s/g, "")}`;
  }
  const encoding = (property.params.get("ENCODING") ?? []).map((each) => each.toUpperCase());
  if (!encoding.includes("B") && !encoding.includes("BASE64")) return undefined;
  const data = value.replace(/\s/g, "");
  // The bytes say what the file is, whatever the TYPE says.
  if (data.startsWith("/9j/")) return `data:image/jpeg;base64,${data}`;
  if (data.startsWith("iVBORw0KGgo")) return `data:image/png;base64,${data}`;
  return undefined;
}

/** One card from its properties, or `null` when it holds nothing a card shows. */
function cardOf(properties: readonly Property[]): ImportedCard | null {
  const labels = new Map<string, string>();
  for (const property of properties) {
    if (property.name === "X-ABLABEL" && property.group) {
      labels.set(property.group, appleLabel(unescapeText(property.value)));
    }
  }
  const card: Omit<Contact, "id" | "account"> = { first: "", last: "" };
  const lists: Record<ContactFieldKind, ContactField[]> = {
    phone: [],
    email: [],
    url: [],
    im: [],
    related: [],
    date: [],
    social: [],
  };
  const addresses: ContactAddress[] = [];
  let fullName = "";
  let named = false;
  let photo: string | undefined;
  let hadPhoto = false;
  for (const property of properties) {
    const { name, value, types, group } = property;
    const label = (kind: ContactFieldKind) => labels.get(group) || labelFrom(kind, types);
    switch (name) {
      case "N": {
        const [last = "", first = ""] = splitUnescaped(value, ";").map(unescapeText);
        card.first = first.trim();
        card.last = last.trim();
        named = card.first !== "" || card.last !== "";
        break;
      }
      case "FN":
        fullName = unescapeText(value).trim();
        break;
      case "ORG": {
        const [company = "", department = ""] = splitUnescaped(value, ";").map((part) =>
          unescapeText(part).trim(),
        );
        if (company) card.company = company;
        if (department) card.department = department;
        break;
      }
      case "NICKNAME":
      case "TITLE":
      case "X-PHONETIC-FIRST-NAME":
      case "X-PHONETIC-LAST-NAME": {
        const text = unescapeText(value).trim();
        if (!text) break;
        if (name === "NICKNAME") card.nickname = text;
        else if (name === "TITLE") card.jobTitle = text;
        else if (name === "X-PHONETIC-FIRST-NAME") card.phoneticFirst = text;
        else card.phoneticLast = text;
        break;
      }
      case "ADR": {
        const [box = "", extended = "", lines = "", city = "", state = "", zip = "", country = ""] =
          splitUnescaped(value, ";").map((part) => unescapeText(part).trim());
        // A card's street is one line: a PO box, an extended address and the street's own lines
        // are kept on it.
        const street = [box, extended, ...lines.split("\n")]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(", ");
        const address = {
          label:
            labels.get(group) ||
            Object.keys(ADDRESS_TYPES).find((each) => types.has(each)) ||
            "other",
          street,
          city,
          state,
          zip,
          country,
        };
        if (!addressIsEmpty(address)) addresses.push(address);
        break;
      }
      case "X-ABRELATEDNAMES": {
        const text = unescapeText(value).trim();
        if (text) lists.related.push({ label: label("related"), value: text });
        break;
      }
      case "X-ABDATE": {
        const text = unescapeText(value).trim();
        const asText = property.params.get("VALUE")?.some((each) => each.toLowerCase() === "text");
        if (text) {
          lists.date.push({
            label: label("date"),
            value: asText ? text : birthdayFromVCard(text),
          });
        }
        break;
      }
      case "X-SOCIALPROFILE": {
        const user = property.params.get("X-USER")?.[0]?.trim();
        const address = unescapeText(value).trim();
        const field = { label: label("social"), value: user || address };
        // The user name stands for the page only where the service's page is made from it.
        const samePage = (one: string | undefined, other: string) =>
          one
            ?.replace(/^https?:\/\/(www\.)?/i, "")
            .replace(/\/$/, "")
            .toLowerCase() ===
          other
            .replace(/^https?:\/\/(www\.)?/i, "")
            .replace(/\/$/, "")
            .toLowerCase();
        if (user && address && !samePage(socialUrl(field), address)) field.value = address;
        if (field.value) lists.social.push(field);
        break;
      }
      case "X-ABSHOWAS":
        if (value.trim().toUpperCase() === "COMPANY") card.isCompany = true;
        break;
      case "TEL":
      case "EMAIL":
      case "URL": {
        const kind = name === "TEL" ? "phone" : name === "EMAIL" ? "email" : "url";
        const text = unescapeText(value).trim();
        if (text) lists[kind].push({ label: label(kind), value: text });
        break;
      }
      case "IMPP": {
        const service =
          property.params.get("X-SERVICE-TYPE")?.[0] ??
          Object.entries(SCHEMES).find(([, scheme]) =>
            value.toLowerCase().startsWith(`${scheme}:`),
          )?.[0] ??
          IM_SERVICES[0];
        const text = unescapeText(value.replace(/^[a-z][a-z0-9+.-]*:/i, "")).trim();
        if (text) lists.im.push({ label: label("im"), value: text, service });
        break;
      }
      case "BDAY": {
        const text = unescapeText(value).trim();
        const asText = property.params.get("VALUE")?.some((each) => each.toLowerCase() === "text");
        if (text) card.birthday = asText ? text : birthdayFromVCard(text);
        break;
      }
      case "NOTE": {
        const text = unescapeText(value);
        if (text.trim()) card.note = text;
        break;
      }
      case "X-MACALICIOUS-USER": {
        const user = value.trim().toLowerCase();
        if (ACCOUNT_NAME.test(user)) card.user = user;
        break;
      }
      case "PHOTO":
        photo = photoOf(property) ?? photo;
        hadPhoto = true;
        break;
      default: {
        const service = IM_PROPERTIES[name];
        const text = unescapeText(value).trim();
        if (service && text) lists.im.push({ label: label("im"), value: text, service });
      }
    }
  }
  if (!named && fullName && fullName !== card.company) Object.assign(card, namesOf(fullName));
  if (!named && !card.first && !card.last && !card.company && fullName) card.company = fullName;
  for (const kind of FIELD_ORDER) {
    if (lists[kind].length > 0) card[FIELD_KINDS[kind].key] = lists[kind];
  }
  if (addresses.length > 0) card.addresses = addresses;
  const empty =
    addresses.length === 0 &&
    !card.first &&
    !card.last &&
    !card.company &&
    !card.note &&
    !card.user &&
    !card.birthday &&
    !card.nickname &&
    !card.jobTitle &&
    !card.department &&
    !card.phoneticFirst &&
    !card.phoneticLast &&
    FIELD_ORDER.every((kind) => lists[kind].length === 0);
  if (empty) return null;
  const read: ImportedCard = photo ? { card, photo } : { card };
  if (hadPhoto) read.hadPhoto = true;
  return read;
}

/** The cards of a vCard file (2.1, 3.0 or 4.0), in order; cards with nothing in them are left out. */
export function parseVCards(text: string): ImportedCard[] {
  const cards: ImportedCard[] = [];
  let current: Property[] | null = null;
  for (const line of unfold(text)) {
    const property = readLine(line);
    if (!property) continue;
    if (property.name === "BEGIN" && property.value.trim().toUpperCase() === "VCARD") {
      current = [];
    } else if (property.name === "END" && property.value.trim().toUpperCase() === "VCARD") {
      const card = current ? cardOf(current) : null;
      if (card) cards.push(card);
      current = null;
    } else if (current) {
      current.push(property);
    }
  }
  return cards;
}
