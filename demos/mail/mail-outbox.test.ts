import { afterEach, describe, expect, it, vi } from "vitest";
import { moveRefusal } from "./mail";
import { flushOutbox, outboxHeader, toMailMessage } from "./mail-live";
import type { OutboxEntry } from "./mail-outbox";

// jsdom has no IndexedDB: the store here is a map in memory, in place of `mail-outbox.ts`'s database.
// The journey mail-rows-batch11 drives the real one across a reload.
const store = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  offline: false,
}));
vi.mock("./mail-outbox", () => ({
  isOffline: () => store.offline,
  readOutbox: async () => [...store.entries.values()],
  dropFromOutbox: async (_me: string, key: string) => {
    store.entries.delete(key);
  },
  keepInOutbox: async (_me: string, entry: { key: string }) => {
    store.entries.set(entry.key, entry);
  },
}));
vi.mock("./mail-send-keys", () => ({
  forgetSendKey: async () => {},
  sendKeyFor: async (_me: string, _body: unknown, fresh: string) => fresh,
}));

const entry = (key: string, subject: string): OutboxEntry => ({
  key,
  at: 1_000,
  body: { to: ["martin"], cc: ["ann"], subject, text: `about ${subject}`, attachments: ["a1"] },
});
const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The server, answering each send in turn; what it was sent, as subject and key. */
function answering(...answers: (Response | Error)[]) {
  const sends: [string, string | null][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sends.push([
        JSON.parse(String(init.body)).subject,
        new Headers(init.headers).get("idempotency-key"),
      ]);
      const answer = answers.shift();
      if (!answer || answer instanceof Error) throw answer ?? new Error("no answer");
      return answer;
    }),
  );
  return sends;
}

afterEach(() => {
  store.entries.clear();
  store.offline = false;
  vi.unstubAllGlobals();
});

describe("flushOutbox", () => {
  it("sends each message under its own key and empties the Outbox", async () => {
    store.entries.set("k1", entry("k1", "One"));
    store.entries.set("k2", entry("k2", "Two"));
    const sends = answering(json(201), json(200));
    expect(await flushOutbox("chris")).toBe(2);
    expect(sends).toEqual([
      ["One", "k1"],
      ["Two", "k2"],
    ]);
    expect(store.entries.size).toBe(0);
  });

  it("keeps a message whose answer was lost, stops, and sends it again under the same key", async () => {
    store.entries.set("k1", entry("k1", "One"));
    store.entries.set("k2", entry("k2", "Two"));
    const sends = answering(new Error("lost"), json(201), json(201));
    expect(await flushOutbox("chris")).toBe(0);
    expect(sends).toEqual([["One", "k1"]]);
    expect((store.entries.get("k1") as OutboxEntry).error).toBe(
      "Mail could not tell whether it was sent. Get Mail tries again, and it is never delivered twice.",
    );
    expect(await flushOutbox("chris")).toBe(2);
    expect(sends.slice(1)).toEqual([
      ["One", "k1"],
      ["Two", "k2"],
    ]);
    expect(store.entries.size).toBe(0);
  });

  it("keeps what the server refuses with its reason, and goes on to the next", async () => {
    store.entries.set("k1", entry("k1", "One"));
    store.entries.set("k2", entry("k2", "Two"));
    answering(json(422, { error: "no such account" }), json(201));
    expect(await flushOutbox("chris")).toBe(1);
    expect([...store.entries.keys()]).toEqual(["k1"]);
    expect((store.entries.get("k1") as OutboxEntry).error).toBe("no such account");
  });

  it("counts a message erased since an earlier try as gone", async () => {
    store.entries.set("k1", entry("k1", "One"));
    answering(json(409, { error: "this message was sent and has since been erased" }));
    expect(await flushOutbox("chris")).toBe(1);
    expect(store.entries.size).toBe(0);
  });

  it("sends nothing while offline", async () => {
    store.entries.set("k1", entry("k1", "One"));
    store.offline = true;
    const sends = answering();
    expect(await flushOutbox("chris")).toBe(0);
    expect(sends).toEqual([]);
    expect(store.entries.size).toBe(1);
  });

  it("two calls at once make one pass", async () => {
    store.entries.set("k1", entry("k1", "One"));
    const sends = answering(json(201));
    expect(await Promise.all([flushOutbox("chris"), flushOutbox("chris")])).toEqual([1, 1]);
    expect(sends).toHaveLength(1);
  });
});

describe("a message in the Outbox", () => {
  it("shows as written, with the recipients as they were typed", () => {
    const message = toMailMessage(
      outboxHeader(entry("k1", "  "), { name: "chris", full_name: "Chris Carter" }),
    );
    expect(message.id).toBe("outbox-k1");
    expect(message.mailbox).toBe("outbox");
    expect(message.subject).toBe("(No Subject)");
    expect(message.from).toBe("Chris Carter");
    expect(message.toAddresses).toEqual(["martin"]);
    expect(message.cc).toEqual(["ann"]);
    expect(message.unread).toBe(false);
  });

  it("can only be deleted, and nothing moves into the Outbox", () => {
    const waiting = toMailMessage(outboxHeader(entry("k1", "One"), { name: "c", full_name: "" }));
    expect(moveRefusal(waiting, "trash")).toBeUndefined();
    expect(moveRefusal(waiting, "archive")).toBe(
      "This message is waiting to be sent: it can only be deleted from the Outbox.",
    );
    expect(moveRefusal({ ...waiting, mailbox: "inbox" }, "outbox")).toBe(
      "Only a message sent while Mail is offline waits in the Outbox: a message cannot be moved there.",
    );
  });
});
