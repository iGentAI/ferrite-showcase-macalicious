import { describe, expect, it } from "vitest";
import type { MailMessage } from "./mail-data";
import { conversationRows, threadSubject, threadsOf } from "./mail-threads";

const message = (fields: Partial<MailMessage>): MailMessage => ({
  id: "m",
  mailbox: "inbox",
  from: "Ada",
  fromAddress: "Ada <ada@macalicious>",
  to: ["Robin"],
  toAddresses: ["Robin <robin@macalicious>"],
  subject: "Ferry times",
  date: "",
  received: "",
  time: 100,
  body: "The first boat.",
  unread: true,
  ...fields,
});
const ME = "Robin <robin@macalicious>";

describe("threads", () => {
  it("takes Re: and Fwd: off a subject", () => {
    expect(threadSubject("Re: Fwd: RE: Ferry")).toBe("ferry");
    expect(threadSubject("Refund")).toBe("refund");
  });
  it("joins one subject among people who overlap, and not people who do not", () => {
    const first = message({ id: "1", time: 1 });
    const reply = message({
      id: "2",
      time: 2,
      mailbox: "sent",
      subject: "Re: Ferry times",
      from: "Robin",
      fromAddress: ME,
      to: ["Ada"],
      toAddresses: ["Ada <ada@macalicious>"],
    });
    const stranger = message({
      id: "3",
      time: 3,
      from: "Otis",
      fromAddress: "Otis <otis@macalicious>",
    });
    const threads = threadsOf([first, reply, stranger], ME);
    expect(threads.get("1")?.messages.map(({ id }) => id)).toEqual(["2", "1"]);
    expect(threads.get("2")).toBe(threads.get("1"));
    expect(threads.get("3")?.messages.map(({ id }) => id)).toEqual(["3"]);
  });
  it("joins two threads a later message shows to be one", () => {
    const fromAda = message({ id: "1", time: 1 });
    const fromOtis = message({ id: "2", time: 2, from: "Otis", fromAddress: "o@macalicious" });
    const both = message({ id: "3", time: 3, cc: ["o@macalicious"] });
    const threads = threadsOf([fromAda, fromOtis, both], ME);
    expect(threads.get("2")?.messages).toHaveLength(3);
    expect(threads.get("1")).toBe(threads.get("2"));
  });
  it("leaves drafts and messages with no subject alone", () => {
    const threads = threadsOf(
      [
        message({ id: "1", subject: "(No Subject)" }),
        message({ id: "2", subject: "(No Subject)" }),
        message({ id: "3", mailbox: "drafts" }),
        message({ id: "4" }),
      ],
      ME,
    );
    expect(threads.get("1")?.messages).toHaveLength(1);
    expect(threads.get("3")?.messages).toHaveLength(1);
    expect(threads.get("4")?.messages).toHaveLength(1);
  });
  it("gives a thread a row, its messages under it when open, the Trash uncounted", () => {
    const one = message({ id: "1", time: 1 });
    const two = message({ id: "2", time: 2 });
    const sent = message({ id: "3", time: 3, mailbox: "sent" });
    const trash = message({ id: "4", time: 4, mailbox: "trash" });
    const lone = message({ id: "5", time: 5, subject: "Dinner" });
    const threads = threadsOf([one, two, sent, trash, lone], ME);
    const listed = [lone, two, one];
    const closed = conversationRows(listed, threads, new Set());
    expect(closed.map((row) => row.kind)).toEqual(["message", "thread"]);
    const thread = closed[1];
    if (thread?.kind !== "thread") throw new Error("not a thread");
    expect(thread.members).toEqual([two, one]);
    expect(thread.related).toEqual([sent]);
    const open = conversationRows(listed, threads, new Set([thread.thread.id]));
    expect(open.map((row) => row.kind)).toEqual(["message", "thread", "message", "message"]);
  });
});
