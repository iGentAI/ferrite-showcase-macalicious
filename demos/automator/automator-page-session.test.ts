import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDesktopSession } from "../desktop/desktop-server";
import { type PageHost, runPageAction } from "./automator-page";

const drive = {
  rev: 1,
  entries: [
    { id: "desktop", name: "Desktop", kind: "folder", size: 0, created_ms: 1, modified_ms: 1 },
  ],
  session: "first-person",
};

let writes: string[];

beforeEach(() => {
  writes = [];
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (init.method && init.method !== "GET") {
      writes.push(`${init.method} ${String(input)}`);
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    }
    return new Response(
      JSON.stringify(
        String(input).startsWith("/api/safari/file")
          ? { ok: true, data: btoa("a"), type: "text/plain", name: "a.txt" }
          : drive,
      ),
      { status: 200 },
    );
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const host = (session: string): PageHost => ({
  session,
  ask: async () => null,
  running: new Map(),
  read: () => undefined,
});

describe("an Automator run during which someone else signs in", () => {
  it("changes the drive of the person it began for", async () => {
    setDesktopSession("next-person");
    await expect(
      runPageAction("page.new-folder", { name: "Made" }, [], host("first-person")),
    ).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual(["POST /api/files/ops?desktop_session=first-person"]);
  });

  it("saves what an action makes on the drive of the person it began for", async () => {
    setDesktopSession("next-person");
    await expect(
      runPageAction(
        "page.download-urls",
        { where: "Desktop" },
        ["https://example.com/a"],
        host("first-person"),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual(["POST /api/files/uploads?desktop_session=first-person"]);
  });
});
