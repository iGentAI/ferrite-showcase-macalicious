/** The colour of a list: its disc in the sidebar, its title and its completed circles. */
export type ReminderColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "brown"
  | "gray";

/** The colours a new list takes in turn. */
export const LIST_COLORS: readonly ReminderColor[] = [
  "blue",
  "green",
  "red",
  "orange",
  "yellow",
  "purple",
  "brown",
  "gray",
];

/** One of the user's lists ("My Lists" in the sidebar). */
export interface ReminderList {
  /** Identifies the list. It cannot be one of the four smart lists' ids. */
  id: string;
  /** The name shown in the sidebar and as the title over the reminders. */
  name: string;
  /** The list's colour. */
  color: ReminderColor;
  /** The group of lists it is in, if any. */
  groupId?: string;
}

/** A group of lists in the sidebar: a list names the group it is in. */
export interface ReminderGroup {
  /** Identifies the group, among the lists' ids too. */
  id: string;
  /** The name shown on its row. */
  name: string;
  /** While it holds no list: the list it stands before. Absent, it stands last. */
  before?: string;
}

/** How urgent a reminder is: the info popover's "priority" row. */
export type ReminderPriority = "none" | "low" | "medium" | "high";

/** How a reminder repeats once it is completed: the info popover's "repeat" row. */
export type ReminderRepeat =
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | "custom";

/** How a reminder that repeats "custom" does: every so many days, weeks, months or years. */
export interface ReminderRepeatRule {
  /** How many units from one occurrence to the next: 1 to 999. */
  every: number;
  unit: "day" | "week" | "month" | "year";
  /** For weeks: the days it falls on, 0 for Sunday to 6. Without them, the due day's weekday. */
  weekdays?: readonly number[];
}

/** The longest title a reminder keeps (`MAX_TITLE_CHARS` in the module). */
export const MAX_TITLE = 1000;

/** One reminder. */
/** What an early reminder may be, in minutes: the choices of the info popover. */
export const EARLY_MINUTES: readonly number[] = [5, 15, 30, 60, 120, 1440];

export interface Reminder {
  /** Identifies the reminder. */
  id: string;
  /** The `id` of the list it belongs to. */
  listId: string;
  /** Its one line of text. */
  title: string;
  /** The reminder of its list it is a sub-reminder of. Sub-reminders have none of their own. */
  parentId?: string;
  /** Whether its circle is filled. A completed reminder leaves its list and the counts. */
  completed?: boolean;
  /** Whether it carries a flag: it is then also in the Flagged smart list. */
  flagged?: boolean;
  /** The day it is due, as `YYYY-MM-DD`: it is then in Scheduled, and in Today on that day. */
  due?: string;
  /**
   * The minute it is due on that day, as `HH:MM` on the clocks of `timeZone` ("At a Time"). Its
   * alert fires then; without it, at 9:00. Only with `due`.
   */
  dueTime?: string;
  /**
   * The time zone `due` and `dueTime` are read in, by its IANA name: the zone of the browser that
   * set them. Every browser alerts at the same instant, and one in another zone shows a timed
   * reminder at that moment on its own clocks. Absent (an older document, or a writer such as
   * Automator that does not name it), the browser's own zone, which the next save from a browser
   * names. Only with `due`.
   */
  timeZone?: string;
  /** How it repeats: completing it moves it to its next occurrence. Only with `due`. */
  repeat?: ReminderRepeat;
  /** The rule of a reminder that repeats `"custom"`, and only of one. */
  repeatRule?: ReminderRepeatRule;
  /** An early reminder: how many minutes before its due minute its alert fires. */
  earlyMinutes?: number;
  /** The last day it may repeat to, as `YYYY-MM-DD` ("end repeat"). Only with `repeat`. */
  repeatEnd?: string;
  /** Free text under the title in the info popover. */
  notes?: string;
  /** Its priority; none when absent. */
  priority?: ReminderPriority;
  /** An address shown in the info popover. */
  url?: string;
  /** "remind me" At a Location is checked. The place is in `reminders-details.ts`; no alert comes. */
  atLocation?: boolean;
  /** "remind me" When Messaging a Person is checked. The person is in `reminders-details.ts`. */
  whenMessaging?: boolean;
  /** How many pictures are attached: those in `reminders-details.ts`, or else a stand-in drawing. */
  images?: number;
  /** When it was made (epoch ms). A reminder made before this was kept has none. */
  createdAt?: number;
}

/** The four tiles over the lists. */
export type SmartListId = "today" | "scheduled" | "all" | "flagged";

/** The smart lists in the order of their tiles, row by row, with the colour of each disc. */
export const SMART_LISTS: readonly { id: SmartListId; name: string; color: ReminderColor }[] = [
  { id: "today", name: "Today", color: "blue" },
  { id: "scheduled", name: "Scheduled", color: "orange" },
  { id: "all", name: "All", color: "gray" },
  { id: "flagged", name: "Flagged", color: "red" },
];

/** Whether `source` names a smart list rather than one of the user's lists. */
export function isSmartList(source: string): source is SmartListId {
  return SMART_LISTS.some((list) => list.id === source);
}

