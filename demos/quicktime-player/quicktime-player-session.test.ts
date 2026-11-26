import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDesktopSession } from "../desktop/desktop-server";
import { defaultDrive } from "./quicktime-player-drive";

let writes: string[];

beforeEach(() => {
  writes = [];
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    writes.push(`${init.method} ${String(input)}`);
    return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("QuickTime Player's drive, once someone else has signed in", () => {
  it("changes a movie for the person its window opened for", async () => {
    setDesktopSession("first-person");
    const drive = defaultDrive();
    setDesktopSession("next-person");
    await expect(drive?.rename?.("m1", "Holiday.mov")).rejects.toMatchObject({ status: 409 });
    await expect(drive?.move?.("m1", "documents")).rejects.toMatchObject({ status: 409 });
    await expect(drive?.upload(new File(["a"], "Take.mov"), () => {})).rejects.toMatchObject({
      status: 409,
    });
    await expect(drive?.keepClips?.("m1", [1])).rejects.toThrow("the server answered 409");
    expect(writes).toEqual([
      "POST /api/files/ops?desktop_session=first-person",
      "POST /api/files/ops?desktop_session=first-person",
      "POST /api/files/uploads?desktop_session=first-person",
      "PUT /api/quicktime-player/clips/m1?desktop_session=first-person",
    ]);
  });
});
