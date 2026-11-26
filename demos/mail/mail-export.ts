import type { MailMessage } from "./mail-data";
import { mailHeaderLines } from "./mail-message-window";

/** How many messages' text are read from the server at a time. */
const READ_AT_ONCE = 6;

/** A name a file can have. */
export const fileNameOf = (name: string) =>
  name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Untitled";

const MIME = [
  "MIME-Version: 1.0",
  'Content-Type: text/plain; charset="utf-8"',
  "Content-Transfer-Encoding: 8bit",
];

/** One message as an RFC 5322 file (`.eml`): its header lines and whole text. It names no attachments' bytes. */
export function rawMessage(message: MailMessage, body: string): string {
  return [...mailHeaderLines(message), ...MIME, "", ...body.split(/\r?\n/)].join("\r\n");
}

/** The date line an mbox separator ends with: `Thu Jan  1 00:00:00 1970`, in UTC. */
function asctime(time: number): string {
  const [day, date, month, year, clock] = new Date(time).toUTCString().replace(",", "").split(" ");
  return `${day} ${month} ${(date ?? "").replace(/^0/, "").padStart(2, " ")} ${clock} ${year}`;
}

/**
 * Messages as an mbox file: each after a `From ` line, with any line of its text that could be taken
 * for one quoted by `>` (the mboxrd form), so that reading it back gives the same text.
 */
export function mboxOf(messages: readonly MailMessage[], bodies: readonly string[]): string {
  return messages
    .map((message, index) => {
      const sender = (message.fromAddress ?? message.from).replace(/\s+/g, "") || "MAILER-DAEMON";
      const text = (bodies[index] ?? "")
        .split(/\r?\n/)
        .map((line) => (/^>*From /.test(line) ? `>${line}` : line));
      return [
        `From ${sender} ${asctime(message.time)}`,
        ...mailHeaderLines(message),
        ...MIME,
        "",
        ...text,
        "",
        "",
      ].join("\n");
    })
    .join("");
}

/** Every message's whole text, a few at a time, or `null` when any of them could not be read. */
export async function wholeBodies(
  messages: readonly MailMessage[],
  read: (message: MailMessage) => Promise<string | null>,
): Promise<string[] | null> {
  const bodies: string[] = [];
  for (let at = 0; at < messages.length; at += READ_AT_ONCE) {
    const some = await Promise.all(messages.slice(at, at + READ_AT_ONCE).map(read));
    for (const body of some) {
      if (body === null) return null;
      bodies.push(body);
    }
  }
  return bodies;
}
