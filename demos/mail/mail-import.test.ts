import { describe, expect, it } from "vitest";
import type { MailMessage } from "./mail-data";
import { mboxOf } from "./mail-export";
import { importedBoxName, parseMbox } from "./mail-import";

const message: MailMessage = {
  id: "m",
  mailbox: "inbox",
  from: "Ada",
  fromAddress: "Ada Moreno <ada@macalicious>",
  to: ["Robin"],
  toAddresses: ["robin@macalicious", '"Vega, R" <r@macalicious>'],
  cc: ["jonas@macalicious"],
  subject: "Tide tables",
  date: "",
  received: "",
  time: Date.UTC(2019, 8, 29, 18, 24),
  body: "",
};

describe("parseMbox", () => {
  it("reads back what Export Mailbox writes, with a From line in the text unquoted", () => {
    const file = mboxOf(
      [message, { ...message, subject: "Second" }],
      ["From the pier\n\nOne", "Two"],
    );
    const read = parseMbox(file, 7);
    expect(read).toHaveLength(2);
    expect(read[0]).toMatchObject({
      from: "Ada Moreno <ada@macalicious>",
      to: ["robin@macalicious", '"Vega, R" <r@macalicious>'],
      cc: ["jonas@macalicious"],
      subject: "Tide tables",
      time: Date.UTC(2019, 8, 29, 18, 24),
      text: "From the pier\n\nOne",
    });
    expect(read[1]).toMatchObject({ subject: "Second", text: "Two" });
  });

  it("keeps one key for one message across two reads, and another for another", () => {
    const file = mboxOf([message, { ...message, subject: "Second" }], ["One", "Two"]);
    const keys = parseMbox(file, 0).map(({ key }) => key);
    expect(parseMbox(file, 0).map(({ key }) => key)).toEqual(keys);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]?.length).toBeLessThanOrEqual(64);
  });

  it("joins a folded header, and falls back on the From line's date", () => {
    const [read] = parseMbox(
      "From a@b.c Thu Jan  2 03:04:05 2020\nSubject: One\n  two\n\nText\n",
      7,
    );
    expect(read).toMatchObject({
      from: "a@b.c",
      subject: "One two",
      time: Date.UTC(2020, 0, 2, 3, 4, 5),
      text: "Text",
    });
  });

  it("finds nothing in a file that is no mbox", () => {
    expect(parseMbox("just some notes\nFrom memory, not a mail.\n", 0)).toEqual([]);
  });
});

describe("importedBoxName", () => {
  it("names the mailbox after the file, unless Mail keeps that name for itself", () => {
    expect(importedBoxName("Trips 2019.mbox")).toBe("Trips 2019");
    expect(importedBoxName("Inbox.mbox")).toBe("Import Inbox");
    expect(importedBoxName(".mbox")).toBe("Import");
  });
});
