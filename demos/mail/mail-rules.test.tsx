import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { Mail, type MailMessageChange, moveRefusal } from "./mail";
import type { MailboxId, MailMessage } from "./mail-data";
import {
  type MailRule,
  messagesOfMailbox,
  readMailRules,
  ruleChange,
  rulesFit,
} from "./mail-rules";
import { MAIL_RULES } from "./mail-saved";
import type { SmartMailbox } from "./mail-smart";

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
const rule = (fields: Partial<MailRule>): MailRule => ({
  id: "rule-1",
  description: "Boats",
  enabled: true,
  matchAll: true,
  conditions: [{ field: "subject", test: "contains", value: "ferry" }],
  actions: [{ kind: "read" }],
  ...fields,
});
const always = () => true;

describe("ruleChange", () => {
  it("takes each action of a rule whose conditions hold", () => {
    const actions = [
      { kind: "read" },
      { kind: "flag", flag: "green" },
      { kind: "move", mailbox: "archive" },
    ] as const;
    expect(ruleChange(message({}), [rule({ actions })], 0, always)).toEqual({
      unread: false,
      flag: "green",
      mailbox: "archive",
    });
  });
  it("changes nothing for a rule that is off, or a message it does not pick", () => {
    expect(ruleChange(message({}), [rule({ enabled: false })], 0, always)).toBeNull();
    expect(ruleChange(message({ subject: "Dinner" }), [rule({})], 0, always)).toBeNull();
  });
  it("changes nothing for a message that is already so", () => {
    expect(ruleChange(message({ unread: false }), [rule({})], 0, always)).toBeNull();
  });
  it("sends a deleted message to the Trash, and moves to no mailbox that has gone", () => {
    expect(ruleChange(message({}), [rule({ actions: [{ kind: "delete" }] })], 0, always)).toEqual({
      mailbox: "trash",
    });
    const gone = rule({ actions: [{ kind: "move", mailbox: "box-gone" }] });
    expect(ruleChange(message({}), [gone], 0, () => false)).toBeNull();
  });
  it("lets a later rule see what an earlier one did", () => {
    const later = rule({
      id: "rule-2",
      conditions: [{ field: "unread", test: "no", value: "" }],
      actions: [{ kind: "flag", flag: "red" }],
    });
    expect(ruleChange(message({}), [rule({}), later], 0, always)).toEqual({
      unread: false,
      flag: "red",
    });
  });
  it("does not let a later rule see a move that was refused", () => {
    const toArchive = rule({ actions: [{ kind: "move", mailbox: "archive" }] });
    const inArchive = rule({
      id: "rule-2",
      conditions: [{ field: "mailbox", test: "is", value: "archive" }],
      actions: [{ kind: "flag", flag: "red" }],
    });
    const server = (now: MailMessage, to: MailboxId) => moveRefusal(now, to) === undefined;
    expect(
      ruleChange(message({ mailbox: "drafts" }), [toArchive, inArchive], 0, server),
    ).toBeNull();
    expect(ruleChange(message({}), [toArchive, inArchive], 0, server)).toEqual({
      mailbox: "archive",
      flag: "red",
    });
  });
});

describe("readMailRules", () => {
  it("keeps what Mail wrote and leaves out the rest", () => {
    const good = rule({ enabled: false, matchAll: false });
    expect(
      readMailRules([
        good,
        { ...good, conditions: [] },
        { ...good, actions: [{ kind: "explode" }] },
        { ...good, actions: [{ kind: "move", mailbox: "drafts" }] },
        { ...good, id: 3 },
      ]),
    ).toEqual([good]);
    expect(readMailRules("nothing")).toBeUndefined();
  });
});

describe("rulesFit", () => {
  it("says whether a person's setting can hold the list", () => {
    expect(rulesFit([rule({})])).toBe(true);
    expect(rulesFit([rule({ description: "é".repeat(2100) })])).toBe(false);
  });
});

