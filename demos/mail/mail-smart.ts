import type { MailboxId, MailMessage, SmartMailboxId } from "./mail-data";

/** What a condition of a Smart Mailbox looks at. */
export type SmartField =
  | "from"
  | "to"
  | "cc"
  | "subject"
  | "body"
  | "message"
  | "flagged"
  | "unread"
  | "attachments"
  | "mailbox"
  | "received";

/** How a condition compares; which apply depends on the field (`TESTS_OF`). */
export type SmartTest =
  | "contains"
  | "lacks"
  | "begins"
  | "ends"
  | "equals"
  | "yes"
  | "no"
  | "is"
  | "not"
  | "within"
  | "older";

/** One condition: the words, the mailbox's id or the number of days are in `value`. */
export interface SmartRule {
  field: SmartField;
  test: SmartTest;
  value: string;
}

/**
 * A mailbox that holds no message of its own: it lists those that meet its conditions, wherever they
 * are. The Trash and Sent only when it says so, as in Mail. Junk and Drafts are left out too, unless
 * it was saved from a search that looked through them, which is the only thing that sets these.
 */
export interface SmartMailbox {
  id: SmartMailboxId;
  name: string;
  /** Every condition must hold, or any one. */
  matchAll: boolean;
  rules: readonly SmartRule[];
  includeTrash: boolean;
  includeSent: boolean;
  includeJunk?: boolean;
  includeDrafts?: boolean;
}

export const SMART_FIELDS: readonly (readonly [SmartField, string])[] = [
  ["from", "From"],
  ["to", "To"],
  ["cc", "Cc"],
  ["subject", "Subject"],
  ["body", "Message Content"],
  ["message", "Entire Message"],
  ["flagged", "Message is Flagged"],
  ["unread", "Message is Unread"],
  ["attachments", "Contains Attachments"],
  ["mailbox", "Message is in Mailbox"],
  ["received", "Date Received"],
];

const TEXT_TESTS: readonly (readonly [SmartTest, string])[] = [
  ["contains", "contains"],
  ["lacks", "does not contain"],
  ["begins", "begins with"],
  ["ends", "ends with"],
  ["equals", "is equal to"],
];
const YES_NO: readonly (readonly [SmartTest, string])[] = [
  ["yes", "is true"],
  ["no", "is false"],
];

/** The tests a field offers, in the order of the pop-up. */
export const TESTS_OF: Readonly<Record<SmartField, readonly (readonly [SmartTest, string])[]>> = {
  from: TEXT_TESTS,
  to: TEXT_TESTS,
  cc: TEXT_TESTS,
  subject: TEXT_TESTS,
  body: TEXT_TESTS,
  message: TEXT_TESTS,
  flagged: YES_NO,
  unread: YES_NO,
  attachments: YES_NO,
  mailbox: [
    ["is", "is"],
    ["not", "is not"],
  ],
  received: [
    ["within", "is in the last"],
    ["older", "is not in the last"],
  ],
};

/** What a condition needs written beside its test. */
export const valueKind = (field: SmartField): "text" | "none" | "mailbox" | "days" =>
  field === "flagged" || field === "unread" || field === "attachments"
    ? "none"
    : field === "mailbox"
      ? "mailbox"
      : field === "received"
        ? "days"
        : "text";

/** A new condition on `field`: its first test, and a value that says something where one is needed. */
export function ruleFor(field: SmartField): SmartRule {
  const kind = valueKind(field);
  return {
    field,
    test: TESTS_OF[field][0]?.[0] ?? "contains",
    value: kind === "mailbox" ? "inbox" : kind === "days" ? "7" : "",
  };
}

/** Whether a condition can be kept: words or a whole number of days are written where needed. */
export function ruleComplete(rule: SmartRule): boolean {
  const kind = valueKind(rule.field);
  if (kind === "text") return rule.value.trim() !== "";
  if (kind === "days") return /^\d{1,5}$/.test(rule.value.trim()) && Number(rule.value) > 0;
  return true;
}

const DAY_MS = 86_400_000;

/** A person as they can be named: the text as written, and each part of `Name <address>`. */
const namesOf = (written: string): string[] => {
  const parts = /^(.*)<([^<>]+)>\s*$/.exec(written);
  return parts ? [written, parts[1] as string, parts[2] as string] : [written];
};

