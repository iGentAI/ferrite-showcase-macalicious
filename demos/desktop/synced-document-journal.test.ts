import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHANGED_ELSEWHERE,
  onSaveFailure,
  PERSON_HEADER,
  WRITE_HEADER,
  WRITES_HEADER,
} from "./desktop-server";
import { mergeDocuments } from "./document-merge";
import { createSyncedDocument } from "./synced-document";

/*
 * Unsent changes of the shared synced document: a page closed before its save was stored, and the
 * next page on this browser. `fetch` stands in for the Ferrite application's routes, which
 * tests/document_writes.rs drives for real; the browser's storage is the real one of the test
 * environment. Each `open()` is a new page of the app.
 */

interface Item {
  id: string;
}
interface Doc {
  items: Item[];
}
const URL = "/api/journal-test/data";
const doc = (...ids: string[]): Doc => ({ items: ids.map((id) => ({ id })) });
const isDoc = (data: unknown): data is Doc =>
  typeof data === "object" && data !== null && Array.isArray((data as Doc).items);
const settle = () => vi.advanceTimersByTimeAsync(20);
/** The page goes: nothing it had waiting runs. */
const close = () => vi.clearAllTimers();

/**
 * Requests whose answer never comes, ended when the test's pages go.
 *
 * The desktop admits at most four API requests at once (`API_IN_FLIGHT` in desktop-server.ts),
 * module state that outlives a test. A request left hanging with nothing to end it held one of
 * those places for the rest of the file, so from the fourth such test on every request queued
 * forever and each later test timed out at 5 s, while every test passed alone. A real fetch ends
 * when its signal aborts or its page goes; these do too.
 */
const lost = new Set<(reason: unknown) => void>();
function lostAnswer(init?: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const end = (reason: unknown) => {
      lost.delete(end);
      reject(reason);
    };
    lost.add(end);
    init?.signal?.addEventListener("abort", () => end(init.signal?.reason));
  });
}

/** The test's pages are gone: whatever they still wait on ends, and gives back its place. */
async function endLostAnswers() {
  for (const end of [...lost]) end(new DOMException("The page went", "AbortError"));
  // `.finally(release)` in the desktop's request queue runs a few turns later.
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
}

function route(start: Doc | null, startRev: number, who: string | null = "ada") {
  const server = {
    data: start,
    rev: startRev,
    writes: [] as string[],
    from: startRev,
    list: true,
    who,
    reachable: true,
    /** The next PUT is stored, but its answer is lost with the page. */
    hangAfterStoring: false,
    /** The next PUT is stored, and the network goes before its answer comes. */
    goOfflineAfterStoring: false,
    /** PUTs are refused as they are, as past the server's limits. */
    refuseSaves: false,
    /** The status they are refused with. */
    refuseStatus: 400,
    /** The next PUT is stored, its answer is lost, and PUTs are refused from then on. */
    storeThenRefuse: false,
    /** The network goes as the next conflict is answered. */
    offlineAfterRefusal: false,
    /** Reads answer 200 with a body that is no document. */
    garbleReads: false,
    /** Reads are answered once this settles; whose they name is decided when they start. */
    readGate: null as Promise<void> | null,
  };
  const headers = () => ({
    ...(server.who ? { [PERSON_HEADER]: server.who } : {}),
    ...(server.list ? { [WRITES_HEADER]: `${server.from}:${server.writes.join(",")}` } : {}),
  });
  const puts: Doc[] = [];
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    if (!server.reachable) throw new TypeError("offline");
    if (init?.method !== "PUT") {
      const named = headers();
      const gate = server.readGate;
      server.readGate = null;
      if (gate) await gate;
      return new Response(
        server.garbleReads ? "not json" : JSON.stringify({ data: server.data, rev: server.rev }),
        { status: 200, headers: named },
      );
    }
    const body = JSON.parse(String(init.body)) as { base: number; data: Doc };
    const owner = (init.headers as Record<string, string>)[PERSON_HEADER];
    if (owner && owner !== server.who) {
      return new Response(JSON.stringify({ session_changed: true }), { status: 409 });
    }
    if (server.refuseSaves) {
      return new Response("{}", { status: server.refuseStatus, headers: headers() });
    }
    if (body.base !== server.rev) {
      if (server.offlineAfterRefusal) {
        server.offlineAfterRefusal = false;
        server.reachable = false;
      }
      return new Response("{}", { status: 409, headers: headers() });
    }
    puts.push(body.data);
    server.data = body.data;
    server.rev += 1;
    server.writes.push((init.headers as Record<string, string>)[WRITE_HEADER] as string);
    if (server.storeThenRefuse) {
      server.storeThenRefuse = false;
      server.refuseSaves = true;
      throw new TypeError("offline");
    }
    if (server.goOfflineAfterStoring) {
      server.goOfflineAfterStoring = false;
      server.reachable = false;
      throw new TypeError("offline");
    }
    if (server.hangAfterStoring) {
      server.hangAfterStoring = false;
      return lostAnswer(init);
    }
    return new Response(JSON.stringify({ rev: server.rev }), { status: 200, headers: headers() });
  });
  const elsewhere = (data: Doc) => {
    server.data = data;
    server.rev += 1;
    server.writes.push(`other-${server.rev}`);
  };
  return { server, puts, elsewhere };
}

