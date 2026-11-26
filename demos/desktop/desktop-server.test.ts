import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHANGED_ELSEWHERE,
  createServerDocument,
  onSaveFailure,
  REQUEST_DEADLINE_MS,
  reloadServerDocuments,
  servedByDesktopApp,
  serverDocument,
  useServerState,
  WRITE_HEADER,
  WRITES_HEADER,
  withDeadline,
} from "./desktop-server";
import { keepServerCopy } from "./document-merge";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A reply as `fetch` resolves it. */
const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** The PUT bodies sent. */
const sentRaw = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls
    .filter((call) => ((call as unknown[])[1] as RequestInit | undefined)?.method === "PUT")
    .map((call) => JSON.parse(((call as unknown[])[1] as RequestInit).body as string));

/** The `PUT` bodies sent, without the page's session, which every save names once a load has
 * named it (asserted where it matters). */
const sentBodies = (fetch: ReturnType<typeof vi.fn>) =>
  sentRaw(fetch).map(({ session: _session, ...body }) => body);

/** The session the test server names in its `GET` replies. */
const SESSION = "a".repeat(64);

/**
 * The one direct `fetch` a demo may make: Music's reachability probe (`answers` in music-player.ts),
 * a no-cors HEAD request that its guard limits to the outside archive.org origin. It carries no
 * cookie of the desktop's, so it cannot start a session of its own.
 */
const ARCHIVE_PROBE = {
  file: path.join("music", "music-player.ts"),
  call: /if \(!url\.startsWith\("https:\/\/archive\.org\/"\)\) return false;\s*const controller = new AbortController\(\);[\s\S]{0,200}?await fetch\(url, \{\s*method: "HEAD",\s*mode: "no-cors",/,
};

// The worker can fetch only its imported static asset URLs, without session cookies.
const CHESS_ASSETS = {
  file: path.join("chess", "chess-reckless.worker.ts"),
  call: /if \(!ASSET_URLS\.has\(url\)\) throw new Error\("Unknown chess asset"\);\s*return fetch\(url, \{ credentials: "omit", signal: AbortSignal\.timeout\(30_000\) \}\);/,
};

/** How many direct `fetch` calls a demo's text makes, Music's archive.org probe aside. */
function directFetches(file: string, text: string): number {
  let rest = file === ARCHIVE_PROBE.file ? text.replace(ARCHIVE_PROBE.call, "") : text;
  if (file === CHESS_ASSETS.file) rest = rest.replace(CHESS_ASSETS.call, "");
  return (rest.match(/\bfetch\s*\(/g) ?? []).length;
}

describe("the demos' requests to the desktop's application", () => {
  it("go through sessionFetch, so that none starts a session of its own", () => {
    const demos = path.resolve(__dirname, "..");
    // Console, About This Mac, System Information and Activity Monitor move to sessionFetch in
    // their own change.
    const elsewhere = new Set([
      "console",
      "about-this-mac",
      "system-information",
      "activity-monitor",
    ]);
    const direct = (readdirSync(demos, { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => !elsewhere.has(file.split(path.sep)[0] ?? ""))
      .filter((file) => file !== path.join("desktop", "desktop-server.ts"))
      .filter((file) => directFetches(file, readFileSync(path.join(demos, file), "utf8")) > 0);
    expect(direct).toEqual([]);
  });

  it("allows only the Chess worker's guarded static asset fetch", () => {
    const text = readFileSync(path.resolve(__dirname, "..", CHESS_ASSETS.file), "utf8");
    expect(directFetches(CHESS_ASSETS.file, text)).toBe(0);
    expect(directFetches(CHESS_ASSETS.file, `${text}\nfetch("/api/chess/games");`)).toBe(1);
    expect(
      directFetches(
        CHESS_ASSETS.file,
        text.replace('credentials: "omit"', 'credentials: "include"'),
      ),
    ).toBe(1);
    expect(
      directFetches(
        CHESS_ASSETS.file,
        text.replace('if (!ASSET_URLS.has(url)) throw new Error("Unknown chess asset");', ""),
      ),
    ).toBe(1);
  });

  it("allow only Music's archive.org probe, and still find a direct request planted beside it", () => {
    const text = readFileSync(path.resolve(__dirname, "..", ARCHIVE_PROBE.file), "utf8");
    const probes = text.match(new RegExp(ARCHIVE_PROBE.call.source, "g")) ?? [];
    expect(probes, "the probe, once").toHaveLength(1);
    expect(directFetches(ARCHIVE_PROBE.file, text)).toBe(0);
    // A first-party request planted in the same file is found.
    expect(directFetches(ARCHIVE_PROBE.file, `${text}\nawait fetch("/api/music/library");\n`)).toBe(
      1,
    );
    // The probe without its archive.org guard is not allowed, nor the same call in another file.
    const unguarded = text.replace(
      'if (!url.startsWith("https://archive.org/")) return false;',
      "",
    );
    expect(directFetches(ARCHIVE_PROBE.file, unguarded)).toBe(1);
    expect(directFetches(path.join("music", "music-desktop.tsx"), text)).toBe(1);
  });
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("desktop server helpers", () => {
  it("are off unless the build says the page is served by the Ferrite application", () => {
    expect(servedByDesktopApp()).toBe(false);
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    expect(servedByDesktopApp()).toBe(true);
  });

  it("reads a document with the server's revision, and reads nothing from a failed request", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { events: null, rev: 4 }))
      .mockResolvedValueOnce(reply(503, { error: "x" }))
      .mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/calendar/events");
    expect(await channel.load()).toEqual({ events: null, rev: 4 });
    expect(channel.revision()).toBe(4);
    expect(await channel.load()).toBeUndefined();
    expect(await channel.load()).toBeUndefined();
    expect(channel.revision()).toBe(4);
  });

  it("reads nothing from a successful reply that is not a document", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, null))
      .mockResolvedValueOnce(reply(200, [1, 2]))
      .mockResolvedValueOnce(reply(200, "events"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      });
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/calendar/events");
    for (let i = 0; i < 4; i += 1) expect(await channel.load()).toBeUndefined();
    expect(channel.revision()).toBe(0);
  });

  it("saves one body at a time, each on the revision the server last answered", async () => {
    const finish: (() => void)[] = [];
    let stored = 0;
    const fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          finish.push(() => {
            stored += 1;
            resolve(reply(200, { rev: stored }));
          });
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const { save, idle, revision } = createServerDocument("/api/contacts/cards");
    save({ n: 1 });
    await tick();
    save({ n: 2 });
    save({ n: 3 });
    await tick();
    expect(fetch).toHaveBeenCalledTimes(1);
    finish.shift()?.();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    finish.shift()?.();
    await idle();
    // Body 2 was replaced by 3 while 1 was in flight.
    expect(sentBodies(fetch)).toEqual([
      { n: 1, rev: 0 },
      { n: 3, rev: 1 },
    ]);
    expect(revision()).toBe(2);
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({
      method: "PUT",
      credentials: "same-origin",
    });
  });

  it("sends a short save so that it outlives the page, and a long one or a second send without", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { rev: 1 }))
      .mockResolvedValueOnce(reply(200, { rev: 2 }));
    vi.stubGlobal("fetch", fetch);
    const { save, idle } = createServerDocument("/api/contacts/cards");
    save({ n: 1 });
    await idle();
    save({ words: "x".repeat(9_000) });
    await idle();
    const initOf = (call: number) => (fetch.mock.calls[call] as [string, RequestInit])[1];
    expect(initOf(0).keepalive).toBe(true);
    expect(initOf(1).keepalive).toBe(false);
  });

  it("merges a save refused with 409 onto the copy the refusal carries, on its revision", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(409, { error: "changed", cards: [{ id: "b" }], rev: 5 }))
      .mockResolvedValueOnce(reply(200, { cards: [{ id: "a" }, { id: "b" }], rev: 6 }));
    vi.stubGlobal("fetch", fetch);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/cards");
    channel.save({ cards: [{ id: "a" }] });
    await channel.idle();
    stop();
    // The card saved elsewhere meanwhile stays beside the one this page added.
    expect(sentBodies(fetch)).toEqual([
      { cards: [{ id: "a" }], rev: 0 },
      { cards: [{ id: "a" }, { id: "b" }], rev: 5 },
    ]);
    expect(channel.revision()).toBe(6);
    expect(failures).not.toHaveBeenCalled();
  });

  it("does not send again a save refused with 409 once a newer body has been given", async () => {
    let answerFirst: (value: unknown) => void = () => {};
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      // The refusal carries no document: it is read before anything is sent.
      .mockResolvedValueOnce(reply(200, { n: 0, rev: 5 }))
      .mockResolvedValueOnce(reply(200, { rev: 6 }));
    vi.stubGlobal("fetch", fetch);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/cards");
    channel.save({ n: 1 });
    await tick();
    channel.save({ n: 2 });
    answerFirst(reply(409, { rev: 5 }));
    await channel.idle();
    stop();
    // Body 1 is not sent again over the newer body 2, which goes out on the new revision.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sentBodies(fetch)).toEqual([
      { n: 1, rev: 0 },
      { n: 2, rev: 5 },
    ]);
    expect(failures).not.toHaveBeenCalled();
  });

  it("does not retry a failed save once a newer body has been given", async () => {
    let failFirst: (error: Error) => void = () => {};
    const fetch = vi
      .fn()
      // Body 1 in flight, then a network error.
      .mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)))
      .mockResolvedValueOnce(reply(200, { rev: 1 }));
    vi.stubGlobal("fetch", fetch);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/test/superseded");
    channel.save({ n: 1 });
    await tick();
    channel.save({ n: 2 });
    failFirst(new TypeError("offline"));
    await channel.idle();
    stop();
    // Body 1 is not sent again over body 2.
    expect(sentBodies(fetch)).toEqual([
      { n: 1, rev: 0 },
      { n: 2, rev: 0 },
    ]);
    expect(failures).not.toHaveBeenCalled();
  });

  it("logs and reports a save that still fails after its retry", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new TypeError("still offline"))
      .mockResolvedValueOnce(reply(400, { error: "bad" }));
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/calendar/events");
    channel.save({ events: [] });
    await channel.idle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(failures).toHaveBeenLastCalledWith({
      url: "/api/calendar/events",
      reason: "still offline",
    });
    // A refused body is not sent again: it would be refused again.
    channel.save({ events: [{}] });
    await channel.idle();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(failures).toHaveBeenLastCalledWith({
      url: "/api/calendar/events",
      reason: "HTTP 400",
      detail: "bad",
    });
    expect(error).toHaveBeenCalledTimes(2);
    stop();
  });

  it("shares one channel per document, and loads only after its saves have finished", async () => {
    const url = "/api/test/shared";
    expect(serverDocument(url)).toBe(serverDocument(url));
    const order: string[] = [];
    let finishPut: () => void = () => {};
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      order.push(init?.method ?? "GET");
      return init?.method === "PUT"
        ? new Promise((resolve) => {
            finishPut = () => resolve(reply(200, { saved: true, rev: 1 }));
          })
        : Promise.resolve(reply(200, { saved: true, rev: 1 }));
    });
    vi.stubGlobal("fetch", fetch);
    // A window saves, is closed, and is opened again while that save is in flight.
    serverDocument(url).save({ n: 1 });
    const reopened = serverDocument(url).load();
    await tick();
    expect(order).toEqual(["PUT"]);
    finishPut();
    expect(await reopened).toEqual({ saved: true, rev: 1 });
    expect(order).toEqual(["PUT", "GET"]);
    // The reopened window saves on the revision it loaded.
    serverDocument(url).save({ n: 2 });
    await vi.waitFor(() => expect(order).toEqual(["PUT", "GET", "PUT"]));
    finishPut();
    await serverDocument(url).idle();
    expect(sentBodies(fetch).at(-1)).toEqual({ n: 2, rev: 1 });
  });

  it("shows and saves again, on the next load, a body whose save failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { n: 0, rev: 4, session: SESSION }))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new TypeError("offline"))
      // The window is closed and opened again: the server still holds the old document.
      .mockResolvedValueOnce(reply(200, { n: 0, rev: 4, session: SESSION }))
      .mockResolvedValueOnce(reply(200, { n: 1, rev: 5 }));
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/test/reopen");
    await channel.load();
    channel.save({ n: 1 });
    await channel.idle();
    expect(await channel.load()).toEqual({ n: 1, rev: 4, session: SESSION });
    await channel.idle();
    expect(sentBodies(fetch).at(-1)).toEqual({ n: 1, rev: 4 });
    expect(channel.revision()).toBe(5);
  });

  it("saves a body that removes a field of the document it loaded", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { title: "a", tag: "b", rev: 2, session: SESSION }))
      .mockResolvedValue(reply(200, { rev: 3 }));
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/test/remove-field");
    await channel.load();
    // The same document saved back is no change; one without its tag is.
    channel.save({ title: "a", tag: "b" });
    await channel.idle();
    expect(sentBodies(fetch)).toEqual([]);
    channel.save({ title: "a" });
    await channel.idle();
    expect(sentBodies(fetch)).toEqual([{ title: "a", rev: 2 }]);
  });

  it("shows and saves again, without the field it removed, a body whose save failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { title: "a", tag: "b", rev: 4, session: SESSION }))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new TypeError("offline"))
      // Opened again: the server still holds the tag the failed save removed.
      .mockResolvedValueOnce(reply(200, { title: "a", tag: "b", rev: 4, session: SESSION }))
      .mockResolvedValueOnce(reply(200, { rev: 5 }));
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/test/remove-field-retry");
    await channel.load();
    channel.save({ title: "a" });
    await channel.idle();
    expect(await channel.load()).toEqual({ title: "a", rev: 4, session: SESSION });
    await channel.idle();
    expect(sentBodies(fetch).at(-1)).toEqual({ title: "a", rev: 4 });
  });

  it("tells every failure listener even when one throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { n: 0, rev: 0, session: SESSION }))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetch);
    const heard = vi.fn();
    const stops = [
      onSaveFailure(() => {
        throw new Error("listener broke");
      }),
      onSaveFailure(heard),
    ];
    const channel = createServerDocument("/api/test/listeners");
    await channel.load();
    channel.save({ n: 1 });
    await channel.idle();
    expect(heard).toHaveBeenCalledTimes(1);
    for (const stop of stops) stop();
  });

  it("sends the body as it was given, whatever the caller changes later", async () => {
    const fetch = vi.fn(async () => reply(200, { rev: 1 }));
    vi.stubGlobal("fetch", fetch);
    const body = { items: ["a"] };
    const channel = createServerDocument("/api/test/snapshot");
    channel.save(body);
    body.items.push("b");
    await channel.idle();
    expect(sentBodies(fetch)).toEqual([{ items: ["a"], rev: 0 }]);
  });
});

