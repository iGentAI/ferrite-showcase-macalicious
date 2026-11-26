import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The page's session is the module's own: each test starts from a page that has named none. */
async function freshPage() {
  vi.resetModules();
  const server = await import("./desktop-server");
  const files = await import("./desktop-files");
  return {
    setDesktopSession: server.setDesktopSession,
    uploadFile: files.uploadFile,
    ensureFolder: files.ensureFolder,
    runOps: files.runOps,
  };
}

const file = () => new Blob(["abc"], { type: "text/plain" });
const saved = { name: "Words.txt" };

describe("the sound of a drive's change", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "cannot make its audio",
      class {
        constructor() {
          throw new Error("no audio device");
        }
      },
    ],
    [
      "cannot resume its audio",
      class {
        state = "suspended";
        resume = () => Promise.reject(new Error("not allowed"));
        createOscillator() {
          throw new Error("no audio device");
        }
      },
    ],
  ])("leaves a trash that was done done when the browser %s", async (_, context) => {
    const drive = { rev: 7, entries: [], usage: 0, quota: 1, piece_bytes: 1, max_file_bytes: 1 };
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("AudioContext", context);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(drive), { status: 200 }));
    const { runOps } = await freshPage();
    await expect(runOps([{ op: "trash", id: "a" }])).resolves.toMatchObject({ rev: 7 });
  });
});

describe("the session an upload names", () => {
  let urls: string[];

  beforeEach(() => {
    urls = [];
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is the one the work began for, whatever the page names now", async () => {
    const { setDesktopSession, uploadFile } = await freshPage();
    setDesktopSession("next-person");
    await expect(
      uploadFile(file(), "documents", { ...saved, session: "first-person" }),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(urls).toEqual(["/api/files/uploads?desktop_session=first-person"]);
  });

  it("is the page's as the upload starts, when none is given", async () => {
    const { setDesktopSession, uploadFile } = await freshPage();
    setDesktopSession("this-person");
    await expect(uploadFile(file(), "documents", saved)).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual(["/api/files/uploads?desktop_session=this-person"]);
  });

  it("refuses work begun with no session once someone has signed in, sending nothing", async () => {
    const { setDesktopSession, uploadFile } = await freshPage();
    setDesktopSession("next-person");
    await expect(
      uploadFile(file(), "documents", { ...saved, session: null }),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(urls).toEqual([]);
  });

  it("refuses an upload after the person has signed out, sending nothing", async () => {
    const { setDesktopSession, uploadFile } = await freshPage();
    setDesktopSession("gone-person");
    setDesktopSession(null);
    await expect(uploadFile(file(), "documents", saved)).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual([]);
  });

  it("names nothing on a page that has never signed anyone in", async () => {
    const { uploadFile } = await freshPage();
    await expect(uploadFile(file(), "documents", saved)).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual(["/api/files/uploads"]);
  });
});

describe("the session a save's folder names", () => {
  let urls: string[];

  beforeEach(() => {
    urls = [];
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is the one the save began for, whatever the page names now", async () => {
    const { setDesktopSession, ensureFolder } = await freshPage();
    setDesktopSession("next-person");
    await expect(ensureFolder("music", "Voice Memos", "first-person")).rejects.toMatchObject({
      status: 409,
    });
    expect(urls).toEqual(["/api/files/ops?desktop_session=first-person"]);
  });

  it("refuses a save with no session once someone has signed in, sending nothing", async () => {
    const { setDesktopSession, ensureFolder } = await freshPage();
    setDesktopSession("next-person");
    await expect(ensureFolder("music", "Voice Memos", null)).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual([]);
  });

  it("holds for ops that name a session themselves", async () => {
    const { setDesktopSession, runOps } = await freshPage();
    setDesktopSession("next-person");
    await expect(runOps([], undefined, null)).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual([]);
    await expect(runOps([], undefined, "first-person")).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual(["/api/files/ops?desktop_session=first-person"]);
  });
});

describe("the session a drive change names", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** A drive whose first reply is a server failure, during which `meanwhile` runs; then a refusal. */
  function failingOnce(meanwhile: () => void) {
    const urls: string[] = [];
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      if (urls.length === 1) {
        meanwhile();
        return new Response("{}", { status: 500 });
      }
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    });
    return urls;
  }

  it("stays the page's as the change began when it is sent again after someone else signs in", async () => {
    const { setDesktopSession, runOps } = await freshPage();
    setDesktopSession("first-person");
    const urls = failingOnce(() => setDesktopSession("next-person"));
    await expect(runOps([{ op: "empty-trash" }])).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual([
      "/api/files/ops?desktop_session=first-person",
      "/api/files/ops?desktop_session=first-person",
    ]);
  });

  it("stays the one named when it is sent again", async () => {
    const { setDesktopSession, runOps } = await freshPage();
    setDesktopSession("next-person");
    const urls = failingOnce(() => {});
    await expect(
      runOps([{ op: "rename", id: "f1", name: "Plan.txt" }], undefined, "first-person"),
    ).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual([
      "/api/files/ops?desktop_session=first-person",
      "/api/files/ops?desktop_session=first-person",
    ]);
  });

  it("is refused unsent on a page everyone has signed out of", async () => {
    const { setDesktopSession, runOps } = await freshPage();
    setDesktopSession("first-person");
    setDesktopSession(null);
    const urls = failingOnce(() => {});
    await expect(runOps([{ op: "empty-trash" }])).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual([]);
  });

  it("names nothing on a page that signs no one in", async () => {
    const { runOps } = await freshPage();
    const urls = failingOnce(() => {});
    await expect(runOps([{ op: "empty-trash" }])).rejects.toMatchObject({ status: 409 });
    expect(urls).toEqual(["/api/files/ops", "/api/files/ops"]);
  });
});
