import { describe, expect, it } from "vitest";
import type { LibraryPhoto } from "./photos-library";
import { hashOfPixels, nearlyAlike, withoutNearDuplicates } from "./photos-near-duplicates";
import { groupPhotos, memoriesOf } from "./photos-served-data";

/** 9 by 8 RGBA pixels, each grey from `level(column, row)`. */
const pixels = (level: (column: number, row: number) => number) => {
  const out: number[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const grey = level(column, row);
      out.push(grey, grey, grey, 255);
    }
  }
  return out;
};

const bars = (column: number) => (column % 2 === 0 ? 40 : 200);
const rising = (column: number) => column * 20;
const steps = (column: number, row: number) => ((column + row) % 3 === 0 ? 220 : 30);

const AT = new Date(2024, 5, 1, 12).getTime();
const photo = (id: string, phash: string | null, more: Partial<LibraryPhoto> = {}) =>
  ({
    id,
    phash,
    taken_ms: AT,
    deleted_ms: null,
    hidden: false,
    favorite: false,
    location: null,
    people: [],
    duration_ms: null,
    ...more,
  }) as LibraryPhoto;

const ids = (list: readonly LibraryPhoto[]) => list.map((each) => each.id);

describe("hashOfPixels", () => {
  it("writes 64 bits and the mean colour as hex", () => {
    expect(hashOfPixels(pixels(rising))).toBe("ffffffffffffffff505050");
    expect(hashOfPixels(pixels(bars))).toBe("aaaaaaaaaaaaaaaa6f6f6f");
    expect(hashOfPixels(pixels(() => 128))).toBe("0000000000000000808080");
  });
});

describe("nearlyAlike", () => {
  const one = hashOfPixels(pixels(bars));

  it("takes the same picture a little brighter, and not a different one", () => {
    const brighter = hashOfPixels(pixels((column) => bars(column) + 10));
    expect(nearlyAlike(one, brighter)).toBe(true);
    expect(nearlyAlike(one, hashOfPixels(pixels(steps)))).toBe(false);
  });

  it("counts the bits apart: six may differ, seven may not", () => {
    const base = "0000000000000001505050";
    expect(nearlyAlike(base, "00000000000000ff505050")).toBe(false);
    expect(nearlyAlike(base, "000000000000007f505050")).toBe(true);
    expect(nearlyAlike("ff00000000000001505050", "0000000000000001505050")).toBe(false);
    expect(nearlyAlike("f000000000000001505050", "0000000000000001505050")).toBe(true);
    expect(nearlyAlike(base, "000000000000007f686868")).toBe(true);
    expect(nearlyAlike(base, "000000000000007f695050")).toBe(false);
  });

  it("tells apart the same pattern in other colours, and pictures with no detail", () => {
    const darker = hashOfPixels(pixels((column) => bars(column) - 40));
    expect(nearlyAlike(one, darker)).toBe(false);
    const flat = hashOfPixels(pixels(() => 90));
    expect(nearlyAlike(flat, flat)).toBe(false);
  });
});

describe("withoutNearDuplicates", () => {
  const a = hashOfPixels(pixels(bars));
  const b = hashOfPixels(pixels(steps));

  it("leaves out what resembles a photo kept before it", () => {
    expect(
      ids(withoutNearDuplicates([photo("1", a), photo("2", b), photo("3", a), photo("4", b)])),
    ).toEqual(["1", "2"]);
  });

  it("keeps favourites, movies and photos not yet hashed", () => {
    expect(ids(withoutNearDuplicates([photo("1", a), photo("2", a, { favorite: true })]))).toEqual([
      "2",
    ]);
    expect(
      ids(
        withoutNearDuplicates([
          photo("1", a),
          photo("2", a, { duration_ms: 1000 }),
          photo("3", null),
        ]),
      ),
    ).toEqual(["1", "2", "3"]);
  });
});

describe("Days and Memories", () => {
  const a = hashOfPixels(pixels(bars));
  const b = hashOfPixels(pixels(steps));
  const c = hashOfPixels(pixels(rising));

  it("a memory of a burst holds one of it, and counts what it holds", () => {
    const [memory] = memoriesOf([photo("1", a), photo("2", a), photo("3", b), photo("4", c)]);
    expect(ids(memory?.photos ?? [])).toEqual(["1", "3", "4"]);
    expect(memory?.detail).toBe("June 2024, 3 Photos");
    expect(memory?.id).toBe("run-1");
  });

  it("a burst alone makes no memory", () => {
    expect(memoriesOf([photo("1", a), photo("2", a), photo("3", a)])).toEqual([]);
  });

  it("a day keeps its whole count in its group, for Days to curate", () => {
    const [day] = groupPhotos([photo("1", a), photo("2", a)], "day");
    expect(day?.detail).toBe("2 Photos");
    expect(ids(day?.photos ?? [])).toEqual(["1", "2"]);
  });
});
