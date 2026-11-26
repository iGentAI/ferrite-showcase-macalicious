import { describe, expect, it } from "vitest";
import { cmapFormat4, quinceTables, sfnt, woff, woff2 } from "./__tests__/font-book-fixtures";
import { repertoireOf } from "./font-book-data";
import { familyOfFile, isFontFile, readFontBytes } from "./font-book-tables";

describe("a font file's own tables", () => {
  it("reads the names, the fixed pitch flag and the characters of a TrueType file", async () => {
    expect(await readFontBytes(sfnt(quinceTables()))).toEqual({
      postScriptName: "Quince-Bold",
      fullName: "Quince Bold",
      familyName: "Quince",
      styleName: "Bold",
      version: "Version 2.5",
      copyright: "Copyright 2019 Quince Foundry",
      designer: "Ada Lovelace",
      fixedWidth: true,
      script: "Latin",
      ranges: [[0x20, 0x7e]],
    });
  });

  it("inflates a WOFF's tables to read the same", async () => {
    const read = await readFontBytes(woff(quinceTables(false)));
    expect(read?.postScriptName).toBe("Quince-Bold");
    expect(read?.fixedWidth).toBe(false);
    expect(read?.ranges).toEqual([[0x20, 0x7e]]);
  });

  it("says the writing system its characters are", async () => {
    const script = async (first: number, last: number) =>
      (await readFontBytes(sfnt(quinceTables(false, first, last))))?.script;
    expect(await script(0x3041, 0x3090)).toBe("Japanese");
    expect(await script(0x4e00, 0x4e20)).toBe("Simplified Chinese");
    expect(await script(0x627, 0x64a)).toBe("Arabic");
    expect(await script(0x2701, 0x2710)).toBe("Symbols");
  });

  it("reads nothing from a WOFF2, whose tables a page cannot decompress, or from no font", async () => {
    expect(await readFontBytes(woff2())).toBeNull();
    expect(await readFontBytes(new TextEncoder().encode("not a font at all").buffer)).toBeNull();
  });

  it("survives a table whose offsets lead outside it", async () => {
    const broken = cmapFormat4(0x20, 0x7e);
    new DataView(broken.buffer).setUint32(8, 9_000);
    expect((await readFontBytes(sfnt([["cmap", broken]])))?.ranges).toBeUndefined();
  });

  it("makes a family of the file: mono when fixed, with the file's own characters", async () => {
    const read = await readFontBytes(sfnt(quinceTables(true, 0x41, 0x43)));
    const family = familyOfFile("Quince", read);
    expect(family.kind).toBe("mono");
    expect(family.script).toBe("Latin");
    expect(repertoireOf(family)).toEqual(["A", "B", "C"]);
  });

  it("knows a font file by its name", () => {
    expect(["a.ttf", "a.OTF", "a.woff", "a.woff2", "a.txt"].map(isFontFile)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});
