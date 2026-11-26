import { describe, expect, it, vi } from "vitest";
import { mediaAttempts, moveCallTo, readDevices } from "./facetime-devices";

const track = (kind: string, readyState = "live") => ({ kind, readyState }) as MediaStreamTrack;
const stream = (...tracks: MediaStreamTrack[]) => ({ getTracks: () => tracks });
const sender = (held: MediaStreamTrack | null, answer: Promise<void> = Promise.resolve()) => ({
  track: held,
  replaceTrack: vi.fn(() => answer),
});

describe("moveCallTo", () => {
  const oldVideo = track("video");
  const oldAudio = track("audio");
  const newVideo = track("video");
  const newAudio = track("audio");
  it("takes the first stream as it is", async () => {
    expect(await moveCallTo(stream(newVideo, newAudio), null, [])).toEqual({
      tracks: [newVideo, newAudio],
      released: [],
      failed: false,
    });
  });
  it("puts the new tracks on the call and lets the old ones go", async () => {
    const video = sender(oldVideo);
    const audio = sender(oldAudio);
    const moved = await moveCallTo(stream(newVideo, newAudio), stream(oldVideo, oldAudio), [
      video,
      audio,
    ]);
    expect(video.replaceTrack).toHaveBeenCalledWith(newVideo);
    expect(audio.replaceTrack).toHaveBeenCalledWith(newAudio);
    expect(moved).toEqual({
      tracks: [newVideo, newAudio],
      released: [oldVideo, oldAudio],
      failed: false,
    });
  });
  it("moves every connection of a group, and puts them back when one refuses", async () => {
    const toBob = sender(oldVideo);
    const toCid = sender(oldVideo);
    expect(await moveCallTo(stream(newVideo), stream(oldVideo), [toBob, toCid])).toEqual({
      tracks: [newVideo],
      released: [oldVideo],
      failed: false,
    });
    expect(toBob.replaceTrack).toHaveBeenCalledWith(newVideo);
    expect(toCid.replaceTrack).toHaveBeenCalledWith(newVideo);

    const taken = sender(oldVideo);
    const refused = sender(oldVideo, Promise.reject(new Error("refused")));
    expect(await moveCallTo(stream(newVideo), stream(oldVideo), [taken, refused])).toEqual({
      tracks: [oldVideo],
      released: [newVideo],
      failed: true,
    });
    expect(taken.replaceTrack).toHaveBeenLastCalledWith(oldVideo);
  });
  it("keeps what a fallback stream lacks, for the call and the window", async () => {
    const video = sender(oldVideo);
    const audio = sender(oldAudio);
    const moved = await moveCallTo(stream(newAudio), stream(oldVideo, oldAudio), [video, audio]);
    expect(video.replaceTrack).not.toHaveBeenCalled();
    expect(moved.tracks).toEqual([newAudio, oldVideo]);
    expect(moved.released).toEqual([oldAudio]);
  });
  it("lets go of a kept kind that has ended", async () => {
    const gone = track("video", "ended");
    const moved = await moveCallTo(stream(newAudio), stream(gone), []);
    expect(moved.tracks).toEqual([newAudio]);
    expect(moved.released).toEqual([gone]);
  });
  it("keeps the working track when the call refuses the new one, without a rejection", async () => {
    const refused = Promise.reject(new DOMException("no", "InvalidModificationError"));
    const moved = await moveCallTo(stream(newVideo), stream(oldVideo), [sender(oldVideo, refused)]);
    expect(moved).toEqual({ tracks: [oldVideo], released: [newVideo], failed: true });
  });
  it("leaves a sender with nothing to send alone", async () => {
    const idle = sender(null);
    await moveCallTo(stream(newVideo), null, [idle]);
    expect(idle.replaceTrack).not.toHaveBeenCalled();
  });
});

describe("readDevices", () => {
  it("keeps the choices and leaves out what is not one", () => {
    expect(readDevices({ camera: "a", microphone: 3, output: "b", other: "c" })).toEqual({
      camera: "a",
      output: "b",
    });
    expect(readDevices("nothing")).toBeUndefined();
    expect(readDevices(null)).toBeUndefined();
  });
});

describe("mediaAttempts", () => {
  it("asks for the browser's defaults until something is chosen", () => {
    expect(mediaAttempts({}).map(([constraints]) => constraints)).toEqual([
      { video: true, audio: true },
      { video: true },
      { audio: true },
    ]);
  });
  it("asks for the chosen devices exactly, then falls to the browser's defaults", () => {
    expect(mediaAttempts({ camera: "c", microphone: "m" }).map(([each]) => each)).toEqual([
      { video: { deviceId: { exact: "c" } }, audio: { deviceId: { exact: "m" } } },
      { video: true, audio: true },
      { video: true },
      { audio: true },
    ]);
    expect(mediaAttempts({ camera: "c" })[0]?.[0]).toEqual({
      video: { deviceId: { exact: "c" } },
      audio: true,
    });
  });
  it("warns only when it got less than it asked for", () => {
    expect(mediaAttempts({}).map(([, warning]) => warning)).toEqual([
      undefined,
      "FaceTime cannot use your microphone; calls carry your picture only.",
      "FaceTime cannot use your camera; calls carry sound only.",
    ]);
  });
});
