import { describe, expect, it } from "vitest";
import type { MailMessage } from "./mail-data";
import {
  inSmartMailbox,
  readSmartMailboxes,
  ruleComplete,
  ruleFor,
  type SmartMailbox,
} from "./mail-smart";

const NOW = 1_000 * 86_400_000;
const message = (fields: Partial<MailMessage> = {}): MailMessage => ({
  id: "m",
  mailbox: "inbox",
  from: "Ada Moreno",
  fromAddress: "Ada Moreno <ada@macalicious>",
  to: ["Robin", "Pat"],
  toAddresses: ["Robin <robin@macalicious>", "Pat <pat@macalicious>"],
  subject: "Ferry times",
  date: "",
  received: "",
  time: NOW - 86_400_000,
  body: "The first boat leaves at eight.",
  ...fields,
});
const box = (fields: Partial<SmartMailbox>): SmartMailbox => ({
  id: "smart-a",
  name: "A",
  matchAll: true,
  rules: [],
  includeTrash: false,
  includeSent: false,
  ...fields,
});

describe("inSmartMailbox", () => {
  it.each([
    [{ field: "from", test: "contains", value: "ada@" }, true],
    [{ field: "from", test: "lacks", value: "ADA" }, false],
    [{ field: "from", test: "equals", value: "ada moreno" }, true],
    [{ field: "from", test: "equals", value: "ada@macalicious" }, true],
    [{ field: "from", test: "begins", value: "ada@" }, true],
    [{ field: "to", test: "equals", value: "pat" }, true],
    [{ field: "to", test: "equals", value: "pat@macalicious" }, true],
    [{ field: "to", test: "lacks", value: "pat" }, false],
    [{ field: "to", test: "lacks", value: "nobody" }, true],
    [{ field: "subject", test: "begins", value: "ferry" }, true],
    [{ field: "subject", test: "ends", value: "ferry" }, false],
    [{ field: "subject", test: "equals", value: "Ferry Times" }, true],
    [{ field: "body", test: "contains", value: "boat" }, true],
    [{ field: "cc", test: "contains", value: "boat" }, false],
    [{ field: "flagged", test: "yes", value: "" }, false],
    [{ field: "flagged", test: "no", value: "" }, true],
    [{ field: "unread", test: "no", value: "" }, true],
    [{ field: "attachments", test: "yes", value: "" }, false],
    [{ field: "mailbox", test: "is", value: "inbox" }, true],
    [{ field: "mailbox", test: "not", value: "inbox" }, false],
    [{ field: "received", test: "within", value: "2" }, true],
    [{ field: "received", test: "older", value: "2" }, false],
  ] as const)("%j gives %s", (rule, expected) => {
    expect(inSmartMailbox(message(), box({ rules: [rule] }), NOW)).toBe(expected);
  });

  const hit = ruleFor("flagged");
  const miss = { field: "subject", test: "contains", value: "nothing like it" } as const;

  it("asks for all conditions or for any one", () => {
    const flagged = message({ flag: "red" });
    expect(inSmartMailbox(flagged, box({ rules: [hit, miss] }), NOW)).toBe(false);
    expect(inSmartMailbox(flagged, box({ rules: [hit, miss], matchAll: false }), NOW)).toBe(true);
  });

  it("takes a flag's colour when the rule names one", () => {
    const red = { field: "flagged", test: "yes", value: "red" } as const;
    expect(inSmartMailbox(message({ flag: "red" }), box({ rules: [red] }), NOW)).toBe(true);
    expect(inSmartMailbox(message({ flag: "blue" }), box({ rules: [red] }), NOW)).toBe(false);
    expect(inSmartMailbox(message({}), box({ rules: [red] }), NOW)).toBe(false);
  });

  it("leaves Junk and Drafts out, and the Trash and Sent until it is told otherwise", () => {
    const rules = [ruleFor("unread")].map((rule) => ({ ...rule, test: "no" as const }));
    for (const mailbox of ["junk", "drafts"] as const) {
      const everything = box({ rules, includeTrash: true, includeSent: true });
      expect(inSmartMailbox(message({ mailbox }), everything, NOW)).toBe(false);
    }
    expect(inSmartMailbox(message({ mailbox: "trash" }), box({ rules }), NOW)).toBe(false);
    expect(inSmartMailbox(message({ mailbox: "sent" }), box({ rules }), NOW)).toBe(false);
    expect(
      inSmartMailbox(message({ mailbox: "trash" }), box({ rules, includeTrash: true }), NOW),
    ).toBe(true);
    expect(
      inSmartMailbox(message({ mailbox: "sent" }), box({ rules, includeSent: true }), NOW),
    ).toBe(true);
  });

  it("lists nothing without a condition", () => {
    expect(inSmartMailbox(message(), box({ rules: [] }), NOW)).toBe(false);
  });
});

describe("ruleComplete", () => {
  it("wants words and a whole number of days", () => {
    expect(ruleComplete(ruleFor("subject"))).toBe(false);
    expect(ruleComplete({ ...ruleFor("subject"), value: " a " })).toBe(true);
    expect(ruleComplete(ruleFor("flagged"))).toBe(true);
    expect(ruleComplete(ruleFor("received"))).toBe(true);
    expect(ruleComplete({ ...ruleFor("received"), value: "0" })).toBe(false);
    expect(ruleComplete({ ...ruleFor("received"), value: "soon" })).toBe(false);
  });
});

describe("readSmartMailboxes", () => {
  it("keeps what Mail wrote and leaves out the rest", () => {
    const good = box({ rules: [ruleFor("flagged")], matchAll: false, includeSent: true });
    expect(
      readSmartMailboxes([
        good,
        { id: "box-1", name: "Not smart", rules: [ruleFor("flagged")] },
        { id: "smart-2", name: "No rules", rules: [] },
        { id: "smart-3", name: "Odd rule", rules: [{ field: "size", test: "is", value: "1" }] },
        { id: "smart-4", name: "", rules: [ruleFor("flagged")] },
      ]),
    ).toEqual([good]);
    expect(readSmartMailboxes("nothing")).toBeUndefined();
  });
});
