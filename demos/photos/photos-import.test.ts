import { describe, expect, it, vi } from "vitest";
import { uploadToDrive } from "./photos-drive";
import {
  albumsFromServer,
  checkPicture,
  importPicture,
  LibraryError,
  MAX_ORIGINAL_BYTES,
  sniffPicture,
} from "./photos-library";
import { importNotice } from "./photos-served-data";

vi.mock("./photos-drive", () => ({
  deleteDriveFile: vi.fn(),
  picturesFolder: vi.fn(),
  readDriveFile: vi.fn(),
  uploadToDrive: vi.fn(),
}));

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** The first bytes of each kind of file, as a real one starts. */
const HEADS = {
  jpeg: bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii("JFIF")),
  png: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13),
  gif: bytes(...ascii("GIF89a"), 1, 0),
  webp: bytes(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBPVP8 ")),
  heic: bytes(0, 0, 0, 0x18, ...ascii("ftypheic"), 0, 0, 0, 0, ...ascii("mif1heic")),
  avif: bytes(0, 0, 0, 0x1c, ...ascii("ftypavif"), 0, 0, 0, 0),
  text: bytes(...ascii("Dear diary, today I took no pictures.")),
  mp4: bytes(0, 0, 0, 0x18, ...ascii("ftypisom"), 0, 0, 2, 0),
  mov: bytes(0, 0, 0, 0x14, ...ascii("ftypqt  "), 0, 0, 2, 0),
  oldMov: bytes(0, 0, 0, 0x6c, ...ascii("moov"), 0, 0, 0, 0),
  webm: bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81),
  audio: bytes(0, 0, 0, 0x18, ...ascii("ftypM4A "), 0, 0, 2, 0),
};

