import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const reply = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  headers: new Headers(),
});
const puts = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.flatMap((call) => {
    const init = call[1] as RequestInit | undefined;
    return init?.method === "PUT" ? [JSON.parse(init.body as string)] : [];
  });

/** A new page: the module's state, which names the page's session, starts again. */
async function newPage() {
  vi.resetModules();
  return (await import("./desktop-server")).createServerDocument;
}

describe("a document kept over a reload", () => {
  /** A page that loaded `stored`, gave `newest` whose save never answers, and went. */
  async function leave(
    url: string,
    stored: object,
    newest: object,
    session: string,
    persisted = false,
  ) {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? new Promise(() => {}) : reply({ ...stored, rev: 1, session }),
    );
    vi.stubGlobal("fetch", fetch);
    const channel = (await newPage())(url, { keptOverReload: true });
    await channel.load();
    channel.save(newest);
    await vi.waitFor(() => expect(puts(fetch).length).toBe(1));
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted }));
  }

  it("saves what the last page left, in its first load", async () => {
    await leave("/api/test/kept", { a: 1, b: 1 }, { a: 2, b: 1 }, "s1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply({ rev: 2 }) : reply({ a: 1, b: 9, rev: 1, session: "s1" }),
    );
    vi.stubGlobal("fetch", fetch);
    const next = (await newPage())("/api/test/kept", { keptOverReload: true });
    expect(await next.load()).toMatchObject({ a: 2, b: 9 });
    await vi.waitFor(() => expect(puts(fetch).length).toBe(1));
    expect(puts(fetch)[0]).toMatchObject({ a: 2, b: 9, rev: 1 });
    expect(sessionStorage.getItem("macalicious.left./api/test/kept")).toBeNull();
  });

  it("keeps a body given before the first load over what the last page left", async () => {
    await leave("/api/test/newer", { a: 1 }, { a: 2 }, "s1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply({ rev: 2 }) : reply({ a: 1, rev: 1, session: "s1" }),
    );
    vi.stubGlobal("fetch", fetch);
    const next = (await newPage())("/api/test/newer", { keptOverReload: true });
    next.save({ a: 3 });
    await next.load();
    await vi.waitFor(() => expect(puts(fetch).length).toBeGreaterThan(0));
    expect(puts(fetch).at(-1)).toMatchObject({ a: 3 });
    expect(puts(fetch).some((body) => body.a === 2)).toBe(false);
  });

  it("keeps a body given while the first load is under way", async () => {
    await leave("/api/test/during", { a: 1 }, { a: 2 }, "s1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? reply({ rev: 2 }) : new Promise((resolve) => (answer = resolve)),
    );
    vi.stubGlobal("fetch", fetch);
    const next = (await newPage())("/api/test/during", { keptOverReload: true });
    const loaded = next.load();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    next.save({ a: 3 });
    answer(reply({ a: 1, rev: 1, session: "s1" }));
    await loaded;
    await vi.waitFor(() => expect(puts(fetch).length).toBeGreaterThan(0));
    expect(puts(fetch).at(-1)).toMatchObject({ a: 3 });
    expect(puts(fetch).some((body) => body.a === 2)).toBe(false);
  });

  it("loads as usual when the record is not one, or storage cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ a: 1, rev: 1, session: "s1" })),
    );
    sessionStorage.setItem("macalicious.left./api/test/bad", "{not json");
    const bad = (await newPage())("/api/test/bad", { keptOverReload: true });
    expect(await bad.load()).toMatchObject({ a: 1 });
    const refused = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const blocked = (await newPage())("/api/test/blocked", { keptOverReload: true });
    expect(await blocked.load()).toMatchObject({ a: 1 });
    refused.mockRestore();
  });

  it("leaves nothing when the page only goes into the browser's page cache", async () => {
    await leave("/api/test/cached", { a: 1 }, { a: 2 }, "s1", true);
    expect(sessionStorage.getItem("macalicious.left./api/test/cached")).toBeNull();
  });

  it("drops what another session left", async () => {
    await leave("/api/test/other", { a: 1 }, { a: 2 }, "alice");
    const fetch = vi.fn(async () => reply({ a: 7, rev: 1, session: "bob" }));
    vi.stubGlobal("fetch", fetch);
    const next = (await newPage())("/api/test/other", { keptOverReload: true });
    expect(await next.load()).toMatchObject({ a: 7 });
    expect(puts(fetch)).toEqual([]);
    expect(sessionStorage.getItem("macalicious.left./api/test/other")).toBeNull();
  });

  it("leaves nothing for a document that does not ask", async () => {
    const fetch = vi.fn(async () => new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);
    const channel = (await newPage())("/api/test/plain");
    channel.save({ a: 1 });
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    expect(sessionStorage.getItem("macalicious.left./api/test/plain")).toBeNull();
  });
});
