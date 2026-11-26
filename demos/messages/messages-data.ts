/** One message of a conversation. */
export interface MessagesMessage {
  /** Identifies the message within its conversation. */
  id: string;
  /** Who wrote it: the user of the window, or the other party. */
  from: "me" | "them";
  /** Its text. */
  text: string;
  /**
   * When it was sent, in local time, as `YYYY-MM-DDTHH:mm`. Text that is not such a stamp
   * counts as the start of 1970: the message is the oldest there is.
   */
  at: string;
  /**
   * The message was refused and never arrived: the transcript says Not Delivered under it, and
   * Delivered stands under the last sent message that is not refused.
   */
  undelivered?: boolean;
  /**
   * The message is on its way and nothing has confirmed it yet: no status stands under it, and
   * Delivered stays under the last sent message that arrived.
   */
  pending?: boolean;
  /**
   * The writer's name over a received bubble, as in a group conversation, where it is not
   * the conversation's name.
   */
  sender?: string;
  /**
   * The status under the last message sent, in place of Delivered: "Read 3:41 PM" when the
   * other person sends read receipts.
   */
  status?: string;
}

/** What the View menu sets: whether the list shows, and whose conversations it lists. */
export interface MessagesView {
  listHidden: boolean;
  senders: "all" | "unknown";
}

export const DEFAULT_VIEW: MessagesView = { listHidden: false, senders: "all" };

/** One conversation: a person and the messages exchanged with them, oldest first. */
export interface MessagesConversation {
  /** Identifies the conversation. Of two conversations with one `id` the first is kept. */
  id: string;
  /** Nobody else in it is in the person's contacts: View > Unknown Senders lists it. */
  unknown?: boolean;
  /**
   * The other party's name. Empty in a conversation that has no recipient yet: its row reads
   * "New Message", the recipient is typed in the bar over the transcript, and nothing is sent
   * until there is one.
   */
  name: string;
  /**
   * The service the messages go through: it names the transcript and the field, and tints
   * what is sent blue or green.
   * @default "imessage"
   */
  service?: "imessage" | "sms";
  /** The messages, oldest first. */
  messages: readonly MessagesMessage[];
  /** Do Not Disturb is on for the conversation: a mark in its row, and nothing else here. */
  muted?: boolean;
  /** The conversation has messages its user has not read: a dot before its row. */
  unread?: boolean;
  /** Who its row's picture shows: the other people, with the picture of their contact card if any. */
  people?: readonly { name: string; image?: string }[];
}

/** What the Preferences window holds. Text size is the one setting the window acts on. */
export interface MessagesSettings {
  /**
   * General, Keep messages: one of `KEEP_CHOICES`. This and the three other choices take any
   * text: one that is not among the choices is listed after them, so that the button shows it.
   */
  keep: string;
  /** General, Save history when conversations are closed. */
  saveHistory: boolean;
  /** General, Notify me about messages from unknown contacts. */
  notifyUnknown: boolean;
  /** General, Notify me when my name is mentioned. */
  notifyMention: boolean;
  /** General, Play sound effects. */
  playSounds: boolean;
  /** General, Message received sound: one of `SOUND_CHOICES`. */
  sound: string;
  /** General, Save received files to: one of `FOLDER_CHOICES`. */
  saveTo: string;
  /**
   * General, Text size: a step from 0 to 6; 3 is the transcript's 13 pt. Another number is
   * taken as the nearest step, and one that is not a number as step 3.
   */
  textSize: number;
  /** iMessage, Enable Messages in iCloud. */
  iCloud: boolean;
  /** iMessage, the addresses the user can be reached at, by address. */
  reachable: Readonly<Record<string, boolean>>;
  /** iMessage, Send read receipts. */
  readReceipts: boolean;
  /** iMessage, Start new conversations from: one of `ADDRESSES`. */
  startFrom: string;
}

/** The choices of the three pop-up buttons of the General pane; the first is the captured one. */
export const KEEP_CHOICES: readonly string[] = ["Forever", "One Year", "30 Days"];
export const SOUND_CHOICES: readonly string[] = [
  "Note (Default)",
  "Bell",
  "Chime",
  "Glass",
  "Marimba",
  "Woodblock",
];
export const FOLDER_CHOICES: readonly string[] = ["Downloads", "Desktop", "Documents"];

/** The invented account of the iMessage pane and the addresses it can be reached at. */
export const ACCOUNT = "robin.vega@example.com";
export const ADDRESSES: readonly string[] = ["+1 (555) 010-0142", ACCOUNT];

/** The settings as captured: the General pane of both reference screenshots. */
export const DEFAULT_SETTINGS: MessagesSettings = {
  keep: "Forever",
  saveHistory: false,
  notifyUnknown: true,
  notifyMention: false,
  playSounds: true,
  sound: "Note (Default)",
  saveTo: "Downloads",
  textSize: 3,
  iCloud: true,
  reachable: { "+1 (555) 010-0142": true, [ACCOUNT]: true },
  readReceipts: false,
  startFrom: "+1 (555) 010-0142",
};