describe("what Photos imports, by its bytes", () => {
  it("knows each picture type the library keeps, and HEIC and AVIF, whatever the name", () => {
    expect(sniffPicture(HEADS.jpeg)).toBe("image/jpeg");
    expect(sniffPicture(HEADS.png)).toBe("image/png");
    expect(sniffPicture(HEADS.gif)).toBe("image/gif");
    expect(sniffPicture(HEADS.webp)).toBe("image/webp");
    expect(sniffPicture(HEADS.heic)).toBe("heic");
    expect(sniffPicture(HEADS.avif)).toBe("avif");
    expect(sniffPicture(HEADS.text)).toBeNull();
    expect(sniffPicture(bytes())).toBeNull();
    expect(sniffPicture(bytes(0xff, 0xd8))).toBeNull();
  });

  it("knows the movie types the library keeps, and not an audio file in the same container", async () => {
    expect(sniffPicture(HEADS.mp4)).toBe("video/mp4");
    expect(sniffPicture(HEADS.mov)).toBe("video/quicktime");
    expect(sniffPicture(HEADS.oldMov)).toBe("video/quicktime");
    expect(sniffPicture(HEADS.webm)).toBe("video/webm");
    expect(sniffPicture(HEADS.audio)).toBeNull();
    const named = new File([HEADS.mp4], "holiday.txt", { type: "text/plain" });
    expect(await checkPicture(named, named.name)).toEqual({ mime: "video/mp4" });
  });

  it("takes a JPEG named .txt and refuses a text file named .jpg", async () => {
    const jpeg = new File([HEADS.jpeg], "IMG_0001.txt", { type: "text/plain" });
    expect(await checkPicture(jpeg, jpeg.name)).toEqual({ mime: "image/jpeg" });
    const text = new File([HEADS.text], "notes.jpg", { type: "image/jpeg" });
    const refused = await checkPicture(text, text.name);
    expect(refused).toEqual({
      refused:
        "“notes.jpg” is not a picture or movie Photos can import (JPEG, PNG, GIF, WebP, MP4, MOV or WebM)",
    });
  });

  it("refuses HEIC and AVIF by name, saying what to do", async () => {
    const heic = await checkPicture(new Blob([HEADS.heic]), "IMG_4512.HEIC");
    expect("refused" in heic && heic.refused).toMatch(
      /^“IMG_4512\.HEIC” is a HEIC \(HEIF\) picture, .*export it as JPEG/,
    );
    const avif = await checkPicture(new Blob([HEADS.avif]), "a.avif");
    expect("refused" in avif && avif.refused).toMatch(/is an AVIF picture/);
  });

  it("refuses an empty file, and one larger than the library keeps before reading it", async () => {
    expect(await checkPicture(new Blob([]), "empty.png")).toEqual({
      refused: "“empty.png” is empty",
    });
    // Its bytes are never read: a picture's header past the limit is still refused for its size.
    const big = new Blob([HEADS.jpeg, new Uint8Array(70_000_000)]);
    const refused = await checkPicture(big, "huge.jpg");
    expect("refused" in refused && refused.refused).toBe(
      "“huge.jpg” is 70.0 MB, larger than the 67.1 MB Photos keeps for one picture",
    );
    expect(MAX_ORIGINAL_BYTES).toBe(64 * 1024 * 1024);
  });

  it("refuses in importPicture too, before anything is decoded or uploaded", async () => {
    const attempt = importPicture(new Blob([HEADS.text], { type: "image/jpeg" }), {
      name: "notes.jpg",
    });
    await expect(attempt).rejects.toBeInstanceOf(LibraryError);
    await expect(attempt).rejects.toMatchObject({ status: 415 });
  });

  it.each([
    {
      why: "decodes to sound alone",
      duration: 3,
      size: 0,
      message: "“Movie.mp4” has sound but no picture",
      status: 415,
    },
    {
      why: "lasts no time",
      duration: 0,
      size: 640,
      message:
        "“Movie.mp4” could not be played: this browser does not decode it, or the file is damaged",
      status: 422,
    },
    {
      why: "lasts under a millisecond",
      duration: 0.0001,
      size: 640,
      message:
        "“Movie.mp4” could not be played: this browser does not decode it, or the file is damaged",
      status: 422,
    },
    {
      why: "never names its length",
      duration: Number.POSITIVE_INFINITY,
      size: 640,
      message:
        "“Movie.mp4” could not be played: this browser does not decode it, or the file is damaged",
      status: 422,
    },
  ])(
    "refuses an MP4 that $why by name, and uploads nothing",
    async ({ duration, size, message, status }) => {
      vi.stubGlobal(
        "URL",
        Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL() {} }),
      );
      const make = document.createElement.bind(document);
      const element = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const made = make(tag);
        if (tag !== "video") return made;
        Object.defineProperties(made, {
          duration: { value: duration },
          videoWidth: { value: size },
          videoHeight: { value: size },
          src: {
            set() {
              queueMicrotask(() => made.dispatchEvent(new Event("loadeddata")));
            },
          },
          currentTime: {
            set() {
              queueMicrotask(() => made.dispatchEvent(new Event("seeked")));
            },
          },
        });
        return made;
      });
      try {
        const attempt = importPicture(new Blob([HEADS.mp4], { type: "video/mp4" }), {
          name: "Movie.mp4",
        });
        await expect(attempt).rejects.toMatchObject({ message, status });
        expect(uploadToDrive).not.toHaveBeenCalled();
      } finally {
        element.mockRestore();
        vi.unstubAllGlobals();
      }
    },
  );

  it("says how many files were not imported and why, naming each", () => {
    expect(importNotice(3, [])).toBeNull();
    expect(importNotice(1, ["“a.txt” is not a picture"])).toBe(
      "1 of 1 file was not imported: “a.txt” is not a picture.",
    );
    const many = ["a", "b", "c", "d", "e", "f"];
    expect(importNotice(8, many)).toBe("6 of 8 files were not imported: a; b; c; d; and 2 more.");
  });
});

describe("albums as the module answers them", () => {
  it("read their order, and an album kept before sorting existed as the order added", () => {
    const albums = albumsFromServer({
      albums: [
        { id: "a", name: "A", photos: ["p"], created_ms: 1, sort: "title" },
        { id: "b", name: "B", photos: [], created_ms: 2 },
        { id: "c", name: "C", photos: [], created_ms: 3, sort: "sideways" },
      ],
    });
    expect(albums?.map((album) => album.sort)).toEqual(["title", "custom", "custom"]);
  });
});
