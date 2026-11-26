import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDrive } from "../desktop/desktop-files";
import { requestOpenFile } from "../finder/finder-open";
import { asWebVtt, homeVideoApi, homeVideoErrorText, subtitleFilesFor } from "./tv-home-player";
import { TvYouTube } from "./tv-youtube";
import {
  addHomeVideo,
  admitHomeVideos,
  emptyLibrary,
  LIMITS,
  noNewHomeVideo,
  placeHomeVideo,
  removeHomeVideo,
  tvLibraryFromServer,
  tvLibraryToServer,
} from "./tv-youtube-data";
import {
  TvYouTubePlayer,
  type YouTubePlayer,
  type YouTubePlayerOptions,
} from "./tv-youtube-player";
import { TV_LIBRARY_URL } from "./tv-youtube-server";

const ids = (count: number) => Array.from({ length: count }, (_, at) => `file${at}`);
/** The page's copy of the drive only takes newer revisions: each read here is one. */
let driveRev = 0;
const fetchesOfDrive = () =>
  (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.filter(
    ([url]) => url === "/api/files/",
  ).length;

describe("home videos in the library", () => {
  it("adds a file once and keeps it through the server's shape", () => {
    const library = addHomeVideo(addHomeVideo(emptyLibrary, "file1"), "file1");
    expect(library.homeVideos).toEqual([{ id: "file1", place: 0 }]);
    const sent = tvLibraryToServer(library);
    expect(sent.library.homeVideos).toEqual([{ id: "file1", place: 0 }]);
    expect(tvLibraryFromServer(sent)?.homeVideos).toEqual([{ id: "file1", place: 0 }]);
  });

  it("reads a library saved before home videos, and sends none while there are none", () => {
    const { library } = tvLibraryToServer(emptyLibrary);
    expect("homeVideos" in library).toBe(false);
    expect(tvLibraryFromServer({ library })?.homeVideos).toEqual([]);
  });

  it("refuses one over the limit, saying why", () => {
    const full = {
      ...emptyLibrary,
      homeVideos: Array.from({ length: LIMITS.homeVideos }, (_, at) => ({
        id: `file${at}`,
        place: 0,
      })),
    };
    expect(noNewHomeVideo(full)).toBe("You have 200 home videos, the most this library keeps.");
    expect(addHomeVideo(full, "another")).toBe(full);
  });

  it("keeps the place to the step while playing, exactly when paused, and none near the end", () => {
    const library = addHomeVideo(emptyLibrary, "file1");
    const place = (seconds: number, duration: number, playing: boolean) =>
      placeHomeVideo(library, "file1", seconds, duration, playing).homeVideos[0]?.place;
    expect(place(47.5, 600, true)).toBe(40);
    expect(place(47.5, 600, false)).toBe(47);
    expect(place(590, 600, false)).toBe(0);
    expect(place(1, 5, false)).toBe(1);
    expect(place(4.8, 5, false)).toBe(0);
    expect(placeHomeVideo(library, "other", 47, 600, false)).toBe(library);
  });

  it("removes a video from the library alone", () => {
    const library = addHomeVideo(addHomeVideo(emptyLibrary, "file1"), "file2");
    expect(removeHomeVideo(library, "file1").homeVideos).toEqual([{ id: "file2", place: 0 }]);
  });

  it("admits two new files one at a time, refusing what no room is left for", () => {
    const nearlyFull = {
      ...emptyLibrary,
      homeVideos: ids(LIMITS.homeVideos - 1).map((id) => ({ id, place: 0 })),
    };
    const { library, refused } = admitHomeVideos(nearlyFull, ["new1", "new2", "file0"]);
    expect(refused).toEqual(["new2"]);
    expect(library.homeVideos).toHaveLength(LIMITS.homeVideos);
    expect(library.homeVideos.at(-1)?.id).toBe("new1");
  });
});

describe("TV's window and the drive", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** The desktop's TV module and drive: the documents kept, `drives` answered one read at a time. */
  function serve(homeVideos: readonly string[], drives: readonly (readonly string[])[]) {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const saved: { homeVideos?: { id: string }[] }[] = [];
    let library: unknown = {
      ...tvLibraryToServer(emptyLibrary).library,
      homeVideos: homeVideos.map((id) => ({ id, place: 0 })),
    };
    let rev = 1;
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = url.split("?")[0] ?? url;
        const answer = (body: unknown) => ({
          ok: true,
          status: 200,
          json: async () => body,
        });
        if (path === "/api/files/") {
          const files = drives[Math.min(reads, drives.length - 1)] ?? [];
          reads += 1;
          driveRev += 1;
          return answer({
            rev: driveRev,
            entries: files.map((id) => ({ id, name: `${id}.webm`, kind: "file", size: 1 })),
          });
        }
        if (path === TV_LIBRARY_URL) {
          if (init?.method === "PUT") {
            const sent = JSON.parse(String(init.body)) as { library: unknown };
            library = sent.library;
            saved.push(sent.library as { homeVideos?: { id: string }[] });
            rev += 1;
          }
          return answer({ library, rev });
        }
        return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
      }),
    );
    return saved;
  }

  it("names the Open With file it has no room for, stores the other, and plays neither", async () => {
    const held = ids(LIMITS.homeVideos - 1);
    const saved = serve(held, [[...held, "new1", "new2"]]);
    requestOpenFile({ app: "tv", id: "new1", name: "new1.webm" });
    requestOpenFile({ app: "tv", id: "new2", name: "new2.webm" });
    render(<TvYouTube />);
    const note = await screen.findByText(/not added/);
    expect(note.textContent).toBe(
      "“new2.webm” not added: You have 200 home videos, the most this library keeps.",
    );
    await waitFor(() => expect(saved.at(-1)?.homeVideos?.at(-1)?.id).toBe("new1"));
    expect(saved.at(-1)?.homeVideos).toHaveLength(LIMITS.homeVideos);
    expect(screen.queryByRole("region", { name: /^Playing / })).toBeNull();
  });

  it("gives back the place of a file a new read says is gone for good", async () => {
    const saved = serve(["gone", "here"], [["here"], ["here"]]);
    render(<TvYouTube />);
    await waitFor(() => expect(saved.at(-1)?.homeVideos).toEqual([{ id: "here", place: 0 }]));
  });

  it("keeps a file only the page's older copy of the drive lacks", async () => {
    const saved = serve(["later", "here"], [["here"], ["here", "later"]]);
    await loadDrive();
    render(<TvYouTube />);
    await waitFor(() => expect(fetchesOfDrive()).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(saved).toEqual([]);
  });
});