/**
 * A document kept as `ferrite-apps/desktop/src/apps/document.rs` keeps it: a `PUT` is stored only
 * on the stored revision, and any other is answered 409 with the current document. `refuse`
 * answers the next `PUT`s with a status of its own first.
 */
function documentServer(doc: Record<string, unknown>, rev: number) {
  const server = { doc, rev, refuse: [] as number[] };
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const status = server.refuse.shift();
      if (status !== undefined) return reply(status, { error: "refused" });
      const { rev: base, session: _session, ...body } = JSON.parse(String(init.body));
      if (base !== server.rev) {
        return reply(409, { ...server.doc, rev: server.rev, error: "changed" });
      }
      server.doc = body;
      server.rev += 1;
      return reply(200, { ...body, rev: server.rev });
    }
    return reply(200, { ...server.doc, rev: server.rev, session: SESSION });
  });
  vi.stubGlobal("fetch", fetch);
  return { server, fetch };
}

/**
 * A document kept as `ferrite-apps/desktop/src/apps/document.rs` keeps it, with the ids of the last
 * writes it stored, which its reads and refusals name (`WRITES_HEADER`).
 */
function namedWritesServer(doc: Record<string, unknown>, rev: number) {
  const server = { doc, rev, writes: [] as string[], from: rev, tracking: true };
  const named = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { [WRITES_HEADER]: `${server.from}:${server.writes.join(",")}` },
    });
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== "PUT")
      return named(200, { ...server.doc, rev: server.rev, session: SESSION });
    const { rev: base, session: _session, ...body } = JSON.parse(String(init.body));
    if (base !== server.rev)
      return named(409, { ...server.doc, rev: server.rev, error: "changed" });
    server.doc = body;
    server.rev += 1;
    const write = (init.headers as Record<string, string>)[WRITE_HEADER];
    if (write && server.tracking) server.writes = [...server.writes, write].slice(-16);
    else server.from = server.rev;
    return reply(200, { ...body, rev: server.rev });
  });
  vi.stubGlobal("fetch", fetch);
  /** Another browser's save, which names its own write. */
  const elsewhere = (next: Record<string, unknown>, id: string) => {
    server.doc = next;
    server.rev += 1;
    server.writes = [...server.writes, id].slice(-16);
  };
  return { server, fetch, elsewhere };
}

