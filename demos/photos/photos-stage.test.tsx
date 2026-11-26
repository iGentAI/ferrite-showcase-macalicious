import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryPhoto } from "./photos-library";
import * as library from "./photos-library";
import { PhotoStage } from "./photos-stage";

vi.mock("./photos-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photos-library")>()),
  readOriginal: vi.fn(),
}));

const photo = (id: string, mime: string) =>
  ({ id, name: id, mime, deleted_ms: null, edited_ms: 0 }) as unknown as LibraryPhoto;
const picture = photo("picture", "image/jpeg");
const movie = photo("movie", "video/webm");

const place = () => document.querySelector(".mac-photos-stage-place")?.textContent;
const video = () => document.querySelector<HTMLVideoElement>(".mac-photos-stage video");
/** Lets the original's read and the address made from it finish. */
const settle = () => act(() => vi.advanceTimersByTimeAsync(0));

describe("a slideshow with a movie", () => {
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(library.readOriginal).mockResolvedValue(new Blob(["x"]));
    let made = 0;
    Object.assign(URL, {
      createObjectURL: () => {
        made += 1;
        return `blob:${made}`;
      },
      revokeObjectURL: () => {},
    });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const show = (photos: readonly LibraryPhoto[]) =>
    render(<PhotoStage photos={photos} slideshow seconds={3} onClose={() => {}} />);

  it("leaves a picture after its seconds, then runs the movie until it ends", async () => {
    show([picture, movie, picture]);
    await settle();
    expect(place()).toBe("1 of 3");
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await settle();
    expect(place()).toBe("2 of 3");
    expect(play).toHaveBeenCalledTimes(1);
    expect(video()?.controls).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(place()).toBe("2 of 3");

    const running = video();
    if (!running) throw new Error("no movie");
    fireEvent.ended(running);
    await settle();
    expect(place()).toBe("3 of 3");
  });

  it("pauses the movie and resumes it with the show", async () => {
    show([movie]);
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(pause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("passes over a movie the browser cannot play, and stops after the last", async () => {
    show([movie, picture]);
    await settle();
    const broken = video();
    if (!broken) throw new Error("no movie");
    fireEvent.error(broken);
    await settle();
    expect(place()).toBe("2 of 2");
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("stays on a movie that fails while paused, until the show goes on", async () => {
    show([movie, picture]);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const broken = video();
    if (!broken) throw new Error("no movie");
    fireEvent.error(broken);
    await settle();
    expect(place()).toBe("1 of 2");
  });

  it("mutes a movie whose sound the browser refuses to start", async () => {
    play.mockRejectedValueOnce(new DOMException("refused", "NotAllowedError"));
    show([movie]);
    await settle();
    expect(video()?.muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });
});

describe("the viewer", () => {
  it("keeps a movie's own controls", async () => {
    vi.mocked(library.readOriginal).mockResolvedValue(new Blob(["x"]));
    Object.assign(URL, { createObjectURL: () => "blob:v", revokeObjectURL: () => {} });
    render(<PhotoStage photos={[movie]} onClose={() => {}} />);
    const shown = await vi.waitFor(() => {
      const found = video();
      if (!found) throw new Error("no movie yet");
      return found;
    });
    expect(shown.controls).toBe(true);
    cleanup();
  });
});