/** The texts a condition reads of a message: for a field of people, one for each way to name one. */
const textsOf = (message: MailMessage, field: SmartField): readonly string[] => {
  if (field === "from") return [message.from, message.fromAddress ?? ""].flatMap(namesOf);
  if (field === "to") return [...message.to, ...(message.toAddresses ?? [])].flatMap(namesOf);
  if (field === "cc") return (message.cc ?? []).flatMap(namesOf);
  if (field === "subject") return [message.subject];
  if (field === "message") return [message.from, message.subject, message.body];
  return [message.body];
};

/** Of several texts one meeting the test is enough; "does not contain" holds of them all. */
function meetsText(texts: readonly string[], test: SmartTest, value: string): boolean {
  const wanted = value.trim().toLowerCase();
  const each = texts.map((text) => text.trim().toLowerCase());
  if (test === "lacks") return !each.some((text) => text.includes(wanted));
  if (test === "begins") return each.some((text) => text.startsWith(wanted));
  if (test === "ends") return each.some((text) => text.endsWith(wanted));
  if (test === "equals") return each.some((text) => text === wanted);
  return each.some((text) => text.includes(wanted));
}

function meetsRule(message: MailMessage, rule: SmartRule, now: number): boolean {
  const { field, test, value } = rule;
  if (field === "flagged") {
    const flagged = value === "" ? message.flag !== undefined : message.flag === value;
    return flagged === (test === "yes");
  }
  if (field === "unread") return (message.unread === true) === (test === "yes");
  if (field === "attachments") return (message.attachmentCount ?? 0) > 0 === (test === "yes");
  if (field === "mailbox") return (message.mailbox === value) === (test === "is");
  if (field === "received") {
    const within = now - message.time <= Number(value) * DAY_MS;
    return within === (test === "within");
  }
  return meetsText(textsOf(message, field), test, value);
}

/** Whether `message` meets every condition, or any one, `now` being what "the last days" count back from. */
export function meetsConditions(
  message: MailMessage,
  rules: readonly SmartRule[],
  matchAll: boolean,
  now: number,
): boolean {
  return matchAll
    ? rules.every((rule) => meetsRule(message, rule, now))
    : rules.some((rule) => meetsRule(message, rule, now));
}

/** Whether a Smart Mailbox lists `message`, `now` being what "the last days" count back from. */
export function inSmartMailbox(message: MailMessage, box: SmartMailbox, now: number): boolean {
  const where: MailboxId = message.mailbox;
  if (where === "junk" && !box.includeJunk) return false;
  if (where === "outbox") return false;
  if (where === "drafts" && !box.includeDrafts) return false;
  if (where === "trash" && !box.includeTrash) return false;
  if (where === "sent" && !box.includeSent) return false;
  if (box.rules.length === 0) return false;
  return meetsConditions(message, box.rules, box.matchAll, now);
}

/** One condition as stored, or `undefined` when it is not something Mail wrote. */
export const readSmartRule = (stored: unknown): SmartRule | undefined => {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { field, test, value } = stored as Partial<Record<keyof SmartRule, unknown>>;
  if (typeof value !== "string" || !SMART_FIELDS.some(([known]) => known === field)) {
    return undefined;
  }
  const asked = field as SmartField;
  if (!TESTS_OF[asked].some(([known]) => known === test)) return undefined;
  const rule = { field: asked, test: test as SmartTest, value };
  return ruleComplete(rule) ? rule : undefined;
};

/** The list as stored, leaving out whatever Mail did not write. */
export function readSmartMailboxes(stored: unknown): readonly SmartMailbox[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((each): SmartMailbox[] => {
    if (typeof each !== "object" || each === null) return [];
    const box = each as Partial<Record<keyof SmartMailbox, unknown>>;
    if (typeof box.id !== "string" || !box.id.startsWith("smart-")) return [];
    if (typeof box.name !== "string" || box.name.trim() === "") return [];
    if (!Array.isArray(box.rules)) return [];
    const rules = box.rules.map(readSmartRule);
    if (rules.length === 0 || rules.some((rule) => rule === undefined)) return [];
    return [
      {
        id: box.id as SmartMailboxId,
        name: box.name,
        matchAll: box.matchAll !== false,
        rules: rules as SmartRule[],
        includeTrash: box.includeTrash === true,
        includeSent: box.includeSent === true,
        ...(box.includeJunk === true ? { includeJunk: true } : {}),
        ...(box.includeDrafts === true ? { includeDrafts: true } : {}),
      },
    ];
  });
}
