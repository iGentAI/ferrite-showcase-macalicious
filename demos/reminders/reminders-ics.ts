import { escapeText, fold, parseLine, unescapeText, unfold } from "../calendar/calendar-ics";
import type { Reminder, ReminderPriority } from "./reminders-data";
import { instantIn, localZone, wallClockIn } from "./reminders-dates";

/**
 * Reminders as iCalendar VTODOs, as Reminders' File > Export writes them and File > Import reads them:
 * the title, notes, address, due day and minute, whether done, and priority. A repeat, an alert and a
 * flag stay behind, since a VTODO elsewhere would not read them as this window does.
 */
const PRIORITY_OF: Readonly<Partial<Record<ReminderPriority, number>>> = {
  high: 1,
  medium: 5,
  low: 9,
};

const property = (name: string, value: string) => fold(`${name}:${value}`);

const stampOf = (day: string, time?: string) => {
  const date = day.replaceAll("-", "");
  return time ? `${date}T${time.replace(":", "")}00` : date;
};

/** The reminders of a list as an iCalendar file. */
export function remindersToIcs(name: string, reminders: readonly Reminder[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Macalicious//Reminders//EN",
    property("X-WR-CALNAME", escapeText(name)),
  ];
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  for (const reminder of reminders) {
    lines.push("BEGIN:VTODO", property("UID", `${reminder.id}@macalicious`), `DTSTAMP:${stamp}`);
    lines.push(property("SUMMARY", escapeText(reminder.title)));
    if (reminder.notes) lines.push(property("DESCRIPTION", escapeText(reminder.notes)));
    if (reminder.url) lines.push(property("URL", reminder.url));
    if (reminder.due) {
      lines.push(
        fold(
          reminder.dueTime
            ? `DUE:${stampOf(reminder.due, reminder.dueTime)}`
            : `DUE;VALUE=DATE:${stampOf(reminder.due)}`,
        ),
      );
    }
    if (reminder.completed) lines.push("STATUS:COMPLETED");
    const priority = reminder.priority && PRIORITY_OF[reminder.priority];
    if (priority) lines.push(`PRIORITY:${priority}`);
    lines.push("END:VTODO");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/** What a file gives of a reminder: everything but where it goes. */
export type ImportedReminder = Pick<
  Reminder,
  "title" | "notes" | "url" | "due" | "dueTime" | "completed" | "priority"
>;

const priorityOf = (value: string): ReminderPriority | undefined => {
  const level = Number(value);
  if (level >= 1 && level <= 4) return "high";
  if (level === 5) return "medium";
  if (level >= 6 && level <= 9) return "low";
  return undefined;
};

const validDay = (year: string, month: string, date: string) => {
  const at = new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)));
  return at.getUTCMonth() === Number(month) - 1 && at.getUTCDate() === Number(date);
};

/** The VTODOs of an iCalendar file. One with no title is left out; nothing else stops the rest. */
export function remindersFromIcs(
  text: string,
  zone: string | undefined = localZone(),
): ImportedReminder[] {
  const found: ImportedReminder[] = [];
  let open: ImportedReminder | null = null;
  // How deep inside the VTODO: its alarms' fields are not the reminder's.
  let nested = 0;
  for (const line of unfold(text)) {
    const prop = parseLine(line);
    if (!prop) continue;
    const value = prop.value.trim();
    if (open && prop.name === "BEGIN") nested += 1;
    else if (open && nested > 0) {
      if (prop.name === "END") nested -= 1;
    } else if (prop.name === "BEGIN" && value.toUpperCase() === "VTODO") open = { title: "" };
    else if (prop.name === "END" && value.toUpperCase() === "VTODO") {
      if (open?.title) found.push(open);
      open = null;
    } else if (open) {
      if (prop.name === "SUMMARY") open.title = unescapeText(value).trim();
      else if (prop.name === "DESCRIPTION") open.notes = unescapeText(value);
      else if (prop.name === "URL") open.url = value;
      else if (prop.name === "STATUS" && value.toUpperCase() === "COMPLETED") open.completed = true;
      else if (prop.name === "PRIORITY") {
        const priority = priorityOf(value);
        if (priority) open.priority = priority;
      } else if (prop.name === "DUE") {
        const at = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z?))?$/.exec(value);
        if (at?.[1] && at[2] && at[3] && validDay(at[1], at[2], at[3])) {
          let day = `${at[1]}-${at[2]}-${at[3]}`;
          if (at[4] && at[5] && Number(at[4]) < 24 && Number(at[5]) < 60) {
            let time = `${at[4]}:${at[5]}`;
            // A time written in UTC or a named zone is that moment on this person's clocks; one that
            // names no zone is the same minute wherever it is read.
            const written = at[6] ? "UTC" : prop.params.TZID?.trim();
            if (written) ({ day, time } = wallClockIn(instantIn(day, time, written), zone));
            open.dueTime = time;
          }
          open.due = day;
        }
      }
    }
  }
  return found;
}
