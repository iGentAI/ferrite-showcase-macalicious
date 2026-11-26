import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * Reading a drive file in several requests while it is saved over: the read never hands back
 * pieces of two versions. A stand-in for the drive's routes answers the listing and the content
 * pieces as the server does: a piece asked for with a `version` the file no longer has is refused
 * with 412, and one asked for without a version is the file's bytes now.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function standIn(id: string, first: string) {
  const encoder = new TextEncoder();
  const file = { content: encoder.encode(first), version: 0, modified: 1 };
  const asked: (string | null)[] = [];
  const drive = () => ({
    rev: file.version + 1,
    entries: [
      { id: "docs", name: "Documents", kind: "folder", size: 0, created_ms: 1, modified_ms: 1 },
      {
        id,
        parent: "docs",
        name: "Notes.txt",
        kind: "file",
        size: file.content.length,
        type: "text/plain",
        created_ms: 1,
        modified_ms: file.modified,
        version: file.version,
      },
    ],
    usage: file.content.length,
    quota: 1_000_000,
    piece_bytes: 1,
    max_file_bytes: 1_000_000,
    max_entries: 100,
    session: "s",
  });
  /** Saves `text` over the file, as another window does: the next version. */
  const saveOver = (text: string, modified = file.modified) => {
    file.content = encoder.encode(text);
    file.version += 1;
    file.modified = modified;
  };
  let onPiece: (count: number) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://desktop.test");
      if (url.pathname === `/api/files/content/${id}`) {
        const version = url.searchParams.get("version");
        asked.push(version);
        if (version !== null && Number(version) !== file.version) {
          return new Response(JSON.stringify({ error: "saved over" }), { status: 412 });
        }
        const from = Number(url.searchParams.get("piece"));
        const count = Number(url.searchParams.get("count"));
        const part = file.content.slice(from, from + count);
        onPiece(asked.length);
        return new Response(part);
      }
      return new Response(JSON.stringify(drive()), { status: 200 });
    }),
  );
  return {
    asked,
    saveOver,
    afterPiece: (callback: (count: number) => void) => {
      onPiece = callback;
    },
  };
}

describe("a drive file read in pieces", () => {
  it("is read again whole when it is saved over between two of its requests, same size and time", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // Ten pieces of one byte: two requests of eight. Saved over with bytes of the same size in
    // the same millisecond right after the first: size and modification time tell nothing.
    const drive = standIn("f1", "aaaaaaaaaa");
    drive.afterPiece((count) => {
      if (count === 1) drive.saveOver("bbbbbbbbbb");
    });
    const { readFileEntry } = await import("./desktop-files");
    const read = await readFileEntry("f1");
    expect(await read.blob.text()).toBe("bbbbbbbbbb");
    expect(read.entry.version).toBe(1);
    // The first read named version 0, was refused at its second request, and the read again
    // named version 1 throughout.
    expect(drive.asked).toEqual(["0", "0", "1", "1"]);
  });

  it("is read again when it grew by whole pieces after the page read the drive", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const drive = standIn("f2", "aaaaaaaa");
    const { readFile, ensureDrive } = await import("./desktop-files");
    await ensureDrive();
    // Saved over with one more piece after the page's copy of the drive was read.
    drive.saveOver("bbbbbbbbb", 2);
    const blob = await readFile("f2");
    expect(await blob.text()).toBe("bbbbbbbbb");
    expect(drive.asked).toEqual(["0", "1", "1"]);
  });
});
