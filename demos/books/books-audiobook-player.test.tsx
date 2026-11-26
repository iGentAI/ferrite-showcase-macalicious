import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooksAudiobookPlayer } from "./books-audiobook-player";

const BOOK = {
  id: "lv-1",
  title: "Alice",
  author: "Carroll",
  source: "librivox",
  added: 1,
} as const;
const CHAPTERS = [
  { title: "One", url: "https://archive.org/one.mp3", seconds: 100, reader: "A" },
  { title: "Two", url: "https://archive.org/two.mp3", seconds: 100, reader: "B" },
];

/** What jsdom's media element lacks, with the two facts the spec gives: `play()` unpauses it and
 * a media error leaves it unpaused. */
let paused = true;
let saved: number[] = [];
const load = vi.fn();
const pause = vi.fn(function (this: HTMLMediaElement) {
  if (paused) return;
  paused = true;
  this.dispatchEvent(new Event("pause"));
});
const play = vi.fn(function (this: HTMLMediaElement) {
  paused = false;
  this.dispatchEvent(new Event("play"));
  return Promise.resolve();
});

beforeEach(() => {
  paused = true;
  saved = [];
  vi.clearAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(load);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        saved.push(JSON.parse(String(init.body)).reading.place);
        return Response.json({ rev: saved.length + 1 });
      }
      if (String(url).includes("/audiobook/")) {
        return Response.json({
          id: "lv-1",
          title: "Alice",
          author: "Carroll",
          page: "",
          seconds: 200,
          chapters: CHAPTERS,
        });
      }
      return Response.json({ reading: { place: 130, bookmarks: [], highlights: [] }, rev: 1 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function opened() {
  const { container } = render(<BooksAudiobookPlayer book={BOOK} onClose={() => {}} />);
  await screen.findByRole("button", { name: "Play" });
  const audio = container.querySelector("audio") as HTMLAudioElement;
  await waitFor(() => expect(audio.getAttribute("src")).toBe(CHAPTERS[1]?.url));
  return audio;
}

const fail = (audio: HTMLAudioElement) =>
  act(() => {
    Object.defineProperty(audio, "error", {
      configurable: true,
      value: { code: 4, message: "Failed to decode media" },
    });
    fireEvent.error(audio);
  });

describe("BooksAudiobookPlayer", () => {
  it("stops and says so when the sound fails while it plays, and Play asks for it again", async () => {
    const audio = await opened();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(await screen.findByRole("button", { name: "Pause" })).toBeDefined();
    expect(audio.paused).toBe(false);

    fail(audio);

    expect(audio.paused).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "The Internet Archive did not give this chapter: Failed to decode media",
    );

    play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the place when the sound fails before it has loaded", async () => {
    const audio = await opened();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fail(audio);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(saved.filter((place) => place !== 130)).toEqual([]);
    expect(screen.getByText("2:10 of 3:20")).toBeDefined();
  });
});