describe("a save whose answer never came, after two saves elsewhere", () => {
  const book = (id: string) => ({ id });
  const loseTheAnswers = (fetch: ReturnType<typeof vi.fn>, stored: boolean) => {
    const served = fetch.getMockImplementation() as
      | ((url: string, init?: RequestInit) => Promise<Response>)
      | undefined;
    fetch
      .mockImplementationOnce(async (url: string, init?: RequestInit) => {
        if (stored) await served?.(url, init);
        throw new TypeError("network");
      })
      .mockImplementationOnce(async () => {
        throw new TypeError("network");
      });
  };

  it("asks for the writes on a read, which an earlier server does not answer", async () => {
    const { fetch } = documentServer({ cards: [] }, 1);
    await createServerDocument("/api/contacts/asks").load();
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(Object.keys(init.headers as object)).toContain(WRITE_HEADER);
  });

  it("merges and saves again a body that never arrived", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch, elsewhere } = namedWritesServer({ cards: [book("a")] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/never-arrived");
    await channel.load();
    loseTheAnswers(fetch, false);
    channel.save({ cards: [book("a"), book("typed")] });
    await channel.idle();
    elsewhere({ cards: [book("a"), book("b")] }, "other-1");
    elsewhere({ cards: [book("a"), book("b"), book("c")] }, "other-2");
    await channel.load();
    await channel.idle();
    stop();
    expect(server.doc).toEqual({
      cards: [book("a"), book("typed"), book("b"), book("c")],
    });
    expect(failures).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: CHANGED_ELSEWHERE }),
    );
  });

  it("brings back nothing deleted on top of a body that was stored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch, elsewhere } = namedWritesServer({ cards: [book("a")] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/stored-then-deleted");
    await channel.load();
    loseTheAnswers(fetch, true);
    channel.save({ cards: [book("a"), book("typed")] });
    await channel.idle();
    elsewhere({ cards: [book("typed")] }, "other-1");
    elsewhere({ cards: [] }, "other-2");
    const puts = sentBodies(fetch).length;
    await channel.load();
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ cards: [] });
    expect(sentBodies(fetch)).toHaveLength(puts);
    expect(failures).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: CHANGED_ELSEWHERE }),
    );
  });

  it("does not take a body as lost when the list starts after the page's revision", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch, elsewhere } = namedWritesServer({ cards: [book("a")] }, 1);
    const channel = createServerDocument("/api/contacts/stored-before-tracking");
    await channel.load();
    // A build that keeps no list stores the save, and the answer is lost.
    server.tracking = false;
    loseTheAnswers(fetch, true);
    channel.save({ cards: [book("a"), book("typed")] });
    await channel.idle();
    elsewhere({ cards: [book("typed")] }, "other-1");
    elsewhere({ cards: [] }, "other-2");
    // The server is upgraded: its list holds nothing from before the revision it starts at.
    server.tracking = true;
    server.writes = [];
    server.from = server.rev;
    const puts = sentBodies(fetch).length;
    await channel.load();
    await channel.idle();
    expect(server.doc).toEqual({ cards: [] });
    expect(sentBodies(fetch)).toHaveLength(puts);
  });

  it("does not take a body as lost when its name was dropped on the way to a tracked document", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch, elsewhere } = namedWritesServer({ cards: [book("a")] }, 1);
    const channel = createServerDocument("/api/contacts/name-dropped");
    elsewhere({ cards: [book("a")] }, "earlier");
    await channel.load();
    const served = fetch.getMockImplementation() as
      | ((url: string, init?: RequestInit) => Promise<Response>)
      | undefined;
    fetch
      .mockImplementationOnce(async (url: string, init?: RequestInit) => {
        const headers = { ...(init?.headers as Record<string, string>) };
        delete headers[WRITE_HEADER];
        await served?.(url, { ...init, headers });
        throw new TypeError("network");
      })
      .mockImplementationOnce(async () => {
        throw new TypeError("network");
      });
    channel.save({ cards: [book("a"), book("typed")] });
    await channel.idle();
    elsewhere({ cards: [book("typed")] }, "other-1");
    elsewhere({ cards: [] }, "other-2");
    const puts = sentBodies(fetch).length;
    await channel.load();
    await channel.idle();
    expect(server.doc).toEqual({ cards: [] });
    expect(sentBodies(fetch)).toHaveLength(puts);
  });

  it("says so when a body that never arrived cannot be kept", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetch, elsewhere } = namedWritesServer({ title: "a" }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/test/never-arrived-gone", {
      merge: (_was, _mine, theirs) => theirs,
    });
    await channel.load();
    loseTheAnswers(fetch, false);
    channel.save({ title: "typed" });
    await channel.idle();
    elsewhere({ title: "b" }, "other-1");
    elsewhere({ title: "c" }, "other-2");
    await channel.load();
    await channel.idle();
    stop();
    expect(failures).toHaveBeenCalledWith({
      url: "/api/test/never-arrived-gone",
      reason: CHANGED_ELSEWHERE,
    });
  });

  it("takes the body as stored and tells the person, on a route that names no writes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ cards: [book("a")] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/old-route");
    await channel.load();
    loseTheAnswers(fetch, false);
    channel.save({ cards: [book("a"), book("typed")] });
    await channel.idle();
    server.doc = { cards: [book("a"), book("b"), book("c")] };
    server.rev += 2;
    await channel.load();
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ cards: [book("a"), book("b"), book("c")] });
    expect(failures).toHaveBeenCalledWith({
      url: "/api/contacts/old-route",
      reason: CHANGED_ELSEWHERE,
    });
  });
});

