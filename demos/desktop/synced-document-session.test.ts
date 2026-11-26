import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERSON_HEADER, setDesktopSession, WRITES_HEADER } from "./desktop-server";
import { mergeDocuments } from "./document-merge";
import { createSyncedDocument } from "./synced-document";

/*
 * The desktop names another session on an open page (signing in as Guest User does not load the
 * page again). `fetch` stands in for the routes, which refuse a save bound to anyone but the
 * person behind the request, as `src/lib.rs` does; e2e/synced-signin-journey.mjs drives the real
 * ones.
 */

interface Doc {
  items: { id: string }[];
}
const URL = "/api/session-test/data";
const doc = (...ids: string[]): Doc => ({ items: ids.map((id) => ({ id })) });
const isDoc = (data: unknown): data is Doc =>
  typeof data === "object" && data !== null && Array.isArray((data as Doc).items);

function route() {
  const people = new Map<string, { data: Doc | null; rev: number }>();
  const server = { who: "browser", refused: 0, hold: null as Promise<void> | null };
  const own = () => {
    const found = people.get(server.who) ?? { data: null, rev: 0 };
    people.set(server.who, found);
    return found;
  };
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    const headers = { [PERSON_HEADER]: server.who, [WRITES_HEADER]: "0:" };
    if (init?.method !== "PUT") {
      const { data, rev } = own();
      const hold = server.hold;
      server.hold = null;
      if (hold) await hold;
      return new Response(JSON.stringify({ data, rev }), { status: 200, headers });
    }
    const named = (init.headers as Record<string, string>)[PERSON_HEADER];
    if (named && named !== server.who) {
      server.refused += 1;
      return new Response(JSON.stringify({ session_changed: true }), { status: 409 });
    }
    const body = JSON.parse(String(init.body)) as { base: number; data: Doc };
    const mine = own();
    if (body.base !== mine.rev) return new Response("{}", { status: 409, headers });
    mine.data = body.data;
    mine.rev += 1;
    return new Response(JSON.stringify({ rev: mine.rev }), { status: 200, headers });
  });
  return { server, people };
}

const options = {
  url: URL,
  isDocument: isDoc,
  merge: (base: Doc | null, mine: Doc, theirs: Doc) => mergeDocuments(base, mine, theirs) as Doc,
  readAttempts: 1,
};
const settle = () => vi.advanceTimersByTimeAsync(400);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a session named on an open page", () => {
  it("keeps the first change after signing in, for the person who signed in", async () => {
    const { server, people } = route();
    const page = createSyncedDocument<Doc>(options);
    await page.load();
    server.who = "guest";
    setDesktopSession("guest-session");
    await settle();
    expect(page.shown()?.data).toBeNull();
    page.save(doc("first"));
    await settle();
    expect(server.refused).toBe(0);
    expect(page.current()).toEqual(doc("first"));
    expect(people.get("guest")?.data).toEqual(doc("first"));
    expect(people.get("browser")?.data).toBeNull();
    setDesktopSession(null);
  });

  it("shows the next person's document and nothing unsent of the one before", async () => {
    const { server, people } = route();
    people.set("grace", { data: doc("graces"), rev: 3 });
    const page = createSyncedDocument<Doc>(options);
    await page.load();
    page.save(doc("unsent"));
    server.who = "grace";
    setDesktopSession("grace-session");
    await settle();
    expect(page.current()).toEqual(doc("graces"));
    expect(page.unsaved()).toBe(false);
    expect(people.get("grace")?.data).toEqual(doc("graces"));
    expect(people.get("browser")?.data).toBeNull();
    setDesktopSession(null);
  });

  it("brings an unsent change back when the same person is behind the new session", async () => {
    const { people } = route();
    const page = createSyncedDocument<Doc>(options);
    await page.load();
    page.save(doc("unsent"));
    setDesktopSession("same-person");
    await settle();
    await settle();
    expect(page.current()).toEqual(doc("unsent"));
    expect(people.get("browser")?.data).toEqual(doc("unsent"));
    await vi.waitFor(() => expect(Object.keys(localStorage)).toEqual([]));
    setDesktopSession(null);
  });

  it("does not send a waiting retry once another person is behind the page", async () => {
    const { server, people } = route();
    people.set("grace", { data: doc("graces"), rev: 1 });
    const page = createSyncedDocument<Doc>(options);
    await page.load();
    const reads = globalThis.fetch;
    const sent: string[] = [];
    let fail = true;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        sent.push(String(init.body));
        if (fail) throw new TypeError("offline");
      }
      return reads(url, init);
    });
    page.save(doc("browsers"));
    await vi.advanceTimersByTimeAsync(350);
    expect(sent).toHaveLength(1);
    fail = false;
    server.who = "grace";
    setDesktopSession("grace-session");
    await vi.advanceTimersByTimeAsync(1500);
    expect(sent).toHaveLength(1);
    expect(people.get("grace")).toEqual({ data: doc("graces"), rev: 1 });
    expect(page.current()).toEqual(doc("graces"));
    setDesktopSession(null);
  });

  it("ignores a read of the session before, when its reply comes after the change", async () => {
    const { server, people } = route();
    people.set("browser", { data: doc("old"), rev: 1 });
    people.set("grace", { data: doc("graces"), rev: 1 });
    let answer = () => {};
    server.hold = new Promise((resolve) => {
      answer = resolve;
    });
    const page = createSyncedDocument<Doc>(options);
    void page.load();
    await vi.advanceTimersByTimeAsync(0);
    server.who = "grace";
    setDesktopSession("grace-session");
    await settle();
    answer();
    await settle();
    expect(page.current()).toEqual(doc("graces"));
    setDesktopSession(null);
  });
});
