import { afterEach, describe, expect, it, vi } from "vitest";
import {
  borrowedId,
  MUSIC_SHARING_URL,
  NotSharedError,
  ownerOfBorrowed,
  readSharedFile,
  readSharedLibrary,
  readSharedPeople,
  writeSharingOn,
} from "./music-sharing";

const reply = (status: number, body: BodyInit | object, headers?: Record<string, string>) =>
  new Response(
    typeof body === "string" || body instanceof Uint8Array
      ? (body as BodyInit)
      : JSON.stringify(body),
    { status, headers },
  );

function serve(answer: (url: string, init?: RequestInit) => Response) {
  const fetched = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
    answer(String(url), init),
  );
  vi.stubGlobal("fetch", fetched);
  return fetched;
}

const paths = (fetched: ReturnType<typeof serve>) =>
  fetched.mock.calls.map(([url]) => {
    const { pathname, search } = new URL(String(url), "http://desktop");
    return `${pathname}${search}`;
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Home Sharing's client", () => {
  it("names a borrowed song so that no library's id can be taken for it", () => {
    expect(borrowedId("chris", "kelp")).toBe("shared/chris/kelp");
    expect(ownerOfBorrowed("shared/chris/kelp")).toBe("chris");
    expect(ownerOfBorrowed("kelp")).toBeNull();
    expect(ownerOfBorrowed("shared/chris")).toBeNull();
    expect(ownerOfBorrowed("shared/chris/kelp/more")).toBeNull();
  });

  it("turns a lent library into songs the player can hold, naming no file", async () => {
    serve(() =>
      reply(200, {
        name: "chris",
        full_name: "Chris Marsh",
        songs: [
          {
            id: "kelp",
            title: "Kelp",
            artist: "Tide",
            album: "Shore",
            genre: "",
            year: null,
            track: 1,
            duration: 10,
            source: { kind: "file", type: "audio/wav", size: 44 },
          },
          {
            id: "reef",
            title: "Reef",
            artist: "Tide",
            album: "Shore",
            genre: "",
            year: null,
            track: 2,
            duration: 20,
            source: { kind: "archive", item: "reef", files: { mp3: "reef.mp3" }, license: "cc" },
          },
        ],
        playlists: [{ id: "open", name: "Open Mix", songs: ["kelp"] }],
      }),
    );
    const library = await readSharedLibrary("chris");
    expect(library.owner).toEqual({ name: "chris", full_name: "Chris Marsh" });
    expect(library.songs[0]?.source).toEqual({
      kind: "file",
      file: "shared/chris/kelp",
      name: "Kelp",
      type: "audio/wav",
      size: 44,
    });
    expect(library.songs[1]?.source).toEqual({
      kind: "archive",
      item: "reef",
      files: { mp3: "reef.mp3" },
      license: "cc",
    });
    expect(library.playlists[0]?.songs).toEqual(["shared/chris/kelp"]);
  });

  it("reads a song's pieces in order by the route that names the song", async () => {
    const fetched = serve((url) => {
      const piece = Number(new URL(url, "http://desktop").searchParams.get("piece"));
      return reply(200, new Uint8Array([piece]), { "x-file-pieces": "12" });
    });
    const blob = await readSharedFile("shared/chris/kelp");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 8]);
    expect(paths(fetched)).toEqual([
      "/api/music/sharing/libraries/chris/songs/kelp?piece=0&count=8",
      "/api/music/sharing/libraries/chris/songs/kelp?piece=8&count=8",
    ]);
  });

  it("says the sharing ended when the server refuses, even part way through a song", async () => {
    let reads = 0;
    serve(() => {
      reads += 1;
      return reads === 1
        ? reply(200, new Uint8Array([1]), { "x-file-pieces": "12" })
        : reply(403, { error: "That library is not shared." });
    });
    await expect(readSharedFile("shared/chris/kelp")).rejects.toBeInstanceOf(NotSharedError);
    serve(() => reply(403, { error: "That library is not shared." }));
    await expect(readSharedLibrary("chris")).rejects.toBeInstanceOf(NotSharedError);
    await expect(readSharedPeople()).rejects.toBeInstanceOf(NotSharedError);
  });

  it("refuses a file id that is not a borrowed song's without asking the server", async () => {
    const fetched = serve(() => reply(200, ""));
    await expect(readSharedFile("0123abcd")).rejects.toThrow("not a shared song");
    expect(fetched).not.toHaveBeenCalled();
  });

  it("turns sharing on with the switch the server holds", async () => {
    const fetched = serve((_url, init) => reply(200, JSON.parse(String(init?.body))));
    await expect(writeSharingOn(true)).resolves.toBe(true);
    await expect(writeSharingOn(false)).resolves.toBe(false);
    expect(paths(fetched)).toEqual([MUSIC_SHARING_URL, MUSIC_SHARING_URL]);
    expect(fetched.mock.calls[0]?.[1]?.method).toBe("PUT");
  });
});
