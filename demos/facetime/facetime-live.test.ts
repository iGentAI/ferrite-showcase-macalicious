import { describe, expect, it } from "vitest";
import {
  answerToApply,
  type CallDoc,
  type CallMember,
  callName,
  formatDuration,
  heldBy,
  peopleOf,
  plans,
  rowsOf,
  whenOf,
} from "./facetime-live";

/* The pure parts of FaceTime's calls on the desktop's Ferrite application (facetime-live.tsx). */

const PAGE = "page-0123456789abcdef";

const member = (
  name: string,
  state: CallMember["state"],
  me: boolean,
  seat?: number,
  page?: string,
): CallMember => ({
  name,
  full_name: name.toUpperCase(),
  state,
  seat: seat === undefined ? null : { n: seat, ...(page ? { page } : {}) },
  joined_ms: 0,
  left_ms: 0,
  me,
});

const call = (members: CallMember[], ended_ms = 0): CallDoc => ({
  id: "0".repeat(32),
  kind: "video",
  created_ms: 0,
  connected_ms: 0,
  ended_ms,
  members,
  links: [],
});

describe("which page holds a call", () => {
  it("is the page whose token the person's own seat names, while the call goes on", () => {
    const doc = call([member("ada", "joined", true, 1, PAGE), member("bob", "ringing", false)]);
    expect(heldBy(doc, PAGE)).toBe(true);
    expect(heldBy(doc, "page-of-another-tab")).toBe(false);
    expect(heldBy({ ...doc, ended_ms: 5 }, PAGE)).toBe(false);
    expect(
      heldBy(call([member("ada", "left", true), member("bob", "joined", false, 2)]), PAGE),
    ).toBe(false);
  });
});

describe("which seat offers", () => {
  it("has the later seat offer, and the earlier answer, with one key for the pair", () => {
    const callee = call([
      member("ada", "joined", false, 1),
      member("bob", "joined", true, 2, PAGE),
    ]);
    expect(plans(callee, PAGE)).toEqual([
      { key: "2>1", mine: 2, seat: 1, offers: true, name: "ADA" },
    ]);
    const caller = call([
      member("ada", "joined", true, 1, PAGE),
      member("bob", "joined", false, 2),
    ]);
    expect(plans(caller, PAGE)).toEqual([
      { key: "2>1", mine: 1, seat: 2, offers: false, name: "BOB" },
    ]);
  });

  it("connects to each other person joined, offering to the earlier seats and answering the later", () => {
    const group = call([
      member("ada", "joined", false, 1),
      member("cid", "joined", true, 3, PAGE),
      member("bob", "joined", false, 5),
      member("dee", "ringing", false),
      member("eve", "left", false),
    ]);
    expect(plans(group, PAGE)).toEqual([
      { key: "3>1", mine: 3, seat: 1, offers: true, name: "ADA" },
      { key: "5>3", mine: 3, seat: 5, offers: false, name: "BOB" },
    ]);
  });

  it("makes no connection while the other is not joined, or for a page that holds no seat", () => {
    const ringing = call([member("ada", "joined", true, 1, PAGE), member("bob", "ringing", false)]);
    expect(plans(ringing, PAGE)).toEqual([]);
    const caller = call([
      member("ada", "joined", true, 1, PAGE),
      member("bob", "joined", false, 2),
    ]);
    expect(plans(caller, "page-of-another-tab")).toEqual([]);
  });
});

describe("applying an answer", () => {
  const link = { from: 2, to: 1, offer: "o1", generation: 1, revision: 1, answer: "a1" };

  it("applies an answer once, to the offer it answers, while the offer waits", () => {
    const waiting = { offer: "o1", answer: null, state: "have-local-offer" as const };
    expect(answerToApply(waiting, link)).toBe("a1");
    expect(answerToApply({ ...waiting, answer: "a1" }, link)).toBeNull();
    expect(answerToApply({ ...waiting, offer: "o2" }, link)).toBeNull();
    expect(answerToApply({ ...waiting, state: "stable" }, link)).toBeNull();
    expect(answerToApply(waiting, { ...link, answer: undefined })).toBeNull();
    expect(answerToApply(waiting, null)).toBeNull();
  });
});

describe("who a call is with", () => {
  it("names one person in a call of two, ringing or joined", () => {
    const ringing = call([member("ada", "joined", true, 1), member("bob", "ringing", false)]);
    expect(callName(ringing)).toBe("BOB");
    expect(peopleOf(ringing).ringing).toEqual([]);
  });

  it("names those joined and counts them, and lists whoever else rings", () => {
    const group = call([
      member("ada", "joined", false, 1),
      member("bob", "joined", false, 2),
      member("cid", "joined", true, 3),
      member("dee", "ringing", false),
      member("eve", "declined", false),
    ]);
    expect(callName(group)).toBe("ADA and 1 other");
    expect(peopleOf(group).ringing.map((each) => each.name)).toEqual(["dee"]);
  });

  it("names the first it rings for while nobody else has joined", () => {
    const rings = call([
      member("ada", "joined", true, 1),
      member("bob", "ringing", false),
      member("cid", "ringing", false),
    ]);
    expect(callName(rings)).toBe("BOB");
    expect(peopleOf(rings).ringing.map((each) => each.name)).toEqual(["cid"]);
  });
});

describe("the recent calls and the call's clock", () => {
  it("counts the others of a group, and dials the first to call back", () => {
    const [row] = rowsOf([
      {
        call: "c1",
        kind: "video",
        status: "outgoing",
        with: { name: "martin", full_name: "Martin Example" },
        at_ms: 0,
        duration_ms: 0,
        done: true,
        with_more: 2,
      },
    ]);
    expect(row).toMatchObject({ name: "Martin Example", to: "martin", also: 2 });
  });

  it("names the other person, and dials their account name to call back", () => {
    const now = new Date(2026, 9, 19, 12, 0).getTime();
    const rows = rowsOf(
      [
        {
          call: "c1",
          kind: "audio",
          status: "missed",
          with: { name: "martin", full_name: "Martin Example" },
          at_ms: new Date(2026, 9, 18, 9, 0).getTime(),
          duration_ms: 0,
          done: true,
        },
      ],
      now,
    );
    expect(rows).toEqual([
      {
        id: "c1",
        name: "Martin Example",
        kind: "audio",
        status: "missed",
        when: "Yesterday",
        to: "martin",
      },
    ]);
    expect(whenOf(new Date(2026, 9, 19, 9, 41).getTime(), now)).toBe("9:41 AM");
  });

  it("counts minutes and hours", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(725_000)).toBe("12:05");
    expect(formatDuration(3_723_000)).toBe("1:02:03");
    expect(formatDuration(-5)).toBe("0:00");
  });
});
