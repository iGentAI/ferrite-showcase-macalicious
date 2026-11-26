import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeSettings } from "../system-preferences/storage";
import { createServerDocument, onSaveFailure } from "./desktop-server";
import { keepServerCopy } from "./document-merge";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const SESSION = "a".repeat(64);
const SETTINGS = "/api/system-preferences/settings";

/**
 * A document kept as `ferrite-apps/desktop/src/apps/document.rs` keeps it: a `PUT` is stored only
 * on the stored revision, and any other is answered 409 with the current document.
 */
function documentServer(doc: Record<string, unknown>, rev: number) {
  const server = { doc, rev };
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
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

const settings = (recent: string[], size: number) => ({
  values: { "desktop.recentApps": recent, "dock.size": size },
  theme: null,
});

/** This window's save, made on `base`, after another window saved `theirs` first. */
async function raceAgainst(
  base: Record<string, unknown>,
  theirs: Record<string, unknown>,
  mine: Record<string, unknown>,
  merge = mergeSettings,
) {
  const { server } = documentServer(base, 1);
  const failures = vi.fn();
  const stop = onSaveFailure(failures);
  const channel = createServerDocument(SETTINGS, { merge });
  channel.watch({}, vi.fn());
  await channel.load();
  server.doc = theirs;
  server.rev = 2;
  channel.save(mine);
  await channel.idle();
  stop();
  return { server, failures };
}

describe("a save refused because another window saved first", () => {
  it("does not say the change was not kept when the server's copy already holds it", async () => {
    // Both windows opened Stickies; the other also changed the Dock, and saved first.
    const { server, failures } = await raceAgainst(
      settings(["notes"], 1),
      settings(["stickies", "notes"], 2),
      settings(["stickies", "notes"], 1),
    );
    expect(failures).not.toHaveBeenCalled();
    expect(server.doc).toEqual(settings(["stickies", "notes"], 2));
  });

  it("still says the change was not kept when the server's copy lacks it", async () => {
    // A merge that keeps the server's copy, which holds another list: this window's app is lost.
    const { server, failures } = await raceAgainst(
      settings(["notes"], 1),
      settings(["calculator", "notes"], 1),
      settings(["stickies", "notes"], 1),
      keepServerCopy,
    );
    expect(failures).toHaveBeenCalledWith(
      expect.objectContaining({
        url: SETTINGS,
        reason: expect.stringContaining("changed elsewhere first"),
      }),
    );
    expect(server.doc).toEqual(settings(["calculator", "notes"], 1));
  });

  it("keeps both windows' apps when they opened different ones, and says nothing was lost", async () => {
    const { server, failures } = await raceAgainst(
      settings(["notes"], 1),
      settings(["calculator", "notes"], 1),
      settings(["font-book", "notes"], 1),
    );
    expect(failures).not.toHaveBeenCalled();
    expect(server.doc).toEqual(settings(["font-book", "calculator", "notes"], 1));
  });
});