describe("a save that meets a newer copy saved elsewhere", () => {
  const book = (id: string, title = id) => ({ id, title });

  it("never sends back a document forgotten elsewhere, and says the change was not kept", async () => {
    const { server, fetch } = documentServer(
      { library: { books: [book("alice")], sort: "recent" } },
      1,
    );
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/books/library");
    const shown = vi.fn();
    channel.watch({}, shown);
    await channel.load();
    // Another browser forgets the library, as `DELETE` does: `null` under the next revision.
    server.doc = { library: null };
    server.rev = 2;
    channel.save({ library: { books: [book("alice")], sort: "title" } });
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ library: null });
    expect(server.rev).toBe(2);
    expect(sentBodies(fetch)).toHaveLength(1);
    expect(failures).toHaveBeenCalledWith({ url: "/api/books/library", reason: CHANGED_ELSEWHERE });
    // Every window is shown the forgotten library.
    expect(shown).toHaveBeenLastCalledWith({ library: null, rev: 2 }, expect.any(Number));
    expect(channel.revision()).toBe(2);
  });

  it("applies the person's change to the copy saved elsewhere, and shows the result", async () => {
    const { server, fetch } = documentServer({ cards: [book("a"), book("b")] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/cards");
    const shown = vi.fn();
    channel.watch({}, shown);
    await channel.load();
    // Elsewhere: b deleted, c added.
    server.doc = { cards: [book("a"), book("c")] };
    server.rev = 2;
    channel.save({ cards: [book("a", "Ann"), book("b")] });
    await channel.idle();
    stop();
    const merged = { cards: [book("a", "Ann"), book("c")] };
    expect(sentBodies(fetch).at(-1)).toEqual({ ...merged, rev: 2 });
    expect(server.doc).toEqual(merged);
    expect(shown).toHaveBeenLastCalledWith(merged, expect.any(Number));
    expect(failures).not.toHaveBeenCalled();
  });

  it("merges the newest body given while the refused save was under way", async () => {
    const { server, fetch } = documentServer({ cards: [book("a")] }, 1);
    const channel = createServerDocument("/api/contacts/newest");
    await channel.load();
    server.doc = { cards: [book("a"), book("z")] };
    server.rev = 2;
    channel.save({ cards: [book("a"), book("b")] });
    channel.save({ cards: [book("a"), book("b"), book("c")] });
    await channel.idle();
    expect(server.doc).toEqual({ cards: [book("a"), book("b"), book("c"), book("z")] });
    // The superseded body was never sent; the newest went first on the old revision, refused.
    expect(sentBodies(fetch).map(({ cards }) => cards.length)).toEqual([3, 4]);
  });

  it("merges a body whose save failed onto what the next load reads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ cards: [book("a"), book("b")] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/failed");
    await channel.load();
    server.refuse.push(503, 503);
    channel.save({ cards: [book("a", "Ann"), book("b")] });
    await channel.idle();
    expect(failures).toHaveBeenCalledTimes(1);
    // Another browser forgets the cards; this page hears of it and loads them again.
    server.doc = { cards: null };
    server.rev = 2;
    expect(await channel.load()).toEqual({ cards: null, rev: 2, session: SESSION });
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ cards: null });
    expect(sentBodies(fetch)).toHaveLength(2);
    expect(failures).toHaveBeenLastCalledWith({
      url: "/api/contacts/failed",
      reason: CHANGED_ELSEWHERE,
    });
  });

  it("keeps the server's copy, and drops the change, for a document that cannot be merged", async () => {
    const { server, fetch } = documentServer({ vault: { iv: "1", data: "x" } }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/keychain-access/vault", { merge: keepServerCopy });
    const shown = vi.fn();
    channel.watch({}, shown);
    await channel.load();
    server.doc = { vault: { iv: "2", data: "y" } };
    server.rev = 2;
    channel.save({ vault: { iv: "3", data: "z" } });
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ vault: { iv: "2", data: "y" } });
    expect(sentBodies(fetch)).toHaveLength(1);
    expect(shown).toHaveBeenLastCalledWith(
      { vault: { iv: "2", data: "y" }, rev: 2 },
      expect.any(Number),
    );
    expect(failures).toHaveBeenCalledWith({
      url: "/api/keychain-access/vault",
      reason: CHANGED_ELSEWHERE,
    });
  });

  it("shows the server's copy when the server refuses the merge", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server } = documentServer({ cards: [book("a")] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/contacts/refused");
    const shown = vi.fn();
    channel.watch({}, shown);
    await channel.load();
    server.doc = { cards: [book("a"), book("b")] };
    server.rev = 2;
    // The first save meets the newer copy; the merge it becomes is refused as it is.
    server.refuse.push(409, 400);
    channel.save({ cards: [book("a"), book("c")] });
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ cards: [book("a"), book("b")] });
    expect(shown).toHaveBeenLastCalledWith({ cards: [book("a"), book("b")] }, expect.any(Number));
    expect(failures).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/contacts/refused", reason: "HTTP 400" }),
    );
  });

  it("applies the change of a caller that watches nothing to what a load it did not ask for read", async () => {
    const { server } = documentServer({ values: { a: 1, b: 1 }, theme: null }, 1);
    const channel = serverDocument("/api/settings-test/settings");
    await channel.load();
    // Another browser changes b, and this page loads the document again for its windows.
    server.doc = { values: { a: 1, b: 2 }, theme: null };
    server.rev = 2;
    reloadServerDocuments("settings-test");
    await channel.idle();
    // The caller, told nothing, still holds b as it was, and changes a.
    channel.save({ values: { a: 5, b: 1 }, theme: null });
    await channel.idle();
    expect(server.doc).toEqual({ values: { a: 5, b: 2 }, theme: null });
    // Its next change is a change of what it holds, and keeps b too.
    channel.save({ values: { a: 6, b: 1 }, theme: null });
    await channel.idle();
    expect(server.doc).toEqual({ values: { a: 6, b: 2 }, theme: null });
  });

  it("sends nothing from a caller that watches nothing once the document was forgotten", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ playback: { index: 1, recent: ["a"] } }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = serverDocument("/api/forgot-test/playback");
    await channel.load();
    server.doc = { playback: null };
    server.rev = 2;
    reloadServerDocuments("forgot-test");
    await channel.idle();
    channel.save({ playback: { index: 2, recent: ["a"] } });
    channel.save({ playback: { index: 3, recent: ["a"] } });
    await channel.idle();
    stop();
    expect(sentBodies(fetch)).toEqual([]);
    expect(server.doc).toEqual({ playback: null });
    // Told once, not at every change.
    expect(failures).toHaveBeenCalledTimes(1);
  });

  it("sends nothing of a change given while a load reads a document forgotten elsewhere", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ cards: [book("a")] }, 1);
    const channel = createServerDocument("/api/contacts/during-load");
    await channel.load();
    server.doc = { cards: null };
    server.rev = 2;
    // The load's request is out when a window makes a change.
    let answer: () => void = () => {};
    const served = fetch.getMockImplementation();
    if (!served) throw new Error("the test server is not set up");
    fetch.mockImplementationOnce(
      (url: string, init?: RequestInit) =>
        new Promise((resolve) => {
          answer = () => resolve(served(url, init));
        }),
    );
    const loaded = channel.load();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    channel.save({ cards: [book("a", "Ann")] });
    answer();
    await loaded;
    await channel.idle();
    expect(sentBodies(fetch)).toEqual([]);
    expect(server.doc).toEqual({ cards: null });
  });

  it("knows its own save, stored though its answer never came, when the retry meets it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ settings: { on: false } }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/test/unanswered");
    const shown = vi.fn();
    channel.watch({}, shown);
    await channel.load();
    const served = fetch.getMockImplementation();
    // The first save is stored, but its answer is lost.
    fetch.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      await served?.(url, init);
      throw new TypeError("network");
    });
    channel.save({ settings: { on: true } });
    await channel.idle();
    // Its retry met the page's own body (409): no change was made elsewhere.
    expect(server.doc).toEqual({ settings: { on: true } });
    expect(failures).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: CHANGED_ELSEWHERE }),
    );
    // Turned off and on again: the second save is stored, and its answer is lost after the
    // person has turned it off once more.
    let lose: () => void = () => {};
    fetch.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      await served?.(url, init);
      await new Promise<void>((resolve) => (lose = resolve));
      throw new TypeError("network");
    });
    const puts = () => sentBodies(fetch).length;
    const before = puts();
    channel.save({ settings: { on: false }, round: 2 });
    await vi.waitFor(() => expect(puts()).toBe(before + 1));
    channel.save({ settings: { on: true }, round: 2 });
    lose();
    await channel.idle();
    stop();
    // The last change is a change of the body the server held: it is stored as the person left it.
    expect(server.doc).toEqual({ settings: { on: true }, round: 2 });
    expect(failures).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: CHANGED_ELSEWHERE }),
    );
  });

  it("brings back nothing deleted elsewhere on top of a save whose answer never came", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ cards: [book("a")] }, 1);
    const channel = createServerDocument("/api/contacts/unanswered-then-deleted");
    await channel.load();
    const served = fetch.getMockImplementation();
    // The save adds z and is stored, but no answer comes; its retry gets none either.
    fetch
      .mockImplementationOnce(async (url: string, init?: RequestInit) => {
        await served?.(url, init);
        throw new TypeError("network");
      })
      .mockImplementationOnce(async () => {
        throw new TypeError("network");
      });
    channel.save({ cards: [book("a"), book("z")] });
    await channel.idle();
    // Another browser deletes z, and this page loads the cards again.
    server.doc = { cards: [book("a")] };
    server.rev += 1;
    await channel.load();
    await channel.idle();
    expect(server.doc).toEqual({ cards: [book("a")] });
    expect(sentBodies(fetch)).toHaveLength(2);
  });

  it("keeps a change whose save failed offline when another browser changed something else", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ a: 1, b: 1 }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/test/offline");
    await channel.load();
    fetch
      .mockImplementationOnce(async () => {
        throw new TypeError("offline");
      })
      .mockImplementationOnce(async () => {
        throw new TypeError("offline");
      });
    channel.save({ a: 2, b: 1 });
    await channel.idle();
    // Another browser changes b, once; this page loads again.
    server.doc = { a: 1, b: 5 };
    server.rev += 1;
    await channel.load();
    await channel.idle();
    stop();
    expect(server.doc).toEqual({ a: 2, b: 5 });
    expect(failures).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: CHANGED_ELSEWHERE }),
    );
  });

  it("keeps a merge the server refuses for now as the page's unsaved body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server } = documentServer({ cards: [book("a")] }, 1);
    const channel = createServerDocument("/api/contacts/locked");
    const shown = vi.fn();
    channel.watch({}, shown);
    await channel.load();
    server.doc = { cards: [book("a"), book("b")] };
    server.rev = 2;
    // The merge meets a locked screen (423), and is saved when the page loads again.
    server.refuse.push(409, 423);
    channel.save({ cards: [book("a"), book("c")] });
    await channel.idle();
    expect(shown).not.toHaveBeenLastCalledWith(
      { cards: [book("a"), book("b")] },
      expect.any(Number),
    );
    await channel.load();
    await channel.idle();
    expect(server.doc).toEqual({ cards: [book("a"), book("c"), book("b")] });
  });

  it("stops sending a change that meets a newer copy again and again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { server, fetch } = documentServer({ n: 0, items: ["a"] }, 1);
    const failures = vi.fn();
    const stop = onSaveFailure(failures);
    const channel = createServerDocument("/api/test/busy");
    await channel.load();
    // Another browser writes before each of this page's saves arrives.
    fetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return reply(200, { ...server.doc, rev: server.rev });
      server.rev += 1;
      server.doc = { n: server.rev, items: ["a"] };
      return reply(409, { ...server.doc, rev: server.rev });
    });
    channel.save({ n: 0, items: ["a", "b"] });
    await channel.idle();
    stop();
    expect(sentBodies(fetch)).toHaveLength(4);
    expect(failures).toHaveBeenCalledWith({
      url: "/api/test/busy",
      reason: "the document kept changing elsewhere",
    });
  });
});

