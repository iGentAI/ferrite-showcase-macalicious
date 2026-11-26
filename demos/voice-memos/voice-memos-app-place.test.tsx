import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerDropTarget } from "../desktop/desktop-drag";
import { DriveError } from "../desktop/desktop-files";
import {
  beginDesktopValues,
  changeDesktopValue,
  connectDesktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { VoiceMemosApp } from "./voice-memos-app";
import { encodeWav, extensionOf, titleOf } from "./voice-memos-audio";
import { MAX_DURATION } from "./voice-memos-data";
import type { VoiceMemoFile, VoiceMemosDrive } from "./voice-memos-drive";
import type { DecodedFile, VoiceMemosHolding } from "./voice-memos-holding";
import { VOICE_MEMOS_PLACE } from "./voice-memos-place";

/*
 * Stand-ins, as in voice-memos-app.test.tsx: a drive in memory for the person's drive, a decoder for
 * the WAV files these tests make, a recorder and a microphone, the media element's playback, and
 * `navigator.mediaSession` for the browser's. IndexedDB's own keeping of a decoding runs in
 * voice-memos-census-journey.mjs.
 */

const RATE = 8000;
function wav(seconds: number): Blob {
  const samples = new Float32Array(Math.round(seconds * RATE)).fill(0.25);
  return new Blob([encodeWav(samples, RATE)], { type: "audio/wav" });
}

function memoOf(id: string, name: string, created: number): VoiceMemoFile {
  return {
    id,
    name,
    title: titleOf(name),
    extension: extensionOf(name),
    created,
    size: 100,
    type: "audio/wav",
    parent: "voice-memos",
  };
}

function driveOf(...memos: VoiceMemoFile[]) {
  const list = [...memos];
  return {
    list: vi.fn<VoiceMemosDrive["list"]>(async () => list),
    watch: () => () => {},
    save: vi.fn<VoiceMemosDrive["save"]>(async (blob, name) => {
      if (list.some((memo) => memo.name === name)) throw new DriveError(409, "name taken");
      const memo = memoOf(`saved-${list.length}`, name, Date.now());
      list.unshift(memo);
      return { ...memo, size: blob.size };
    }),
    read: vi.fn<VoiceMemosDrive["read"]>(async () => wav(3)),
    opened: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
    replace: vi.fn(),
  } satisfies VoiceMemosDrive;
}

class FakeOfflineAudioContext {
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    const view = new DataView(data);
    const rate = view.getUint32(24, true);
    const samples = new Float32Array(view.getUint32(40, true) / 2);
    return Promise.resolve({
      duration: samples.length / rate,
      sampleRate: rate,
      numberOfChannels: 1,
      length: samples.length,
      getChannelData: () => samples,
    } as unknown as AudioBuffer);
  }
}

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  start() {
    this.state = "recording";
  }
  pause() {}
  resume() {}
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.dispatchEvent(Object.assign(new Event("dataavailable"), { data: wav(1) }));
      this.dispatchEvent(new Event("stop"));
    });
  }
}

class FakeAudioContext {
  state = "running";
  resume = () => Promise.resolve();
  close = () => Promise.resolve();
  createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
  createAnalyser = () => ({ fftSize: 4, getByteTimeDomainData() {} });
}

const playback = new WeakMap<HTMLMediaElement, { time: number; paused: boolean }>();
const playing = (element: HTMLMediaElement) => {
  let found = playback.get(element);
  if (!found) {
    found = { time: 0, paused: true };
    playback.set(element, found);
  }
  return found;
};

const audio = () => document.querySelector(".mac-voice-memos audio") as HTMLAudioElement;
async function loaded() {
  await waitFor(() => expect(audio()).toHaveAttribute("src"));
  await act(async () => void audio().dispatchEvent(new Event("loadedmetadata")));
}
const row = (name: RegExp) => screen.findByRole("option", { name });

const handlers = new Map<string, MediaSessionActionHandler | null>();
const session = {
  metadata: null as MediaMetadata | null,
  playbackState: "none",
  setActionHandler: (action: string, handler: MediaSessionActionHandler | null) =>
    handlers.set(action, handler),
};

