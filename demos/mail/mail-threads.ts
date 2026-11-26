import { addressKey, type MailMessage } from "./mail-data";

/** A conversation: messages about one subject among people who overlap, newest first. */
export interface MailThread {
  id: string;
  messages: readonly MailMessage[];
}

/** A subject without its Re: and Fwd: and in one case: what the messages of a thread share. */
export const threadSubject = (subject: string): string =>
  subject
    .replace(/^(\s*(re|fwd?)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();

/** Everyone on a message but `me`; the message of someone writing to themselves has only them. */
function peopleOn(message: MailMessage, me: string): Set<string> {
  const mine = addressKey(me);
  const everyone = [
    message.fromAddress ?? message.from,
    ...(message.toAddresses ?? message.to),
    ...(message.cc ?? []),
  ].map(addressKey);
  const others = everyone.filter((person) => person !== mine);
  return new Set(others.length > 0 ? others : [mine]);
}

/**
 * Every message's thread, by its id. Messages are in one thread when their subjects are the same
 * without Re: and Fwd: and someone other than `me` is on both. A draft and a message with no subject
 * are alone.
 */
export function threadsOf(
  messages: readonly MailMessage[],
  me: string,
): ReadonlyMap<string, MailThread> {
  const groups = new Map<string, { people: Set<string>; members: MailMessage[] }[]>();
  const threads = new Map<string, MailThread>();
  for (const message of [...messages].sort((a, b) => a.time - b.time)) {
    const subject = threadSubject(message.subject);
    if (
      message.mailbox === "drafts" ||
      message.mailbox === "outbox" ||
      subject === "" ||
      subject === "(no subject)"
    ) {
      threads.set(message.id, { id: message.id, messages: [message] });
      continue;
    }
    const people = peopleOn(message, me);
    const bucket = groups.get(subject) ?? [];
    groups.set(subject, bucket);
    const meeting = bucket.filter((group) => [...people].some((each) => group.people.has(each)));
    const joined = meeting[0] ?? { people: new Set<string>(), members: [] };
    if (meeting.length === 0) bucket.push(joined);
    for (const other of meeting.slice(1)) {
      for (const person of other.people) joined.people.add(person);
      joined.members.push(...other.members);
      bucket.splice(bucket.indexOf(other), 1);
    }
    for (const person of people) joined.people.add(person);
    joined.members.push(message);
  }
  for (const bucket of groups.values()) {
    for (const { members } of bucket) {
      const newestFirst = [...members].sort((a, b) => b.time - a.time);
      const id = newestFirst.at(-1)?.id ?? "";
      const thread = { id, messages: newestFirst };
      for (const member of members) threads.set(member.id, thread);
    }
  }
  return threads;
}

/** A row of the message list. */
export type MailRow =
  | { kind: "message"; message: MailMessage; child: boolean }
  | {
      kind: "thread";
      thread: MailThread;
      /** The thread's messages the list shows, in its order: commands act on these. */
      members: readonly MailMessage[];
      /** Its messages in other mailboxes that count, shown when the thread is read. */
      related: readonly MailMessage[];
      expanded: boolean;
    };

export const rowId = (row: MailRow): string =>
  row.kind === "thread" ? `thread-${row.thread.id}` : row.message.id;

/**
 * The list's rows for the messages `listed`, in their order, organized by conversation: a thread has
 * a row where the first of its messages stands, its other messages under it while it is `expanded`.
 * A message whose thread has nothing else that counts is a row of its own.
 */
export function conversationRows(
  listed: readonly MailMessage[],
  threads: ReadonlyMap<string, MailThread>,
  expanded: ReadonlySet<string>,
): MailRow[] {
  const shown = new Set(listed.map((message) => message.id));
  const done = new Set<string>();
  return listed.flatMap((message): MailRow[] => {
    const thread = threads.get(message.id);
    if (!thread) return [{ kind: "message", message, child: false }];
    if (done.has(thread.id)) return [];
    done.add(thread.id);
    const members = listed.filter((each) => threads.get(each.id)?.id === thread.id);
    const related = thread.messages.filter(
      (each) => !shown.has(each.id) && each.mailbox !== "trash" && each.mailbox !== "junk",
    );
    if (members.length === 1 && related.length === 0) {
      return [{ kind: "message", message, child: false }];
    }
    const open = expanded.has(thread.id) && members.length > 1;
    return [
      { kind: "thread", thread, members, related, expanded: open },
      ...(open
        ? members.map((member): MailRow => ({ kind: "message", message: member, child: true }))
        : []),
    ];
  });
}
