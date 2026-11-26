import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editedSize } from "./quicktime-player-picture";
import { replayMovie } from "./quicktime-player-replay";

describe("the size of an edited movie", () => {
  it("swaps its sides on a quarter turn and keeps them on a half turn", () => {
    expect(editedSize(640, 480, { turns: 1 })).toEqual({ width: 480, height: 640 });
    expect(editedSize(640, 480, { turns: 3 })).toEqual({ width: 480, height: 640 });
    expect(editedSize(640, 480, { turns: 2 })).toEqual({ width: 640, height: 480 });
  });

  it("scales down to Export As's height, in even pixels, and never up", () => {
    expect(editedSize(1920, 1080, { height: 720 })).toEqual({ width: 1280, height: 720 });
    expect(editedSize(1441, 1081, { height: 480 })).toEqual({ width: 640, height: 480 });
    expect(editedSize(640, 480, { height: 1080 })).toEqual({ width: 640, height: 480 });
  });
});

/*
 * Test doubles: `FakeVideo`, `FakeRecorder` and a fake AudioContext and canvas stand in for the
 * browser's media, so each can be left pending or made to fail at will. A real replay is
 * e2e/quicktime-edit-journey.mjs.
 */
class FakeVideo extends EventTarget {
  playsInline = false;
  preload = "";
  muted = false;
  duration = 2;
  videoWidth = 4;
  videoHeight = 4;
  ended = false;
  time = 0;
  play = vi.fn(async () => {});
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  get currentTime() {
    return this.time;
  }
  set currentTime(value: number) {
    this.time = value;
    queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
  }
  set src(_value: string) {
    queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
  }
}

class FakeRecorder extends EventTarget {
  static made: FakeRecorder[] = [];
  static isTypeSupported = () => true;
  static stopsAlone = true;
  state = "inactive";
  mimeType = "video/webm";
  constructor() {
    super();
    FakeRecorder.made.push(this);
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop = vi.fn(() => {
    if (!FakeRecorder.stopsAlone) return;
    this.give();
    this.finish();
  });
  give() {
    const data = new Event("dataavailable") as Event & { data: Blob };
    data.data = new Blob(["frames"]);
    this.dispatchEvent(data);
  }
  finish() {
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

const pending = () => new Promise<void>(() => {});
let video: FakeVideo;
let picture: { stop: ReturnType<typeof vi.fn> };
let sound: { stop: ReturnType<typeof vi.fn> };
let closed: ReturnType<typeof vi.fn>;
let resume: ReturnType<typeof vi.fn>;
const revoked = vi.fn();

beforeEach(() => {
  video = new FakeVideo();
  picture = { stop: vi.fn() };
  sound = { stop: vi.fn() };
  closed = vi.fn(async () => {});
  resume = vi.fn(async () => {});
  revoked.mockClear();
  FakeRecorder.made = [];
  FakeRecorder.stopsAlone = true;
  const make = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "video") return video;
    if (tag === "canvas") {
      return {
        getContext: () => ({
          setTransform() {},
          rotate() {},
          scale() {},
          drawImage() {},
          fillRect() {},
        }),
        captureStream: () => ({ getVideoTracks: () => [picture] }),
      };
    }
    return make(tag);
  }) as typeof document.createElement);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("MediaStream", class {});
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = resume;
      close = closed;
      createMediaElementSource = () => ({ connect() {} });
      createMediaStreamDestination = () => ({ stream: { getAudioTracks: () => [sound] } });
    },
  );
  Object.assign(URL, { createObjectURL: () => "blob:source", revokeObjectURL: revoked });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const source = new Blob(["movie"]);
const replay = (signal?: AbortSignal) => replayMovie(source, {}, () => {}, signal);
const released = () => {
  expect(closed).toHaveBeenCalledTimes(1);
  expect(revoked).toHaveBeenCalledWith("blob:source");
};
const recording = () => vi.waitFor(() => expect(FakeRecorder.made).toHaveLength(1));

