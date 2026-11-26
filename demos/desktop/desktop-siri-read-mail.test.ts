import { afterEach, describe, expect, it, vi } from "vitest";
import { answerHere } from "./desktop-siri-answers";

const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const person = (name: string) => ({ name: name.toLowerCase(), full_name: name });

const INBOX = {
  messages: [
    { id: "m3", mailbox: "sent", unread: true, subject: "Mine", from: person("Me") },
    { id: "m2", mailbox: "inbox", unread: true, subject: "Lunch", from: person("Ada Lovelace") },
    { id: "m1", mailbox: "inbox", unread: false, subject: "Old", from: person("Grace") },
    { id: "m0", mailbox: "inbox", unread: true, subject: "", from: { name: "bob" } },
  ],
};

describe("Siri reading the inbox", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("says what is new, and lists each unread message of the inbox with its id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(INBOX)),
    );
    const said = await answerHere("check my email");
    expect(said?.text).toBe("You have 2 new messages. The newest is from Ada Lovelace: “Lunch”.");
    expect(said?.card).toEqual({
      title: "Mail",
      app: "mail",
      items: [
        { text: "Ada Lovelace · Lunch", id: "m2" },
        { text: "bob · (No Subject)", id: "m0" },
      ],
    });
    expect((await answerHere("do I have any new mail?"))?.text).toMatch(/^You have 2 new/);
    expect((await answerHere("read my mail"))?.text).toMatch(/^You have 2 new/);
  });

  it("says one, none, and when the mail cannot be reached", async () => {
    const fetch = vi.fn(async () => reply({ messages: [INBOX.messages[1]] }));
    vi.stubGlobal("fetch", fetch);
    expect((await answerHere("new mail"))?.text).toBe(
      "You have one new message, from Ada Lovelace: “Lunch”.",
    );
    fetch.mockImplementation(async () => reply({ messages: [INBOX.messages[2]] }));
    expect((await answerHere("read my email"))?.text).toBe("You have no new mail.");
    fetch.mockImplementation(async () => new Response("", { status: 503 }));
    expect((await answerHere("check my mail"))?.text).toBe("I can’t reach your mail right now.");
  });
});

describe("Siri finding a place", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("answers with its map, and with the words alone when the search finds none", async () => {
    const fetch = vi.fn(async () =>
      reply({
        places: [
          {
            id: "p1",
            name: "Paris",
            category: "city",
            lat: 48.85,
            lon: 2.35,
            address: ["Paris", "France"],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const said = await answerHere("where is paris");
    expect(said?.text).toBe("Here’s Paris in Maps.");
    expect(said?.card).toMatchObject({
      app: "maps",
      lead: "Paris",
      detail: "Paris, France",
      map: { lat: 48.85, lon: 2.35 },
    });
    fetch.mockImplementation(async () => new Response("", { status: 503 }));
    const alone = await answerHere("where is nowhere");
    expect(alone?.text).toBe("Here’s Nowhere in Maps.");
    expect(alone?.card).toBeNull();
  });
});
