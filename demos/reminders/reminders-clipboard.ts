import { droppedLink } from "../safari/safari-drop";
import { MAX_TITLE, type Reminder } from "./reminders-data";

/*
 * Edit > Copy of reminders: the page holds them whole, with their dates and notes, and the system
 * clipboard holds their titles, one a line, so that they can be pasted elsewhere. Paste asks the
 * clipboard: what it holds is the page's reminders when it still says their titles or cannot be
 * read (a browser may refuse), and otherwise each line of text is a new reminder, cut at the longest
 * title a reminder keeps.
 */

let copied: { reminders: readonly Reminder[]; text: string } | null = null;

/** The type Mail's list drags messages by; their text says `from: subject`, one a line. */
export const MAIL_DRAG = "application/x-macalicious-mail";

/** Whether a drag holds something a list makes reminders of: a link, or messages from Mail. */
export const carriesReminderText = (types: readonly string[]) =>
  types.includes(MAIL_DRAG) || types.includes("text/uri-list");

/** What a list makes of a drop: a reminder per message, or one for the link. */
export function remindersFromDrop(
  data: Pick<DataTransfer, "getData" | "types">,
): readonly { title: string; url?: string; notes?: string }[] {
  if (data.types.includes(MAIL_DRAG)) {
    return data
      .getData("text/plain")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const at = line.indexOf(": ");
        return at < 0
          ? { title: line.trim() }
          : { title: line.slice(at + 2).trim() || line.trim(), notes: `From ${line.slice(0, at)}` };
      });
  }
  const link = droppedLink(data);
  return link ? [link] : [];
}

/** `reminders`, a parent before its sub-reminders, as Paste will make them again. */
export function copyReminders(reminders: readonly Reminder[]): void {
  const text = reminders.map((reminder) => reminder.title).join("\n");
  copied = { reminders, text };
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

/** What Paste makes: reminders with ids only among themselves, and no list yet. */
export async function remindersToPaste(): Promise<readonly Reminder[]> {
  const text = await navigator.clipboard?.readText().catch(() => null);
  if (copied && (typeof text !== "string" || text === copied.text)) return copied.reminders;
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((title, at) => ({
      id: `line-${at}`,
      listId: "",
      title: [...title].slice(0, MAX_TITLE).join(""),
    }));
}

/** Forgets what the page copied, for tests. */
export function resetCopiedReminders(): void {
  copied = null;
}
