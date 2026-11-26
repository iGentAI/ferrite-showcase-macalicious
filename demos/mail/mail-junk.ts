import { addressKey, type MailboxId, type MailMessage } from "./mail-data";

/*
 * Preferences > Junk Mail > Enable junk mail filtering: a word count over what the person's own
 * mailboxes hold, so it learns from each message they file as junk or take out of the Junk mailbox.
 */

/** What the filter has read: in how many messages of each kind every word stands. */
export interface JunkModel {
  junk: ReadonlyMap<string, number>;
  good: ReadonlyMap<string, number>;
  junkCount: number;
  goodCount: number;
}

/** The filter says nothing until it has seen this many messages filed as junk. */
export const JUNK_NEEDED = 3;
/** How sure the filter must be to file a message. */
export const JUNK_CERTAINTY = 0.9;
/** A message is judged by its most telling words alone. */
const TELLING_WORDS = 15;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu;
const wordsOf = (message: MailMessage): ReadonlySet<string> =>
  new Set(`${message.subject} ${message.body}`.toLowerCase().match(WORD) ?? []);

const NEITHER: readonly MailboxId[] = ["drafts", "outbox", "sent", "trash"];

/** What the mailboxes teach: Junk's messages against the rest, less what the person wrote or threw away. */
export function learnJunk(messages: readonly MailMessage[], junkBox: MailboxId): JunkModel {
  const junk = new Map<string, number>();
  const good = new Map<string, number>();
  let junkCount = 0;
  let goodCount = 0;
  for (const message of messages) {
    if (message.rulesPending || NEITHER.includes(message.mailbox)) continue;
    const isJunk = message.mailbox === junkBox;
    if (isJunk) junkCount += 1;
    else goodCount += 1;
    const counts = isJunk ? junk : good;
    for (const word of wordsOf(message)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return { junk, good, junkCount, goodCount };
}

/** How likely `message` is junk, from 0 to 1. A message with no word the filter knows is 0.5. */
export function junkChance(model: JunkModel, message: MailMessage): number {
  const telling: number[] = [];
  for (const word of wordsOf(message)) {
    const inJunk = (model.junk.get(word) ?? 0) / Math.max(1, model.junkCount);
    const inGood = (model.good.get(word) ?? 0) / Math.max(1, model.goodCount);
    if (inJunk === 0 && inGood === 0) continue;
    telling.push(Math.min(0.99, Math.max(0.01, inJunk / (inJunk + inGood))));
  }
  telling.sort((a, b) => Math.abs(b - 0.5) - Math.abs(a - 0.5));
  let junkSide = 1;
  let goodSide = 1;
  for (const chance of telling.slice(0, TELLING_WORDS)) {
    junkSide *= chance;
    goodSide *= 1 - chance;
  }
  return junkSide / (junkSide + goodSide);
}

/**
 * Whether new mail goes to the Junk mailbox: the filter has seen enough, is sure, and the sender is
 * not among those the person exempted (`exempt`, as `addressKey` writes them).
 */
export function isJunk(
  model: JunkModel,
  message: MailMessage,
  exempt: ReadonlySet<string>,
): boolean {
  if (model.junkCount < JUNK_NEEDED) return false;
  if (exempt.has(addressKey(message.fromAddress ?? message.from))) return false;
  return junkChance(model, message) >= JUNK_CERTAINTY;
}
