import {
  addressLines,
  type Contact,
  type ContactAddress,
  type ContactField,
  type ContactGroup,
  desktopAddress,
  FIELD_KINDS,
  FIELD_ORDER,
  fold,
  nameParts,
} from "./contacts-data";

/** What the server takes on one card: more than this and it refuses every card. */
const MAX_FIELDS = 50;
const MAX_NOTE_CHARS = 5000;

/**
 * What makes two entries the same: a phone number's digits, an email address whatever its case, and
 * anything else as it is written. Accents and the case of a web address can make a different value.
 */
const entryKey = (kind: string, value: string) => {
  const text = value.trim();
  if (kind === "phone") {
    return /\p{L}/u.test(text) ? text : text.replace(/\P{Nd}/gu, "") || text;
  }
  return kind === "email" ? text.toLowerCase() : text;
};
const addressKey = (address: ContactAddress) => addressLines(address).join("\n");

const SINGLE_FIELDS = [
  "first",
  "last",
  "company",
  "phoneticFirst",
  "phoneticLast",
  "nickname",
  "jobTitle",
  "department",
  "ringtone",
  "textTone",
  "birthday",
] as const;

const FIELD_NAMES: Readonly<Record<(typeof SINGLE_FIELDS)[number], string>> = {
  first: "First name",
  last: "Last name",
  company: "Company",
  phoneticFirst: "Phonetic first name",
  phoneticLast: "Phonetic last name",
  nickname: "Nickname",
  jobTitle: "Job title",
  department: "Department",
  ringtone: "Ringtone",
  textTone: "Text tone",
  birthday: "Birthday",
};

