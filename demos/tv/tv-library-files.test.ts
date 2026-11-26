import { describe, expect, it } from "vitest";
import {
  homeVideosMatching,
  isPlaylistFile,
  playlistFileName,
  playlistNameOfFile,
  readPlaylist,
  writeLibrary,
  writePlaylist,
} from "./tv-library-files";

describe("homeVideosMatching", () => {
  it("keeps a list chosen from to what a search shows", () => {
    const videos = [{ title: "Beach" }, { title: "Garden" }];
    expect(homeVideosMatching(videos, "GARD")).toEqual([{ title: "Garden" }]);
    expect(homeVideosMatching(videos, "")).toEqual(videos);
  });
});

const BUNNY = { id: "aqz-KE-bpKQ", title: "Big  Buck Bunny", channel: "Blender" };
const LLAMAS = { id: "SkVqJ1SGeL0", title: "Caminandes", channel: "" };

describe("a playlist's file", () => {
  it("writes each video's title and YouTube link", () => {
    expect(writePlaylist([BUNNY])).toBe(
      "#EXTM3U\n#EXTINF:-1,Big Buck Bunny\nhttps://www.youtube.com/watch?v=aqz-KE-bpKQ\n",
    );
  });

  it("reads back what it wrote", () => {
    expect(readPlaylist(writePlaylist([BUNNY, LLAMAS]))).toEqual({
      videos: [
        { id: BUNNY.id, title: "Big Buck Bunny", channel: "" },
        { id: LLAMAS.id, title: "Caminandes", channel: "" },
      ],
      others: 0,
    });
  });

  it("counts what is not YouTube's, takes a link without a title, and each video once", () => {
    const text = `#EXTM3U\n#EXTINF:12,Local song\n./song.mp3\nhttps://youtu.be/${LLAMAS.id}\nhttps://youtu.be/${LLAMAS.id}\n`;
    expect(readPlaylist(text)).toEqual({
      videos: [{ id: LLAMAS.id, title: "YouTube video", channel: "" }],
      others: 1,
    });
  });

  it("names its file from the playlist and the playlist from its file", () => {
    expect(playlistFileName("Road/Trip")).toBe("Road-Trip.m3u");
    expect(playlistFileName("  ")).toBe("Untitled.m3u");
    expect(playlistNameOfFile("Road Trip.m3u8")).toBe("Road Trip");
    expect(isPlaylistFile("a.M3U8")).toBe(true);
    expect(isPlaylistFile("a.mp3")).toBe(false);
  });
});

describe("the library's file", () => {
  it("lists every list by title and link, escaped", () => {
    const xml = writeLibrary({
      homeVideos: ["Beach & sea"],
      watchLater: [LLAMAS],
      upNext: [],
      history: [BUNNY],
      playlists: [{ name: "<Mine>", videos: [LLAMAS] }],
    });
    expect(xml).toContain("<key>Home Videos</key><array><string>Beach &amp; sea</string></array>");
    expect(xml).toContain(
      `<key>Watch Later</key><array><dict><key>Name</key><string>Caminandes</string><key>Location</key><string>https://www.youtube.com/watch?v=${LLAMAS.id}</string></dict></array>`,
    );
    expect(xml).toContain("<key>Up Next</key><array></array>");
    expect(xml).toContain("<key>Name</key><string>&lt;Mine&gt;</string>");
    expect(new DOMParser().parseFromString(xml, "text/xml").querySelector("parsererror")).toBe(
      null,
    );
  });
});
