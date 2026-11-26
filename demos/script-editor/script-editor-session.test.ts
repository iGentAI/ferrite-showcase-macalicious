import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDesktopSession } from "../desktop/desktop-server";
import { desktopScriptEditorServer } from "./script-editor-server";

const drive = {
  rev: 1,
  entries: [
    {
      id: "documents",
      name: "Documents",
      kind: "folder",
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    },
    {
      id: "s1",
      parent: "documents",
      name: "Tidy.js",
      kind: "file",
      size: 1,
      version: 3,
      created_ms: 1,
      modified_ms: 1,
    },
  ],
  session: "first-person",
};

let writes: string[];
let reading: () => void;

beforeEach(() => {
  writes = [];
  reading = () => {};
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (init.method && init.method !== "GET") {
      writes.push(`${init.method} ${String(input)}`);
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    }
    reading();
    return new Response(JSON.stringify(drive), { status: 200 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a Script Editor save during which someone else signs in", () => {
  beforeEach(() => {
    setDesktopSession("first-person");
    reading = () => setDesktopSession("next-person");
  });

  it("keeps a bundle to the person it began for", async () => {
    await expect(
      desktopScriptEditorServer.exportBundle("Tidy", {
        code: "1",
        description: "",
        info: { name: "Tidy", identifier: "tidy", version: "1", copyright: "" },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual(["POST /api/files/ops?desktop_session=first-person"]);
  });

  it("keeps a copy to the person it began for", async () => {
    await expect(desktopScriptEditorServer.exportCopy("Tidy.js", "1")).rejects.toMatchObject({
      status: 409,
    });
    expect(writes).toEqual(["POST /api/files/uploads?desktop_session=first-person"]);
  });

  it("keeps a save over the file to the person it began for", async () => {
    await expect(
      desktopScriptEditorServer.write({ id: "s1", name: "Tidy.js", version: 3 }, "1"),
    ).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual(["POST /api/files/uploads?desktop_session=first-person"]);
  });
});