const merging = {
  url: URL,
  isDocument: isDoc,
  merge: (base: Doc | null, mine: Doc, theirs: Doc) => mergeDocuments(base, mine, theirs) as Doc,
  readAttempts: 1,
};

async function open(options: Parameters<typeof createSyncedDocument<Doc>>[0] = merging) {
  const page = createSyncedDocument<Doc>(options);
  await page.load();
  return page;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  localStorage.clear();
});

afterEach(async () => {
  await endLostAnswers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a page closed before its change was stored", () => {
  it("saves the change when the app opens again", async () => {
    const { server } = route(doc("a"), 1);
    const closed = await open();
    closed.save(doc("a", "typed"));
    close();
    // The page went before its save was due: nothing was sent.
    expect(server.rev).toBe(1);

    const next = await open();
    expect(next.current()).toEqual(doc("a", "typed"));
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "typed")));
    await vi.waitFor(() => expect(next.unsaved()).toBe(false));
    await vi.waitFor(() => expect(Object.keys(localStorage)).toEqual([]));
  });

  it("saves a first document typed into an empty account", async () => {
    const { server } = route(null, 0);
    (await open()).save(doc("first"));
    close();
    await open();
    await vi.waitFor(() => expect(server.data).toEqual(doc("first")));
  });

  it("merges the change onto what other clients saved since", async () => {
    const { server, elsewhere } = route(doc("a"), 1);
    (await open()).save(doc("a", "typed"));
    close();
    elsewhere(doc("a", "b"));
    elsewhere(doc("a", "b", "c"));
    await open();
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "c", "typed"]),
    );
  });

  it("brings back nothing deleted on top of a save that was stored as the page closed", async () => {
    const { server, puts, elsewhere } = route(doc("a"), 1);
    server.hangAfterStoring = true;
    const closed = await open();
    closed.save(doc("a", "typed"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    close();
    elsewhere(doc("typed"));
    elsewhere(doc());
    const sent = puts.length;

    const next = await open();
    await settle();
    expect(next.current()).toEqual(doc());
    expect(server.data).toEqual(doc());
    expect(puts).toHaveLength(sent);
  });

  it("keeps what was typed after a stored save, on top of what others did to it", async () => {
    const { server, elsewhere } = route(doc("a"), 1);
    server.hangAfterStoring = true;
    const closed = await open();
    closed.save(doc("a", "sent"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    closed.save(doc("a", "sent", "later"));
    close();
    elsewhere(doc("a"));
    await open();
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "later"]),
    );
  });

  it("takes the last body sent as stored, and says so, where the server keeps no list", async () => {
    const { server, elsewhere } = route(doc("a"), 1);
    server.list = false;
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const closed = await open();
    server.reachable = false;
    closed.save(doc("a", "typed"));
    await vi.advanceTimersByTimeAsync(400);
    close();
    server.reachable = true;
    elsewhere(doc("a", "b"));
    elsewhere(doc("a", "b", "c"));
    await open({ ...merging, merge: undefined });
    stop();
    expect(server.data).toEqual(doc("a", "b", "c"));
    expect(failures).toHaveBeenCalledWith({ url: URL, reason: CHANGED_ELSEWHERE });
  });

  it("keeps the entry for next time when its merge fails, and recovers then", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    (await open()).save(doc("a", "typed"));
    close();
    elsewhere(doc("a", "b"));
    await open({
      ...merging,
      merge: () => {
        throw new Error("no merge today");
      },
    });
    await settle();
    expect(error).toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
    close();
    await open();
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "typed"]),
    );
    await vi.waitFor(() => expect(Object.keys(localStorage)).toEqual([]));
  });

  it("keeps the entry while its change is nowhere else", async () => {
    const { server, elsewhere } = route(doc("a"), 1);
    (await open()).save(doc("a", "typed"));
    close();
    elsewhere(doc("a", "b"));
    server.refuseSaves = true;
    const next = await open();
    await settle();
    close();
    expect(next.unsaved()).toBe(true);
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
  });

  it("merges the change where the demo has no merge of its own, as Reminders has none", async () => {
    const { server, elsewhere } = route(doc("a"), 1);
    (await open({ ...merging, merge: undefined })).save(doc("a", "typed"));
    close();
    elsewhere(doc("a", "b"));
    await open({ ...merging, merge: undefined });
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "typed"]),
    );
  });

  it("restores a reversal made while a stored save had no answer", async () => {
    const { server } = route(doc("a"), 1);
    server.hangAfterStoring = true;
    const closed = await open();
    closed.save(doc("a", "oops"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    closed.save(doc("a"));
    close();
    expect(JSON.stringify({ ...localStorage })).toContain("oops");
    await open();
    await vi.waitFor(() => expect(server.data).toEqual(doc("a")));
    await vi.waitFor(() => expect(Object.keys(localStorage)).toEqual([]));
  });

  it("keeps the older entry when the browser's storage is full, and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server } = route(doc("a"), 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const closed = await open();
    closed.save(doc("a", "kept"));
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    closed.save(doc("a", "kept", "newest"));
    close();
    setItem.mockRestore();
    stop();
    expect(failures).toHaveBeenCalledWith({
      url: URL,
      reason: "this browser could not keep the latest unsent changes",
    });
    await open();
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "kept")));
  });

  it("keeps an entry through a reply that names nobody, for that person's next page", async () => {
    const { server } = route(doc("a"), 1);
    const closed = await open();
    closed.save(doc("a", "typed"));
    server.who = null;
    await closed.refresh();
    close();
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
    server.who = "ada";
    await open();
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "typed")));
  });

  it("counts a save as stored by the revision, though another client put the document back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts, elsewhere } = route(doc("a"), 1);
    server.list = false;
    server.hangAfterStoring = true;
    const closed = await open();
    closed.save(doc("a", "stored"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    close();
    elsewhere(doc("a"));
    const sent = puts.length;
    const next = await open();
    await settle();
    expect(next.current()).toEqual(doc("a"));
    expect(server.data).toEqual(doc("a"));
    expect(puts).toHaveLength(sent);
  });

  it("keeps a body that never arrived where the server keeps no list and one save came from elsewhere", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.list = false;
    const closed = await open();
    server.reachable = false;
    closed.save(doc("a", "typed"));
    await vi.advanceTimersByTimeAsync(400);
    close();
    server.reachable = true;
    elsewhere(doc("a", "b"));
    await open();
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "typed"]),
    );
  });

  it("stores nothing of one person's when the session changes before a recovered save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts } = route(doc("a"), 1);
    (await open()).save(doc("a", "private"));
    close();
    await open();
    server.who = "grace";
    await vi.advanceTimersByTimeAsync(2000);
    close();
    expect(puts).toEqual([]);
    expect(server.data).toEqual(doc("a"));
    const entries = Object.entries({ ...localStorage }).filter(([, text]) =>
      text.includes("private"),
    );
    expect(entries.map(([key]) => key)).toEqual([expect.stringContaining("ada")]);

    server.who = "ada";
    await open();
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "private")));
  });

  it("replays nothing already stored after a reply that named nobody", async () => {
    const { server, puts, elsewhere } = route(doc("a"), 1);
    const page = await open();
    page.save(doc("a", "typed"));
    server.who = null;
    await page.refresh();
    await vi.advanceTimersByTimeAsync(1000);
    expect(puts).toEqual([]);
    server.who = "ada";
    await page.refresh();
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "typed")));
    await vi.waitFor(() => expect(page.unsaved()).toBe(false));
    close();
    elsewhere(doc("a"));
    const sent = puts.length;
    await open();
    await settle();
    expect(server.data).toEqual(doc("a"));
    expect(puts).toHaveLength(sent);
  });

  it("carries nothing of one person's through a reply that names nobody", async () => {
    const { server, puts } = route(doc("a"), 1);
    const page = await open();
    page.save(doc("a", "private"));
    server.who = null;
    await page.refresh();
    close();
    server.who = "grace";
    server.data = doc("g");
    server.rev = 9;
    await page.refresh();
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.current()).toEqual(doc("g"));
    expect(puts).toEqual([]);
    expect(server.data).toEqual(doc("g"));
    expect(Object.keys(localStorage).some((key) => key.includes("grace"))).toBe(false);
  });

  it("keeps a change refused outright when the next read fails too, where the server keeps no list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.list = false;
    const closed = await open();
    elsewhere(doc("a", "b"));
    server.offlineAfterRefusal = true;
    closed.save(doc("a", "typed"));
    await vi.advanceTimersByTimeAsync(400);
    close();
    expect(server.reachable).toBe(false);
    server.reachable = true;
    await open();
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "typed"]),
    );
  });

  it("takes no one's name from a garbled read, nor from one a change has overtaken", async () => {
    const { server, puts } = route(doc("a"), 1);
    const page = await open();
    // A read naming Grace whose body is garbled is no read.
    server.who = "grace";
    server.garbleReads = true;
    await page.refresh();
    server.garbleReads = false;
    expect(page.current()).toEqual(doc("a"));
    page.save(doc("a", "mine"));
    await vi.advanceTimersByTimeAsync(400);
    expect(puts).toEqual([]);
    expect(server.data).toEqual(doc("a"));
  });

  it("takes no one's name from a read a change has overtaken", async () => {
    const { server } = route(doc("a"), 1);
    const fresh = await open();
    let release: () => void = () => {};
    server.readGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.who = "grace";
    const reading = fresh.refresh();
    await vi.advanceTimersByTimeAsync(1);
    fresh.save(doc("a", "overtaking"));
    release();
    await reading;
    server.who = "ada";
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "overtaking")));
  });

  it("brings back nothing deleted on top of a stored save whose retry was refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts, elsewhere } = route(doc("a"), 1);
    server.refuseStatus = 403;
    server.storeThenRefuse = true;
    const closed = await open();
    server.garbleReads = true;
    closed.save(doc("a", "stored"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(server.rev).toBe(2);
    close();
    server.refuseSaves = false;
    server.garbleReads = false;
    elsewhere(doc("a"));
    const sent = puts.length;
    const next = await open();
    await settle();
    expect(next.current()).toEqual(doc("a"));
    expect(server.data).toEqual(doc("a"));
    expect(puts).toHaveLength(sent);
  });

  it("reads what a refused retry left before saving a later edit on the same page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.refuseStatus = 403;
    server.storeThenRefuse = true;
    const page = await open();
    server.garbleReads = true;
    page.save(doc("a", "stored"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(server.rev).toBe(2);
    server.refuseSaves = false;
    server.garbleReads = false;
    elsewhere(doc("a"));
    page.save(doc("a", "stored", "later"));
    await vi.advanceTimersByTimeAsync(400);
    expect(server.data).toEqual(doc("a", "later"));
    expect(page.current()).toEqual(doc("a", "later"));
  });

  it("keeps a recovered change through a conflict in a demo with no merge of its own", async () => {
    const { server, elsewhere } = route(doc("a"), 1);
    const plain = { url: URL, isDocument: isDoc, readAttempts: 1 };
    (await open(plain)).save(doc("a", "typed"));
    close();
    await open(plain);
    elsewhere(doc("a", "other"));
    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "typed", "other")));
    await vi.waitFor(() => expect(Object.keys(localStorage)).toEqual([]));
  });

  it("keeps a recovered change when the document is deleted before it is saved again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts } = route(doc("a"), 1);
    (await open()).save(doc("a", "typed"));
    close();
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    await open();
    server.data = null;
    server.rev += 1;
    await vi.advanceTimersByTimeAsync(100);
    stop();
    expect(puts).toEqual([]);
    expect(server.data).toBeNull();
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
    expect(failures).toHaveBeenCalledWith({ url: URL, reason: CHANGED_ELSEWHERE });
  });

  it("holds a closed page's entry until the combined copy is written, then lets it go", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    route(doc("a"), 1);
    const stop = onSaveFailure(() => {});
    (await open()).save(doc("a", "typed"));
    close();
    const left = Object.keys(localStorage);
    expect(left).toHaveLength(1);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const fetching = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const reads = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
      init?.method === "PUT" ? fetching() : reads(url, init),
    );
    const page = await open();
    expect(Object.keys(localStorage)).toEqual(left);
    setItem.mockRestore();
    page.save(doc("a", "typed", "newer"));
    stop();
    const kept = Object.keys(localStorage);
    expect(kept).toHaveLength(1);
    expect(kept).not.toEqual(left);
    expect(localStorage.getItem(kept[0] as string)).toContain("newer");
  });

  it("keeps an unsent edit when a refresh finds the document deleted elsewhere", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts } = route(doc("a"), 1);
    const page = await open();
    page.save(doc("a", "typed"));
    server.data = null;
    server.rev += 1;
    await page.refresh();
    await vi.advanceTimersByTimeAsync(400);
    expect(page.current()).toBeNull();
    await page.refresh();
    close();
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
    await open();
    await settle();
    expect(puts).toEqual([]);
    expect(server.data).toBeNull();
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
  });

  it("takes up a closed page's entry when a later read first names the person", async () => {
    const { server } = route(doc("a"), 1);
    (await open()).save(doc("a", "typed"));
    close();
    server.who = null;
    const page = await open();
    await settle();
    expect(page.current()).toEqual(doc("a"));
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
    server.who = "ada";
    await page.refresh();
    expect(page.current()).toEqual(doc("a", "typed"));
    await vi.advanceTimersByTimeAsync(400);
    expect(server.data).toEqual(doc("a", "typed"));
    await vi.waitFor(() => expect(Object.keys(localStorage)).toEqual([]));
  });

  it("stops showing one person's document when the next person has none", async () => {
    const { server } = route(doc("private"), 1);
    const page = await open();
    expect(page.shown()?.data).toEqual(doc("private"));
    server.who = "grace";
    server.data = null;
    server.rev = 0;
    await page.refresh();
    expect(page.shown()?.data).toBeNull();
    expect(page.current()).toBeNull();
  });

  it("keeps edits made after a stored first save when that document is deleted elsewhere", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts } = route(null, 0);
    server.hangAfterStoring = true;
    const closed = await open();
    closed.save(doc("first"));
    await vi.waitFor(() => expect(server.rev).toBe(1));
    closed.save(doc("first", "later"));
    close();
    server.data = null;
    server.rev += 1;
    const sent = puts.length;
    await open();
    await settle();
    expect(puts).toHaveLength(sent);
    expect(server.data).toBeNull();
    expect(JSON.stringify({ ...localStorage })).toContain("later");
  });

  it("keeps what was typed when the document was deleted elsewhere, and puts nothing back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, puts } = route(doc("a"), 1);
    (await open()).save(doc("a", "typed"));
    close();
    server.data = null;
    server.rev += 1;
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    await open();
    await settle();
    stop();
    expect(puts).toEqual([]);
    expect(server.data).toBeNull();
    expect(JSON.stringify({ ...localStorage })).toContain("typed");
    expect(failures).toHaveBeenCalledWith({ url: URL, reason: CHANGED_ELSEWHERE });
  });

  it("carries nothing of one person's across a change of person on an open page", async () => {
    const { server, puts } = route(doc("a"), 1);
    const page = await open();
    page.save(doc("a", "private"));
    server.who = "grace";
    server.data = doc("g");
    server.rev = 9;
    await page.refresh();
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.current()).toEqual(doc("g"));
    expect(puts).toEqual([]);
    expect(server.data).toEqual(doc("g"));
    const entries = Object.entries({ ...localStorage });
    expect(entries.filter(([, text]) => text.includes("private")).map(([key]) => key)).toEqual([
      expect.stringContaining("ada"),
    ]);
    expect(entries.some(([key]) => key.includes("grace"))).toBe(false);

    // A server that stops saying whose it is: nothing more is journaled.
    server.who = null;
    await page.refresh();
    const before = Object.keys(localStorage).length;
    server.reachable = false;
    page.save(doc("g", "unnamed"));
    expect(Object.keys(localStorage)).toHaveLength(before);
    expect(JSON.stringify({ ...localStorage })).not.toContain("unnamed");
    await vi.advanceTimersByTimeAsync(1500);
  });

  it("never gives one person's unsent change to another, and deletes it", async () => {
    const { server } = route(doc("a"), 1);
    (await open()).save(doc("a", "private"));
    close();
    expect(JSON.stringify({ ...localStorage })).toContain("private");
    server.who = "grace";
    const read = vi.spyOn(Storage.prototype, "getItem");
    const next = await open();
    await settle();
    expect(read.mock.calls.filter(([key]) => key.includes("ada"))).toEqual([]);
    read.mockRestore();
    expect(next.current()).toEqual(doc("a"));
    expect(server.data).toEqual(doc("a"));
    expect(JSON.stringify({ ...localStorage })).not.toContain("private");
  });

  it("keeps no entry once the change is stored", async () => {
    route(doc("a"), 1);
    const page = await open();
    page.save(doc("a", "typed"));
    expect(Object.keys(localStorage)).toHaveLength(1);
    await vi.waitFor(() => expect(page.unsaved()).toBe(false));
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("saves as it always did, and journals nothing, on a server that has never named anyone", async () => {
    const { server, puts } = route(doc("a"), 1, null);
    const page = await open();
    page.save(doc("a", "typed"));
    expect(Object.keys(localStorage)).toEqual([]);
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "typed")));
    expect(puts).toEqual([doc("a", "typed")]);
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("journals nothing from a server that does not say whose document it is", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ data: doc("a"), rev: 1 }), { status: 200 }),
    );
    (await open()).save(doc("a", "typed"));
    expect(Object.keys(localStorage)).toEqual([]);
  });
});

