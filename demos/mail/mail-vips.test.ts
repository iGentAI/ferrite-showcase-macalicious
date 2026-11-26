import { describe, expect, it } from "vitest";
import type { MailMessage } from "./mail-data";
import { inSmartMailbox } from "./mail-smart";
import { FLAGGED_BOX, readMailVips, vipBox } from "./mail-vips";

const message = (fields: Partial<MailMessage> = {}): MailMessage => ({
  id: "m",
  mailbox: "inbox",
  from: "Ada Moreno",
  fromAddress: "Ada Moreno <ada@macalicious>",
  to: [],
  subject: "",
  date: "",
  received: "",
  time: 0,
  body: "",
  ...fields,
});

describe("the VIP's mailbox", () => {
  const ada = vipBox({ address: "ada@macalicious", name: "Ada Moreno" });
  it("lists that sender's mail, wherever it is, and nobody else's", () => {
    expect(inSmartMailbox(message(), ada, 0)).toBe(true);
    expect(inSmartMailbox(message({ mailbox: "box-1" }), ada, 0)).toBe(true);
    expect(inSmartMailbox(message({ mailbox: "trash" }), ada, 0)).toBe(false);
    expect(
      inSmartMailbox(message({ from: "Martin", fromAddress: "Martin <m@macalicious>" }), ada, 0),
    ).toBe(false);
  });
});

describe("the Flagged mailbox", () => {
  it("lists flagged mail, sent mail too, and not the Trash", () => {
    expect(inSmartMailbox(message(), FLAGGED_BOX, 0)).toBe(false);
    expect(inSmartMailbox(message({ flag: "red" }), FLAGGED_BOX, 0)).toBe(true);
    expect(inSmartMailbox(message({ flag: "red", mailbox: "sent" }), FLAGGED_BOX, 0)).toBe(true);
    expect(inSmartMailbox(message({ flag: "red", mailbox: "trash" }), FLAGGED_BOX, 0)).toBe(false);
  });
});

describe("readMailVips", () => {
  it("keeps what Mail wrote and leaves out the rest", () => {
    const ada = { address: "ada@macalicious", name: "Ada" };
    expect(readMailVips([ada, { name: "No address" }, null, 3])).toEqual([ada]);
    expect(readMailVips("nothing")).toBeUndefined();
  });
});
