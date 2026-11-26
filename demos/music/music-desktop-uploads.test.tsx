import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddedSong } from "./music-drive";

/**
 * Songs added from the computer while the Music window closes. `fetch` stands in for the
 * desktop's Ferrite application, and `addSongFile` (reading tags and uploading to the drive) and
 * `forgetSongFile` (deleting a drive file) are replaced by doubles the test drives: this checks
 * what the window commits and cleans up, not the drive.
 */

const pending: { resolve: (added: AddedSong) => void; signal?: AbortSignal }[] = [];
const forgotten: string[] = [];

vi.mock("./music-drive", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./music-drive")>();
  return {
    ...actual,
    addSongFile: (
      _file: File,
      _id: string,
      _progress: (sent: number, total: number) => void,
      signal?: AbortSignal,
    ) => new Promise<AddedSong>((resolve) => pending.push({ resolve, signal })),
    forgetSongFile: (id: string) => forgotten.push(id),
  };
});

const added = (n: number): AddedSong => ({
  song: {
    id: `up-${n}`,
    title: `Song ${n}`,
    artist: "",
    album: "",
    genre: "",
    year: null,
    track: null,
    duration: 10,
    added: 1,
    source: { kind: "file", file: `f-${n}`, name: `${n}.mp3`, type: "audio/mpeg", size: 100 },
  },
  cover: null,
});

function serve(initial: unknown = null) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  let library = initial;
  let rev = initial ? 1 : 0;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (url.startsWith("/api/music/library")) {
      if (init?.method === "PUT") {
        library = JSON.parse(String(init.body)).library;
        rev += 1;
        return reply({ library, rev });
      }
      return reply({ library, rev, session: "s1" });
    }
    if (url.startsWith("/api/music/playback")) {
      return reply({ playback: null, rev: 0, session: "s1" });
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  pending.length = 0;
  forgotten.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Music's songs being added when the window closes", () => {
  it("stops adding with the window, and takes a finished upload out of the drive again", async () => {
    const fetch = serve();
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    const { unmount } = render(<DesktopMusic />);
    const window = screen.getByRole("region", { name: "Music" });
    await waitFor(() => expect(window).not.toHaveAttribute("aria-busy"));
    const files = [1, 2].map((n) => new File(["x"], `${n}.mp3`, { type: "audio/mpeg" }));
    fireEvent.drop(window, { dataTransfer: { files, types: ["Files"] } });
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(screen.getByText(/Closing Music stops adding/)).toBeInTheDocument();

    unmount();
    expect(pending[0]?.signal?.aborted).toBe(true);
    // The first upload finishes after the window closed: it is not added, and its file goes.
    pending[0]?.resolve(added(1));
    await waitFor(() => expect(forgotten).toEqual(["f-1"]));
    // The second file is never started, and no library save names either song.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(pending).toHaveLength(1);
    const puts = fetch.mock.calls.filter(
      ([url, init]) => url.startsWith("/api/music/library") && init?.method === "PUT",
    );
    expect(puts).toEqual([]);
  });

  it("stops a batch when the library is full, and takes the refused upload out of the drive", async () => {
    // A library already holding the 500 songs Music keeps.
    const full = {
      songs: Array.from({ length: 500 }, (_, n) => ({ ...added(1000 + n).song, artwork: null })),
      playlists: [],
      loved: [],
    };
    const fetch = serve(full);
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    render(<DesktopMusic />);
    const window = screen.getByRole("region", { name: "Music" });
    await waitFor(() => expect(window).not.toHaveAttribute("aria-busy"));
    const files = [1, 2].map((n) => new File(["x"], `${n}.mp3`, { type: "audio/mpeg" }));
    fireEvent.drop(window, { dataTransfer: { files, types: ["Files"] } });
    await waitFor(() => expect(pending).toHaveLength(1));
    pending[0]?.resolve(added(1));
    await waitFor(() => expect(forgotten).toEqual(["f-1"]));
    expect(await screen.findByText(/Music keeps at most 500 songs/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The second file is never uploaded, and nothing was saved.
    expect(pending).toHaveLength(1);
    expect(
      fetch.mock.calls.filter(
        ([url, init]) => url.startsWith("/api/music/library") && init?.method === "PUT",
      ),
    ).toEqual([]);
  });

  it("adds each finished song to the library while the window stays open", async () => {
    const fetch = serve();
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    const { unmount } = render(<DesktopMusic />);
    const window = screen.getByRole("region", { name: "Music" });
    await waitFor(() => expect(window).not.toHaveAttribute("aria-busy"));
    const files = [new File(["x"], "1.mp3", { type: "audio/mpeg" })];
    fireEvent.drop(window, { dataTransfer: { files, types: ["Files"] } });
    await waitFor(() => expect(pending).toHaveLength(1));
    pending[0]?.resolve(added(1));
    await waitFor(() => {
      const put = fetch.mock.calls
        .filter(([url, init]) => url.startsWith("/api/music/library") && init?.method === "PUT")
        .at(-1);
      expect(put).toBeDefined();
    });
    expect(forgotten).toEqual([]);

    // Music opened again reads the song back from what the server stored.
    unmount();
    vi.resetModules();
    const { DesktopMusic: Again } = await import("./music-desktop");
    render(<Again />);
    const reopened = screen.getByRole("region", { name: "Music" });
    await waitFor(() => expect(reopened).not.toHaveAttribute("aria-busy"));
    await userEvent.click(
      within(within(reopened).getByRole("tree", { name: "Music" })).getByRole("treeitem", {
        name: "Songs",
      }),
    );
    expect(within(reopened).getByRole("grid", { name: "Songs" })).toHaveTextContent("Song 1");
  });
});