describe("useServerState", () => {
  it("saves a change the person makes straight after a body told from elsewhere", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let gets = 0;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return reply(200, { rev: 3 });
      gets += 1;
      return gets === 1
        ? reply(200, { items: ["a"], rev: 1 })
        : reply(200, { items: ["a", "elsewhere"], rev: 2 });
    });
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/told-then-changed";
    const { result } = renderHook(() => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    const channel = serverDocument(url);
    // Heard right after the window's own watcher, as a lookup's reply follows a load's in one task.
    const stop = channel.watch({}, () => {
      stop();
      result.current.setItems((now) => [...now, "asked"]);
    });
    await act(async () => {
      await channel.load({});
    });
    await channel.idle();
    expect(result.current.items).toEqual(["a", "elsewhere", "asked"]);
    expect(sentBodies(fetch)).toEqual([{ items: ["a", "elsewhere", "asked"], rev: 2 }]);
  });

  it("tells another window of a save without rendering inside the saving window's effect", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply(200, { rev: 2 }) : reply(200, { items: ["a"], rev: 1 }),
    );
    vi.stubGlobal("fetch", fetch);
    const complaint = vi.spyOn(console, "error");
    const url = "/api/test/told-outside-effects";
    const useWindow = () => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    const first = renderHook(() => useWindow());
    const second = renderHook(() => useWindow());
    await waitFor(() => expect(first.result.current.pending).toBe(false));
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    act(() => first.result.current.setItems(["a", "b"]));
    await waitFor(() => expect(second.result.current.items).toEqual(["a", "b"]));
    expect(complaint).not.toHaveBeenCalled();
    complaint.mockRestore();
  });
  it("saves nothing after a successful reply that is not a document", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(init?.method === "PUT" ? reply(200, { rev: 1 }) : reply(200, ["not", "one"])),
    );
    vi.stubGlobal("fetch", fetch);
    const loaded: unknown[] = [];
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useServerState({
          url: "/api/test/unreadable",
          enabled: true,
          value,
          onLoad: (stored) => loaded.push(stored),
          toBody: (v) => ({ v }),
        }),
      { initialProps: { value: "a" } },
    );
    // The wait ends, as for a failed load, and the demo works on what it shows.
    await waitFor(() => expect(result.current).toBe(false));
    rerender({ value: "changed" });
    rerender({ value: "changed again" });
    await tick();
    expect(loaded).toEqual([]);
    expect(sentBodies(fetch)).toEqual([]);
  });

  it("saves nothing to a document the demo says it cannot read", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "PUT" ? reply(200, { rev: 1 }) : reply(200, { v: 42, rev: 1 }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useServerState({
          url: "/api/test/undecodable",
          enabled: true,
          value,
          // The demo keeps `v` as a string: a number is a document it cannot read.
          onLoad: (stored) => typeof (stored as { v?: unknown }).v === "string",
          toBody: (v) => ({ v }),
        }),
      { initialProps: { value: "a" } },
    );
    await waitFor(() => expect(result.current).toBe(false));
    rerender({ value: "changed" });
    rerender({ value: "changed again" });
    await tick();
    expect(sentBodies(fetch)).toEqual([]);
  });

  it("saves nothing to a new address until its own load has succeeded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answerB: (value: unknown) => void = () => {};
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Promise.resolve(reply(200, { rev: 2 }));
      return url === "/api/test/hook-a"
        ? Promise.resolve(reply(200, { v: "a", rev: 1 }))
        : new Promise((resolve) => (answerB = resolve));
    });
    vi.stubGlobal("fetch", fetch);
    const loadedValues: unknown[] = [];
    const { result, rerender } = renderHook(
      ({ url, value }: { url: string; value: string }) =>
        useServerState({
          url,
          enabled: true,
          value,
          onLoad: (stored) => loadedValues.push(stored),
          toBody: (v) => ({ v }),
        }),
      { initialProps: { url: "/api/test/hook-a", value: "a" } },
    );
    await waitFor(() => expect(result.current).toBe(false));
    rerender({ url: "/api/test/hook-b", value: "a" });
    expect(result.current).toBe(true);
    rerender({ url: "/api/test/hook-b", value: "changed" });
    await tick();
    expect(sentBodies(fetch)).toEqual([]);
    act(() => answerB(reply(200, { v: "b", rev: 1 })));
    await waitFor(() => expect(result.current).toBe(false));
    expect(loadedValues).toEqual([
      { v: "a", rev: 1 },
      { v: "b", rev: 1 },
    ]);
    // The render that shows what B loaded saves nothing; the next change is saved to B.
    expect(sentBodies(fetch)).toEqual([]);
    rerender({ url: "/api/test/hook-b", value: "newer" });
    await waitFor(() => expect(sentBodies(fetch)).toEqual([{ v: "newer", rev: 1 }]));
    expect(fetch.mock.calls.at(-1)?.[0]).toBe("/api/test/hook-b");
  });

  it("shows a window, whose load was under way, what another window saved meanwhile", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let gets = 0;
    let answerSecond: (value: unknown) => void = () => {};
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Promise.resolve(reply(200, { rev: 2 }));
      gets += 1;
      return gets === 1
        ? Promise.resolve(reply(200, { items: ["a"], rev: 1 }))
        : new Promise((resolve) => (answerSecond = resolve));
    });
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/late-window";
    const useWindow = () => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    const first = renderHook(() => useWindow());
    await waitFor(() => expect(first.result.current.pending).toBe(false));
    // The second window opens: its load is sent, and answers late with the older document.
    const second = renderHook(() => useWindow());
    await waitFor(() => expect(gets).toBe(2));
    act(() => first.result.current.setItems(["a", "b"]));
    await tick();
    act(() => answerSecond(reply(200, { items: ["a"], rev: 1 })));
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    expect(second.result.current.items).toEqual(["a", "b"]);
  });

  it("gives each window of a document what another window saves, and saves it once", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply(200, { rev: 2 }) : reply(200, { items: ["a"], rev: 1 }),
    );
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/two-windows";
    // A window of a demo: its state, loaded from and saved to the document.
    const useWindow = (initial: string[]) => {
      const [items, setItems] = useState(initial);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    const first = renderHook(() => useWindow([]));
    const second = renderHook(() => useWindow([]));
    await waitFor(() => expect(first.result.current.pending).toBe(false));
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    act(() => first.result.current.setItems(["a", "b"]));
    // The second window shows the first one's change, so its next save keeps it.
    await waitFor(() => expect(second.result.current.items).toEqual(["a", "b"]));
    act(() => second.result.current.setItems([...second.result.current.items, "c"]));
    await waitFor(() => expect(first.result.current.items).toEqual(["a", "b", "c"]));
    await serverDocument(url).idle();
    // Each change is saved once: a window showing another's body does not save it back.
    expect(sentBodies(fetch)).toEqual([
      { items: ["a", "b"], rev: 1 },
      { items: ["a", "b", "c"], rev: 2 },
    ]);
  });

  it("saves nothing back for a body another window gave, even when the demo reshapes it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply(200, { rev: 2 }) : reply(200, { items: ["a"], rev: 1 }),
    );
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/reshaped";
    const useWindow = () => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        // The demo keeps only what it can use: an extra field is dropped, values are trimmed.
        onLoad: (stored) =>
          setItems((stored as { items: string[] }).items.map((item) => item.trim())),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    const first = renderHook(() => useWindow());
    const second = renderHook(() => useWindow());
    await waitFor(() => expect(first.result.current.pending).toBe(false));
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    // The first window gives a body the second shows in another form.
    serverDocument(url).save({ items: [" a ", "b"], extra: true }, {});
    await waitFor(() => expect(second.result.current.items).toEqual(["a", "b"]));
    await tick();
    await serverDocument(url).idle();
    expect(sentBodies(fetch)).toEqual([{ items: [" a ", "b"], extra: true, rev: 1 }]);
  });

  it("does not show a window, after its own load, a body told before that load was sent", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let gets = 0;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return reply(200, { rev: 3 });
      gets += 1;
      // Another tab saves between the two windows' loads.
      return gets === 1
        ? reply(200, { items: ["old"], rev: 1 })
        : reply(200, { items: ["newer"], rev: 2 });
    });
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/told-before";
    const useWindow = () => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    // Both windows mount together: the first load tells the second (still loading) revision 1.
    const first = renderHook(() => useWindow());
    const second = renderHook(() => useWindow());
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    await waitFor(() => expect(first.result.current.items).toEqual(["newer"]));
    expect(second.result.current.items).toEqual(["newer"]);
    act(() => second.result.current.setItems(["newer", "b"]));
    await waitFor(() => expect(sentBodies(fetch)).toEqual([{ items: ["newer", "b"], rev: 2 }]));
  });

  it("keeps two windows changed in one batch on one body", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let rev = 1;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return reply(200, { items: ["a"], rev: 1 });
      rev += 1;
      return reply(200, { rev });
    });
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/one-batch";
    const useWindow = () => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    const first = renderHook(() => useWindow());
    const second = renderHook(() => useWindow());
    await waitFor(() => expect(first.result.current.pending).toBe(false));
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    act(() => {
      first.result.current.setItems(["a", "from first"]);
      second.result.current.setItems(["a", "from second"]);
    });
    await tick();
    await serverDocument(url).idle();
    // Whichever body was saved last, both windows show it.
    const saved = sentBodies(fetch).at(-1)?.items;
    expect(first.result.current.items).toEqual(saved);
    expect(second.result.current.items).toEqual(saved);
  });

  it("sends nothing for a load, even one that changes what the window shows", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply(200, { rev: 3 }) : reply(200, { items: ["x", "y"], rev: 2 }),
    );
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/load-only";
    const { result } = renderHook(() => {
      const [items, setItems] = useState(["starting data"]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, pending };
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.items).toEqual(["x", "y"]);
    await tick();
    await serverDocument(url).idle();
    expect(fetch.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      expect.not.objectContaining({ method: "PUT" }),
    ]);
  });

  it("shows every open window what a later window's load read, so none saves an older copy", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let gets = 0;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return reply(200, { rev: 3 });
      gets += 1;
      // Another tab saved between the two windows' loads.
      return gets === 1
        ? reply(200, { items: ["a"], rev: 1 })
        : reply(200, { items: ["a", "from another tab"], rev: 2 });
    });
    vi.stubGlobal("fetch", fetch);
    const url = "/api/test/load-tells";
    const useWindow = () => {
      const [items, setItems] = useState<string[]>([]);
      const pending = useServerState({
        url,
        enabled: true,
        value: items,
        onLoad: (stored) => setItems((stored as { items: string[] }).items),
        toBody: (value) => ({ items: value }),
      });
      return { items, setItems, pending };
    };
    const first = renderHook(() => useWindow());
    await waitFor(() => expect(first.result.current.pending).toBe(false));
    const second = renderHook(() => useWindow());
    await waitFor(() => expect(second.result.current.pending).toBe(false));
    await waitFor(() => expect(first.result.current.items).toEqual(["a", "from another tab"]));
    await tick();
    await serverDocument(url).idle();
    // Being shown the load is no change to save.
    expect(sentBodies(fetch)).toEqual([]);
    act(() => first.result.current.setItems([...first.result.current.items, "b"]));
    await waitFor(() =>
      expect(sentBodies(fetch)).toEqual([{ items: ["a", "from another tab", "b"], rev: 2 }]),
    );
  });
});

