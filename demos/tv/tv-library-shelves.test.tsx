import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TV_PREFERENCES_URL } from "./tv-settings";
import { TvYouTube } from "./tv-youtube";
import { nextEpisodeId } from "./tv-youtube-data";
import { TV_LIBRARY_URL } from "./tv-youtube-server";

/** `fetch` answers as the desktop's TV module does, with the library given; no server is reached. */
function serve(videos: readonly { id: string; title: string; channel: string }[]) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const documents: Record<string, unknown> = {
    [TV_LIBRARY_URL]: {
      library: { videos, history: [], upNext: [], watchLater: [], positions: {} },
      rev: 1,
    },
    [TV_PREFERENCES_URL]: { preferences: null, rev: 1 },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => documents[url.split("?")[0] ?? url] ?? {},
    })),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TV's Library", () => {
  it("lists the videos the person added under Recently Added, newest first", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve([
      { id: "aqz-KE-bpKZ", title: "Big Buck Bunny", channel: "Blender" },
      { id: "eRsGyueVLvZ", title: "My Clip", channel: "Me" },
    ]);
    render(<TvYouTube />);
    await user.click(await screen.findByRole("button", { name: "Library" }));
    expect(await screen.findByText("Recently Added")).toBeInTheDocument();
    const clip = screen.getByRole("button", { name: /My Clip/ });
    const bunny = screen.getByRole("button", { name: /Big Buck Bunny/ });
    expect(clip.compareDocumentPosition(bunny) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("TV Shows", () => {
  it("shelves each open series in episode order, then what the person added", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve([{ id: "eRsGyueVLvZ", title: "My Clip", channel: "Me" }]);
    render(<TvYouTube />);
    await user.click(await screen.findByRole("button", { name: "TV Shows" }));
    for (const series of ["Caminandes", "Pepper & Carrot", "Morevna", "Added by You"]) {
      expect(await screen.findByText(series)).toBeInTheDocument();
    }
    const third = screen.getByRole("button", { name: /Pepper & Carrot 3: The Secret Ingredients/ });
    const sixth = screen.getByRole("button", { name: /Pepper & Carrot 6: The Potion Contest/ });
    expect(third.compareDocumentPosition(sixth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: /My Clip/ })).toBeInTheDocument();
  });

  it("steps through a series with Next Episode, and the last has none", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve([]);
    render(<TvYouTube />);
    await user.click(await screen.findByRole("button", { name: "TV Shows" }));
    await user.click(await screen.findByRole("button", { name: /Morevna: Episode 3/ }));
    await user.click(await screen.findByRole("button", { name: "Next Episode" }));
    expect(await screen.findByText("Morevna: Episode 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next Episode" })).toBeNull();
  });

  it("finds the next episode past a cleared checkbox, and none after the last", () => {
    expect(nextEpisodeId("nuw1B334feI")).toBe("-wWIZ7wT8eg");
    expect(nextEpisodeId("nuw1B334feI", ["-wWIZ7wT8eg"])).toBe("v6-r01Jb_HM");
    expect(nextEpisodeId("cTb1_w8hvqY")).toBeUndefined();
    expect(nextEpisodeId("eRsGyueVLvQ")).toBeUndefined();
  });
});