describe("YouTube's subtitles", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("turns off captions YouTube shows by itself, and lists what it offers last", async () => {
    const setOption = vi.fn();
    let tracklist: { languageCode: string; displayName: string }[] = [];
    const made: { events: YouTubePlayerOptions["events"]; target: YouTubePlayer }[] = [];
    vi.stubGlobal("YT", {
      Player: class {
        playVideo = () => {};
        pauseVideo = () => {};
        seekTo = () => {};
        getCurrentTime = () => 0;
        getDuration = () => 60;
        setVolume = () => {};
        mute = () => {};
        unMute = () => {};
        destroy = () => {};
        loadModule = () => {};
        getOption = () => tracklist;
        setOption = setOption;
        constructor(_mount: HTMLElement, options: YouTubePlayerOptions) {
          made.push({ events: options.events, target: this as unknown as YouTubePlayer });
          queueMicrotask(() =>
            options.events?.onReady?.({ target: this as unknown as YouTubePlayer }),
          );
        }
      },
    });
    const onControls = vi.fn();
    render(
      <TvYouTubePlayer
        video={{ id: "aaaaaaaaaaa", title: "Film", channel: "" }}
        onProgress={() => {}}
        onEnded={() => {}}
        onDetails={() => {}}
        onDone={() => {}}
        onControls={onControls}
      />,
    );
    await waitFor(() => expect(made).toHaveLength(1));
    const [player] = made;
    await waitFor(() => expect(onControls.mock.lastCall?.[0]?.usable).toBe(true));
    expect(setOption).not.toHaveBeenCalled();

    tracklist = [{ languageCode: "en", displayName: "English" }];
    act(() => player?.events?.onApiChange?.({ target: player.target }));
    await waitFor(() => expect(setOption).toHaveBeenCalledWith("captions", "track", {}));

    tracklist = [{ languageCode: "fr", displayName: "French" }];
    act(() => player?.events?.onApiChange?.({ target: player.target }));
    await waitFor(() =>
      expect(onControls.mock.lastCall?.[0]?.subtitles).toEqual([{ id: "fr", label: "French" }]),
    );
    expect(onControls.mock.lastCall?.[0]?.subtitle).toBe("");
    expect(setOption).toHaveBeenCalledTimes(1);
  });
});