beforeEach(() => {
  beginDesktopValues();
  handlers.clear();
  session.metadata = null;
  session.playbackState = "none";
  Object.assign(URL, { createObjectURL: () => "blob:memo", revokeObjectURL: () => {} });
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal(
    "MediaMetadata",
    class {
      title: string;
      artist: string;
      constructor(init: { title: string; artist: string }) {
        this.title = init.title;
        this.artist = init.artist;
      }
    },
  );
  Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) as unknown as MediaStream,
    },
  });
  const proto = HTMLMediaElement.prototype;
  Object.defineProperties(proto, {
    currentTime: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return playing(this).time;
      },
      set(this: HTMLMediaElement, value: number) {
        playing(this).time = value;
      },
    },
    paused: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return playing(this).paused;
      },
    },
    duration: { configurable: true, get: () => 3 },
    readyState: { configurable: true, get: () => 1 },
    ended: { configurable: true, get: () => false },
  });
  vi.spyOn(proto, "load").mockImplementation(() => {});
  vi.spyOn(proto, "play").mockImplementation(function (this: HTMLMediaElement) {
    playing(this).paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(proto, "pause").mockImplementation(function (this: HTMLMediaElement) {
    if (playing(this).paused) return;
    playing(this).paused = true;
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const name of ["currentTime", "paused", "duration", "readyState", "ended"]) {
    delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>)[name];
  }
});

describe("Voice Memos on the desktop, the place and what it keeps", () => {
  it("goes back to the recording, the playhead and the hidden list the person left", async () => {
    const drive = driveOf(memoOf("new", "Newest.wav", 2000), memoOf("old", "Older.wav", 1000));
    changeDesktopValue(VOICE_MEMOS_PLACE, { recording: "old", position: 1.5, sidebar: false });
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Older" });
    await loaded();
    await waitFor(() => expect(audio().currentTime).toBe(1.5));
    expect(screen.getByRole("timer", { name: "Position" })).toHaveTextContent("00:01.50");
    expect(screen.queryByRole("listbox", { name: "Recordings" })).toBeNull();
  });

  it("shows the newest when the recording it left has gone from the drive", async () => {
    const drive = driveOf(memoOf("new", "Newest.wav", 2000));
    changeDesktopValue(VOICE_MEMOS_PLACE, { recording: "gone", position: 2, sidebar: true });
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Newest" });
    await loaded();
    expect(audio().currentTime).toBe(0);
  });

  it("saves where the person is, and again as the window closes", async () => {
    const user = userEvent.setup();
    const writes: unknown[] = [];
    const disconnect = connectDesktopValues((key, value) => {
      if (key === VOICE_MEMOS_PLACE) writes.push(value);
    });
    const drive = driveOf(memoOf("new", "Newest.wav", 2000), memoOf("old", "Older.wav", 1000));
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await user.click(await row(/^Older/));
    await screen.findByRole("region", { name: "Older" });
    await loaded();
    await waitFor(() =>
      expect(writes.at(-1)).toEqual({ recording: "old", position: 0, sidebar: true }),
    );
    await act(async () => {
      audio().currentTime = 2;
      audio().dispatchEvent(new Event("timeupdate"));
    });
    unmount();
    expect(writes.at(-1)).toEqual({ recording: "old", position: 2, sidebar: true });
    disconnect();
  });

  it("takes a length and a waveform from what the browser kept, and keeps what it decodes", async () => {
    const kept = new Map<string, DecodedFile>([["old", { duration: 125, peaks: [0.5, 0.5] }]]);
    const place: VoiceMemosHolding = {
      list: async () => [],
      put: async () => {},
      remove: async () => {},
      knownDecoded: async (id) => kept.get(id),
      keepDecoded: async (id, decoded) => void kept.set(id, decoded),
    };
    const drive = Object.assign(
      driveOf(memoOf("new", "Newest.wav", 2000), memoOf("old", "Older.wav", 1000)),
      { holding: async () => place },
    );
    render(<VoiceMemosApp drive={drive} />);
    expect(await row(/^Older.*2:05$/)).toBeInTheDocument();
    expect(drive.read).not.toHaveBeenCalledWith("old");
    await waitFor(() => expect(kept.get("new")?.duration).toBe(3));
    expect(kept.get("new")?.peaks).toHaveLength(150);
  });

  it("keeps no decoding of a take the drive has not taken", async () => {
    const user = userEvent.setup();
    const keepDecoded = vi.fn(async () => {});
    const place: VoiceMemosHolding = {
      list: async () => [],
      put: async () => {},
      remove: async () => {},
      keepDecoded,
    };
    const drive = Object.assign(driveOf(), { holding: async () => place });
    drive.save.mockRejectedValue(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(screen.getByRole("button", { name: "New Recording" }));
    await user.click(await screen.findByRole("button", { name: "Done" }));
    await row(/Not saved.*00:01$/);
    expect(keepDecoded).not.toHaveBeenCalled();
  });
});

describe("Voice Memos on the desktop, a take's title", () => {
  const takeAndDone = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "New Recording" }));
    return screen.findByRole("button", { name: "Done" });
  };

  it("numbers a new recording after those the list holds", async () => {
    const user = userEvent.setup();
    const drive = driveOf(
      memoOf("a", "New Recording.wav", 2000),
      memoOf("b", "New Recording 2.wav", 1000),
    );
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "New Recording" });
    await user.click(await takeAndDone(user));
    await waitFor(() => expect(drive.save).toHaveBeenCalled());
    expect(drive.save.mock.calls[0]?.[1]).toBe("New Recording 3.webm");
  });

  it("takes the next number when another window has saved under its own", async () => {
    const user = userEvent.setup();
    const drive = driveOf();
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    const done = await takeAndDone(user);
    await drive.save(new Blob(["other"]), "New Recording.webm");
    drive.save.mockClear();
    await user.click(done);
    await row(/^New Recording 2/);
    expect(drive.save.mock.calls.map((call) => call[1])).toEqual([
      "New Recording.webm",
      "New Recording 2.webm",
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says why a take stopped at the hour a recording gets", async () => {
    let at = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => at);
    const user = userEvent.setup();
    const drive = driveOf();
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await takeAndDone(user);
    at += MAX_DURATION * 1000;
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Voice Memos ends a recording at an hour, so this one stopped there.",
    );
    expect(drive.save).toHaveBeenCalledTimes(1);
  });
});

