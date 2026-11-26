import { describe, expect, it } from "vitest";
import { DOWNLOADS_KEPT, readDownloads, withDownload } from "./safari-downloads";

const entry = (id: string, at = 1) => ({ id, name: `${id}.png`, url: `https://a.test/${id}`, at });

describe("Safari's list of downloads", () => {
  it("puts the newest first, and a file downloaded again is one row", () => {
    const list = withDownload(withDownload([], entry("a")), entry("b"));
    expect(list.map((one) => one.id)).toEqual(["b", "a"]);
    expect(withDownload(list, entry("a", 2)).map((one) => [one.id, one.at])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("keeps the most recent ones", () => {
    let list = withDownload([], entry("first"));
    for (let n = 0; n < DOWNLOADS_KEPT; n += 1) list = withDownload(list, entry(`f${n}`));
    expect(list).toHaveLength(DOWNLOADS_KEPT);
    expect(list.some((one) => one.id === "first")).toBe(false);
  });

  it("reads back only whole rows", () => {
    expect(readDownloads("no")).toBeUndefined();
    expect(readDownloads([entry("a"), null, { id: "b" }])).toEqual([entry("a")]);
  });
});