function uniqueEntries(kind: string, fields: readonly ContactField[]): ContactField[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = entryKey(kind, field.value);
    if (key === "" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueAddresses(addresses: readonly ContactAddress[]): ContactAddress[] {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = addressKey(address);
    if (key === "" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The card that stays when `cards` merge: the person's own, else the first with a picture, else the
 * first.
 */
export function keeperOf<Card extends Pick<Contact, "me" | "image">>(
  cards: readonly Card[],
): Card | undefined {
  return cards.find((card) => card.me) ?? cards.find((card) => card.image) ?? cards[0];
}

/**
 * Everything `cards` hold, on the keeper's card: its own values first, a value it lacks from the
 * next card that has one, every different phone number, address and other entry, and each different
 * note. A second value of a single field goes in the note. A desktop account only another card names
 * stays as that card's address, so the person can still be reached. One picture stays, the keeper's
 * or else the first another card has (`picture` names that card, whose picture the owner moves, as a
 * picture is kept by its card's id), and `spare` names the cards whose picture no card keeps. What
 * would pass what the server takes on one card (50 entries of a kind, 5,000 characters of note) is
 * named in `left`: such cards are not to be merged, or it would be lost.
 */
export function mergeCards(cards: readonly Contact[]): {
  card: Contact;
  left: readonly string[];
  picture?: Contact;
  spare: readonly Contact[];
} {
  const keeper = keeperOf(cards);
  if (!keeper) throw new Error("mergeCards needs a card");
  const order = [keeper, ...cards.filter((card) => card !== keeper)];
  const card: Contact = { ...keeper };
  const left: string[] = [];
  const kept: string[] = [];
  for (const field of SINGLE_FIELDS) {
    const values = order.map((each) => each[field]?.trim()).filter((each) => !!each);
    const [value, ...others] = [...new Set(values)];
    if (value !== undefined) card[field] = value;
    // A second value of a field that holds one goes in the note, so the merge loses nothing.
    for (const other of others) kept.push(`${FIELD_NAMES[field]}: ${other}`);
  }
  const pictured = order.filter((each) => each.image);
  const picture = keeper.image ? undefined : pictured[0];
  const spare = pictured.filter((each) => each !== keeper && each !== picture);
  card.isCompany = order.some((each) => each.isCompany) || undefined;
  card.user = order.map((each) => each.user).find(Boolean);
  for (const kind of FIELD_ORDER) {
    const { key } = FIELD_KINDS[kind];
    const given = order.flatMap((each) => {
      const fields = each[key] ?? [];
      return kind === "email" && each.user && each.user !== card.user
        ? [...fields, { label: "desktop", value: desktopAddress(each.user) }]
        : fields;
    });
    const entries = uniqueEntries(kind, given);
    for (const { value } of entries.slice(MAX_FIELDS)) left.push(value);
    if (entries.length > 0) card[key] = entries.slice(0, MAX_FIELDS);
  }
  const addresses = uniqueAddresses(order.flatMap((each) => each.addresses ?? []));
  for (const address of addresses.slice(MAX_FIELDS)) left.push(addressLines(address).join(", "));
  if (addresses.length > 0) card.addresses = addresses.slice(0, MAX_FIELDS);
  const notes = [
    ...new Set([
      ...order.map((each) => each.note?.trim()).filter((note): note is string => !!note),
      ...kept,
    ]),
  ];
  let note = "";
  for (const each of notes) {
    const next = note ? `${note}\n\n${each}` : each;
    if ([...next].length > MAX_NOTE_CHARS) left.push(each);
    else note = next;
  }
  if (note) card.note = note;
  return { card, left, picture, spare };
}

/** The list of cards with `card` in place of itself and without the cards `gone`. */
export const withMergedCard = (
  contacts: readonly Contact[],
  card: Contact,
  gone: ReadonlySet<string>,
): Contact[] =>
  contacts
    .filter((contact) => !gone.has(contact.id))
    .map((contact) => (contact.id === card.id ? card : contact));

/**
 * The groups with the card `keeper` beside each of the cards `gone`. Written before the cards change,
 * so a failure can only leave an id that names no card, which a group ignores when it is read, and
 * never a group without the card that stays.
 */
export const withKeeperInGroups = (
  groups: readonly ContactGroup[],
  keeper: string,
  gone: ReadonlySet<string>,
): readonly ContactGroup[] =>
  groups.map((group) =>
    group.members.some((id) => gone.has(id)) && !group.members.includes(keeper)
      ? { ...group, members: [...group.members, keeper] }
      : group,
  );

/** What Look for Duplicates finds. */
export interface Duplicates {
  /** Cards that have one name. */
  sets: readonly (readonly Contact[])[];
  /** Cards holding the same entry more than once, and not in a set. */
  entries: readonly Contact[];
  /** How many entries any card repeats, in a set or not. */
  entryCount: number;
}

function repeatedEntries(card: Contact): number {
  let repeats = 0;
  for (const kind of FIELD_ORDER) {
    const fields = card[FIELD_KINDS[kind].key] ?? [];
    repeats += fields.length - uniqueEntries(kind, fields).length;
  }
  const addresses = card.addresses ?? [];
  return repeats + addresses.length - uniqueAddresses(addresses).length;
}

/**
 * Cards with the same name, ignoring case and accents, and entries a card holds twice. A card with no
 * name is never the same as another: nothing says they are one person.
 */
export function findDuplicates(contacts: readonly Contact[]): Duplicates {
  const byName = new Map<string, Contact[]>();
  for (const card of contacts) {
    const parts = nameParts(card).map((part) => fold(part.trim()));
    if (parts.every((part) => part === "")) continue;
    // The parts stay apart: Ann Able and Anna Ble are different people.
    const key = JSON.stringify(parts);
    byName.set(key, [...(byName.get(key) ?? []), card]);
  }
  const sets = [...byName.values()].filter((set) => set.length > 1);
  const inSet = new Set(sets.flat().map((card) => card.id));
  const entries = contacts.filter((card) => !inSet.has(card.id) && repeatedEntries(card) > 0);
  return {
    sets,
    entries,
    entryCount: contacts.reduce((count, card) => count + repeatedEntries(card), 0),
  };
}

/** `card` without an entry it holds twice: the first of each stays. */
export function withoutRepeats(card: Contact): Contact {
  const next: Contact = { ...card };
  for (const kind of FIELD_ORDER) {
    const { key } = FIELD_KINDS[kind];
    const fields = card[key];
    if (fields) next[key] = uniqueEntries(kind, fields);
  }
  if (card.addresses) next.addresses = uniqueAddresses(card.addresses);
  return next;
}