describe("Voice Memos on the desktop, a recording leaves the window", () => {
  const pointer = (type: string, x: number) =>
    window.dispatchEvent(
      Object.assign(new MouseEvent(type, { clientX: x, clientY: 0 }), { pointerId: 1 }),
    );

  it("drags the pressed recording onto what takes files, and only that one", async () => {
    const drive = driveOf(memoOf("new", "Newest.wav", 2000), memoOf("old", "Older.wav", 1000));
    render(<VoiceMemosApp drive={drive} />);
    const pressed = await row(/^Older/);
    const target = document.body.appendChild(document.createElement("div"));
    const dropped: unknown[] = [];
    const stop = registerDropTarget({
      element: target,
      landing: (_hit, drag) => ({
        element: target,
        drop: () => dropped.push({ from: drag.from, items: drag.items }),
      }),
    });
    document.elementFromPoint = () => target;
    fireEvent.pointerDown(pressed, { button: 0, pointerId: 1 });
    pointer("pointermove", 20);
    pointer("pointerup", 20);
    expect(dropped).toEqual([
      {
        from: "voice-memos",
        items: [{ id: "old", name: "Older.wav", kind: "file", type: "audio/wav", size: 100 }],
      },
    ]);
    stop();
    target.remove();
  });
});

describe("Voice Memos on the desktop, the media keys", () => {
  it("names the recording and answers the keys once it plays, and lets go as it closes", async () => {
    const user = userEvent.setup();
    const drive = driveOf(memoOf("new", "Newest.wav", 2000));
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Newest" });
    await loaded();
    expect(handlers.size).toBe(0);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(session.playbackState).toBe("playing");
    expect(session.metadata).toMatchObject({ title: "Newest", artist: "Voice Memos" });
    await act(async () => handlers.get("pause")?.({ action: "pause" }));
    expect(audio().paused).toBe(true);
    expect(session.playbackState).toBe("paused");
    await act(async () => handlers.get("seekforward")?.({ action: "seekforward" }));
    // Fifteen seconds on, stopped by the recording's end.
    expect(audio().currentTime).toBe(3);
    await act(async () => handlers.get("seekto")?.({ action: "seekto", seekTime: 1 }));
    expect(audio().currentTime).toBe(1);
    await act(async () => handlers.get("play")?.({ action: "play" }));
    expect(audio().paused).toBe(false);
    unmount();
    expect(handlers.get("play")).toBeNull();
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");
  });
});

describe("Voice Memos on the desktop, the waveform", () => {
  it("zooms with a pinch, within its limits, and leaves a plain wheel alone", async () => {
    const drive = driveOf(memoOf("new", "Newest.wav", 2000));
    render(<VoiceMemosApp drive={drive} />);
    const view = await screen.findByRole("group", { name: "Newest" });
    const detail = await screen.findByRole("img", { name: "Waveform of Newest" });
    const scale = () => Number(detail.style.getPropertyValue("--_s"));
    expect(scale()).toBe(77);
    fireEvent.wheel(view, { deltaY: -100 });
    expect(scale()).toBe(77);
    fireEvent.wheel(view, { deltaY: -50, ctrlKey: true });
    expect(scale()).toBeCloseTo(77 * Math.exp(0.5));
    fireEvent.wheel(view, { deltaY: -5000, ctrlKey: true });
    expect(scale()).toBe(308);
    fireEvent.wheel(view, { deltaY: 5000, ctrlKey: true });
    expect(scale()).toBe(20);
  });
});
