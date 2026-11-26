import {
  ADD_FIELDS,
  ADDRESS_FORMATS,
  type AddableField,
  type AddressFormat,
  addressLines,
  type Contact,
  displayName,
  labelOf,
} from "./contacts-data";

/** A card as File > Print hands it to the browser: its name, company, and every field with a label. */
export function cardPrintLines(contact: Contact): readonly string[] {
  const fields = [
    ...(contact.phones ?? []),
    ...(contact.emails ?? []),
    ...(contact.urls ?? []),
    ...(contact.ims ?? []),
    ...(contact.relatedNames ?? []),
    ...(contact.dates ?? []),
    ...(contact.socials ?? []),
    ...(contact.addresses ?? []).map((address) => ({
      label: labelOf(address),
      value: addressLines(address).join(", "),
    })),
  ];
  const heads = [contact.jobTitle, contact.department].filter((line): line is string => !!line);
  const phonetic = [contact.phoneticFirst, contact.phoneticLast]
    .filter((part) => part?.trim())
    .join(" ");
  return [
    ...(phonetic ? [phonetic] : []),
    displayName(contact),
    ...(contact.nickname ? [`\u201c${contact.nickname}\u201d`] : []),
    ...heads,
    ...(contact.company && !contact.isCompany ? [contact.company] : []),
    ...(fields.length ? [""] : []),
    ...fields.map((field) => `${field.label || "other"}: ${field.value}`),
  ];
}

/** The sort order a person chose in View > Sort By, as stored. */
export const CONTACTS_SORT = "contacts.sort";
export const readContactSort = (stored: unknown): "first" | "last" | undefined =>
  stored === "first" || stored === "last" ? stored : undefined;

/** Whether last names come first where a card is named, as stored. */
export const CONTACTS_NAME_ORDER = "contacts.nameOrder";

/** Preferences > General, Address Format, as stored. */
export const CONTACTS_ADDRESS_FORMAT = "contacts.addressFormat";
export const readAddressFormat = (stored: unknown): AddressFormat | undefined =>
  ADDRESS_FORMATS.find(([format]) => format === stored)?.[0];

/** Preferences > Phone, whether numbers are formatted, as stored. */
export const CONTACTS_PHONE_FORMAT = "contacts.phoneFormat";
/** Preferences > vCard, whether notes and pictures are written, as stored. */
export const CONTACTS_VCARD_NOTES = "contacts.vcardNotes";
export const CONTACTS_VCARD_PHOTOS = "contacts.vcardPhotos";
/** Preferences > vCard > Enable private me card: My Card's fields can each be kept out of a vCard. */
export const CONTACTS_PRIVATE_ME = "contacts.privateMe";
export const CONTACTS_VCARD_FORMAT = "contacts.vcardFormat";
export const CONTACTS_VCARD_ENCODING = "contacts.vcardEncoding";
/** Preferences > General > Default Account: where a card made outside an account's group goes. */
export const CONTACTS_DEFAULT_ACCOUNT = "contacts.defaultAccount";
/** Preferences > Accounts: the accounts turned off, whose cards stay on the server, not shown. */
export const CONTACTS_ACCOUNTS_OFF = "contacts.accountsOff";

export const readDefaultAccount = (stored: unknown): "icloud" | "mac" | undefined =>
  stored === "icloud" || stored === "mac" ? stored : undefined;
export const readAccountsOff = (stored: unknown): readonly ("icloud" | "mac")[] | undefined =>
  Array.isArray(stored)
    ? stored.filter((each): each is "icloud" | "mac" => readDefaultAccount(each) !== undefined)
    : undefined;
export const NO_ACCOUNTS_OFF: readonly ("icloud" | "mac")[] = [];

/** Preferences > vCard's format, as kept: 3.0 unless 2.1 was chosen. */
export const readVCardFormat = (stored: unknown): "3.0" | "2.1" =>
  stored === "2.1" ? "2.1" : "3.0";
/** Preferences > vCard's encoding of a 2.1 file, as kept: UTF-8 unless Windows Latin 1 was chosen. */
export const readVCardEncoding = (stored: unknown): "utf-8" | "windows-1252" =>
  stored === "windows-1252" ? "windows-1252" : "utf-8";
export const readBooleanSetting = (stored: unknown) =>
  typeof stored === "boolean" ? stored : undefined;

/** Preferences > Template, the fields a new card starts with besides the usual ones, as stored. */
export const CONTACTS_TEMPLATE = "contacts.template";
export const readTemplate = (stored: unknown): readonly AddableField[] =>
  Array.isArray(stored)
    ? ADD_FIELDS.flatMap(({ field }) => (stored.includes(field) ? [field] : []))
    : [];

/** The group shown and the card chosen when the window was last used, as stored. */
export const CONTACTS_GROUP_SHOWN = "contacts.groupShown";
export const CONTACTS_CARD_CHOSEN = "contacts.cardChosen";
export const readText = (stored: unknown) => (typeof stored === "string" ? stored : undefined);