describe("a save lost while the page stays open", () => {
  it("counts a save as stored by the revision, though another client put the document back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.list = false;
    server.goOfflineAfterStoring = true;
    const page = await open();
    page.save(doc("a", "stored"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    await vi.advanceTimersByTimeAsync(1500);
    server.reachable = true;
    elsewhere(doc("a"));
    // A page that lost a save reads again before it sends: the next change is what does that.
    page.save(doc("a", "stored", "more"));
    await vi.waitFor(() => expect(server.data).toEqual(doc("a", "more")));
    expect(page.current()).toEqual(doc("a", "more"));
  });

  it("brings back nothing deleted on top of it where the server keeps no list, and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.list = false;
    server.goOfflineAfterStoring = true;
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const page = await open();
    page.save(doc("a", "stored"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    await vi.advanceTimersByTimeAsync(1500);
    page.save(doc("a", "stored", "later"));
    await vi.advanceTimersByTimeAsync(400);
    server.reachable = true;
    elsewhere(doc("a"));
    elsewhere(doc("a", "b"));
    page.save(doc("a", "stored", "later", "more"));
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "later", "more"]),
    );
    stop();
    expect(failures).toHaveBeenCalledWith({ url: URL, reason: CHANGED_ELSEWHERE });
  });

  it("does not take a save refused on its first attempt as stored, where the server keeps no list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.list = false;
    const page = await open();
    elsewhere(doc("a", "b"));
    page.save(doc("a", "typed"));
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "typed"]),
    );
  });

  it("brings back nothing deleted on top of a stored save, though the person typed on while offline", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    server.goOfflineAfterStoring = true;
    const page = await open();
    page.save(doc("a", "stored"));
    await vi.waitFor(() => expect(server.rev).toBe(2));
    await vi.advanceTimersByTimeAsync(1500);
    // Its outcome is not known, and nothing can be read: the next change sends nothing yet.
    page.save(doc("a", "stored", "later"));
    await vi.advanceTimersByTimeAsync(400);
    expect(server.rev).toBe(2);
    server.reachable = true;
    elsewhere(doc("a"));
    elsewhere(doc("a", "b"));
    page.save(doc("a", "stored", "later", "more"));
    await vi.waitFor(() =>
      expect(server.data?.items.map(({ id }) => id).sort()).toEqual(["a", "b", "later", "more"]),
    );
  });
  it("keeps the change when two saves came from elsewhere, and saves it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, elsewhere } = route(doc("a"), 1);
    const page = await open();
    server.reachable = false;
    page.save(doc("a", "typed"));
    await vi.advanceTimersByTimeAsync(1500);
    server.reachable = true;
    elsewhere(doc("a", "b"));
    elsewhere(doc("a", "b", "c"));
    page.save(doc("a", "typed", "more"));
    await vi.waitFor(
      () =>
        expect(server.data?.items.map(({ id }) => id).sort()).toEqual([
          "a",
          "b",
          "c",
          "more",
          "typed",
        ]),
      { timeout: 4000 },
    );
  });
});
