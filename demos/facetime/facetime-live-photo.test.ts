import { afterEach, describe, expect, it, vi } from "vitest";
import { importPicture } from "../photos/photos-library";
import { keepLivePhoto, LIVE_MOTION_MS } from "./facetime-live-photo";

/*
 * Stand-ins: jsdom draws no canvas, so the canvas's context and encoder are replaced; the stream behind
 * the picture is a plain object with the sizes a playing video reports; and the Photos library's
 * `importPicture` is replaced, so what reaches the server is not verified here.
 */
vi.mock("../photos/photos-library", () => ({ importPicture: vi.fn() }));

const imported = vi.mocked(importPicture);
const JPEG = new Blob(["jpeg"], { type: "image/jpeg" });
const drawImage = vi.fn();

const video = (videoWidth: number, videoHeight: number) =>
  ({ videoWidth, videoHeight, dataset: { remote: "Ada" } }) as unknown as HTMLVideoElement;

function stubCanvas(encoded: Blob | null = JPEG) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as null);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(encoded));
}

afterEach(() => {
  vi.restoreAllMocks();
  imported.mockReset();
  drawImage.mockClear();
});

describe("keepLivePhoto", () => {
  const told = async () => null;
  it("keeps the frame in Photos, named for the person, and says so", async () => {
    stubCanvas();
    const picture = video(640, 480);
    await expect(keepLivePhoto(picture, told, 1_000)).resolves.toBe(
      "Live Photo of Ada saved to Photos, as a still.",
    );
    expect(drawImage).toHaveBeenCalledWith(picture, 0, 0);
    expect(imported).toHaveBeenCalledWith(JPEG, { name: "FaceTime Photo of Ada", takenMs: 1_000 });
  });
  it("keeps the seconds after the moment beside the still, when the browser records them", async () => {
    stubCanvas();
    const MOVIE = new Blob(["movie"], { type: "video/webm" });
    class FakeStream {}
    class FakeRecorder {
      state = "recording";
      mimeType = "video/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {}
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: MOVIE });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaStream", FakeStream);
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.useFakeTimers();
    const picture = { ...video(640, 480), srcObject: new FakeStream() } as HTMLVideoElement;
    const taken = keepLivePhoto(picture, told, 1_000);
    await vi.advanceTimersByTimeAsync(LIVE_MOTION_MS);
    vi.useRealTimers();
    await expect(taken).resolves.toBe(
      "Live Photo of Ada saved to Photos, with its motion and sound.",
    );
    expect(imported).toHaveBeenCalledWith(JPEG, { name: "FaceTime Photo of Ada", takenMs: 1_000 });
    const [movie, named] = imported.mock.calls[1] ?? [];
    expect(named).toEqual({ name: "FaceTime Live Photo of Ada", takenMs: 1_000 });
    expect((movie as Blob).type).toBe("video/webm");
    expect((movie as Blob).size).toBe(5);
    vi.unstubAllGlobals();
  });
  it("keeps nothing unless the others were told", async () => {
    stubCanvas();
    imported.mockClear();
    await expect(
      keepLivePhoto(video(640, 480), async () => "you are not in this call"),
    ).resolves.toBe("The Live Photo was not taken: you are not in this call.");
    expect(imported).not.toHaveBeenCalled();
  });
  it("says there was nothing to take while the picture has no frame", async () => {
    stubCanvas();
    await expect(keepLivePhoto(video(0, 0), told)).resolves.toBe(
      "There was no picture of Ada to take.",
    );
    await expect(keepLivePhoto(null, told)).resolves.toBe(
      "There was no picture of the other person to take.",
    );
    expect(imported).not.toHaveBeenCalled();
  });
  it("says why when the library refuses it", async () => {
    stubCanvas();
    imported.mockRejectedValue(new Error("Your drive is full"));
    await expect(keepLivePhoto(video(640, 480), told)).resolves.toBe(
      "The Live Photo could not be saved. Your drive is full.",
    );
  });
});
