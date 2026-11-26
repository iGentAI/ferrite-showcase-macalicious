import { addressKey, type MailMessage } from "./mail-data";

/*
 * What Window > Previous Recipients, Edit > Paste as Quotation, Append Selected Messages and Complete
 * Address work from.
 */

/** Someone the person has written to, read from what the Sent mailbox holds. */
export interface MailRecipient {
  /** How the message addressed them, which a new message can use as it is. */
  written: string;
  /** Their address in lower case, as `addressKey` writes it. */
  address: string;
  /** When they were last written to, as a message's `time`. */
  last: number;
}

/** The people the Sent messages are addressed to, the most recent first, less those `removed`. */
export function previousRecipients(
  messages: readonly MailMessage[],
  removed: readonly string[],
): readonly MailRecipient[] {
  const people = new Map<string, MailRecipient>();
  for (const message of messages) {
    if (message.mailbox !== "sent") continue;
    const everyone = [
      ...(message.toAddresses ?? message.to),
      ...(message.cc ?? []),
      ...(message.bcc ?? []),
    ];
    for (const written of everyone) {
      const address = addressKey(written);
      const known = people.get(address);
      if (!removed.includes(address) && (!known || known.last < message.time)) {
        people.set(address, { written, address, last: message.time });
      }
    }
  }
  return [...people.values()].sort((a, b) => b.last - a.last);
}

/** The addresses removed from Previous Recipients as stored, leaving out whatever Mail did not write. */
export function readRemovedRecipients(stored: unknown): readonly string[] | undefined {
  return Array.isArray(stored)
    ? stored.filter((each): each is string => typeof each === "string")
    : undefined;
}

const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Text as one quote level of a rich message, a line a block, and a line to go on writing under it. The
 * empty line first is what Chromium's insertHTML merges into the line the caret is on, which would
 * otherwise take the quote's first line out of the quote.
 */
export function quotationHtml(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => `<div>${line === "" ? "<br>" : escaped(line)}</div>`)
    .join("");
  return `<div><br></div><blockquote>${lines}</blockquote><div><br></div>`;
}

/** Text as a plain message quotes it. */
export const quotationText = (text: string): string =>
  `${text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n")}\n`;

/** The contact that what was typed completes to: one it begins first, then one that holds it. */
export function completeAddress(typed: string, contacts: readonly string[]): string | undefined {
  const asked = typed.trim().toLowerCase();
  if (asked === "") return undefined;
  return (
    contacts.find((each) => each.toLowerCase().startsWith(asked)) ??
    contacts.find((each) => each.toLowerCase().includes(asked))
  );
}

/** Changes what a field holds as typing does, so that the field's owner hears of it. */
export function fillInput(input: HTMLInputElement, text: string): void {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The account an address names on this desktop, or `null` for any other. */
export function accountOf(written: string): { name: string; fullName: string } | null {
  const name = /^([^@\s]+)@macalicious$/.exec(addressKey(written))?.[1];
  if (!name) return null;
  const fullName = /^(.*?)\s*<[^<>]*>\s*$/.exec(written)?.[1];
  return { name, fullName: fullName || name };
}

/** Messages as Edit > Append Selected Messages adds them to a message: who, when, and the text. */
export const appendedText = (messages: readonly MailMessage[], bodies: readonly string[]): string =>
  messages
    .map(
      (message, index) =>
        `From: ${message.fromAddress ?? message.from}\nSubject: ${message.subject}\nDate: ${message.received}\n\n${bodies[index] ?? ""}`,
    )
    .join("\n\n");