describe("messagesOfMailbox", () => {
  const held = [
    message({ id: "here", mailbox: "inbox" }),
    message({ id: "other", mailbox: "archive" }),
    message({ id: "draft", mailbox: "drafts" }),
  ];
  it("is what the mailbox holds, not what a search lists", () => {
    expect(messagesOfMailbox(held, "inbox", [], 0).map(({ id }) => id)).toEqual(["here"]);
  });
  it("is what a Smart Mailbox lists, without drafts", () => {
    const box: SmartMailbox = {
      id: "smart-1",
      name: "Boats",
      matchAll: true,
      rules: [{ field: "subject", test: "contains", value: "ferry" }],
      includeTrash: false,
      includeSent: false,
      includeDrafts: true,
    };
    expect(messagesOfMailbox(held, "smart-1", [box], 0).map(({ id }) => id)).toEqual([
      "here",
      "other",
    ]);
  });
});

describe("Mail, as mail arrives", () => {
  const boats = rule({ actions: [{ kind: "move", mailbox: "archive" }] });
  afterEach(() => forgetDesktopValues());
  const held = (onMessageChange: (id: string, change: MailMessageChange) => void) => ({
    messages: [],
    defaultMessage: null,
    me: ME,
    keepsView: true,
    onMessageChange,
  });
  const withRules = (rules: readonly MailRule[]) => {
    receiveDesktopValues({ [MAIL_RULES]: rules });
    return connectDesktopValues(vi.fn());
  };

  it("runs the rules once on each new message, past any number of them", async () => {
    const stop = withRules([boats]);
    const onMessageChange = vi.fn<(id: string, change: MailMessageChange) => void>();
    const new501 = Array.from({ length: 501 }, (_, at) =>
      message({ id: `new-${at}`, time: at, rulesPending: true }),
    );
    const { rerender } = render(<Mail {...held(onMessageChange)} heldMessages={new501} />);
    await waitFor(() => expect(onMessageChange).toHaveBeenCalledTimes(501));
    expect(onMessageChange).toHaveBeenCalledWith("new-0", {
      mailbox: "archive",
      rulesPending: false,
    });
    expect(onMessageChange).toHaveBeenCalledWith("new-500", {
      mailbox: "archive",
      rulesPending: false,
    });
    // Another read before the server has answered does not ask again.
    rerender(<Mail {...held(onMessageChange)} heldMessages={[...new501]} />);
    await new Promise((settle) => setTimeout(settle, 20));
    expect(onMessageChange).toHaveBeenCalledTimes(501);
    stop();
  });
  it("ends the mark on new mail no rule picks, and leaves mail that has no mark", async () => {
    const stop = withRules([boats]);
    const onMessageChange = vi.fn<(id: string, change: MailMessageChange) => void>();
    render(
      <Mail
        {...held(onMessageChange)}
        heldMessages={[
          message({ id: "new", subject: "Dinner", rulesPending: true }),
          message({ id: "old", mailbox: "inbox" }),
        ]}
      />,
    );
    await waitFor(() =>
      expect(onMessageChange).toHaveBeenCalledWith("new", { rulesPending: false }),
    );
    expect(onMessageChange).toHaveBeenCalledTimes(1);
    stop();
  });
  it("does not run on what it has not seen the rules for", async () => {
    const onMessageChange = vi.fn<(id: string, change: MailMessageChange) => void>();
    render(<Mail {...held(onMessageChange)} heldMessages={[message({ rulesPending: true })]} />);
    await screen.findAllByRole("option");
    expect(onMessageChange).not.toHaveBeenCalled();
  });
  it("runs again in the next window when the mark is still there", async () => {
    const stop = withRules([boats]);
    const first = vi.fn<(id: string, change: MailMessageChange) => void>();
    const pending = [message({ rulesPending: true })];
    const window = render(<Mail {...held(first)} heldMessages={pending} />);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    window.unmount();
    const second = vi.fn<(id: string, change: MailMessageChange) => void>();
    render(<Mail {...held(second)} heldMessages={pending} />);
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    stop();
  });
  it("mutes new mail of a muted conversation", async () => {
    const stop = withRules([]);
    const onMessageChange = vi.fn<(id: string, change: MailMessageChange) => void>();
    render(
      <Mail
        {...held(onMessageChange)}
        heldMessages={[
          message({ id: "old", time: 10, muted: true }),
          message({ id: "new", time: 20, subject: "Re: Ferry times", rulesPending: true }),
        ]}
      />,
    );
    await waitFor(() =>
      expect(onMessageChange).toHaveBeenCalledWith("new", { muted: true, rulesPending: false }),
    );
    stop();
  });
});
