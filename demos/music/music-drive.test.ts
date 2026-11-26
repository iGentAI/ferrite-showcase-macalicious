import { afterEach, describe, expect, it, vi } from "vitest";
import {
  artworkReport,
  probeDuration,
  sharedAlbumArtwork,
  songsWantingArtwork,
} from "./music-drive";
import type { LibrarySong } from "./music-server";

describe("Get Album Artwork", () => {
  const song = (id: string, artwork: string | null, kind: "file" | "url") =>
    ({
      id,
      artwork,
      source:
        kind === "file"
          ? { kind, file: id, name: id, type: "audio/mpeg", size: 1 }
          : { kind, url: "https://example.com/a" },
    }) as unknown as LibrarySong;

  it("reads only the songs of the drive with no picture", () => {
    const songs = [
      song("bare", null, "file"),
      song("has", "digest", "file"),
      song("far", null, "url"),
    ];
    expect(songsWantingArtwork(songs).map(({ id }) => id)).toEqual(["bare"]);
  });

  it("gives a song with no picture the first picture of its own album and artist", () => {
    const track = (id: string, artist: string, album: string, artwork: string | null) =>
      ({ id, artist, album, artwork }) as unknown as LibrarySong;
    const shared = sharedAlbumArtwork([
      track("bare-before", "Ada", "Blue", null),
      track("first", "Ada", "Blue", "sleeve"),
      track("second", "Ada", "Blue", "another"),
      track("bare-after", "Ada", "Blue", null),
      track("other-artist", "Ben", "Blue", null),
      track("other-album", "Ada", "Red", null),
      track("no-album", "Ada", "", null),
      track("no-album-picture", "Ada", "", "loose"),
    ]);
    expect([...shared]).toEqual([
      ["bare-before", "sleeve"],
      ["bare-after", "sleeve"],
    ]);
  });

  it("says what it found, and that nothing looks artwork up online when it found nothing", () => {
    expect(artworkReport(1, 2, 0)).toBe("Artwork from their own files was added to 1 of 2 songs.");
    expect(artworkReport(0, 1, 0)).toBe(
      "No picture was found in the files of 1 song. Nothing here looks artwork up online; Song Info's Artwork pane takes a picture.",
    );
    expect(artworkReport(1, 3, 1)).toBe(
      "Artwork from their own files was added to 1 of 3 songs. 1 could not be read or kept; choose Get Album Artwork again to try them.",
    );
  });
});

/** An audio element as browsers have it: `load()` with no source forgets the length. */
class FakeAudio extends EventTarget {
  duration = Number.NaN;
  preload = "";
  #src = "";
  canPlayType() {
    return "maybe";
  }
  get src() {
    return this.#src;
  }
  set src(url: string) {
    this.#src = url;
    queueMicrotask(() => {
      this.duration = 10.5;
      this.dispatchEvent(new Event("loadedmetadata"));
    });
  }
  removeAttribute() {
    this.#src = "";
  }
  load() {
    this.duration = Number.NaN;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** An audio element given a file it cannot decode: it fails as browsers do, with code 4. */
class BrokenAudio extends EventTarget {
  duration = Number.NaN;
  preload = "";
  error: { code: number } | null = null;
  #src = "";
  canPlayType() {
    return "maybe";
  }
  get src() {
    return this.#src;
  }
  set src(url: string) {
    this.#src = url;
    queueMicrotask(() => {
      this.error = { code: 4 };
      this.dispatchEvent(new Event("error"));
    });
  }
  removeAttribute() {
    this.#src = "";
  }
  load() {}
}

/** An audio element that never says anything about the file it was given. */
class SilentAudio extends EventTarget {
  duration = Number.NaN;
  preload = "";
  error = null;
  src = "";
  canPlayType() {
    return "maybe";
  }
  removeAttribute() {
    this.src = "";
  }
  load() {}
}

describe("probeDuration", () => {
  it("reads the length before letting the file go", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:song", revokeObjectURL: () => {} });
    const seconds = await probeDuration(new Blob(["x"], { type: "audio/wav" }), "audio/wav");
    expect(seconds).toBe(10.5);
  });

  it.each([0, Number.POSITIVE_INFINITY, Number.NaN])(
    "refuses a file the browser gives a length of %s",
    async (length) => {
      class NoLengthAudio extends FakeAudio {
        override load() {}
        override set src(_url: string) {
          queueMicrotask(() => {
            this.duration = length;
            this.dispatchEvent(new Event("loadedmetadata"));
          });
        }
      }
      vi.stubGlobal("Audio", NoLengthAudio);
      vi.stubGlobal("URL", { createObjectURL: () => "blob:song", revokeObjectURL: () => {} });
      await expect(
        probeDuration(new Blob(["x"], { type: "audio/wav" }), "audio/wav"),
      ).rejects.toThrow(/could not find its length/);
    },
  );

  it("refuses a file the browser cannot decode, saying so", async () => {
    vi.stubGlobal("Audio", BrokenAudio);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:song", revokeObjectURL: () => {} });
    await expect(
      probeDuration(new Blob(["x"], { type: "audio/wav" }), "audio/wav"),
    ).rejects.toThrow(/could not decode it: the file is damaged/);
  });

  it("refuses a file whose length the browser never finds, rather than list it with none", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Audio", SilentAudio);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:song", revokeObjectURL: () => {} });
    const probe = probeDuration(new Blob(["x"], { type: "audio/wav" }), "audio/wav", 50);
    const outcome = expect(probe).rejects.toThrow(/could not find its length/);
    await vi.advanceTimersByTimeAsync(50);
    await outcome;
  });
});
