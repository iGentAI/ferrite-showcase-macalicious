import { describe, expect, it } from "vitest";
import type { Drive } from "../desktop/desktop-files";
import { EQ_OFF, EQ_PRESETS, equalizerForSong } from "./music-audio";
import { inMusicFolder, organizedPlace } from "./music-organize";
import type { LibrarySong } from "./music-server";
import { readTime } from "./music-song-info";
import { musicVideos } from "./music-videos";

const song: LibrarySong = {
  id: "s",
  title: "Harbour: Bell",
  artist: "Ada/Rowan",
  album: "",
  genre: "",
  year: null,
  track: 3,
  duration: 10,
  added: 1,
  artwork: null,
  source: { kind: "file", file: "f", name: "bell.mp3", type: "audio/mpeg", size: 1 },
};

const drive = {
  entries: [
    { id: "music", name: "Music", kind: "folder" },
    { id: "movies", name: "Movies", kind: "folder" },
    { id: "sub", parent: "music", name: "Clips", kind: "folder" },
    { id: "v2", parent: "sub", name: "b.webm", kind: "file" },
    { id: "v1", parent: "music", name: "a.mov", kind: "file", type: "video/quicktime" },
    { id: "a1", parent: "music", name: "c.mp3", kind: "file", type: "audio/mpeg" },
    { id: "out", parent: "movies", name: "film.mp4", kind: "file", type: "video/mp4" },
  ],
} as unknown as Drive;

describe("Organize Library", () => {
  it("places a song by artist, album, track and title, in names the drive can hold", () => {
    expect(organizedPlace(song)).toEqual({
      artist: "Ada-Rowan",
      album: "Unknown Album",
      name: "03 Harbour- Bell.mp3",
    });
  });
  it("knows what is already in the Music folder", () => {
    const entry = (id: string) => drive.entries.find((each) => each.id === id);
    expect(inMusicFolder(drive, entry("v2") as Drive["entries"][number])).toBe(true);
    expect(inMusicFolder(drive, entry("out") as Drive["entries"][number])).toBe(false);
  });
});

describe("Music Videos", () => {
  it("lists the video files under the Music folder only, by name", () => {
    expect(musicVideos(drive).map((entry) => entry.id)).toEqual(["v1", "v2"]);
  });
});

describe("a typed start or stop time", () => {
  it("reads minutes and seconds, or seconds, and refuses anything else", () => {
    expect(readTime("1:30")).toBe(90);
    expect(readTime("90")).toBe(90);
    expect(readTime(" ")).toBeNull();
    expect(readTime("1:75")).toBeUndefined();
    expect(readTime("soon")).toBeUndefined();
  });
});

describe("a song's own Equalizer preset", () => {
  it("turns the Equalizer on with that preset's gains, and only a preset that exists", () => {
    expect(equalizerForSong(EQ_OFF, "Rock")).toEqual({
      on: true,
      preset: "Rock",
      preamp: 0,
      gains: EQ_PRESETS.Rock,
    });
    expect(equalizerForSong(EQ_OFF, undefined)).toBe(EQ_OFF);
    expect(equalizerForSong(EQ_OFF, "No Such Preset")).toBe(EQ_OFF);
  });
});
