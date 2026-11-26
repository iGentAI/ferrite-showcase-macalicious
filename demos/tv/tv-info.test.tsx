import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TV_PREFERENCES_URL } from "./tv-settings";
import { TvYouTube } from "./tv-youtube";
import {
  emptyLibrary,
  genreNames,
  know,
  LIMITS,
  noRoomForGenre,
  removeHomeVideo,
  tvLibraryFromServer,
  tvLibraryToServer,
  withGenre,
} from "./tv-youtube-data";
import { TV_LIBRARY_URL } from "./tv-youtube-server";

const SINTEL = { id: "eRsGyueVLvQ", title: "Sintel", channel: "Blender" };
const CLIP = { id: "eRsGyueVLvZ", title: "My Clip", channel: "Me" };

describe("a video's genre", () => {
  it("goes to the server and back, and is left out while there is none", () => {
    const kept = withGenre(know(emptyLibrary, SINTEL), SINTEL.id, "  Fantasy ");
    const body = tvLibraryToServer(kept);
    expect(body.library.genres).toEqual({ [SINTEL.id]: "Fantasy" });
    expect(tvLibraryFromServer(body)?.genres).toEqual({ [SINTEL.id]: "Fantasy" });
    expect(tvLibraryToServer(emptyLibrary).library).not.toHaveProperty("genres");
    expect(
      tvLibraryFromServer({ library: tvLibraryToServer(emptyLibrary).library })?.genres,
    ).toEqual({});
  });

  it("is cleared by an empty field, and keeps one spelling whatever the case", () => {
    const one = withGenre(know(know(emptyLibrary, SINTEL), CLIP), SINTEL.id, "Fantasy");
    const two = withGenre(one, CLIP.id, "FANTASY");
    expect(two.genres[CLIP.id]).toBe("Fantasy");
    expect(genreNames(two, () => true)).toEqual(["Fantasy"]);
    expect(withGenre(two, CLIP.id, " ").genres).toEqual({ [SINTEL.id]: "Fantasy" });
  });

  it("lists names in order, only of what is shown", () => {
    const library = {
      ...emptyLibrary,
      genres: { a: "western", b: "Comedy", c: "Horror" },
    };
    expect(genreNames(library, (id) => id !== "c")).toEqual(["Comedy", "western"]);
  });

  it("leaves with the home video it was set on", () => {
    const home = { ...emptyLibrary, homeVideos: [{ id: "file", place: 0 }] };
    expect(removeHomeVideo(withGenre(home, "file", "Family"), "file").genres).toEqual({});
  });

  it("is refused at the limit, while a video that has one can change it", () => {
    const genres = Object.fromEntries(
      Array.from({ length: LIMITS.genres }, (_, at) => [`file${at}`, "Drama"]),
    );
    const full = { ...emptyLibrary, genres };
    expect(noRoomForGenre(full, "another", "Drama")).toContain(`${LIMITS.genres} videos`);
    expect(noRoomForGenre(full, "file0", "Comedy")).toBeUndefined();
    expect(noRoomForGenre(full, "another", "")).toBeUndefined();
  });
});

describe("the Library's Genres", () => {
  /** `fetch` answers as the desktop's TV module does, and records what is saved. */
  function serve(library: unknown) {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const saved: { library: { genres?: Record<string, string> } }[] = [];
    const documents: Record<string, unknown> = {
      [TV_LIBRARY_URL]: { library, rev: 1 },
      [TV_PREFERENCES_URL]: { preferences: null, rev: 1 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PUT" && url.startsWith(TV_LIBRARY_URL)) {
          saved.push(JSON.parse(String(init.body)));
          return { ok: true, status: 200, json: async () => ({ ...saved.at(-1), rev: 2 }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => documents[url.split("?")[0] ?? url] ?? {},
        };
      }),
    );
    return saved;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const stored = (genres?: Record<string, string>) => ({
    videos: [SINTEL, CLIP],
    history: [],
    upNext: [],
    watchLater: [],
    positions: {},
    ...(genres ? { genres } : {}),
  });

  it("has no list until a video has a genre", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve(stored());
    render(<TvYouTube />);
    await user.click(await screen.findByRole("button", { name: "Library" }));
    await screen.findByText("Recently Added");
    expect(screen.queryByText("Genres")).toBeNull();
  });

  it("shows only the chosen genre's videos, and All Videos brings the rest back", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve(stored({ [SINTEL.id]: "Fantasy" }));
    render(<TvYouTube />);
    await user.click(await screen.findByRole("button", { name: "Library" }));
    expect(await screen.findByText("Genres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My Clip/ })).toBeInTheDocument();
    await user.click(screen.getByRole("treeitem", { name: "Fantasy" }));
    expect(await screen.findByRole("button", { name: /Sintel/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /My Clip/ })).toBeNull();
    await user.click(screen.getByRole("treeitem", { name: "All Videos" }));
    expect(await screen.findByRole("button", { name: /My Clip/ })).toBeInTheDocument();
  });

  it("saves the Genre typed in Get Info, and lists it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const saved = serve(stored());
    render(<TvYouTube />);
    await user.click(await screen.findByRole("button", { name: "Library" }));
    const card = await screen.findByRole("button", { name: /My Clip/ });
    await user.pointer({ keys: "[MouseRight]", target: card });
    await user.click(await screen.findByRole("menuitem", { name: "Get Info" }));
    await user.type(await screen.findByLabelText("Genre:"), "Home Movies");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText("Home Movies")).toBeInTheDocument();
    await waitFor(() => expect(saved.at(-1)?.library.genres).toEqual({ [CLIP.id]: "Home Movies" }));
  });
});