/** The transcript's text for each step of the Text size slider, in points; step 3 is 13 pt. */
export const TEXT_SIZES: readonly number[] = [10, 11, 12, 13, 14, 15, 16];

/** The step the Text size slider is on in the captures. */
export const DEFAULT_TEXT_SIZE = 3;

/** The step of the Text size slider a setting stands for: a whole number from 0 to 6. */
export function textSizeStep(textSize: number): number {
  if (!Number.isFinite(textSize)) return DEFAULT_TEXT_SIZE;
  return Math.min(TEXT_SIZES.length - 1, Math.max(0, Math.round(textSize)));
}

/** The choices of a pop-up button with the one that is set, also when it is not among them. */
export const choicesWith = (choices: readonly string[], value: string): readonly string[] =>
  choices.includes(value) ? choices : [...choices, value];

/**
 * The moment the window takes as the present unless it is given another: the minute of the
 * last message of the default conversations, which is when the Aqua capture was taken.
 */
export const DEFAULT_NOW = "2019-10-07T15:27";

/**
 * The conversations the window starts with. The first is the one in the reference
 * screenshots, whose two messages are the captured ones; the people are invented.
 */
export const defaultConversations: readonly MessagesConversation[] = [
  {
    id: "ines",
    name: "Ines Lindqvist",
    messages: [
      {
        id: "ines-1",
        from: "me",
        text: "Can you believe another year has gone by?!",
        at: "2019-10-07T15:26",
      },
      { id: "ines-2", from: "them", text: "New macOS, who dis?", at: "2019-10-07T15:27" },
    ],
  },
  {
    id: "otis",
    name: "Otis Brandt",
    messages: [
      {
        id: "otis-1",
        from: "them",
        text: "Are we still on for the ferry on Saturday?",
        at: "2019-10-06T18:02",
      },
      {
        id: "otis-2",
        from: "me",
        text: "Yes! The 8:40 crossing. I booked two seats.",
        at: "2019-10-06T18:05",
      },
      {
        id: "otis-3",
        from: "me",
        text: "Bring a jacket, the deck is windy.",
        at: "2019-10-06T18:05",
      },
      {
        id: "otis-4",
        from: "them",
        text: "Perfect. I'll bring the coffee.",
        at: "2019-10-06T18:07",
      },
    ],
  },
  {
    id: "mara",
    name: "Mara Okafor",
    messages: [
      { id: "mara-1", from: "them", text: "Did you finish the book?", at: "2019-10-04T09:12" },
      {
        id: "mara-2",
        from: "me",
        text: "Two chapters to go. No spoilers!",
        at: "2019-10-04T09:20",
      },
      {
        id: "mara-3",
        from: "them",
        text: "Then I won't say a word about the lighthouse.",
        at: "2019-10-04T12:41",
      },
    ],
  },
  {
    id: "tomas",
    name: "Tomas Reyes",
    messages: [
      {
        id: "tomas-1",
        from: "me",
        text: "Thanks for the lift to the station.",
        at: "2019-09-28T20:15",
      },
      { id: "tomas-2", from: "them", text: "Any time. Safe travels!", at: "2019-09-28T20:31" },
    ],
  },
  {
    id: "ferry",
    name: "Harbor Ferry",
    service: "sms",
    messages: [
      {
        id: "ferry-1",
        from: "them",
        text: "Your booking for the 8:40 AM crossing on Saturday is confirmed: two foot passengers.",
        at: "2019-09-20T07:00",
      },
      { id: "ferry-2", from: "me", text: "Thank you!", at: "2019-09-20T07:04" },
    ],
  },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Moment = { year: number; month: number; day: number; hour: number; minute: number };

// A stamp is read as it is written, without a time zone: 15:27 is 3:27 PM wherever the page
// is shown. Text that is not a stamp counts as the start of 1970.
function read(stamp: string): Moment {
  if (!isStamp(stamp)) return { year: 1970, month: 1, day: 1, hour: 0, minute: 0 };
  const [year = 1970, month = 1, day = 1, hour = 0, minute = 0] = (stamp.match(/\d+/g) ?? []).map(
    Number,
  );
  return { year, month, day, hour, minute };
}

/** Midnight of a day, in UTC. A year is taken as written: `Date.UTC` reads 0 to 99 as 19xx. */
function midnight(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

const dayNumber = ({ year, month, day }: Moment) =>
  Math.round(midnight(year, month, day).getTime() / 86_400_000);

const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Whether text starts with a stamp, `YYYY-MM-DDTHH:mm`, of a day and a minute there are. */
export function isStamp(text: string): boolean {
  const found = STAMP.exec(text);
  if (!found) return false;
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0] = found.slice(1).map(Number);
  const date = midnight(year, month, day);
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day && hour < 24 && minute < 60;
}

/**
 * The present a window is given, as a stamp of 16 characters: text that is not a stamp (an
 * empty string, a date without a time, a day there is not) counts as `DEFAULT_NOW`, so that
 * every time is still written against a real moment and a message that is sent carries one.
 */
export const presentOf = (now: string): string => (isStamp(now) ? now.slice(0, 16) : DEFAULT_NOW);

/** The stamp of a `Date`, in its local time: `YYYY-MM-DDTHH:mm`. */
export function stampOf(date: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** Minutes from one stamp to a later one. */
export function minutesBetween(from: string, to: string): number {
  const a = read(from);
  const b = read(to);
  return (dayNumber(b) - dayNumber(a)) * 1440 + (b.hour - a.hour) * 60 + (b.minute - a.minute);
}

/** The time of day of a stamp, as Messages writes it: "3:27 PM". */
export function clockOf(stamp: string): string {
  const { hour, minute } = read(stamp);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * When a conversation was last heard from, as its row says it: the time on the same day as
 * `now`, "Yesterday", the weekday up to six days back, otherwise the date ("9/28/19").
 */
export function listTime(stamp: string, now: string): string {
  const then = read(stamp);
  const days = dayNumber(read(now)) - dayNumber(then);
  if (days === 0) return clockOf(stamp);
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return WEEKDAYS[(((dayNumber(then) + 4) % 7) + 7) % 7] ?? "";
  return `${then.month}/${then.day}/${String(then.year % 100).padStart(2, "0")}`;
}

/**
 * When a run of messages was exchanged, as the transcript's header says it: "Today, 3:26 PM",
 * "Yesterday, 3:26 PM", "Friday, 9:12 AM", otherwise "Sep 28, 2019, 8:15 PM".
 */
export function transcriptTime(stamp: string, now: string): string {
  const then = read(stamp);
  const days = dayNumber(read(now)) - dayNumber(then);
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Yesterday"
        : days > 1 && days < 7
          ? WEEKDAYS[(((dayNumber(then) + 4) % 7) + 7) % 7]
          : `${MONTHS[then.month - 1] ?? ""} ${then.day}, ${then.year}`;
  return `${day}, ${clockOf(stamp)}`;
}

/** The last message of a conversation, if it has one. */
export const lastMessage = (conversation: MessagesConversation): MessagesMessage | undefined =>
  conversation.messages[conversation.messages.length - 1];

/**
 * Text as a search compares it: without regard to case or to accents, as the search fields of
 * macOS do. The letters are taken apart from their marks first, so a capital whose lowercase
 * form is longer than itself (U+0130, a dotted capital I, becomes an i and a mark) is the
 * plain letter here. Nothing is cut out of the original text by a position in the folded one.
 */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

/**
 * The window's conversations, the ones whose recipient can still be typed, and what is typed
 * and not sent, without a conversation that was started and is given up: it leaves the list,
 * and what was typed into it goes with it.
 */
export function abandon<C extends { readonly id: string }>(
  drafts: {
    conversations: readonly C[];
    unnamed: ReadonlySet<string>;
    texts: ReadonlyMap<string, string>;
  },
  id: string,
): { conversations: C[]; unnamed: Set<string>; texts: Map<string, string> } {
  const texts = new Map(drafts.texts);
  texts.delete(id);
  return {
    conversations: drafts.conversations.filter((conversation) => conversation.id !== id),
    unnamed: new Set([...drafts.unnamed].filter((other) => other !== id)),
    texts,
  };
}

/**
 * Whether a conversation's name or one of its messages holds the text searched for. The text
 * is taken as it is typed: a full stop is a full stop and a bracket a bracket, not a pattern.
 */
export function matches(conversation: MessagesConversation, query: string): boolean {
  const text = fold(query.trim());
  return (
    text === "" ||
    fold(conversation.name).includes(text) ||
    conversation.messages.some((message) => fold(message.text).includes(text))
  );
}

/**
 * The conversations with the one last heard from first; equal times keep their order, and
 * one without a message, or whose last message has no stamp, follows the others. Of two
 * with the same `id` the first is kept: an `id` names one conversation.
 */
export function byRecency(
  conversations: readonly MessagesConversation[],
): readonly MessagesConversation[] {
  const seen = new Set<string>();
  const each = conversations.filter(
    (conversation) => !seen.has(conversation.id) && seen.add(conversation.id),
  );
  const time = (conversation: MessagesConversation) => {
    const at = lastMessage(conversation)?.at ?? "";
    return isStamp(at) ? at : "";
  };
  return each.sort((a, b) => (time(a) < time(b) ? 1 : time(a) > time(b) ? -1 : 0));
}

/**
 * The recipients typed into a To field, split at its commas, except a comma inside double
 * quotes, parentheses or angle brackets (`"Lee, Ann" (ann)` is one person, as a contact whose
 * name holds a comma is offered), trimmed, the empty ones left out.
 */
export function splitRecipients(typed: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let part = "";
  for (const character of typed) {
    if (character === '"') quoted = !quoted;
    else if (quoted) {
      // Inside a quoted name every character is the name's.
    } else if (character === "(" || character === "<") depth += 1;
    else if ((character === ")" || character === ">") && depth > 0) depth -= 1;
    if (character === "," && depth === 0 && !quoted) {
      parts.push(part);
      part = "";
    } else {
      part += character;
    }
  }
  parts.push(part);
  return parts.map((each) => each.trim()).filter(Boolean);
}