describe("a replay", () => {
  it("answers the recording at the movie's end, and lets everything go", async () => {
    const done = replay();
    await recording();
    video.ended = true;
    const blob = await done;
    expect(await blob.text()).toBe("frames");
    expect(picture.stop).toHaveBeenCalled();
    expect(sound.stop).toHaveBeenCalled();
    released();
  });

  it("ends at once when cancelled while the sound is starting", async () => {
    resume.mockImplementation(pending);
    const stop = new AbortController();
    const done = replay(stop.signal);
    stop.abort(new Error("cancelled here"));
    await expect(done).rejects.toThrow("cancelled here");
    released();
  });

  it("ends at once when cancelled while the movie is starting", async () => {
    video.play.mockImplementation(pending);
    const stop = new AbortController();
    const done = replay(stop.signal);
    await recording();
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    stop.abort(new Error("cancelled here"));
    await expect(done).rejects.toThrow("cancelled here");
    expect(picture.stop).toHaveBeenCalled();
    expect(sound.stop).toHaveBeenCalled();
    expect(FakeRecorder.made[0]?.state).toBe("inactive");
    released();
  });

  it("starts recording only once the movie moves", async () => {
    let moving: () => void = () => {};
    video.play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          moving = resolve;
        }),
    );
    const done = replay();
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    expect(FakeRecorder.made[0]?.state).toBe("inactive");
    moving();
    await vi.waitFor(() => expect(FakeRecorder.made[0]?.state).toBe("recording"));
    video.ended = true;
    await done;
  });

  it("ends at once when cancelled while the recorder is stopping", async () => {
    FakeRecorder.stopsAlone = false;
    const stop = new AbortController();
    const done = replay(stop.signal);
    await recording();
    video.ended = true;
    await vi.waitFor(() => expect(FakeRecorder.made[0]?.stop).toHaveBeenCalled());
    stop.abort(new Error("cancelled here"));
    await expect(done).rejects.toThrow("cancelled here");
    expect(picture.stop).toHaveBeenCalled();
    released();
  });

  it("fails when the movie fails while it plays", async () => {
    const done = replay();
    await recording();
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    video.dispatchEvent(new Event("error"));
    await expect(done).rejects.toThrow("cannot play the movie");
    expect(picture.stop).toHaveBeenCalled();
    released();
  });

  it("fails, and gives no partial movie, when the recorder fails after it gave some", async () => {
    const done = replay();
    await recording();
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    const take = FakeRecorder.made[0] as FakeRecorder;
    take.give();
    take.dispatchEvent(Object.assign(new Event("error"), { error: { message: "encoder quit" } }));
    take.finish();
    await expect(done).rejects.toThrow("encoder quit");
    released();
  });

  it("fails when the recorder stops by itself before the end", async () => {
    const done = replay();
    await recording();
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    (FakeRecorder.made[0] as FakeRecorder).finish();
    await expect(done).rejects.toThrow("stopped early");
    released();
  });

  it("fails, recording nothing, when the sound cannot start", async () => {
    resume.mockRejectedValue(new Error("no sound here"));
    await expect(replay()).rejects.toThrow("no sound here");
    expect(FakeRecorder.made).toHaveLength(0);
    released();
  });

  it("needs no sound when none is wanted", async () => {
    resume.mockRejectedValue(new Error("no sound here"));
    const done = replayMovie(source, { noAudio: true }, () => {});
    await recording();
    video.ended = true;
    expect(await (await done).text()).toBe("frames");
    expect(video.muted).toBe(true);
  });

  it("plays pieces in their order, with the recorder paused over each seek", async () => {
    const seekedTo: number[] = [];
    const recorderStates: string[] = [];
    const pause = vi.spyOn(FakeRecorder.prototype, "pause");
    const resumeTake = vi.spyOn(FakeRecorder.prototype, "resume");
    const setTime = Object.getOwnPropertyDescriptor(FakeVideo.prototype, "currentTime");
    Object.defineProperty(video, "currentTime", {
      get: () => setTime?.get?.call(video),
      set: (value: number) => {
        seekedTo.push(value);
        recorderStates.push(FakeRecorder.made[0]?.state ?? "none");
        setTime?.set?.call(video, value);
      },
    });
    video.play.mockImplementation(async () => {
      video.time += 1;
    });
    const blob = new Blob(["movie"]);
    const joins: number[] = [];
    const done = replayMovie(
      [
        { blob, start: 1, end: 2 },
        { blob, start: 0, end: 1 },
      ],
      {},
      () => {},
      undefined,
      (seconds) => joins.push(seconds),
    );
    expect(await (await done).text()).toBe("frames");
    expect(joins).toHaveLength(1);
    expect(seekedTo).toEqual([1, 0]);
    expect(recorderStates).toEqual(["none", "paused"]);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resumeTake).toHaveBeenCalledTimes(1);
    expect(video.play).toHaveBeenCalledTimes(2);
  });

  it("refuses pieces of nothing", async () => {
    const blob = new Blob(["movie"]);
    await expect(replayMovie([{ blob, start: 5, end: 9 }], {}, () => {})).rejects.toThrow(
      "nothing is left",
    );
  });
});
