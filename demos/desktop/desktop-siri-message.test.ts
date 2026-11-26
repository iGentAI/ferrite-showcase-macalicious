import { afterEach, describe, expect, it, vi } from "vitest";
import { takeAddressRequests } from "./desktop-reach";
import { answerHere } from "./desktop-siri-answers";

const CARDS = {
  cards: [
    { id: "c1", account: "mac", first: "Ada", last: "Lovelace", user: "ada" },
    { id: "c2", account: "mac", first: "Sam", last: "Lee" },
    { id: "c3", account: "mac", first: "Sam", last: "Roy" },
  ],
};

describe("Siri starting a message", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens Messages on a card's account, or the name said, with the words ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(CARDS), { status: 200 })),
    );
    expect((await answerHere("message ada saying I'm late"))?.text).toBe(
      "Here’s your message to Ada Lovelace, ready to send: “I'm late”.",
    );
    expect((await answerHere("send a text to martin"))?.text).toBe(
      "Here’s a new message to Martin.",
    );
    expect((await answerHere("text ada that says on my way"))?.text).toBe(
      "Here’s your message to Ada Lovelace, ready to send: “on my way”.",
    );
    expect((await answerHere("message sam"))?.text).toBe(
      "Which Sam do you mean: Sam Lee, Sam Roy?",
    );
    expect(takeAddressRequests("messages").map(({ to, text }) => [to, text])).toEqual([
      ["ada", "I'm late"],
      ["martin", undefined],
      ["ada", "on my way"],
    ]);
  });

  it("opens FaceTime on a card's account, or the name said", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(CARDS), { status: 200 })),
    );
    expect((await answerHere("facetime ada"))?.text).toBe(
      "Here’s a FaceTime call to Ada Lovelace.",
    );
    expect((await answerHere("audio call martin"))?.text).toBe(
      "Here’s a FaceTime audio call to Martin.",
    );
    expect(takeAddressRequests("facetime").map(({ to, kind }) => [to, kind])).toEqual([
      ["ada", "video"],
      ["martin", "audio"],
    ]);
  });

  it("leaves other sentences alone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(CARDS), { status: 200 })),
    );
    expect(await answerHere("text size")).toBeNull();
    expect(takeAddressRequests("messages")).toEqual([]);
  });
});