describe("a home video's subtitles", () => {
  it("finds the files of its name beside it, one per language, WebVTT first", () => {
    const files = subtitleFilesFor(
      [
        { id: "1", name: "Beach.srt" },
        { id: "2", name: "Beach.vtt" },
        { id: "3", name: "beach.en.srt" },
        { id: "4", name: "Beach house.vtt" },
        { id: "5", name: "Beach.webm" },
        { id: "6", name: "Beach.1.vtt" },
      ],
      "Beach.webm",
    );
    expect(files).toEqual([
      { id: "2", label: "Subtitles" },
      { id: "3", label: "en" },
    ]);
  });

  it("rewrites SubRip's times and leaves WebVTT as it is", () => {
    expect(asWebVtt("1\r\n00:00:01,500 --> 00:00:02,000\r\nHello\r\n")).toBe(
      "WEBVTT\n\n1\n00:00:01.500 --> 00:00:02.000\nHello\n",
    );
    expect(asWebVtt("WEBVTT\n\n00:01.000 --> 00:02.000\nHi")).toBe(
      "WEBVTT\n\n00:01.000 --> 00:02.000\nHi",
    );
  });

  it("plays the video and offers what it could read, whatever the other files do", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    URL.createObjectURL = createObjectURL;
    const mount = document.createElement("div");
    const box = document.createElement("div");
    box.append(mount);
    const changed = vi.fn();
    const player = new (homeVideoApi(
      async () => new Blob(["movie"]),
      [
        { id: "good", label: "en" },
        { id: "bad", label: "fr" },
        { id: "stuck", label: "de" },
      ],
      (id) => {
        if (id === "stuck") return new Promise(() => {});
        if (id === "bad") return Promise.reject(new Error("gone"));
        return Promise.resolve("WEBVTT");
      },
    ).Player)(mount, { videoId: "file1", events: { onApiChange: changed } });
    await waitFor(() => expect(player.subtitleTracks?.()).toEqual([{ id: "en", label: "en" }]));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(box.querySelector("video")?.getAttribute("src")).toBe("blob:x");
  });
});

describe("the player of a home video", () => {
  const make = (read: (id: string) => Promise<Blob>) => {
    const box = document.createElement("div");
    const mount = document.createElement("div");
    box.append(mount);
    const errors: number[] = [];
    const states: number[] = [];
    const player = new (homeVideoApi(read).Player)(mount, {
      videoId: "file1",
      events: {
        onError: ({ data }) => errors.push(data),
        onStateChange: ({ data }) => states.push(data),
      },
    });
    return { box, errors, states, player };
  };

  it("puts a video in place of the mount and asks for the file named", async () => {
    const asked: string[] = [];
    const { box } = make(async (id) => {
      asked.push(id);
      throw new Error("no drive here");
    });
    expect(box.children[0]?.tagName).toBe("VIDEO");
    expect(asked).toEqual(["file1"]);
  });

  it("says the file could not be read when the drive fails", async () => {
    const { errors } = make(() => Promise.reject(new Error("gone")));
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toEqual([-1]);
    expect(homeVideoErrorText(-1)).toBe("The file could not be read from your drive.");
  });

  it("reports nothing once destroyed", async () => {
    const { errors, player, box } = make(() => Promise.reject(new Error("gone")));
    player.destroy();
    await Promise.resolve();
    await Promise.resolve();
    box.querySelector("video")?.dispatchEvent(new Event("error"));
    expect(errors).toEqual([]);
  });

  it("tells the player's states from the video's events", () => {
    const { box, states } = make(() => new Promise(() => {}));
    const video = box.querySelector("video") as HTMLVideoElement;
    for (const event of ["playing", "pause", "waiting", "ended"]) {
      video.dispatchEvent(new Event(event));
    }
    expect(states).toEqual([1, 2, 3, 0]);
  });

  it("says the browser cannot play a file it cannot decode", () => {
    const { box, errors } = make(() => new Promise(() => {}));
    box.querySelector("video")?.dispatchEvent(new Event("error"));
    expect(errors).toEqual([5]);
    expect(homeVideoErrorText(5)).toBe("This browser cannot play this file.");
  });
});
