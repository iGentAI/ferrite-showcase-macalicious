import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appWritesUnderWay, REQUEST_DEADLINE_MS, reloadServerDocuments } from "./desktop-server";
import { createSyncedDocument, recordTag, type Shown } from "./synced-document";

/** What a window is shown, without the copy's number. */
const plain = (shown: Shown<unknown> | undefined) =>
  shown && { data: shown.data, origin: shown.origin };

interface Item {
  id: string;
  v: number;
}
interface Doc {
  items: Item[];
}

const isDoc = (data: unknown): data is Doc =>
  typeof data === "object" && data !== null && Array.isArray((data as Doc).items);
const doc = (...items: [string, number][]): Doc => ({
  items: items.map(([id, v]) => ({ id, v })),
});

describe("createSyncedDocument", () => {
  const URL = "/api/test/data";
  let server: { data: Doc | null; rev: number };
  let puts: string[];
  let gets: number;
  /** How the next PUTs are answered, before the server's own rule; empty means the rule. */
  let answers: ((
    body: { base: number; data: Doc },
    init: RequestInit,
  ) => Response | Promise<Response>)[];
  /** How many of the next GETs get no answer: they end only when their request is aborted. */
  let hangingReads: number;

  /** Store on the right base, as the Ferrite application does; 409 with its revision otherwise. */
  const rule = (body: { base: number; data: Doc }) => {
    if (body.base !== server.rev) {
      return new Response(JSON.stringify({ error: "changed", rev: server.rev }), { status: 409 });
    }
    server = { data: body.data, rev: server.rev + 1 };
    return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
  };

  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    server = { data: doc(["a", 1]), rev: 3 };
    puts = [];
    gets = 0;
    answers = [];
    hangingReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe(URL);
        if (init?.method === "PUT") {
          const text = String(init.body);
          puts.push(text);
          return (answers.shift() ?? rule)(JSON.parse(text), init);
        }
        gets += 1;
        if (hangingReads > 0) {
          hangingReads -= 1;
          return hang(init);
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const create = () => createSyncedDocument<Doc>({ url: URL, isDocument: isDoc });
  /** A merge of item lists by id: the page's items where both sides have one. */
  const byId = (_base: Doc | null, mine: Doc, theirs: Doc): Doc => ({
    items: [
      ...mine.items,
      ...theirs.items.filter((item) => !mine.items.some((own) => own.id === item.id)),
    ],
  });
  /** A request the server never answers: like `fetch`, it fails only when it is aborted. */
  const hang = (init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  const sent = (index: number) => JSON.parse(puts.at(index) ?? "null");

  it("saves on the revision it read, and takes the server's next one", async () => {
    vi.useFakeTimers();
    const synced = create();
    expect(await synced.load()).toEqual(doc(["a", 1]));
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    expect(sent(0)).toEqual({ base: 3, data: doc(["a", 2]) });
    synced.save(doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(300);
    expect(sent(1).base).toBe(4);
    expect(server).toEqual({ data: doc(["a", 3]), rev: 5 });
    expect(synced.unsaved()).toBe(false);
  });

  it("has one save under way at a time, and sends a change made meanwhile after it", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    let release: () => void = () => {};
    answers.push((body) => new Promise((resolve) => (release = () => resolve(rule(body)))));
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    synced.save(doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(puts).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(2);
    expect(sent(1)).toEqual({ base: 4, data: doc(["a", 3]) });
    expect(server.rev).toBe(5);
  });

  it("drops a change that meets a newer revision, and shows the stored document in every window", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    // Another window saves first.
    server = { data: doc(["a", 1], ["t", 1]), rev: 4 };
    const mine = {};
    synced.save(doc(["a", 2]), mine);
    expect(plain(synced.shown())).toEqual({ data: doc(["a", 2]), origin: mine });
    await vi.advanceTimersByTimeAsync(300);
    // The stale body is not sent again, and nothing is merged into the stored document.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(puts).toHaveLength(1);
    expect(server).toEqual({ data: doc(["a", 1], ["t", 1]), rev: 4 });
    expect(synced.current()).toEqual(doc(["a", 1], ["t", 1]));
    expect(plain(synced.shown())).toEqual({ data: doc(["a", 1], ["t", 1]), origin: null });
    expect(synced.unsaved()).toBe(false);
    // The next change is saved on the revision read.
    synced.save(doc(["a", 3], ["t", 1]));
    await vi.advanceTimersByTimeAsync(300);
    expect(sent(1).base).toBe(4);
    expect(server.rev).toBe(5);
  });

  it("sends a save that met a network error once more, the same body on the same base", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    answers.push(() => {
      throw new TypeError("network");
    });
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300 + 1000);
    expect(puts).toHaveLength(2);
    expect(puts[1]).toBe(puts[0]);
    expect(server).toEqual({ data: doc(["a", 2]), rev: 4 });
    expect(synced.unsaved()).toBe(false);
  });

  it("gives up a save the server never answers at its deadline, and sends it again", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    answers.push((_body, init) => hang(init));
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    expect(puts).toHaveLength(1);
    // A write under way, which another browser's change to the app waits for (desktop-live.ts).
    expect(appWritesUnderWay("test")).toBe(1);
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS);
    expect(appWritesUnderWay("test")).toBe(0);
    // Its one retry after a network error, the same body on the same base, is stored.
    await vi.advanceTimersByTimeAsync(1000);
    expect(puts).toHaveLength(2);
    expect(puts[1]).toBe(puts[0]);
    expect(server).toEqual({ data: doc(["a", 2]), rev: 4 });
    expect(synced.unsaved()).toBe(false);
    // And the next change is saved as usual.
    synced.save(doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(300);
    expect(server).toEqual({ data: doc(["a", 3]), rev: 5 });
  });

  it("keeps the changes made during a save that was stored though its answer never came", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    // Stored, then no answer by the deadline. The server writes each item's fields in an order
    // of its own, as it writes its records.
    answers.push((body, init) => {
      rule(body);
      server = {
        ...server,
        data: { items: (server.data?.items ?? []).map(({ id, v }) => ({ v, id })) },
      };
      return hang(init);
    });
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    // The person goes on typing while the save is under way.
    await vi.advanceTimersByTimeAsync(5_000);
    synced.save(doc(["a", 2], ["b", 1]));
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS + 1000);
    // The retry met the save's own body (409), which the page reads: nothing is dropped, and the
    // change made meanwhile is saved on it.
    await vi.advanceTimersByTimeAsync(1000);
    expect(server).toEqual({ data: doc(["a", 2], ["b", 1]), rev: 5 });
    expect(synced.current()).toEqual(doc(["a", 2], ["b", 1]));
    expect(synced.unsaved()).toBe(false);
  });

  it("counts a save stored though its answer never came as saved, its fields in any order", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    answers.push((body, init) => {
      rule(body);
      server = {
        ...server,
        data: { items: (server.data?.items ?? []).map(({ id, v }) => ({ v, id })) },
      };
      return hang(init);
    });
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300 + REQUEST_DEADLINE_MS + 1000 + 1000);
    expect(puts).toHaveLength(2);
    expect(synced.unsaved()).toBe(false);
  });

  it("gives up a read the server never answers at its deadline, and reads again", async () => {
    vi.useFakeTimers();
    hangingReads = 1;
    const synced = create();
    const loaded = synced.load();
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS + 1000);
    expect(await loaded).toEqual(doc(["a", 1]));
    expect(gets).toBe(2);
    expect(synced.readable()).toBe(true);
  });

  it("reads the stored document after a retry whose answer was lost, and sends nothing more", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    const lost = (body: { base: number; data: Doc }) => {
      rule(body);
      throw new TypeError("network");
    };
    answers.push(lost, lost);
    synced.save(doc(["a", 2]));
    const before = gets;
    await vi.advanceTimersByTimeAsync(300 + 1000);
    await vi.advanceTimersByTimeAsync(10_000);
    // The first try was stored; its retry met a 409 whose answer was lost too.
    expect(puts).toHaveLength(2);
    expect(gets).toBe(before + 1);
    expect(plain(synced.shown())).toEqual({ data: doc(["a", 2]), origin: null });
    expect(synced.unsaved()).toBe(false);
  });

  it("reads the stored document after a server error, without sending the save again", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    answers.push(() => new Response("unavailable", { status: 503 }));
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(puts).toHaveLength(1);
    expect(synced.current()).toEqual(doc(["a", 1]));
    expect(synced.shown()?.origin).toBeNull();
  });

  it("marks the change unsaved and sends nothing while the stored document cannot be read", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") puts.push(String(init.body));
        return new Response("unavailable", { status: 503 });
      }),
    );
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300 + 3000);
    expect(puts).toHaveLength(1);
    expect(synced.unsaved()).toBe(true);
  });

  it("does not send a refused body again, but sends the next change", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    answers.push(() => new Response('{"error":"too long"}', { status: 400 }));
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    expect(synced.unsaved()).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(puts).toHaveLength(1);
    synced.save(doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(300);
    expect(server).toEqual({ data: doc(["a", 3]), rev: 4 });
    expect(synced.unsaved()).toBe(false);
  });

  it("sends nothing as the page is hidden or left", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    synced.save(doc(["a", 2]));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    try {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }
    expect(puts).toHaveLength(0);
    // The change goes after its usual delay.
    await vi.advanceTimersByTimeAsync(300);
    expect(puts).toHaveLength(1);
  });

  it("gives every window a change, and makes no change of an unchanged document", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    expect(plain(synced.shown())).toEqual({ data: doc(["a", 1]), origin: null });
    const window = {};
    synced.save(doc(["a", 2]), window);
    const after = synced.shown();
    expect(plain(after)).toEqual({ data: doc(["a", 2]), origin: window });
    // Another window showing the same document saves it: nothing changes, nothing is sent twice.
    synced.save(doc(["a", 2]), {});
    expect(synced.shown()).toBe(after);
    await vi.advanceTimersByTimeAsync(300);
    expect(puts).toHaveLength(1);
  });

  it("reads the stored document again when asked and no change waits", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    server = { data: doc(["a", 1], ["t", 1]), rev: 4 };
    await synced.refresh();
    expect(plain(synced.shown())).toEqual({ data: doc(["a", 1], ["t", 1]), origin: null });
    // With a change waiting, the copy is kept for that change's save.
    synced.save(doc(["a", 2], ["t", 1]));
    server = { data: doc(["z", 1]), rev: 9 };
    await synced.refresh();
    expect(synced.current()).toEqual(doc(["a", 2], ["t", 1]));
  });

  it("reads a change made in another tab or browser when desktop-live reloads the app", async () => {
    vi.useFakeTimers();
    const synced = createSyncedDocument<Doc>({
      url: URL,
      isDocument: isDoc,
      refreshOnRemoteChange: true,
    });
    await synced.load();
    // Another browser of the person saved: desktop-live hears it and reloads the app's documents.
    server = { data: doc(["a", 1], ["b", 2]), rev: 4 };
    reloadServerDocuments("test");
    await vi.waitFor(() =>
      expect(plain(synced.shown())).toEqual({ data: doc(["a", 1], ["b", 2]), origin: null }),
    );
    // Another app's change reads nothing of this document.
    const before = gets;
    reloadServerDocuments("other");
    await Promise.resolve();
    expect(gets).toBe(before);
    // A change of this page's waits: it is kept, and its save meets the newer revision.
    synced.save(doc(["a", 3], ["b", 2]));
    server = { data: doc(["z", 1]), rev: 7 };
    reloadServerDocuments("test");
    await Promise.resolve();
    expect(synced.current()).toEqual(doc(["a", 3], ["b", 2]));
  });

  it("follows no other tab's change without refreshOnRemoteChange, as before", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    const before = gets;
    server = { data: doc(["a", 1], ["b", 2]), rev: 4 };
    reloadServerDocuments("test");
    await vi.advanceTimersByTimeAsync(100);
    expect(gets).toBe(before);
    expect(plain(synced.shown())).toEqual({ data: doc(["a", 1]), origin: null });
  });

  it("merges a change still waiting here onto another browser's change, and saves the merge", async () => {
    vi.useFakeTimers();
    const synced = createSyncedDocument<Doc>({
      url: URL,
      isDocument: isDoc,
      refreshOnRemoteChange: true,
      merge: byId,
    });
    await synced.load();
    // Typed here, not sent yet.
    synced.save(doc(["a", 1], ["b", 1]));
    // Another browser saved meanwhile.
    server = { data: doc(["a", 1], ["c", 1]), rev: 4 };
    reloadServerDocuments("test");
    await vi.waitFor(() => expect(synced.current()).toEqual(doc(["a", 1], ["b", 1], ["c", 1])));
    expect(plain(synced.shown())?.data).toEqual(doc(["a", 1], ["b", 1], ["c", 1]));
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent(-1)).toEqual({ base: 4, data: doc(["a", 1], ["b", 1], ["c", 1]) });
    expect(server).toEqual({ data: doc(["a", 1], ["b", 1], ["c", 1]), rev: 5 });
    expect(synced.unsaved()).toBe(false);
  });

  it("stops sending a merge the server keeps refusing, and keeps it unsaved until the next change", async () => {
    vi.useFakeTimers();
    const synced = createSyncedDocument<Doc>({ url: URL, isDocument: isDoc, merge: byId });
    await synced.load();
    // Every save is refused from now on.
    answers = Array.from(
      { length: 20 },
      () => () => new Response(JSON.stringify({ error: "changed", rev: 9 }), { status: 409 }),
    );
    synced.save(doc(["a", 1], ["b", 1]));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(puts).toHaveLength(4);
    expect(synced.unsaved()).toBe(true);
    expect(synced.current()).toEqual(doc(["a", 1], ["b", 1]));
    // The next change is sent again (and, refused, merged and sent once more at once).
    synced.save(doc(["a", 1], ["b", 2]));
    await vi.advanceTimersByTimeAsync(1000);
    expect(puts.length).toBeGreaterThan(4);
    expect(sent(4)).toEqual({ base: 3, data: doc(["a", 1], ["b", 2]) });
  });

  it("merges a change that met a newer revision (409) instead of dropping it", async () => {
    vi.useFakeTimers();
    const synced = createSyncedDocument<Doc>({ url: URL, isDocument: isDoc, merge: byId });
    await synced.load();
    // Another browser saved before this page's change was sent.
    server = { data: doc(["a", 1], ["c", 1]), rev: 4 };
    synced.save(doc(["a", 1], ["b", 1]));
    await vi.advanceTimersByTimeAsync(2000);
    // The first save met 409 on base 3; the merge is saved on revision 4.
    expect(sent(0)).toEqual({ base: 3, data: doc(["a", 1], ["b", 1]) });
    expect(sent(-1)).toEqual({ base: 4, data: doc(["a", 1], ["b", 1], ["c", 1]) });
    expect(server.data).toEqual(doc(["a", 1], ["b", 1], ["c", 1]));
    expect(synced.current()).toEqual(doc(["a", 1], ["b", 1], ["c", 1]));
    // A document forgotten on the server is not merged back.
    server = { data: null, rev: 6 };
    synced.save(doc(["a", 2], ["b", 1], ["c", 1]));
    await vi.advanceTimersByTimeAsync(2000);
    expect(synced.current()).toBeNull();
  });

  it("is saved again once a refused document is put back as it is stored", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    answers.push(() => new Response('{"error":"too long"}', { status: 400 }));
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    expect(synced.unsaved()).toBe(true);
    // The window undoes the refused change: what it shows is what is stored.
    synced.save(doc(["a", 1]));
    await vi.advanceTimersByTimeAsync(300);
    expect(synced.unsaved()).toBe(false);
    expect(puts).toHaveLength(1);
  });

  it("sends a change made while a refused body was under way", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    let release: () => void = () => {};
    answers.push(
      () =>
        new Promise((resolve) => {
          release = () => resolve(new Response('{"error":"too long"}', { status: 400 }));
        }),
    );
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    // A newer change is made, and its timer fires, while the refused body is still under way.
    synced.save(doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(300);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(server).toEqual({ data: doc(["a", 3]), rev: 4 });
    expect(synced.unsaved()).toBe(false);
  });

  it("takes a newer revision from a refresh even when the document is the same", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    // Another page saved the same document, and the revision moved on.
    server = { data: doc(["a", 1]), rev: 7 };
    await synced.refresh();
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    expect(sent(0).base).toBe(7);
    expect(server).toEqual({ data: doc(["a", 2]), rev: 8 });
  });

  it("ignores a refresh answered after a save that started and finished meanwhile", async () => {
    vi.useFakeTimers();
    const synced = create();
    await synced.load();
    // The refresh's read is held until the save is stored.
    let answerRead: () => void = () => {};
    const old = JSON.stringify(server);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") return rule(JSON.parse(String(init.body)));
        return new Promise<Response>((resolve) => {
          answerRead = () => resolve(new Response(old, { status: 200 }));
        });
      }),
    );
    const refreshed = synced.refresh();
    synced.save(doc(["a", 2]));
    await vi.advanceTimersByTimeAsync(300);
    expect(server).toEqual({ data: doc(["a", 2]), rev: 4 });
    answerRead();
    await refreshed;
    expect(synced.current()).toEqual(doc(["a", 2]));
    // The next save goes on the revision the save got, not the older one the read carried.
    synced.save(doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(300);
    expect(server).toEqual({ data: doc(["a", 3]), rev: 5 });
  });

  it("writes nothing when the document could not be read", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") puts.push(String(init.body));
        return new Response("unavailable", { status: 503 });
      }),
    );
    const synced = create();
    const loaded = synced.load();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await loaded).toBeNull();
    expect(plain(synced.shown())).toEqual({ data: null, origin: null });
    synced.save(doc(["a", 2]));
    synced.update(() => doc(["a", 3]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(puts).toHaveLength(0);
  });

  it("fetches nothing outside the Ferrite application's build", async () => {
    vi.unstubAllEnvs();
    const synced = create();
    expect(synced.enabled()).toBe(false);
    expect(await synced.load()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("recordTag", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is empty outside the Ferrite application's build, and new at each call in it", () => {
    expect(recordTag()).toBe("");
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const first = recordTag();
    expect(first).toMatch(/^[0-9a-z]+-\d+-$/);
    expect(recordTag()).not.toBe(first);
  });
});
