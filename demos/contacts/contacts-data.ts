/** Where a card is kept: the two accounts of the sidebar. */
export type ContactAccount = "icloud" | "mac";

/** What the sidebar can show: every card, or the cards of one account. */
export type ContactGroupId = "all" | ContactAccount;

/** The kinds of field a card holds any number of. */
export type ContactFieldKind = "phone" | "email" | "url" | "im" | "related" | "date" | "social";

/** What a card's buttons, badges and label menus can ask for. */
export type ContactAction =
  | "message"
  | "call"
  | "video"
  | "mail"
  | "open"
  | "spotlight"
  | "share"
  | "map"
  | "copy-label";

/** The four buttons under a card's name, which need a service set up on the Mac. */
export type ContactService = "message" | "call" | "video" | "mail";

/** One labelled value of a card: a phone number, an address. */
export interface ContactField {
  /**
   * The label before the value: "mobile", "work", or a label of the user's own. A string is
   * required; a blank one (`""`) is shown and kept as "other".
   */
  label: string;
  /** The value. A field without one is dropped when the card is done. */
  value: string;
  /** For an instant-messaging name: the service it belongs to. */
  service?: string;
  /** On My Card, kept out of a vCard while Preferences > vCard has the private me card on. */
  private?: boolean;
}

/** A postal address of a card. Its parts are `""` when they are not known. */
export interface ContactAddress {
  /** The label before it: "home", "work", or a label of the user's own. */
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/** One card. */
export interface Contact {
  /** Identifies the card: no two cards of a window have the same. */
  id: string;
  /** The account that keeps it. */
  account: ContactAccount;
  /** First name; `""` for none. */
  first: string;
  /** Last name: what a person is sorted by; `""` for none. */
  last: string;
  /** The company the person works for, or the company the card is for. */
  company?: string;
  /** The card is for the company: it is listed and titled by the company's name. */
  isCompany?: boolean;
  /** The card of the Mac's user, marked in the list. */
  me?: boolean;
  /** What the card shows as its picture: initials on a disc, or a silhouette. */
  picture?: "monogram" | "silhouette";
  /** Phone numbers. */
  phones?: readonly ContactField[];
  /** Email addresses. */
  emails?: readonly ContactField[];
  /** Web addresses. */
  urls?: readonly ContactField[];
  /** Instant-messaging names. */
  ims?: readonly ContactField[];
  /** People the card's person is related to; the label says how. */
  relatedNames?: readonly ContactField[];
  /** Dates, as typed, other than the birthday. */
  dates?: readonly ContactField[];
  /** Social profiles: the label is the service, the value the user name or the page's address. */
  socials?: readonly ContactField[];
  /** Postal addresses. */
  addresses?: readonly ContactAddress[];
  /** How the first name sounds. */
  phoneticFirst?: string;
  /** How the last name sounds. */
  phoneticLast?: string;
  /** What the person is called by. */
  nickname?: string;
  /** The person's job title. */
  jobTitle?: string;
  /** The department the person works in. */
  department?: string;
  /** The ringtone for the person's calls. */
  ringtone?: string;
  /** The sound for the person's messages. */
  textTone?: string;
  /** The birthday, as typed. */
  birthday?: string;
  /** Free text. */
  note?: string;
  /**
   * On the desktop served by Ferrite: the account name of the person on that desktop the card
   * is for (`"martin"`). Messages reaches them by it, and Mail at `martin@macalicious`. My Card
   * carries the signed-in person's own.
   */
  user?: string;
  /**
   * On the desktop served by Ferrite: the version of the card's own picture, which the server
   * keeps beside the cards. The card shows that picture in place of its monogram.
   */
  image?: string;
}

/** What chooses the cards of a smart group. */
export type SmartGroupRule = "desktop-user" | "contains" | "rules";

/** What a condition of a smart group looks at. */
export type SmartField =
  | "any"
  | "name"
  | "first"
  | "last"
  | "nickname"
  | "company"
  | "jobTitle"
  | "email"
  | "phone"
  | "address"
  | "url"
  | "birthday"
  | "note"
  | "user";

/** How a condition compares: `yes` and `no` for what a card simply is or is not. */
export type SmartTest = "contains" | "lacks" | "is" | "begins" | "ends" | "yes" | "no";

/** One condition of a smart group, as the rule builder writes it. */
export interface SmartCondition {
  field: SmartField;
  test: SmartTest;
  /** The text to compare with; empty for `yes` and `no`. */
  value: string;
}

/** The fields the rule builder offers, by what it calls them. */
export const SMART_FIELDS: readonly (readonly [SmartField, string])[] = [
  ["user", "Desktop User"],
  ["any", "Any Field"],
  ["name", "Name"],
  ["first", "First Name"],
  ["last", "Last Name"],
  ["nickname", "Nickname"],
  ["company", "Company"],
  ["jobTitle", "Job Title"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["url", "URL"],
  ["birthday", "Birthday"],
  ["note", "Note"],
];

/** The tests a field takes, by what the rule builder calls them. */
export const testsOf = (field: SmartField): readonly (readonly [SmartTest, string])[] =>
  field === "user"
    ? [
        ["yes", "is"],
        ["no", "is not"],
      ]
    : [
        ["contains", "contains"],
        ["lacks", "does not contain"],
        ["is", "is"],
        ["begins", "begins with"],
        ["ends", "ends with"],
      ];

/** A group of the sidebar whose cards a rule chooses, kept on the desktop served by Ferrite. */
export interface SmartGroup {
  /** Identifies the group: no two groups have the same. */
  id: string;
  /** What the sidebar calls it. */
  name: string;
  /**
   * `"desktop-user"`: the cards of people on the desktop, other than My Card; `"contains"`: the
   * cards whose names, company, note or any field's value contain `text`, as the search finds;
   * `"rules"`: the cards that meet all of `conditions`, or any one of them with `any`.
   */
  rule: SmartGroupRule;
  /** For `"contains"`: the text to find. */
  text?: string;
  /** For `"rules"`: what a card must meet. */
  conditions?: readonly SmartCondition[];
  /** For `"rules"`: any one condition is enough. */
  any?: boolean;
}

/** A group of the person's own: the cards they put in it, by id, kept on the served desktop. */
export interface ContactGroup {
  /** Identifies the group: no two groups have the same. */
  id: string;
  /** What the sidebar calls it. */
  name: string;
  /** The ids of its cards. An id whose card is gone holds nothing. */
  members: readonly string[];
}

/** The domain of a desktop user's address in Mail: `<account name>@macalicious`. */
export const DESKTOP_MAIL_DOMAIN = "macalicious";

/** The Mail address of the desktop user `user`. */
export const desktopAddress = (user: string) => `${user}@${DESKTOP_MAIL_DOMAIN}`;

/** An account name, as the desktop's accounts take it: lower case, starting with a letter. */
export const ACCOUNT_NAME = /^[a-z][a-z0-9._-]{0,31}$/;

/** The rows of the sidebar. A row with a `section` sits under that header. */
export const GROUPS: readonly { id: ContactGroupId; name: string; section?: string }[] = [
  { id: "all", name: "All Contacts" },
  { id: "icloud", name: "All iCloud", section: "iCloud" },
  { id: "mac", name: "All on My Mac", section: "On My Mac" },
];

/** The buttons under a card's name, in order. */
export const SERVICES: readonly ContactService[] = ["message", "call", "video", "mail"];

/**
 * What each kind of field is called, where a card keeps it, what its empty field says, the
 * labels its pop-up menu offers (a new field takes the first one no field has yet) and the
 * commands of its label's menu on a finished card.
 */
export const FIELD_KINDS: Readonly<
  Record<
    ContactFieldKind,
    {
      key: "phones" | "emails" | "urls" | "ims" | "relatedNames" | "dates" | "socials";
      name: string;
      placeholder: string;
      labels: readonly string[];
      actions: readonly { action: ContactAction; title: string }[];
      badge?: ContactAction;
    }
  >
> = {
  phone: {
    key: "phones",
    name: "phone",
    placeholder: "Phone",
    labels: ["mobile", "iPhone", "home", "work", "main", "other"],
    actions: [
      { action: "call", title: "Call" },
      { action: "message", title: "Send Message" },
      { action: "spotlight", title: "Search with Spotlight" },
    ],
    badge: "call",
  },
  email: {
    key: "emails",
    name: "email",
    placeholder: "Email",
    labels: ["home", "work", "other"],
    actions: [
      { action: "mail", title: "Send Email" },
      { action: "message", title: "Send Message" },
      { action: "spotlight", title: "Search with Spotlight" },
    ],
    badge: "mail",
  },
  url: {
    key: "urls",
    name: "URL",
    placeholder: "URL",
    labels: ["home page", "home", "work", "other"],
    actions: [
      { action: "open", title: "Open URL" },
      { action: "spotlight", title: "Search with Spotlight" },
    ],
  },
  im: {
    key: "ims",
    name: "user name",
    placeholder: "User Name",
    labels: ["home", "work", "other"],
    actions: [
      { action: "message", title: "Send Message" },
      { action: "spotlight", title: "Search with Spotlight" },
    ],
  },
  related: {
    key: "relatedNames",
    name: "related name",
    placeholder: "Name",
    labels: [
      "mother",
      "father",
      "parent",
      "brother",
      "sister",
      "child",
      "friend",
      "spouse",
      "partner",
      "assistant",
      "manager",
      "other",
    ],
    actions: [],
  },
  date: {
    key: "dates",
    name: "date",
    placeholder: "month/day/year",
    labels: ["anniversary", "other"],
    actions: [],
  },
  social: {
    key: "socials",
    name: "profile",
    placeholder: "User Name",
    labels: ["Twitter", "LinkedIn", "Facebook", "Flickr", "Myspace", "Sina Weibo"],
    actions: [{ action: "open", title: "View Profile" }],
  },
};

/** The kinds in the order a finished card lists them. */
export const FIELD_ORDER: readonly ContactFieldKind[] = [
  "phone",
  "email",
  "url",
  "im",
  "related",
  "date",
  "social",
];

/** The labels a postal address offers; a new one takes the first no address has yet. */
export const ADDRESS_LABELS: readonly string[] = ["home", "work", "other"];

/** The texts of a card that are one line each, shown only once they are added or filled in. */
export type ContactTextField =
  | "phoneticFirst"
  | "phoneticLast"
  | "nickname"
  | "jobTitle"
  | "department";

const TEXT_FIELDS: readonly ContactTextField[] = [
  "phoneticFirst",
  "phoneticLast",
  "nickname",
  "jobTitle",
  "department",
];

/** What Card > Add Field can add. */
export type AddableField = ContactTextField | "address" | "related" | "date" | "social";

/** The items of Card > Add Field. */
export const ADD_FIELDS: readonly { field: AddableField; title: string }[] = [
  { field: "phoneticFirst", title: "Phonetic First Name" },
  { field: "phoneticLast", title: "Phonetic Last Name" },
  { field: "nickname", title: "Nickname" },
  { field: "jobTitle", title: "Job Title" },
  { field: "department", title: "Department" },
  { field: "address", title: "Address" },
  { field: "related", title: "Related Name" },
  { field: "date", title: "Date" },
  { field: "social", title: "Social Profile" },
];

/** The card with `field` shown while it is edited: a field already there is left as it is. */
export function withField(contact: Contact, field: AddableField): Contact {
  if (field === "address") return { ...contact, addresses: contact.addresses ?? [] };
  if (field === "related" || field === "date" || field === "social") {
    const { key } = FIELD_KINDS[field];
    return { ...contact, [key]: contact[key] ?? [] };
  }
  return { ...contact, [field]: contact[field] ?? "" };
}

/** Whether a postal address has nothing in it but its label. */
export const addressIsEmpty = ({ street, city, state, zip, country }: ContactAddress) =>
  [street, city, state, zip, country].every((part) => part.trim() === "");

/** How a postal address is laid out: Contacts > Preferences > General, Address Format. */
export type AddressFormat = "us" | "uk" | "de";

/** The address formats the preference offers, by what it calls them. */
export const ADDRESS_FORMATS: readonly (readonly [AddressFormat, string])[] = [
  ["us", "United States"],
  ["uk", "United Kingdom"],
  ["de", "Germany"],
];

/**
 * A postal address as the lines of a label, in `format`: in the United States the street, then
 * city, state and ZIP; in the United Kingdom city and postcode each on a line; in Germany the
 * postcode before the city. The country comes last in each.
 */
export function addressLines(
  { street, city, state, zip, country }: ContactAddress,
  format: AddressFormat = "us",
): string[] {
  const [town, region, code] = [city.trim(), state.trim(), zip.trim()];
  const places =
    format === "uk"
      ? [town, region, code]
      : format === "de"
        ? [[code, town].filter(Boolean).join(" "), region]
        : [[[town, region].filter(Boolean).join(", "), code].filter(Boolean).join(" ")];
  return [street.trim(), ...places, country.trim()].filter(Boolean);
}

/**
 * A phone number as Contacts > Preferences > Phone formats it: ten digits as `(555) 010-0000`, and
 * eleven starting with 1 as `+1 (555) 010-0000`. Any other number stays as it was typed.
 */
export function formatPhone(typed: string): string {
  if (!/^[\d\s().+-]+$/.test(typed)) return typed;
  const digits = typed.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10 || (typed.trim().startsWith("+") && national === digits)) {
    return typed;
  }
  const local = `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  return national === digits ? local : `+1 ${local}`;
}

/** The label a new postal address takes. */
export const nextAddressLabel = (addresses: readonly ContactAddress[]) =>
  ADDRESS_LABELS.find((label) => addresses.every((each) => labelOf(each) !== label)) ?? "other";

const SOCIAL_SITES: Readonly<Record<string, string>> = {
  Twitter: "https://twitter.com/",
  LinkedIn: "https://www.linkedin.com/in/",
  Facebook: "https://www.facebook.com/",
  Flickr: "https://www.flickr.com/people/",
  Myspace: "https://myspace.com/",
  "Sina Weibo": "https://weibo.com/",
};

/** The page of a social profile: its value when that is an address, else the service's page. */
export function socialUrl(field: ContactField): string | undefined {
  const value = field.value.trim();
  if (/^https?:\/\//i.test(value)) return value;
  const site = SOCIAL_SITES[labelOf(field)];
  return site && value ? site + encodeURIComponent(value.replace(/^@/, "")) : undefined;
}

/** The ringtones a card can choose; the first is what a card without one has. */
export const RINGTONES: readonly string[] = ["Opening", "Apex", "Beacon", "Chimes", "Radar"];

/** The message sounds a card can choose; the first is what a card without one has. */
export const TEXT_TONES: readonly string[] = ["Note", "Aurora", "Bamboo", "Chord", "Tri-tone"];

/** The services of an instant-messaging name; the first is what a new name has. */
export const IM_SERVICES: readonly string[] = ["Jabber", "AIM", "ICQ", "Skype"];

/** The cards the window starts with: the two of the screenshots and six invented people. */
export const defaultContacts: readonly Contact[] = [
  {
    id: "apple",
    account: "mac",
    first: "",
    last: "",
    company: "Apple Inc.",
    isCompany: true,
    phones: [{ label: "main", value: "1-800-MY-APPLE" }],
    urls: [{ label: "home page", value: "http://www.apple.com" }],
  },
  {
    id: "stephen-hackett",
    account: "icloud",
    first: "Stephen",
    last: "Hackett",
    emails: [{ label: "work", value: "stephen@example.com" }],
  },
  {
    id: "ines-okafor",
    account: "icloud",
    first: "Ines",
    last: "Okafor",
    company: "Harbor Ferry",
    phones: [
      { label: "mobile", value: "(555) 010-0142" },
      { label: "work", value: "(555) 010-0170" },
    ],
    emails: [{ label: "work", value: "ines@harborferry.example" }],
    birthday: "March 14",
    note: "Runs the Saturday crossings.",
  },
  {
    id: "tomas-lindqvist",
    account: "icloud",
    first: "Tomas",
    last: "Lindqvist",
    phones: [{ label: "iPhone", value: "(555) 010-0118" }],
    emails: [{ label: "home", value: "tomas@lindqvist.example" }],
    ims: [{ label: "home", value: "tomas.l", service: "Jabber" }],
    ringtone: "Chimes",
  },
  {
    id: "mara-delgado",
    account: "mac",
    first: "Mara",
    last: "Delgado",
    company: "Tide Tables",
    phones: [{ label: "work", value: "(555) 010-0155" }],
    urls: [{ label: "home page", value: "https://tidetables.example" }],
  },
  {
    id: "jun-watanabe",
    account: "icloud",
    first: "Jun",
    last: "Watanabe",
    emails: [
      { label: "home", value: "jun@watanabe.example" },
      { label: "work", value: "jun.watanabe@islandpost.example" },
    ],
    note: "Prefers email.",
  },
  {
    id: "robin-vega",
    account: "mac",
    first: "Robin",
    last: "Vega",
    phones: [{ label: "mobile", value: "(555) 010-0199" }],
    emails: [{ label: "home", value: "robin@vega.example" }],
    birthday: "October 7",
  },
  {
    id: "island-post",
    account: "mac",
    first: "",
    last: "",
    company: "Island Post",
    isCompany: true,
    phones: [{ label: "main", value: "(555) 010-0100" }],
    emails: [{ label: "work", value: "desk@islandpost.example" }],
  },
];

/** A card's fields of one kind. */
export const fieldsOf = (contact: Contact, kind: ContactFieldKind): readonly ContactField[] =>
  contact[FIELD_KINDS[kind].key] ?? [];

/** The label a field is shown and kept with: its own, or "other" when it has none. */
export const labelOf = (field: ContactField | ContactAddress) => field.label.trim() || "other";

/** A person's names as one text, without the space around them; `""` for a card without any. */
const personName = (contact: Contact) => `${contact.first.trim()} ${contact.last.trim()}`.trim();

/** Whether the card is listed and titled by its company. */
const byCompany = (contact: Contact) =>
  !!contact.company?.trim() && (!!contact.isCompany || personName(contact) === "");

/**
 * A card's name in two parts: what comes before the name it is sorted by, and that name. A
 * person is sorted by the last name, a company by its own; a card without either has no name.
 * Names that are only spaces count as none.
 */
export function nameParts(contact: Contact): [lead: string, sort: string] {
  if (byCompany(contact)) return ["", contact.company?.trim() ?? ""];
  const first = contact.first.trim();
  const last = contact.last.trim();
  if (!last) return ["", first];
  return [first ? `${first} ` : "", last];
}

/** A card's name as one text; "No Name" for a card without one. */
export const displayName = (contact: Contact) => nameParts(contact).join("") || "No Name";

/**
 * A card's name as its row in the list shows it: what comes before the bold name, the name the list
 * is sorted by, in bold, and what comes after. A company or a person with one name is all bold.
 */
export function listNameParts(
  contact: Contact,
  sort: ContactSort,
  order: ContactNameOrder,
): [before: string, bold: string, after: string] {
  const [lead, last] = nameParts(contact);
  const first = lead.trim();
  if (!first) return ["", last, ""];
  const bold = sort === "first" ? first : last;
  const other = sort === "first" ? last : first;
  const boldFirst = (order === "first") === (sort === "first");
  return boldFirst ? ["", bold, ` ${other}`] : [`${other} `, bold, ""];
}

/** Which of a person's names comes first where a card is named: Display Last Name Before First. */
export type ContactNameOrder = "first" | "last";

/** A card's name in that order; a company or a person with one name reads as ever. */
export function displayNameIn(contact: Contact, order: ContactNameOrder): string {
  const [lead, sort] = nameParts(contact);
  return order === "last" && lead ? `${sort} ${lead.trim()}` : displayName(contact);
}

/**
 * What a finished card shows under its name: a person's company, or the person a company's
 * card names; `""` when there is neither.
 */
export const secondaryName = (contact: Contact) =>
  byCompany(contact) ? personName(contact) : (contact.company?.trim() ?? "");

/**
 * The letters on a card's picture: the first letters of a person's names; none for a company.
 * A letter is a whole code point, so a letter outside the basic plane is not cut in two.
 */
export const initialsOf = (contact: Contact) =>
  byCompany(contact)
    ? ""
    : [contact.first, contact.last]
        .map((name) => [...name.trim().normalize("NFC")][0] ?? "")
        .join("")
        .toUpperCase();

/** What the list is sorted by: View > Sort By. */
export type ContactSort = "last" | "first";

/**
 * The cards in the order of the list: by the name each is sorted by, then by the whole name. By
 * first name, a person goes by the first name and a company by its own.
 */
export const sortContacts = (contacts: readonly Contact[], by: ContactSort = "last"): Contact[] => {
  const key = (contact: Contact) =>
    by === "first" && contact.first.trim() && !byCompany(contact)
      ? contact.first.trim()
      : nameParts(contact)[1];
  return [...contacts].sort(
    (a, b) =>
      key(a).localeCompare(key(b), "en", { sensitivity: "base" }) ||
      displayName(a).localeCompare(displayName(b), "en", { sensitivity: "base" }),
  );
};

/** Whether a group of the sidebar holds the card. */
export const inGroup = (contact: Contact, group: ContactGroupId) =>
  group === "all" || contact.account === group;

/**
 * A text as the search compares it: without its accents and in lower case, so "ines" finds
 * "Inés" and "istanbul" finds "İstanbul". The folded text can be shorter or longer than the
 * text itself (the lower case of U+0130 is two characters), so it is only ever compared whole:
 * nothing is cut out of the original at a position found in the folded one.
 */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Every text the search looks through on a card. */
function textsOfCard(contact: Contact): (string | undefined)[] {
  const fields = FIELD_ORDER.flatMap((kind) => fieldsOf(contact, kind).map((field) => field.value));
  return [
    personName(contact),
    contact.company,
    contact.note,
    contact.user,
    ...TEXT_FIELDS.map((field) => contact[field]),
    ...(contact.addresses ?? []).map((address) => addressLines(address).join(" ")),
    ...fields,
  ];
}

/**
 * Whether the card's names, company, note or any field's value contain the text, whatever
 * the case and the accents. The text is taken as it is typed: a `.`, a `*` or a `(` is that
 * character and not a pattern.
 */
export function matches(contact: Contact, query: string) {
  const text = fold(query.trim());
  if (text === "") return true;
  return textsOfCard(contact).some((value) => value !== undefined && fold(value).includes(text));
}

/** What a condition of `field` compares with, on this card. */
function textsOfField(contact: Contact, field: SmartField): (string | undefined)[] {
  const values = (list: readonly ContactField[] | undefined) =>
    (list ?? []).map((each) => each.value);
  switch (field) {
    case "any":
      return textsOfCard(contact);
    case "name":
      return [personName(contact), contact.nickname];
    case "first":
      return [contact.first];
    case "last":
      return [contact.last];
    case "nickname":
      return [contact.nickname];
    case "company":
      return [contact.company];
    case "jobTitle":
      return [contact.jobTitle];
    case "email":
      return values(contact.emails);
    case "phone":
      return values(contact.phones);
    case "address":
      return (contact.addresses ?? []).map((address) => addressLines(address).join(" "));
    case "url":
      return values(contact.urls);
    case "birthday":
      return [contact.birthday];
    case "note":
      return [contact.note];
    case "user":
      return [contact.user];
  }
}

/** Whether the card meets one condition of a smart group. */
export function meetsCondition(contact: Contact, { field, test, value }: SmartCondition) {
  if (field === "user") return (Boolean(contact.user) && !contact.me) === (test === "yes");
  const wanted = fold(value.trim());
  const texts = textsOfField(contact, field).flatMap((text) => (text ? [fold(text.trim())] : []));
  if (test === "lacks") return !texts.some((text) => text.includes(wanted));
  if (test === "is") return texts.includes(wanted);
  if (test === "begins") return texts.some((text) => text.startsWith(wanted));
  if (test === "ends") return texts.some((text) => text.endsWith(wanted));
  return texts.some((text) => text.includes(wanted));
}

/** The rule builder's conditions for a group, whichever way it was made. */
export function conditionsOf(group: SmartGroup): readonly SmartCondition[] {
  if (group.rule === "rules") return group.conditions ?? [];
  return group.rule === "desktop-user"
    ? [{ field: "user", test: "yes", value: "" }]
    : [{ field: "any", test: "contains", value: group.text ?? "" }];
}

/** Whether the smart group's rule chooses the card. */
export const inSmartGroup = (contact: Contact, group: SmartGroup) => {
  if (group.rule === "desktop-user") return !!contact.user && !contact.me;
  if (group.rule === "contains") {
    return (group.text ?? "").trim() !== "" && matches(contact, group.text ?? "");
  }
  const conditions = group.conditions ?? [];
  if (conditions.length === 0) return false;
  return group.any
    ? conditions.some((each) => meetsCondition(contact, each))
    : conditions.every((each) => meetsCondition(contact, each));
};

/** The label a new field takes: the first of its kind's labels that no field has yet. */
export function nextLabel(kind: ContactFieldKind, fields: readonly ContactField[]) {
  const { labels } = FIELD_KINDS[kind];
  return (
    labels.find((label) => fields.every((field) => labelOf(field) !== label)) ?? labels[0] ?? ""
  );
}

/**
 * The card without the fields that hold nothing, with its texts trimmed and every field
 * under a label.
 */
export function tidy(contact: Contact): Contact {
  const next: Contact = {
    ...contact,
    first: contact.first.trim(),
    last: contact.last.trim(),
    company: contact.company?.trim() || undefined,
  };
  for (const kind of FIELD_ORDER) {
    const { key } = FIELD_KINDS[kind];
    const kept = fieldsOf(contact, kind)
      .map((field) => ({ ...field, label: labelOf(field), value: field.value.trim() }))
      .filter((field) => field.value !== "");
    next[key] = kept.length ? kept : undefined;
  }
  for (const field of TEXT_FIELDS) next[field] = contact[field]?.trim() || undefined;
  const addresses = (contact.addresses ?? []).filter((address) => !addressIsEmpty(address));
  next.addresses = addresses.length
    ? addresses.map((address) => ({ ...address, label: labelOf(address) }))
    : undefined;
  return next;
}

/**
 * My Card as a vCard shows it with the private me card on: without the fields marked private. Any
 * other card is whole.
 */
export function withoutPrivateFields(contact: Contact): Contact {
  if (!contact.me) return contact;
  const open = (fields: readonly ContactField[] | undefined) =>
    fields?.filter((field) => !field.private);
  return {
    ...contact,
    phones: open(contact.phones),
    emails: open(contact.emails),
    urls: open(contact.urls),
    ims: open(contact.ims),
  };
}

/** Whether a value of a card is an email address. */
export const isEmailValue = (text: string) => /^[^\s@]+@[^\s@]+$/.test(text.trim());

/**
 * A new card's fields for a value chosen on another card (Add to > New Card): an email address, a
 * web address or a telephone number goes in that field, and anything else in the note.
 */
export function fieldsOfValue(text: string): Partial<Contact> {
  const value = text.trim();
  if (isEmailValue(value)) return { emails: [{ label: "work", value }] };
  if (/^(https?:\/\/|www\.)\S+$/i.test(value)) return { urls: [{ label: "home page", value }] };
  if (/^\+?[\d\s().-]{5,}$/.test(value) && /\d{3}/.test(value.replace(/\D/g, ""))) {
    return { phones: [{ label: "mobile", value }] };
  }
  return { note: value };
}

/**
 * What a card can reach each service at: a phone number to call, a phone number or an email
 * address for a message or a video call, an email address for mail. A card for a desktop user
 * is reached on the desktop: a message goes to the account name and mail to its desktop
 * address. `undefined` when the card has nothing for it.
 */
export function addressFor(contact: Contact, service: ContactService): string | undefined {
  const phone = contact.phones?.find((field) => field.value !== "")?.value;
  const email = contact.emails?.find((field) => field.value !== "")?.value;
  if (contact.user && service === "message") return contact.user;
  if (contact.user && service === "mail") return desktopAddress(contact.user);
  if (contact.user && (service === "call" || service === "video")) return contact.user;
  if (service === "call") return phone;
  if (service === "mail") return email;
  return phone ?? email;
}

/** A signed-in person, as the desktop's accounts name them. */
export interface DesktopAccount {
  /** The account name, lower case. */
  name: string;
  /** The full name the login window shows. */
  fullName: string;
  /** Whether this is the Guest User, who has no account name to be reached by. */
  guest: boolean;
}

/** A full name as a card's two names: the first word, and the rest. */
export function namesOf(fullName: string): { first: string; last: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: words[0] ?? "", last: words.slice(1).join(" ") };
}

/** The id My Card is given when the desktop makes it. */
export const MY_CARD_ID = "my-card";

/**
 * The cards with card `id` as the person's own: Card > Make This My Card. The card that was their
 * own stays as a card like any other, and the account name moves with the mark, since the desktop
 * lets only My Card carry the signed-in account.
 */
export function withThisAsMine(cards: readonly Contact[], id: string): readonly Contact[] {
  const mine = cards.find((card) => card.me);
  return cards.map((card) => {
    if (card.id === id) return { ...card, me: true, ...(mine?.user ? { user: mine.user } : {}) };
    if (!card.me) return card;
    const { me: _me, user: _user, ...rest } = card;
    return rest;
  });
}

/**
 * The cards with the signed-in person's own card among them: My Card is added, made from the
 * account's full name, when no card is the person's, and it carries the account name (the
 * Guest User's carries none). Nothing else changes; the same list comes back when nothing had
 * to.
 */
export function withMyCard(cards: readonly Contact[], account: DesktopAccount): readonly Contact[] {
  const user = account.guest ? undefined : account.name;
  const mine = cards.find((card) => card.me);
  if (mine) {
    if (mine.user === user) return cards;
    return cards.map((card) => {
      if (card !== mine) return card;
      const { user: _old, ...rest } = card;
      return user ? { ...rest, user } : rest;
    });
  }
  let id = MY_CARD_ID;
  for (let n = 2; cards.some((card) => card.id === id); n += 1) id = `${MY_CARD_ID}-${n}`;
  const card: Contact = {
    id,
    account: "icloud",
    ...namesOf(account.fullName),
    me: true,
    ...(user ? { user } : {}),
  };
  return [card, ...cards];
}
