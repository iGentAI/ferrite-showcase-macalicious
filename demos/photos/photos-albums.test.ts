import { describe, expect, it } from "vitest";
import type { LibraryAlbum, LibraryPhoto } from "./photos-library";
import { photosOfSource, rangeIds, sortAlbumPhotos } from "./photos-served-data";

const photo = (id: string, name: string, taken: number): LibraryPhoto => ({
  id,
  file: `file-${id}`,
  name,
  mime: "image/jpeg",
  bytes: 1,
  width: 4,
  height: 3,
  taken_ms: taken,
  added_ms: 0,
  source: "import",
  effect: null,
  camera: null,
  favorite: false,
  deleted_ms: null,
  edit: null,
  edited_ms: null,
  title: null,
  caption: null,
  keywords: [],
  people: [],
  location: null,
  hidden: false,
  exif: null,
  duration_ms: null,
});

const beach = photo("b", "Beach 10", 300);
const lake = photo("l", "lake", 100);
const beach2 = photo("c", "Beach 9", 200);

describe("an album's order", () => {
  it("lists its photos as added, by date either way, or by title in natural order", () => {
    const added = [beach, lake, beach2];
    const ids = (photos: LibraryPhoto[]) => photos.map((each) => each.id);
    expect(ids(sortAlbumPhotos(added, "custom"))).toEqual(["b", "l", "c"]);
    expect(ids(sortAlbumPhotos(added, "oldest"))).toEqual(["l", "c", "b"]);
    expect(ids(sortAlbumPhotos(added, "newest"))).toEqual(["b", "c", "l"]);
    expect(ids(sortAlbumPhotos(added, "title"))).toEqual(["c", "b", "l"]);
    expect(ids(added), "the album's own order is left as it was").toEqual(["b", "l", "c"]);
  });

  it("is the order the album's row shows", () => {
    const album: LibraryAlbum = {
      id: "a",
      name: "Trip",
      photos: ["b", "l", "c"],
      created_ms: 0,
      sort: "oldest",
      key_photo: null,
      folder: null,
    };
    const shown = photosOfSource("album:a", [beach, lake, beach2], [album], 0);
    expect(shown.map((each) => each.id)).toEqual(["l", "c", "b"]);
  });
});

describe("a Shift-click range", () => {
  const order = ["p1", "p2", "p3", "p4", "p5"];
  it("runs from the anchor to the photo clicked, either way", () => {
    expect(rangeIds(order, "p2", "p4")).toEqual(["p2", "p3", "p4"]);
    expect(rangeIds(order, "p4", "p2")).toEqual(["p2", "p3", "p4"]);
    expect(rangeIds(order, "p3", "p3")).toEqual(["p3"]);
  });
  it("is the photo clicked alone without an anchor shown, and nothing for one not shown", () => {
    expect(rangeIds(order, null, "p2")).toEqual(["p2"]);
    expect(rangeIds(order, "gone", "p2")).toEqual(["p2"]);
    expect(rangeIds(order, "p1", "hidden")).toEqual([]);
  });
});
