// @vitest-environment node
import { inflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { crc32, MOST_ARCHIVE_ENTRIES, zipBlob } from "./finder-archive";

const encode = (text: string) => new TextEncoder().encode(text);

/** The entries of a zip, read by its central directory as an unzip tool would. */
async function read(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: { name: string; text: string; method: number; crc: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true);
    const body = bytes.subarray(start, start + packed);
    const raw = method === 8 ? inflateRawSync(body) : body;
    entries.push({ name, text: new TextDecoder().decode(raw), method, crc });
    at += 46 + nameLength;
  }
  return entries;
}

describe("a zip", () => {
  it("checks its bytes as a zip does", () => {
    expect(crc32(encode("abc"))).toBe(0x352441c2);
  });

  it("holds folders and files under their paths, with the same bytes", async () => {
    const long = "hello ".repeat(500);
    const zip = await zipBlob([
      { path: "Folder/" },
      { path: "Folder/long é.txt", blob: new Blob([long]) },
      { path: "short.txt", blob: new Blob(["hi"]) },
    ]);
    const entries = await read(zip);
    expect(entries.map((entry) => [entry.name, entry.text])).toEqual([
      ["Folder/", ""],
      ["Folder/long é.txt", long],
      ["short.txt", "hi"],
    ]);
    expect(entries[2]?.crc).toBe(crc32(encode("hi")));
  });

  it("stores the bytes where the browser cannot deflate them", async () => {
    vi.stubGlobal(
      "CompressionStream",
      class {
        constructor() {
          throw new TypeError("unsupported format");
        }
      },
    );
    const long = "hello ".repeat(500);
    const entries = await read(await zipBlob([{ path: "a.txt", blob: new Blob([long]) }]));
    vi.unstubAllGlobals();
    expect(entries).toEqual([{ name: "a.txt", text: long, method: 0, crc: crc32(encode(long)) }]);
  });

  it("refuses more entries than a zip can name, before it reads any", async () => {
    const read = vi.fn(() => {
      throw new Error("read");
    });
    const files = Array.from({ length: MOST_ARCHIVE_ENTRIES + 1 }, (_, index) => ({
      path: `${index}`,
      get blob() {
        return read();
      },
    }));
    await expect(zipBlob(files)).rejects.toThrow("A zip holds at most 65535 items.");
    expect(read).not.toHaveBeenCalled();
  });

  it("counts its files as it goes", async () => {
    const told: number[] = [];
    await zipBlob(
      [
        { path: "a", blob: new Blob(["a"]) },
        { path: "b", blob: new Blob(["b"]) },
      ],
      (done) => told.push(done),
    );
    expect(told).toEqual([1, 2]);
  });
});