/** The lists of the reference screenshots. */
export const defaultLists: readonly ReminderList[] = [
  { id: "reminders", name: "Reminders", color: "blue" },
  { id: "work", name: "Work", color: "green" },
  { id: "imac-colors", name: "iMac Colors", color: "blue" },
];

/** The thirteen reminders the screenshots show, in their order. */
const IMAC_COLORS = [
  "Bondi",
  "Blueberry",
  "Strawberry",
  "Grape",
  "Lime",
  "Tangerine",
  "Graphite",
  "Snow",
  "Sage",
  "Ruby",
  "Indigo",
  "Flower Power",
  "Blue Dalmation",
];

/** The screenshots show only the count of the Work list, 5: its reminders are invented. */
const WORK = [
  "Send the agenda for Monday",
  "Review the budget draft",
  "Book a room for the workshop",
  "Reply to the hiring thread",
  "File the expense report",
];

/** The priorities in the order of the info popover's menu, with their titles. */
export const PRIORITIES: readonly { id: ReminderPriority; name: string }[] = [
  { id: "none", name: "None" },
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
];

/** The marks a row shows before the title of a reminder of each priority. */
export const PRIORITY_MARKS: Readonly<Record<ReminderPriority, string>> = {
  none: "",
  low: "!",
  medium: "!!",
  high: "!!!",
};

/** The repeats in the order of the info popover's menu, with their titles. */
export const REPEATS: readonly { id: ReminderRepeat | "never"; name: string }[] = [
  { id: "never", name: "Never" },
  { id: "daily", name: "Every Day" },
  { id: "weekdays", name: "Every Weekday" },
  { id: "weekly", name: "Every Week" },
  { id: "biweekly", name: "Every 2 Weeks" },
  { id: "monthly", name: "Every Month" },
  { id: "yearly", name: "Every Year" },
  { id: "custom", name: "Custom" },
];

/**
 * The reminders of the reference screenshots: 13 in iMac Colors, 5 in Work, none completed.
 * Graphite is the one whose info the screenshots show: it is set to remind when messaging a
 * person and carries one picture.
 */
export const defaultReminders: readonly Reminder[] = [
  ...WORK.map((title, index) => ({ id: `work-${index + 1}`, listId: "work", title })),
  ...IMAC_COLORS.map((title, index) => ({
    id: `imac-${index + 1}`,
    listId: "imac-colors",
    title,
    ...(title === "Graphite" ? { whenMessaging: true, images: 1 } : null),
  })),
];

/** Whether a reminder belongs to `source`, a list's id or a smart list's, on the day `today`. */
export function inSource(reminder: Reminder, source: string, today: string): boolean {
  switch (source) {
    case "today":
      return reminder.due !== undefined && reminder.due <= today;
    case "scheduled":
      return reminder.due !== undefined;
    case "all":
      return true;
    case "flagged":
      return reminder.flagged === true;
    default:
      return reminder.listId === source;
  }
}

/** How many reminders of `source` are still to do: the number in a tile or beside a list. */
export function countOf(reminders: readonly Reminder[], source: string, today: string): number {
  let count = 0;
  for (const reminder of reminders)
    if (!reminder.completed && inSource(reminder, source, today)) count++;
  return count;
}

/** How a list's reminders are ordered. `manual` is the order they were made in. */
export type ReminderSort = "manual" | "due" | "created" | "priority" | "title";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 } as const;

/** `reminders` in the order `sort` asks; those it cannot tell apart keep their order. */
export function sortReminders(reminders: readonly Reminder[], sort: ReminderSort): Reminder[] {
  // One being typed has no title yet: it stays last, where its new row is brought into view.
  const typing = reminders.filter((reminder) => reminder.title === "");
  return typing.length === 0
    ? sortedReminders(reminders, sort)
    : [
        ...sortedReminders(
          reminders.filter((reminder) => reminder.title !== ""),
          sort,
        ),
        ...typing,
      ];
}

function sortedReminders(reminders: readonly Reminder[], sort: ReminderSort): Reminder[] {
  const rank = (reminder: Reminder): string | number => {
    if (sort === "due") {
      // Without a date, last; without a time, first on its day.
      return reminder.due ? `${reminder.due} ${reminder.dueTime ?? ""}` : "~";
    }
    if (sort === "priority") return PRIORITY_ORDER[reminder.priority ?? "none"];
    return reminder.title.toLowerCase();
  };
  if (sort === "manual") return [...reminders];
  // Oldest first; one that does not know when it was made is older than any that does.
  if (sort === "created") {
    return [...reminders].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }
  return [...reminders].sort((a, b) => {
    const [left, right] = [rank(a), rank(b)];
    if (typeof left === "number" && typeof right === "number") return left - right;
    // Dates compare by their characters; titles as a person reads them.
    if (sort === "due") return left < right ? -1 : left > right ? 1 : 0;
    return String(left).localeCompare(String(right));
  });
}

/** Whether a reminder's title or notes contain the search text, whatever the letters' case. */
export function matches(reminder: Reminder, query: string): boolean {
  const text = query.trim().toLowerCase();
  return (
    reminder.title.toLowerCase().includes(text) ||
    (reminder.notes ?? "").toLowerCase().includes(text)
  );
}

/** A day as `YYYY-MM-DD` in local time, which is how `Reminder.due` is written. */
export function dayOf(date: Date): string {
  const two = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