describe("the end of the page's server session", () => {
  /** A copy of the module of its own: a session ended in one test stays ended for the page. */
  const freshModule = async () => {
    vi.resetModules();
    return import("./desktop-server");
  };

  it("ends the page's session for a ticket or widget reply of another session, and only then", async () => {
    const { createServerDocument: create, onSessionEnd, replyOfPageSession } = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => reply(200, { doc: url, rev: 1, session: SESSION })),
    );
    const ended = vi.fn();
    const stop = onSessionEnd(ended);
    await create("/api/test/widget-session").load();
    // The page's own session, a reply naming none, or a refusal for another reason: taken.
    expect(replyOfPageSession(200, { events: [], session: SESSION })).toBe(true);
    expect(replyOfPageSession(200, { events: [] })).toBe(true);
    expect(replyOfPageSession(409, { error: "the document changed" })).toBe(true);
    expect(ended).not.toHaveBeenCalled();
    // A widget reply for another session (the cookie was replaced): refused, and the page ends.
    expect(replyOfPageSession(200, { events: ["theirs"], session: "f".repeat(64) })).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
    // From then on nothing more is taken.
    expect(replyOfPageSession(200, { events: [], session: SESSION })).toBe(false);
    stop();

    // A ticket refused because the page's session changed ends it too.
    const next = await freshModule();
    const endedToo = vi.fn();
    const stopToo = next.onSessionEnd(endedToo);
    expect(next.replyOfPageSession(409, { error: "changed", session_changed: true })).toBe(false);
    expect(endedToo).toHaveBeenCalledTimes(1);
    stopToo();
  });

  it("ends the page's session when a notification write is refused for a changed session", async () => {
    vi.resetModules();
    const server = await import("./desktop-server");
    const live = await import("./desktop-live");
    const ended = vi.fn();
    const stop = server.onSessionEnd(ended);
    const body = { error: "changed", session_changed: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ...reply(409, body), text: async () => JSON.stringify(body) })),
    );
    const item = { seq: 1, at_ms: 0, app: "finder", id: "page-1", title: "Done" };
    expect(await live.clearItem(item as never)).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
    stop();
  });

  it("ends the page's session when a load is refused for a session that changed or ended", async () => {
    for (const refusal of [
      { error: "this page belongs to a session that has ended", session: "u-someone" },
      { error: "this browser's session has just changed", session_ended: true },
      { error: "this page was showing a session that has changed", session_changed: true },
    ]) {
      const { createServerDocument: create, onSessionEnd } = await freshModule();
      let stale = false;
      const fetch = vi.fn((url: string) =>
        Promise.resolve(
          stale ? reply(409, refusal) : reply(200, { doc: url, rev: 1, session: SESSION }),
        ),
      );
      vi.stubGlobal("fetch", fetch);
      const ended = vi.fn();
      const stop = onSessionEnd(ended);
      const notes = create("/api/test/stale-notes");
      await notes.load();
      stale = true;
      expect(await notes.load()).toBeUndefined();
      expect(ended).toHaveBeenCalledTimes(1);
      stop();
    }
  });

  it("stops every document of the page when a load of one names another session", async () => {
    const { createServerDocument: create, onSessionEnd } = await freshModule();
    let replaced = false;
    let answerPut: (value: unknown) => void = () => {};
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Promise((resolve) => (answerPut = resolve));
      const session = replaced ? "f".repeat(64) : SESSION;
      return Promise.resolve(reply(200, { doc: url, rev: 3, session }));
    });
    vi.stubGlobal("fetch", fetch);
    const ended = vi.fn();
    const stop = onSessionEnd(ended);
    const notes = create("/api/test/end-notes");
    const cards = create("/api/test/end-cards");
    await notes.load();
    await cards.load();
    // A save of the cards is in flight when the cookie is replaced.
    cards.save({ n: "old" });
    await vi.waitFor(() => expect(sentBodies(fetch)).toHaveLength(1));
    replaced = true;
    // The notes document finds the new session: nothing of it is shown in the old page.
    expect(await notes.load()).toBeUndefined();
    expect(ended).toHaveBeenCalledTimes(1);
    // The save in flight answers late: its revision is not taken.
    answerPut(reply(200, { rev: 99 }));
    await cards.idle();
    expect(cards.revision()).toBe(3);
    // Nothing more is saved, and no later load is shown, the old session's or the new one's.
    notes.save({ n: "after" });
    cards.save({ n: "after" });
    expect(await cards.load()).toBeUndefined();
    await notes.idle();
    expect(sentBodies(fetch)).toEqual([{ n: "old", rev: 3 }]);
    expect(ended).toHaveBeenCalledTimes(1);
    stop();
  });

  it("loads the page again when the session changes, instead of resetting its documents", async () => {
    const { createServerDocument: create, SESSION_RELOAD_KEY } = await freshModule();
    // jsdom cannot navigate, and says so on the console.
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.sessionStorage.removeItem(SESSION_RELOAD_KEY);
    let replaced = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return reply(503, { error: "down" });
      return reply(200, { doc: url, rev: 1, session: replaced ? "f".repeat(64) : SESSION });
    });
    vi.stubGlobal("fetch", fetch);
    const cards = create("/api/test/reload-cards");
    await cards.load();
    // A change whose save fails: the old session's unsaved body.
    cards.save({ n: "unsaved" });
    await cards.idle();
    const puts = sentBodies(fetch).length;
    replaced = true;
    const before = Date.now();
    expect(await create("/api/test/reload-notes").load()).toBeUndefined();
    // No handler: the page is reloaded, which the guard records.
    expect(Number(window.sessionStorage.getItem(SESSION_RELOAD_KEY))).toBeGreaterThanOrEqual(
      before,
    );
    // The old session's unsaved body is dropped, not shown or saved in the new one.
    expect(await cards.load()).toBeUndefined();
    await cards.idle();
    expect(sentBodies(fetch)).toHaveLength(puts);
    window.sessionStorage.removeItem(SESSION_RELOAD_KEY);
  });

  it("reloads for a new session at most once a minute in a tab, so it cannot loop", async () => {
    const { reloadForNewSession, SESSION_RELOAD_KEY } = await freshModule();
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.sessionStorage.removeItem(SESSION_RELOAD_KEY);
    const reload = vi.fn();
    expect(reloadForNewSession(reload, 1_000_000)).toBe(true);
    // An old response while this navigation is pending cannot start another navigation.
    expect(reloadForNewSession(reload, 1_000_001)).toBe(false);
    // A fresh module models the reloaded document, with the tab's sessionStorage retained.
    const nextPage = await freshModule();
    expect(nextPage.reloadForNewSession(reload, 1_030_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // A session that ends later, in the same tab, reloads it again.
    expect(nextPage.reloadForNewSession(reload, 1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
    window.sessionStorage.removeItem(SESSION_RELOAD_KEY);
  });

  it("refuses implicit reloads without storage but permits a confirmed account change", async () => {
    const { reloadForNewSession } = await freshModule();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const reload = vi.fn();
    expect(reloadForNewSession(reload, 2_000_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    // A deliberate account change still leaves the old desktop even if storage is blocked.
    expect(reloadForNewSession(reload, 2_000_001, "account-change")).toBe(true);
    expect(reloadForNewSession(reload, 2_000_002)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it("ends the page's session when a save is refused for belonging to another one", async () => {
    for (const refusal of [
      { error: "another session", session: "f".repeat(64) },
      { error: "this browser's session has just changed", session_ended: true },
      { error: "this page was showing a session that has changed", session_changed: true },
    ]) {
      const { createServerDocument: create, onSessionEnd } = await freshModule();
      const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "PUT"
          ? reply(409, refusal)
          : reply(200, { n: 0, rev: 0, session: SESSION }),
      );
      vi.stubGlobal("fetch", fetch);
      const ended = vi.fn();
      const stop = onSessionEnd(ended);
      const notes = create("/api/test/put-session");
      await notes.load();
      notes.save({ n: 1 });
      await notes.idle();
      // Sent once, naming the page's session; not retried on the refusal.
      expect(sentRaw(fetch)).toEqual([{ n: 1, rev: 0, session: SESSION }]);
      expect(ended).toHaveBeenCalledTimes(1);
      expect(notes.revision()).toBe(0);
      stop();
    }
  });

  it("ignores a reply of the old session that answers after the session ended", async () => {
    const { createServerDocument: create, onSessionEnd } = await freshModule();
    let answerOld: (value: unknown) => void = () => {};
    let gets = 0;
    const fetch = vi.fn((url: string) => {
      gets += 1;
      if (gets === 1) return Promise.resolve(reply(200, { doc: url, rev: 1, session: SESSION }));
      // The cards' load was sent before the cookie was replaced, and answers last.
      if (url === "/api/test/late-cards") return new Promise((resolve) => (answerOld = resolve));
      return Promise.resolve(reply(200, { doc: url, rev: 0, session: "f".repeat(64) }));
    });
    vi.stubGlobal("fetch", fetch);
    const ended = vi.fn();
    const stop = onSessionEnd(ended);
    await create("/api/test/late-notes").load();
    const lateLoad = create("/api/test/late-cards").load();
    await vi.waitFor(() => expect(gets).toBe(2));
    expect(await create("/api/test/late-photos").load()).toBeUndefined();
    answerOld(reply(200, { doc: "old", rev: 1, session: SESSION }));
    expect(await lateLoad).toBeUndefined();
    expect(ended).toHaveBeenCalledTimes(1);
    stop();
  });

  it("gives a fresh browser one session when the page loads its documents all at once", async () => {
    const { createServerDocument: create, onSessionEnd } = await freshModule();
    // The server: a request sent without a cookie starts a session, whose cookie the browser
    // holds once the reply has come back.
    let cookie: string | null = null;
    const sessions = new Set<string>();
    const fetch = vi.fn(async (url: string) => {
      const sent = cookie;
      await tick();
      const session = sent ?? String.fromCharCode(97 + sessions.size).repeat(64);
      sessions.add(session);
      cookie = session;
      return reply(200, { doc: url, rev: 0, session });
    });
    vi.stubGlobal("fetch", fetch);
    const ended = vi.fn();
    const stop = onSessionEnd(ended);
    const loads = await Promise.all(
      ["library", "layout", "settings"].map((name) => create(`/api/test/fresh-${name}`).load()),
    );
    // One session, named by every document: the page's session goes on.
    expect(sessions.size).toBe(1);
    expect(loads.map((loaded) => (loaded as { session?: string } | undefined)?.session)).toEqual([
      ...sessions,
      ...sessions,
      ...sessions,
    ]);
    expect(ended).not.toHaveBeenCalled();
    stop();
  });

  it("sends the next request alone when the page's first one failed without a reply", async () => {
    const { sessionFetch } = await freshModule();
    const sent: string[] = [];
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn((url: string) => {
      sent.push(url);
      if (url === "/api/first") return Promise.reject(new TypeError("offline"));
      if (url === "/api/second") return new Promise((resolve) => (answer = resolve));
      return Promise.resolve(reply(200, {}));
    });
    vi.stubGlobal("fetch", fetch);
    const first = sessionFetch("/api/first").catch(() => null);
    const second = sessionFetch("/api/second");
    const third = sessionFetch("/api/third");
    await first;
    await vi.waitFor(() => expect(sent).toEqual(["/api/first", "/api/second"]));
    // The second request, now the first, carries the cookie back before the third goes.
    await tick();
    expect(sent).toEqual(["/api/first", "/api/second"]);
    answer(reply(200, {}));
    await second;
    await third;
    expect(sent).toEqual(["/api/first", "/api/second", "/api/third"]);
  });

  it("cancels a first request that had no reply in time, so its late cookie cannot replace its successor's", async () => {
    const { sessionFetch } = await freshModule();
    vi.useFakeTimers();
    try {
      // The browser: a reply's cookie is kept unless its request was cancelled first.
      let cookie: string | null = null;
      const deliver = new Map<string, () => void>();
      const signals = new Map<string, AbortSignal | undefined>();
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (url: string, init?: RequestInit) =>
            new Promise((resolve, reject) => {
              signals.set(url, init?.signal ?? undefined);
              const session = cookie ?? `session of ${url}`;
              deliver.set(url, () => {
                if (init?.signal?.aborted) return reject(init.signal.reason);
                cookie = session;
                resolve(reply(200, { session }));
              });
            }),
        ),
      );
      const stalled = sessionFetch("/api/stalled").catch((error: unknown) => error);
      const successor = sessionFetch("/api/successor");
      await vi.advanceTimersByTimeAsync(10_000);
      expect(signals.get("/api/stalled")?.aborted).toBe(true);
      deliver.get("/api/successor")?.();
      await successor;
      expect(cookie).toBe("session of /api/successor");
      // The stalled request's reply comes back after all: it was cancelled, and its cookie is not
      // kept.
      deliver.get("/api/stalled")?.();
      expect(await stalled).toBeInstanceOf(DOMException);
      expect(cookie).toBe("session of /api/successor");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends one request at a time, never all at once, while the first has no reply or a server failure", async () => {
    const { sessionFetch } = await freshModule();
    vi.useFakeTimers();
    try {
      const sent: string[] = [];
      const answers = new Map<string, (value: unknown) => void>();
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          sent.push(url);
          return new Promise((resolve) => answers.set(url, resolve));
        }),
      );
      void sessionFetch("/api/stalled").catch(() => null);
      const others = ["/api/a", "/api/b", "/api/c"].map((url) => sessionFetch(url));
      await vi.advanceTimersByTimeAsync(9_999);
      expect(sent).toEqual(["/api/stalled"]);
      // The stalled request hands its place to one request, not to all of them.
      await vi.advanceTimersByTimeAsync(1);
      expect(sent).toEqual(["/api/stalled", "/api/a"]);
      // A server failure proves no session either: the next goes alone too.
      answers.get("/api/a")?.(reply(503, { error: "sessions are unavailable; retry" }));
      await vi.advanceTimersByTimeAsync(0);
      expect(sent).toEqual(["/api/stalled", "/api/a", "/api/b"]);
      // A reply from the application: the cookie is set, and the rest go.
      answers.get("/api/b")?.(reply(200, {}));
      await vi.advanceTimersByTimeAsync(0);
      expect(sent).toEqual(["/api/stalled", "/api/a", "/api/b", "/api/c"]);
      answers.get("/api/c")?.(reply(200, {}));
      await Promise.all(others);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves a window's load unanswered when it names another session, so the window saves nothing", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { serverDocument: shared, onSessionEnd, useServerState: useState_ } = await freshModule();
    let replaced = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return reply(200, { rev: 2 });
      return reply(200, { v: url, rev: 1, session: replaced ? "f".repeat(64) : SESSION });
    });
    vi.stubGlobal("fetch", fetch);
    const ended = vi.fn();
    const stop = onSessionEnd(ended);
    await shared("/api/test/end-first").load();
    replaced = true;
    const loaded: unknown[] = [];
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useState_({
          url: "/api/test/end-window",
          enabled: true,
          value,
          onLoad: (stored) => loaded.push(stored),
          toBody: (v) => ({ v }),
        }),
      { initialProps: { value: "a" } },
    );
    await waitFor(() => expect(result.current).toBe(false));
    rerender({ value: "changed" });
    await tick();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual([]);
    expect(sentBodies(fetch)).toEqual([]);
    stop();
  });
});

