import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { duplicateFontFiles, validateFontBytes, validationVerdict } from "./font-book-validate";

/** An sfnt file of `tags`, each table of 16 bytes, with right checksums unless `spoil` names one. */
function sfnt(tags: readonly string[], spoil?: string): ArrayBuffer {
  const data = new DataView(new ArrayBuffer(12 + tags.length * 32));
  data.setUint32(0, 0x00010000);
  data.setUint16(4, tags.length);
  tags.forEach((tag, index) => {
    const at = 12 + index * 16;
    const offset = 12 + tags.length * 16 + index * 16;
    for (let char = 0; char < 4; char += 1) data.setUint8(at + char, tag.charCodeAt(char));
    if (tag === "head") data.setUint32(offset + 12, 0x5f0f3cf5);
    else data.setUint32(offset, index + 1);
    data.setUint32(at + 4, tag === "head" || tag === spoil ? 0 : index + 1);
    data.setUint32(at + 8, offset);
    data.setUint32(at + 12, 16);
  });
  return data.buffer;
}

const COMPLETE = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "post"];
const stateOf = (data: ArrayBuffer, name: string) =>
  validateFontBytes(data).find((check) => check.name === name)?.state;

describe("validating a font's bytes", () => {
  it("passes a real TrueType file", () => {
    const file = readFileSync("node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf");
    const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.length) as ArrayBuffer;
    expect(validationVerdict(validateFontBytes(data))).toBe("passed");
  });
  it("passes a complete file", () => {
    const checks = validateFontBytes(sfnt(COMPLETE));
    expect(checks.map(({ name, state }) => [name, state])).toEqual([
      ["File type", "passed"],
      ["Table directory", "passed"],
      ["Required tables", "passed"],
      ["Font header", "passed"],
      ["Table checksums", "passed"],
    ]);
    expect(validationVerdict(checks)).toBe("passed");
  });

  it("fails a file that is not a font", () => {
    const text = new TextEncoder().encode("not a font at all");
    expect(validateFontBytes(text.buffer as ArrayBuffer)).toEqual([
      { name: "File type", state: "failed", detail: "The file does not start as a font does." },
    ]);
  });

  it("names the tables that are missing", () => {
    const checks = validateFontBytes(sfnt(["head", "name"]));
    expect(checks.find(({ name }) => name === "Required tables")?.detail).toBe(
      "Missing: cmap, hhea, hmtx, maxp, post",
    );
    expect(validationVerdict(checks)).toBe("failed");
  });

  it("warns of a checksum that does not match, and fails a table past the file's end", () => {
    const spoiled = validateFontBytes(sfnt(COMPLETE, "name"));
    expect(spoiled.at(-1)).toEqual({
      name: "Table checksums",
      state: "warning",
      detail: "Do not match: name",
    });
    expect(validationVerdict(spoiled)).toBe("warning");
    expect(stateOf(sfnt(COMPLETE).slice(0, 150), "Table directory")).toBe("failed");
  });

  it("fails a wrong header", () => {
    const data = sfnt(COMPLETE);
    const headOffset = 12 + COMPLETE.length * 16 + 16;
    new DataView(data).setUint32(headOffset + 12, 1);
    expect(stateOf(data, "Font header")).toBe("failed");
  });

  it("reads a web font's header, and refuses one whose length is wrong", () => {
    const data = new DataView(new ArrayBuffer(44 + 7 * 20));
    for (const [at, char] of [..."wOFF"].entries()) data.setUint8(at, char.charCodeAt(0));
    data.setUint32(8, data.byteLength);
    data.setUint16(12, 7);
    COMPLETE.forEach((tag, index) => {
      for (let char = 0; char < 4; char += 1) {
        data.setUint8(44 + index * 20 + char, tag.charCodeAt(char));
      }
    });
    expect(validationVerdict(validateFontBytes(data.buffer))).toBe("passed");
    data.setUint32(8, 1);
    expect(validationVerdict(validateFontBytes(data.buffer))).toBe("failed");
  });
});

describe("duplicate font files", () => {
  it("finds one name in two formats, and a copy the drive numbered", () => {
    const groups = duplicateFontFiles([
      { id: "a", name: "Quince.ttf", size: 100 },
      { id: "b", name: "Quince 2.ttf", size: 100 },
      { id: "c", name: "Plum.otf", size: 7 },
      { id: "d", name: "Plum.woff", size: 9 },
    ]);
    expect(groups.map(({ keep, extra }) => [keep.id, extra.map(({ id }) => id)])).toEqual([
      ["a", ["b"]],
      ["c", ["d"]],
    ]);
  });

  it("leaves fonts that only look alike", () => {
    expect(
      duplicateFontFiles([
        { id: "a", name: "Quince.ttf", size: 100 },
        { id: "b", name: "Quince 2.ttf", size: 101 },
        { id: "c", name: "Helvetica 55.ttf", size: 100 },
      ]),
    ).toEqual([]);
  });
});
