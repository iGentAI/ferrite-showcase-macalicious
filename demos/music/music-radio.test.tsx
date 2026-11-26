import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadioBrowser } from "./music-radio";
import {
  DEFAULT_PLAYBACK,
  playbackFromServer,
  playbackToServer,
  songFromStation,
} from "./music-server";

const station = {
  id: "83dcfac4",
  name: "Harbour FM",
  url: "https://harbour.example/live.mp3",
  country: "Norway",
  genre: "jazz",
  bitrate: 128,
};

function serve(answer: (url: string) => { status: number; body: unknown }) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (url: string) => {
    const { status, body } = answer(url);
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const browser = (props: Partial<Parameters<typeof RadioBrowser>[0]> = {}) => (
  <RadioBrowser libraryIds={new Set()} rowHeight={20} onPlay={vi.fn()} onAdd={vi.fn()} {...props} />
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Music's Radio", () => {
  it("lists the stations and plays the one opened, as a stream from its own address", async () => {
    serve(() => ({ status: 200, body: { stations: [station], more: false } }));
    const onPlay = vi.fn();
    render(browser({ onPlay }));
    const row = await screen.findByRole("row", { name: /Harbour FM/ });
    expect(within(row).getByText("128 kbps")).toBeInTheDocument();
    await userEvent.dblClick(row);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay.mock.calls[0]?.[0]).toMatchObject({
      id: "radio-83dcfac4",
      title: "Harbour FM",
      artist: "Norway",
      genre: "jazz",
      duration: 0,
      source: { kind: "stream", url: "https://harbour.example/live.mp3" },
    });
  });

  it("asks again by genre and by name", async () => {
    const fetch = serve(() => ({ status: 200, body: { stations: [station], more: false } }));
    render(browser());
    await screen.findByRole("row", { name: /Harbour FM/ });
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/music/radio/stations?name=&genre=&page=1");
    await userEvent.click(screen.getByRole("radio", { name: "Jazz" }));
    await waitFor(() =>
      expect(fetch.mock.calls.at(-1)?.[0]).toBe(
        "/api/music/radio/stations?name=&genre=jazz&page=1",
      ),
    );
    await screen.findByRole("row", { name: /Harbour FM/ });
    await userEvent.type(screen.getByRole("searchbox"), "sea air{Enter}");
    await waitFor(() =>
      expect(fetch.mock.calls.at(-1)?.[0]).toBe(
        "/api/music/radio/stations?name=sea%20air&genre=jazz&page=1",
      ),
    );
  });

  it("adds a station and then says it is in the library", async () => {
    serve(() => ({ status: 200, body: { stations: [station], more: false } }));
    const onAdd = vi.fn();
    const { rerender } = render(browser({ onAdd }));
    await userEvent.click(await screen.findByRole("button", { name: "Add Harbour FM" }));
    expect(onAdd.mock.calls[0]?.[0]).toMatchObject({ id: "radio-83dcfac4" });
    rerender(browser({ onAdd, libraryIds: new Set(["radio-83dcfac4"]) }));
    expect(screen.getByText("In Library")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Harbour FM" })).toBeNull();
  });

  it("reads the next page, leaving out a station already listed", async () => {
    const second = { ...station, id: "bb", name: "Fjord Radio" };
    const fetch = serve((url) =>
      url.endsWith("page=1")
        ? { status: 200, body: { stations: [station], more: true } }
        : { status: 200, body: { stations: [station, second], more: false } },
    );
    render(browser());
    await userEvent.click(await screen.findByRole("button", { name: "More Stations" }));
    await screen.findByRole("row", { name: /Fjord Radio/ });
    expect(screen.getAllByRole("row", { name: /Harbour FM/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "More Stations" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("says the directory could not be read, and asks again on Try Again", async () => {
    let up = false;
    serve(() =>
      up
        ? { status: 200, body: { stations: [station], more: false } }
        : { status: 502, body: { error: "the Radio Browser directory answered HTTP 500" } },
    );
    render(browser());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("the Radio Browser directory answered HTTP 500");
    up = true;
    await userEvent.click(within(alert).getByRole("button", { name: "Try Again" }));
    await screen.findByRole("row", { name: /Harbour FM/ });
  });

  it("keeps a station played outside the library with the playback, and reads it back", () => {
    const song = songFromStation(station, 1);
    const { playback } = playbackToServer({
      ...DEFAULT_PLAYBACK,
      queue: [song.id],
      index: 0,
      guests: [song],
    });
    expect(playback.guests.map((guest) => guest.id)).toEqual(["radio-83dcfac4"]);
    const read = playbackFromServer({ playback });
    expect(read?.guests[0]?.source).toEqual({
      kind: "stream",
      url: "https://harbour.example/live.mp3",
    });
  });

  it("makes the same song of a station each time, so adding it again finds it", () => {
    const first = songFromStation(station, 1);
    const second = songFromStation(station, 2);
    expect(first.id).toBe(second.id);
    expect(first.album).toBe("Internet Radio");
    expect(first.added).toBe(1);
  });
});
