import { describe, expect, it, vi } from "vitest";
import type { MailMessage } from "./mail-data";
import { fileNameOf, mboxOf, rawMessage, wholeBodies } from "./mail-export";

const message: MailMessage = {
  id: "one",
  mailbox: "inbox",
  from: "Martin Klein",
  fromAddress: "Martin Klein <martin@macalicious>",
  to: ["Chris"],
  subject: "Hello",
  date: "1/2/20",
  received: "January 2, 2020 at 3:04 PM",
  time: Date.UTC(2020, 0, 2, 15, 4, 5),
  body: "",
};

describe("Mail's files", () => {
  it("writes a message as an .eml with lines ended the way the format says", () => {
    expect(rawMessage(message, "Line one\nLine two")).toBe(
      [
        "From: Martin Klein <martin@macalicious>",
        "To: Chris",
        "Subject: Hello",
        "Date: Thu, 02 Jan 2020 15:04:05 GMT",
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="utf-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        "Line one",
        "Line two",
      ].join("\r\n"),
    );
  });

  it("separates an mbox's messages and quotes text that could read as a separator", () => {
    const mbox = mboxOf([message], ["From the top\n>From before\nFromage"]);
    expect(mbox.split("\n")[0]).toBe(
      "From MartinKlein<martin@macalicious> Thu Jan  2 15:04:05 2020",
    );
    expect(mbox).toContain("\n\n>From the top\n>>From before\nFromage\n\n");
  });

  it("reads every message's text, in order, and gives up on one that cannot be read", async () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ ...message, id: `${index}` }));
    const read = vi.fn(async (each: MailMessage) => each.id);
    expect(await wholeBodies(many, read)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
    expect(await wholeBodies(many, async (each) => (each.id === "7" ? null : each.id))).toBeNull();
  });

  it("makes a file's name of a subject", () => {
    expect(fileNameOf('Re: a/b "c"')).toBe("Re- a-b -c-");
    expect(fileNameOf("::")).toBe("-");
    expect(fileNameOf("  ")).toBe("Untitled");
  });
});