describe("withDeadline", () => {
  afterEach(() => vi.useRealTimers());

  it("lets a document's queue move on past a load and a save the server never answers", async () => {
    vi.useFakeTimers();
    const hang = (init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      );
    let puts = 0;
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return hang(init);
      puts += 1;
      return puts === 1 ? hang(init) : Promise.resolve(reply(200, { rev: 1 }) as Response);
    });
    vi.stubGlobal("fetch", fetch);
    const channel = createServerDocument("/api/test/hanging");
    let loaded: unknown = "pending";
    void channel.load().then((value) => {
      loaded = value;
    });
    channel.save({ n: 1 });
    // The load gives up at its deadline; the save is sent, hangs too, gives up, and is sent once
    // more. (Were this the page's first request, the first-request wait would end it sooner.)
    await vi.advanceTimersByTimeAsync(3 * REQUEST_DEADLINE_MS);
    expect(loaded).toBeUndefined();
    expect(puts).toBe(2);
    await channel.idle();
    expect(sentBodies(fetch)).toEqual([
      { n: 1, rev: 0 },
      { n: 1, rev: 0 },
    ]);
  });

  it("aborts a request that hangs at its deadline, and leaves no timer once it settles", async () => {
    vi.useFakeTimers();
    let outcome: unknown = "pending";
    void withDeadline(
      (signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason)),
        ),
      1000,
    ).catch((error: unknown) => {
      outcome = error;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(outcome).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect((outcome as DOMException).name).toBe("TimeoutError");
    expect(await withDeadline(async () => "answered", 1000)).toBe("answered");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles at its deadline even when the request never settles, whatever its signal", async () => {
    vi.useFakeTimers();
    let outcome: unknown = "pending";
    let aborted = false;
    void withDeadline((signal) => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise<never>(() => {});
    }, 1000).catch((error: unknown) => {
      outcome = error;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(aborted).toBe(true);
    expect((outcome as DOMException).name).toBe("TimeoutError");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("restored desktop request concurrency", () => {
  it("bounds reads, reserves a write, preserves FIFO and drops a cancelled queued request", async () => {
    vi.resetModules();
    const { sessionFetch } = await import("./desktop-server");
    const sent: string[] = [];
    const finish = new Map<string, (value: unknown) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        sent.push(url);
        if (url === "/api/seed") return Promise.resolve(reply(200, {}));
        return new Promise((resolve) => finish.set(url, resolve));
      }),
    );
    await sessionFetch("/api/seed");
    const reads = ["a", "b", "c", "d", "e"].map((name) => sessionFetch(`/api/test/${name}`));
    const cancelled = new AbortController();
    const dropped = sessionFetch("/api/test/cancelled", { signal: cancelled.signal }).catch(
      (e: unknown) => e,
    );
    const write = sessionFetch("/api/test/write", { method: "PUT" });
    expect(sent).toEqual([
      "/api/seed",
      "/api/test/a",
      "/api/test/b",
      "/api/test/c",
      "/api/test/write",
    ]);
    cancelled.abort();
    expect(((await dropped) as DOMException).name).toBe("AbortError");
    finish.get("/api/test/a")?.(reply(200, {}));
    await vi.waitFor(() => expect(sent).toContain("/api/test/d"));
    expect(sent).not.toContain("/api/test/e");
    finish.get("/api/test/b")?.(reply(200, {}));
    await vi.waitFor(() => expect(sent).toContain("/api/test/e"));
    expect(sent.indexOf("/api/test/d")).toBeLessThan(sent.indexOf("/api/test/e"));
    for (const name of ["c", "d", "e", "write"]) finish.get(`/api/test/${name}`)?.(reply(200, {}));
    await Promise.all([...reads, write]);
    expect(sent).not.toContain("/api/test/cancelled");
  });

  it("does not send a queued old-session write and exempts identity, streams and keepalive", async () => {
    vi.resetModules();
    const { sessionFetch, setDesktopSession } = await import("./desktop-server");
    const sent: string[] = [];
    const finish = new Map<string, (value: unknown) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        sent.push(url);
        if (
          url === "/api/seed" ||
          url.startsWith("/api/session/") ||
          url.startsWith("/live/") ||
          url.includes("unload")
        )
          return Promise.resolve(reply(200, {}));
        return new Promise((resolve) => finish.set(url, resolve));
      }),
    );
    await sessionFetch("/api/seed");
    setDesktopSession("old");
    const reads = ["a", "b", "c"].map((name) => sessionFetch(`/api/test/${name}`));
    const activeWrite = sessionFetch("/api/test/active", { method: "PUT" });
    const stale = sessionFetch("/api/test/stale", { method: "PUT" }).catch((e: unknown) => e);
    await sessionFetch("/api/session/sign-out", { method: "POST" });
    await sessionFetch("/live/test");
    await sessionFetch("/api/test/unload", { method: "POST", keepalive: true });
    setDesktopSession("new");
    finish.get("/api/test/active?desktop_session=old")?.(reply(200, {}));
    expect(((await stale) as DOMException).name).toBe("AbortError");
    expect(sent.some((url) => url.includes("/stale"))).toBe(false);
    for (const name of ["a", "b", "c"])
      finish.get(`/api/test/${name}?desktop_session=old`)?.(reply(200, {}));
    await Promise.all([...reads, activeWrite]);
  });
});

