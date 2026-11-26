import { afterEach, describe, expect, it, vi } from "vitest";
import { setDesktopSession } from "../desktop/desktop-server";
import { saveToDownloads } from "./safari-web";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a download to Downloads during which someone else signs in", () => {
  it("is refused for the person it began for", async () => {
    const writes: string[] = [];
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    setDesktopSession("first-person");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (init.method && init.method !== "GET") {
        writes.push(`${init.method} ${String(input)}`);
        return new Response(JSON.stringify({ error: "this page's session has ended" }), {
          status: 409,
        });
      }
      setDesktopSession("next-person");
      return new Response(JSON.stringify({ rev: 1, entries: [], session: "first-person" }), {
        status: 200,
      });
    });
    await expect(saveToDownloads(new Blob(["a"]), "a.txt")).resolves.toEqual({
      ok: false,
      message: "this page's session has ended",
    });
    expect(writes).toEqual(["POST /api/files/uploads?desktop_session=first-person"]);
  });
});