describe("request cancellation before the first cookie", () => {
  it("settles at its deadline without waiting for an unrelated first request", async () => {
    vi.resetModules();
    const { sessionFetch, withDeadline } = await import("./desktop-server");
    let finish: (value: unknown) => void = () => {};
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        sent.push(url);
        return new Promise((resolve) => {
          finish = resolve;
        });
      }),
    );
    const first = sessionFetch("/api/first");
    const expired = await withDeadline(
      (signal) => sessionFetch("/api/waiting", { signal }),
      20,
    ).catch((error: unknown) => error);
    expect((expired as DOMException).name).toBe("TimeoutError");
    expect(sent).toEqual(["/api/first"]);
    finish(reply(200, {}));
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toEqual(["/api/first"]);
  });
});

describe("request queue recovery and session boundaries", () => {
  it("releases a place when fetch throws synchronously", async () => {
    vi.resetModules();
    const { sessionFetch } = await import("./desktop-server");
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        sent.push(url);
        if (url === "/api/throws") throw new TypeError("offline");
        return Promise.resolve(reply(200, {}));
      }),
    );
    await sessionFetch("/api/seed");
    await expect(sessionFetch("/api/throws")).rejects.toThrow("offline");
    await Promise.all(["a", "b", "c", "d"].map((name) => sessionFetch(`/api/${name}`)));
    expect(sent).toEqual(["/api/seed", "/api/throws", "/api/a", "/api/b", "/api/c", "/api/d"]);
  });

  it("drops an old-session queued read and does not exempt session polling", async () => {
    vi.resetModules();
    const { sessionFetch, setDesktopSession } = await import("./desktop-server");
    const sent: string[] = [];
    const finish = new Map<string, (value: unknown) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        sent.push(url);
        if (url === "/api/seed") return Promise.resolve(reply(200, {}));
        return new Promise((resolve) => finish.set(url, resolve));
      }),
    );
    await sessionFetch("/api/seed");
    setDesktopSession("old");
    const reads = ["a", "b", "c"].map((name) => sessionFetch(`/api/test/${name}`));
    const stale = sessionFetch("/api/test/stale-read").catch((error: unknown) => error);
    const polling = sessionFetch("/api/session/ticket", { method: "POST" }).catch(
      (error: unknown) => error,
    );
    expect(sent).toContain("/api/session/ticket");
    const secondPoll = sessionFetch("/api/session/ticket", { method: "POST" }).catch(
      (error: unknown) => error,
    );
    expect(sent.filter((url) => url === "/api/session/ticket")).toHaveLength(1);
    setDesktopSession("new");
    finish.get("/api/test/a?desktop_session=old")?.(reply(200, {}));
    expect(((await stale) as DOMException).name).toBe("AbortError");
    expect(sent.some((url) => url.includes("stale-read"))).toBe(false);
    finish.get("/api/session/ticket")?.(reply(200, {}));
    expect(((await secondPoll) as DOMException).name).toBe("AbortError");
    for (const name of ["b", "c"])
      finish.get(`/api/test/${name}?desktop_session=old`)?.(reply(200, {}));
    await Promise.all([...reads, polling]);
  });
});

describe("restoring many windows", () => {
  it("keeps a 75-read burst bounded while a write and live stream make progress", async () => {
    vi.resetModules();
    const { sessionFetch } = await import("./desktop-server");
    let active = 0;
    let peak = 0;
    let activeReads = 0;
    let peakReads = 0;
    const pending: Array<() => void> = [];
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        sent.push(url);
        if (url === "/api/seed" || url.startsWith("/live/")) return Promise.resolve(reply(200, {}));
        const read = !init?.method || init.method === "GET";
        active += 1;
        if (read) activeReads += 1;
        peak = Math.max(peak, active);
        peakReads = Math.max(peakReads, activeReads);
        return new Promise((resolve) =>
          pending.push(() => {
            active -= 1;
            if (read) activeReads -= 1;
            resolve(reply(200, {}));
          }),
        );
      }),
    );
    await sessionFetch("/api/seed");
    const reads = Array.from({ length: 75 }, (_, index) => sessionFetch(`/api/app/${index}`));
    const write = sessionFetch("/api/app/write", { method: "PUT" });
    await sessionFetch("/live/desktop");
    expect(sent).toContain("/api/app/write");
    expect(sent).toContain("/live/desktop");
    let completed = 0;
    while (completed < 76) {
      await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
      pending.shift()?.();
      completed += 1;
      await Promise.resolve();
    }
    await Promise.all([...reads, write]);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peakReads).toBeLessThanOrEqual(3);
  });
});

describe("request capacity across session changes", () => {
  it("returns every read place after dropping three queued old-session reads", async () => {
    vi.resetModules();
    const { sessionFetch, setDesktopSession } = await import("./desktop-server");
    const sent: string[] = [];
    const finish = new Map<string, (value: unknown) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        sent.push(url);
        if (url === "/api/seed") return Promise.resolve(reply(200, {}));
        return new Promise((resolve) => finish.set(url, resolve));
      }),
    );
    await sessionFetch("/api/seed");
    setDesktopSession("old");
    const active = ["a", "b", "c"].map((name) => sessionFetch(`/api/test/${name}`));
    const stale = ["d", "e", "f"].map((name) =>
      sessionFetch(`/api/test/${name}`).catch((error: unknown) => error),
    );
    setDesktopSession("new");
    for (const name of ["a", "b", "c"])
      finish.get(`/api/test/${name}?desktop_session=old`)?.(reply(200, {}));
    await Promise.all(active);
    expect((await Promise.all(stale)).map((error) => (error as DOMException).name)).toEqual([
      "AbortError",
      "AbortError",
      "AbortError",
    ]);
    const fresh = ["x", "y", "z"].map((name) => sessionFetch(`/api/test/${name}`));
    expect(sent.filter((url) => url.includes("desktop_session=new"))).toHaveLength(3);
    for (const name of ["x", "y", "z"])
      finish.get(`/api/test/${name}?desktop_session=new`)?.(reply(200, {}));
    await Promise.all(fresh);
  });
});
