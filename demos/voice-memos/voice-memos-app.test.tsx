import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { setDesktopSession } from "../desktop/desktop-server";
import { VoiceMemosApp } from "./voice-memos-app";
import { encodeWav, extensionOf, titleOf } from "./voice-memos-audio";
import { MAX_DURATION } from "./voice-memos-data";
import type { VoiceMemoFile, VoiceMemosDrive } from "./voice-memos-drive";
import { sameBytes } from "./voice-memos-drive";
import type { HeldTake, VoiceMemosHolding } from "./voice-memos-holding";

/*
 * Test doubles, each standing in for a browser or server part jsdom does not have:
 * - `memoryDrive` for the person's drive on the desktop's Ferrite application (Music/Voice
 *   Memos), keeping files in memory; the real drive is exercised by
 *   ferrite-apps/desktop/e2e/voice-memos-journey.mjs.
 * - `FakeOfflineAudioContext` for Web Audio's decoder: it decodes the 16-bit WAV files the tests
 *   make (and refuses anything else), at their own rate.
 * - `FakeMediaRecorder` and a stubbed `navigator.mediaDevices.getUserMedia` for the microphone:
 *   the recording they hand back is a WAV file of one second, typed as WebM.
 * - `FakeAudioContext` for the analyser that gives the live levels.
 * - The media element's playback (`play`, `pause`, `currentTime`, `duration`, `readyState`),
 *   which jsdom does not implement; the tests fire its events.
 * Real playback, recording and decoding run in the browser journey.
 */

const RATE = 8000;

/** A WAV file of `seconds` of a tone. */
function wav(seconds: number, type = "audio/wav"): Blob {
  const samples = Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, at) => Math.sin(at / 3) * 0.5,
  );
  return new Blob([encodeWav(samples, RATE)], { type });
}

const DAY = 86_400_000;

function memoryDrive(initial: readonly { name: string; seconds: number; created: number }[] = []) {
  const prefix = Math.random().toString(36).slice(2, 8);
  let made = 0;
  const files = new Map<string, { memo: VoiceMemoFile; blob: Blob }>();
  const trashed: VoiceMemoFile[] = [];
  const listeners = new Set<(list: VoiceMemoFile[]) => void>();
  const list = () =>
    [...files.values()]
      .map((file) => file.memo)
      .sort((a, b) => b.created - a.created || a.name.localeCompare(b.name));
  const emit = () => {
    for (const listener of listeners) listener(list());
  };
  const add = (blob: Blob, name: string, created = Date.now()) => {
    made += 1;
    const memo: VoiceMemoFile = {
      id: `${prefix}-${made}`,
      name,
      title: titleOf(name),
      extension: extensionOf(name),
      created,
      size: blob.size,
      type: blob.type,
      parent: "voice-memos",
    };
    files.set(memo.id, { memo, blob });
    return memo;
  };
  const taken = (name: string, except?: string) =>
    list().some((memo) => memo.id !== except && memo.name.toLowerCase() === name.toLowerCase());
  for (const file of initial) add(wav(file.seconds), file.name, file.created);
  const drive = {
    files,
    trashed,
    list: vi.fn<VoiceMemosDrive["list"]>(async () => list()),
    watch: vi.fn<VoiceMemosDrive["watch"]>((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    save: vi.fn<VoiceMemosDrive["save"]>(async (blob, name) => {
      // As the person's drive saves a recording: under exactly its name, answering the file of
      // an earlier save of the same recording (its very bytes) rather than making a second.
      const same = list().find((memo) => memo.name.toLowerCase() === name.toLowerCase());
      if (same && (await sameBytes(files.get(same.id)?.blob ?? new Blob(), blob))) return same;
      if (same) throw new Error(`an item named “${name}” already exists in that folder`);
      const memo = add(blob, name);
      emit();
      return memo;
    }),
    read: vi.fn<VoiceMemosDrive["read"]>(async (id) => {
      const file = files.get(id);
      if (!file) throw new Error("No such file is on the drive.");
      return file.blob;
    }),
    opened: vi.fn<VoiceMemosDrive["opened"]>(),
    rename: vi.fn<VoiceMemosDrive["rename"]>(async (id, name) => {
      const file = files.get(id);
      if (!file) throw new Error("No such file is on the drive.");
      if (taken(name, id)) throw new Error(`an item named “${name}” already exists in that folder`);
      file.memo = { ...file.memo, name, title: titleOf(name), extension: extensionOf(name) };
      emit();
      return file.memo;
    }),
    trash: vi.fn<VoiceMemosDrive["trash"]>(async (id) => {
      const file = files.get(id);
      if (!file) throw new Error("No such file is on the drive.");
      files.delete(id);
      trashed.push(file.memo);
      emit();
    }),
    replace: vi.fn<VoiceMemosDrive["replace"]>(async (original, blob, name) => {
      const memo = add(blob, name);
      files.delete(original.id);
      trashed.push(original);
      emit();
      return memo;
    }),
  };
  return drive;
}

class FakeOfflineAudioContext {
  decodeAudioData(
    data: ArrayBuffer,
    ok?: (buffer: AudioBuffer) => void,
    fail?: (error: unknown) => void,
  ): Promise<AudioBuffer> {
    const result = new Promise<AudioBuffer>((resolve, reject) => {
      const view = new DataView(data);
      const riff =
        data.byteLength >= 44 &&
        String.fromCharCode(
          view.getUint8(0),
          view.getUint8(1),
          view.getUint8(2),
          view.getUint8(3),
        ) === "RIFF";
      if (!riff) {
        reject(new DOMException("Unable to decode audio data", "EncodingError"));
        return;
      }
      const rate = view.getUint32(24, true);
      const samples = new Float32Array(view.getUint32(40, true) / 2);
      for (let at = 0; at < samples.length; at++) {
        samples[at] = view.getInt16(44 + at * 2, true) / 32768;
      }
      resolve({
        duration: samples.length / rate,
        sampleRate: rate,
        numberOfChannels: 1,
        length: samples.length,
        getChannelData: () => samples,
      } as unknown as AudioBuffer);
    });
    result.then(ok, fail);
    return result;
  }
}

const tracks: { stop: ReturnType<typeof vi.fn> }[] = [];
const getUserMedia = vi.fn(async () => {
  const track = { stop: vi.fn() };
  tracks.push(track);
  return { getTracks: () => [track] } as unknown as MediaStream;
});
const recorders: FakeMediaRecorder[] = [];

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  state: RecordingState = "inactive";
  mimeType: string;
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? "";
    recorders.push(this);
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
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.dispatchEvent(
        Object.assign(new Event("dataavailable"), { data: wav(1, this.mimeType) }),
      );
      this.dispatchEvent(new Event("stop"));
    });
  }
}

class FakeAudioContext {
  state = "running";
  resume = () => Promise.resolve();
  close = vi.fn(() => Promise.resolve());
  createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
  createAnalyser = () => ({
    fftSize: 4,
    // A level of a half.
    getByteTimeDomainData: (bytes: Uint8Array) => bytes.set([128, 192, 128, 64]),
  });
}

/** The media element's playback, which jsdom does not have. */
const media = new WeakMap<
  HTMLMediaElement,
  { time: number; paused: boolean; duration: number; ready: number }
>();
const state = (element: HTMLMediaElement) => {
  let found = media.get(element);
  if (!found) {
    found = { time: 0, paused: true, duration: Number.NaN, ready: 0 };
    media.set(element, found);
  }
  return found;
};
const saved = new Map<string, PropertyDescriptor | undefined>();
function stubMedia() {
  const define = (name: string, descriptor: PropertyDescriptor) => {
    saved.set(name, Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, name));
    Object.defineProperty(HTMLMediaElement.prototype, name, { configurable: true, ...descriptor });
  };
  define("currentTime", {
    get(this: HTMLMediaElement) {
      return state(this).time;
    },
    set(this: HTMLMediaElement, value: number) {
      const own = state(this);
      own.time = Number.isFinite(own.duration) ? Math.min(value, own.duration) : value;
    },
  });
  define("paused", {
    get(this: HTMLMediaElement) {
      return state(this).paused;
    },
  });
  define("duration", {
    get(this: HTMLMediaElement) {
      return state(this).duration;
    },
  });
  define("readyState", {
    get(this: HTMLMediaElement) {
      return state(this).ready;
    },
  });
  define("ended", {
    get(this: HTMLMediaElement) {
      return false;
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    state(this).paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (state(this).paused) return;
    state(this).paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
}

const audio = () => document.querySelector(".mac-voice-memos audio") as HTMLAudioElement;

/** The browser has read the chosen file's header: its length is `seconds`. */
async function loaded(seconds: number) {
  await waitFor(() => expect(audio()).toHaveAttribute("src"));
  const element = audio();
  state(element).duration = seconds;
  state(element).ready = 1;
  act(() => void element.dispatchEvent(new Event("loadedmetadata")));
}

const button = (name: string) => screen.getByRole("button", { name });
const rows = () =>
  within(screen.getByRole("listbox", { name: "Recordings" })).getAllByRole("option");
const timer = () => screen.getByRole("timer", { name: "Position" }).textContent;
const position = () => screen.getByRole("slider", { name: "Recording position" });
const row = (title: RegExp) => screen.getByRole("option", { name: title });
/** A take's title: the first "New Recording" number not in use. */
const TAKE = /^New Recording( \d+)?$/;
const TAKE_FILE = /^New Recording( \d+)?\.webm$/;
/** The window of the take under way, once it shows; answers its title, which is the take's. */
const takeTitle = async () => {
  const window = await screen.findByRole("region", { name: TAKE });
  const label = document.getElementById(window.getAttribute("aria-labelledby") ?? "");
  return label?.textContent ?? "";
};
/** The row of the take that is not saved. */
const notSaved = () => screen.getByRole("option", { name: /Not saved/ });
const findNotSaved = () => screen.findByRole("option", { name: /Not saved/ });
/** The drive, with a place in memory for the recordings it has not taken yet. */
function withHolding<T extends object>(drive: T) {
  const held = new Map<string, HeldTake>();
  const place: VoiceMemosHolding = {
    list: async () => [...held.values()],
    put: async (take) => {
      held.set(take.id, take);
    },
    remove: async (id) => {
      held.delete(id);
    },
  };
  return Object.assign(drive, { held, place, holding: async () => place });
}

let now = 0;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tracks.length = 0;
  recorders.length = 0;
  getUserMedia.mockClear();
  let made = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:memo-${++made}`),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  stubMedia();
  errors = vi.spyOn(console, "error");
});

afterEach(() => {
  // Nothing the window does is logged as an error: problems are said in the window.
  expect(errors).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(HTMLMediaElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLMediaElement.prototype, name);
  }
  saved.clear();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("VoiceMemosApp without a drive", () => {
  it("is the demo, and requests nothing, where the desktop app does not serve the page", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { unmount } = render(<VoiceMemosApp />);
    expect(screen.getByRole("region", { name: "New Recording 3" })).toBeInTheDocument();
    expect(timer()).toBe("00:03.09");
    unmount();
    render(<VoiceMemosApp drive={null} defaultView="library" />);
    expect(rows()).toHaveLength(6);
    expect(fetch).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

/** The id of the drive's file named `name`. */
const idOf = (drive: ReturnType<typeof memoryDrive>, name: string) =>
  [...drive.files.values()].find((file) => file.memo.name === name)?.memo.id;

describe("VoiceMemosApp with the person's drive", () => {
  it("lists the recordings newest first, with their dates and decoded lengths", async () => {
    const drive = memoryDrive([
      { name: "Lecture.wav", seconds: 2.5, created: Date.now() - DAY },
      { name: "New Recording.webm", seconds: 3, created: Date.now() },
      { name: "Old Idea.wav", seconds: 1.25, created: new Date(2019, 8, 28).getTime() },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    const window = await screen.findByRole("region", { name: "New Recording" });
    // Every file is decoded for its length; the newest is chosen, and read to be played.
    await waitFor(() =>
      expect(rows().map((option) => option.textContent)).toEqual([
        "New RecordingToday00:03",
        "LectureYesterday00:02",
        "Old Idea28 Sep 201900:01",
      ]),
    );
    expect(rows()[0]).toHaveAttribute("aria-selected", "true");
    expect(window).not.toHaveAttribute("aria-busy");
    expect(drive.read).toHaveBeenCalledWith(idOf(drive, "New Recording.webm"));
    // The player shows the chosen recording's decoded length and waveform.
    await waitFor(() => expect(position()).toHaveAttribute("max", "3"));
    expect(
      screen.getByRole("img", { name: "Waveform of New Recording" }).querySelector("path"),
    ).toHaveAttribute("d", expect.stringMatching(/^M/));
  });

  it("lists the length of a large recording without its being chosen", async () => {
    // Over 16 MiB of WAV: as long as the old size limit left unknown until chosen.
    const drive = memoryDrive([
      { name: "Small.wav", seconds: 1, created: Date.now() },
      { name: "Long.wav", seconds: 1050, created: Date.now() - DAY },
    ]);
    expect(drive.files.get(idOf(drive, "Long.wav") ?? "")?.blob.size).toBeGreaterThan(
      16 * 1024 * 1024,
    );
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Small" });
    await waitFor(() => expect(row(/^Long/)).toHaveTextContent("17:30"), { timeout: 10_000 });
  });

  it("decodes one recording at a time, also when one is chosen while others decode", async () => {
    const user = userEvent.setup();
    // A decoder that takes a moment, and counts how many decodings run at once.
    let running = 0;
    let most = 0;
    class SlowDecoder extends FakeOfflineAudioContext {
      override decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
        running += 1;
        most = Math.max(most, running);
        return new Promise<void>((resolve) => setTimeout(resolve, 20))
          .then(() => super.decodeAudioData(data))
          .finally(() => {
            running -= 1;
          });
      }
    }
    vi.stubGlobal("OfflineAudioContext", SlowDecoder);
    const drive = memoryDrive([
      { name: "One.wav", seconds: 1, created: Date.now() - 3000 },
      { name: "Two.wav", seconds: 2, created: Date.now() - 2000 },
      { name: "Three.wav", seconds: 3, created: Date.now() - 1000 },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Three" });
    await user.click(row(/^One/));
    await waitFor(() =>
      expect(rows().map((option) => option.textContent?.slice(-5))).toEqual([
        "00:03",
        "00:02",
        "00:01",
      ]),
    );
    expect(most).toBe(1);
  });

  it("follows the drive: a recording renamed or put in the Trash elsewhere changes the list", async () => {
    const drive = memoryDrive([
      { name: "One.wav", seconds: 1, created: Date.now() - 1000 },
      { name: "Two.wav", seconds: 1, created: Date.now() },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Two" });
    // Finder renames "Two" and moves "One" to the Trash.
    await act(async () => {
      await drive.rename(idOf(drive, "Two.wav") as string, "Second.wav");
      await drive.trash(idOf(drive, "One.wav") as string);
    });
    expect(rows().map((option) => option.textContent?.split("Today")[0])).toEqual(["Second"]);
    expect(screen.getByRole("region", { name: "Second" })).toBeInTheDocument();
  });

  it("plays the chosen recording from its file, with the playhead following the audio", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Memo.wav", seconds: 30, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Memo" });
    expect(button("Play")).toBeDisabled();
    await loaded(30);
    expect(audio()).toHaveAttribute("src", "blob:memo-1");
    expect(URL.createObjectURL).toHaveBeenCalledWith(
      drive.files.get(idOf(drive, "Memo.wav") ?? "")?.blob,
    );

    await user.click(button("Play"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(button("Pause")).toBeEnabled();
    expect(drive.opened).toHaveBeenCalledWith(idOf(drive, "Memo.wav"));
    state(audio()).time = 1.5;
    await waitFor(() => expect(timer()).toBe("00:01.50"));

    await user.click(button("Pause"));
    expect(button("Play")).toBeEnabled();
    // Skipping and seeking move the audio, within the recording.
    await user.click(button("Skip Forward 15 Seconds"));
    expect(audio().currentTime).toBe(16.5);
    expect(timer()).toBe("00:16.50");
    await user.click(button("Skip Forward 15 Seconds"));
    expect(audio().currentTime).toBe(30);
    await user.click(button("Skip Back 15 Seconds"));
    expect(timer()).toBe("00:15.00");
    position().focus();
    await user.keyboard("{Home}");
    expect(audio().currentTime).toBe(0);
    // From the end, playback starts over; the recording is marked opened once.
    state(audio()).time = 30;
    act(() => void audio().dispatchEvent(new Event("ended")));
    expect(timer()).toBe("00:30.00");
    await user.click(button("Play"));
    expect(audio().currentTime).toBe(0);
    expect(drive.opened).toHaveBeenCalledTimes(1);
  });

  it("stops playing when the window closes", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Memo.wav", seconds: 30, created: Date.now() }]);
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Memo" });
    await loaded(30);
    const element = audio();
    await user.click(button("Play"));
    expect(element.paused).toBe(false);
    unmount();
    expect(element.paused).toBe(true);
  });

  it("finds the length of a file that names none before it seeks in it", async () => {
    const drive = memoryDrive([{ name: "Memo.webm", seconds: 2, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Memo" });
    // MediaRecorder's WebM: the browser reports no length until it has looked for the end.
    await loaded(Number.POSITIVE_INFINITY);
    expect(audio().currentTime).toBe(1e101);
    expect(button("Play")).toBeDisabled();
    state(audio()).duration = 2.04;
    act(() => void audio().dispatchEvent(new Event("durationchange")));
    expect(audio().currentTime).toBe(0);
    expect(button("Play")).toBeEnabled();
  });

  it("plays a recording whose length neither its file nor the browser gives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const drive = memoryDrive();
      // A file this browser cannot decode: no length or waveform comes from decoding it.
      await drive.save(new Blob(["not a WAV file"], { type: "audio/webm" }), "Memo.webm");
      render(<VoiceMemosApp drive={drive} />);
      await screen.findByRole("region", { name: "Memo" });
      await loaded(Number.POSITIVE_INFINITY);
      expect(button("Play")).toBeDisabled();
      // The browser never finds the end: the window stops looking and plays without it.
      await act(() => vi.advanceTimersByTimeAsync(3100));
      expect(audio().currentTime).toBe(0);
      expect(button("Play")).toBeEnabled();
      await user.click(button("Play"));
      expect(audio().paused).toBe(false);
      // A skip is not stopped at a length of zero.
      await user.click(button("Skip Forward 15 Seconds"));
      expect(audio().currentTime).toBe(15);
      await waitFor(() => expect(timer()).toBe("00:15.00"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("records a take from the microphone, with live levels, and saves it under its id", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([
      { name: "New Recording.webm", seconds: 2, created: Date.now() - DAY },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "New Recording" });
    await user.click(button("New Recording"));
    // The take's title derives from its id; the editing view shows it with the take running.
    const title = await takeTitle();
    const window = screen.getByRole("region", { name: title });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorders[0]?.mimeType).toBe("audio/webm;codecs=opus");
    expect(recorders[0]?.state).toBe("recording");
    expect(button("Pause Recording")).toBeEnabled();
    expect(button("Play")).toBeDisabled();
    now += 1500;
    await waitFor(() => expect(timer()).toBe("00:01.50"));
    // The analyser's levels are the waveform's bars, 50 a second.
    expect(
      within(window)
        .getByRole("img", { name: `Waveform of ${title}` })
        .querySelector("path"),
    ).toHaveAttribute("d", expect.stringMatching(/^M/));

    // Paused, no time is recorded.
    await user.click(button("Pause Recording"));
    expect(recorders[0]?.state).toBe("paused");
    now += 5000;
    await user.click(button("Resume Recording"));
    expect(recorders[0]?.state).toBe("recording");
    now += 500;
    await waitFor(() => expect(timer()).toBe("00:02.00"));

    await user.click(button("Done"));
    await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
    const [blob, name] = drive.save.mock.calls[0] ?? [];
    expect(name).toBe(`${title}.webm`);
    expect(blob?.type).toBe("audio/webm;codecs=opus");
    expect(blob?.size).toBeGreaterThan(0);
    // The microphone is released, and the new recording is listed first and shown.
    expect(tracks[0]?.stop).toHaveBeenCalled();
    await waitFor(() => expect(rows()[0]).toHaveTextContent(`${title}Today00:01`));
    expect(rows()[0]).toHaveAttribute("aria-selected", "true");
    expect(rows()).toHaveLength(2);
    // It is played from what was recorded, not read back.
    expect(drive.read).not.toHaveBeenCalledWith(idOf(drive, `${title}.webm`));
  });

  it("says in the window when the microphone is refused, and records nothing", async () => {
    const user = userEvent.setup();
    getUserMedia.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
    const drive = memoryDrive();
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    expect(screen.getByRole("status")).toHaveTextContent("No Recordings");
    await user.click(button("New Recording"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Voice Memos is not allowed to use the microphone.",
    );
    expect(screen.queryByRole("button", { name: "Pause Recording" })).toBeNull();
    expect(drive.save).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("alert")).toBeNull();

    // A browser without a microphone at all.
    Reflect.deleteProperty(navigator, "mediaDevices");
    await user.click(button("New Recording"));
    expect(await screen.findByRole("alert")).toHaveTextContent("This browser cannot record sound.");
  });

  it("keeps a take the drive refuses as a Not saved row, playable, with Retry", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    const title = await takeTitle();
    await user.click(button("Done"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `“${title}” could not be saved: The drive is full. It stays in the list, not saved.`,
    );
    // Dismissing the message loses nothing: the row stays, says so, and is chosen.
    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "OK" }));
    expect(notSaved()).toHaveTextContent(`${title}Not saved`);
    expect(notSaved()).toHaveAttribute("aria-selected", "true");
    // It plays from what was recorded.
    await loaded(1);
    expect(button("Play")).toBeEnabled();
    expect(button("Discard")).toBeEnabled();
    await user.click(button("Retry"));
    await waitFor(() => expect(rows()[0]).toHaveTextContent(`${title}Today`));
    expect(screen.queryByRole("option", { name: /Not saved/ })).toBeNull();
    expect(drive.save).toHaveBeenCalledTimes(2);
    expect(drive.save.mock.calls[1]).toEqual(drive.save.mock.calls[0]);
    expect(drive.files.size).toBe(1);
  });

  it("keeps a take the drive refuses for the next window, which saves it", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    const title = await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    expect([...drive.held.values()].map((take) => take.title)).toEqual([title]);
    unmount();

    // The next window is refused too: the row is there, and nothing is lost.
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    const next = render(<VoiceMemosApp drive={drive} />);
    expect(await findNotSaved()).toHaveTextContent(`${title}Not saved`);
    expect(drive.held.size).toBe(1);
    next.unmount();

    // The one after is not: the drive has it, once, and the browser no longer holds it.
    render(<VoiceMemosApp drive={drive} />);
    await waitFor(() => expect(drive.files.size).toBe(1));
    await waitFor(() => expect(drive.held.size).toBe(0));
    expect(screen.queryByRole("option", { name: /Not saved/ })).toBeNull();
  });

  it("keeps a take under way for the next window when the drive refuses it as the window closes", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    const title = await takeTitle();
    unmount();
    await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(drive.held.size).toBe(1));
    render(<VoiceMemosApp drive={drive} />);
    await waitFor(() => expect(drive.files.size).toBe(1));
    expect([...drive.files.values()][0]?.memo.title).toBe(title);
    await waitFor(() => expect(drive.held.size).toBe(0));
  });

  it("forgets a held take the person discards", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(within(await screen.findByRole("alert")).getByRole("button", { name: "OK" }));
    await user.click(button("Discard"));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(drive.held.size).toBe(0));
  });

  it("offers no Retry or Discard until the browser has answered about a finished take", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    let finishPut = () => {};
    drive.place.put = () =>
      new Promise((resolve) => {
        finishPut = resolve;
      });
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await waitFor(() => expect(button("Discard")).toHaveAttribute("aria-disabled", "true"));
    expect(button("Retry")).toHaveAttribute("aria-disabled", "true");
    expect(drive.save).not.toHaveBeenCalled();
    finishPut();
    await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button("Discard")).not.toHaveAttribute("aria-disabled", "true"));
  });

  it("does not promise to keep a take under way, which the browser may not have room for", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    render(<VoiceMemosApp drive={drive} onClose={() => {}} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Close"));
    expect(await screen.findByText(/if it has the room; if not, it is lost/)).toBeInTheDocument();
  });

  it("names the session it was recorded under, and keeps the take when that is refused", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    drive.save.mockRejectedValueOnce(new Error("Someone else has signed in."));
    setDesktopSession("session-a");
    onTestFinished(() => {
      setDesktopSession(null);
    });
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else has signed in");
    expect(notSaved()).toBeInTheDocument();
    expect(drive.save.mock.calls[0]?.[3]).toBe("session-a");
    expect(drive.held.size).toBe(1);
  });

  it("saves, naming the session, where the browser cannot hold a take", async () => {
    const user = userEvent.setup();
    const drive = Object.assign(memoryDrive(), { holding: async () => null });
    setDesktopSession("session-a");
    onTestFinished(() => {
      setDesktopSession(null);
    });
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot keep a copy");
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await waitFor(() => expect(drive.files.size).toBe(1));
    expect(drive.save.mock.calls[0]?.[3]).toBe("session-a");
  });

  it("offers no Retry while a discarded take is being forgotten", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    let finishRemove = () => {};
    const remove = drive.place.remove;
    drive.place.remove = (id) =>
      new Promise((resolve) => {
        finishRemove = () => void remove(id).then(resolve);
      });
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(within(await screen.findByRole("alert")).getByRole("button", { name: "OK" }));
    await user.click(button("Discard"));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => expect(button("Retry")).toHaveAttribute("aria-disabled", "true"));
    finishRemove();
    await waitFor(() => expect(screen.queryByRole("option", { name: /Not saved/ })).toBeNull());
    expect(drive.held.size).toBe(0);
    expect(drive.save).toHaveBeenCalledTimes(1);
  });

  it("warns of the loss when the browser would not hold a refused take", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    drive.place.put = () => Promise.reject(new Error("The store is full."));
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} onClose={() => {}} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(button("Close"));
    expect(await screen.findByText(/closing the window loses it/)).toBeInTheDocument();
    expect(screen.queryByText(/waits in this browser/)).toBeNull();
  });

  it("keeps the row, and says so, when the browser will not forget a discarded take", async () => {
    const user = userEvent.setup();
    const drive = withHolding(memoryDrive());
    drive.place.remove = () => Promise.reject(new Error("The store is locked."));
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(within(await screen.findByRole("alert")).getByRole("button", { name: "OK" }));
    await user.click(button("Discard"));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be discarded");
    expect(notSaved()).toBeInTheDocument();
  });

  it("leaves a refused take recoverable after another recording is made and saved", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    const refused = await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    // Another take, which the drive keeps: its own notices replace nothing the person needs.
    await user.click(button("New Recording"));
    const second = await takeTitle();
    expect(second).not.toBe(refused);
    await user.click(button("Done"));
    await waitFor(() => expect(drive.files.size).toBe(1));
    await waitFor(() => expect(rows()).toHaveLength(2));
    // The refused take is still a row, and still saves, under its own name.
    expect(notSaved()).toHaveTextContent(`${refused}Not saved`);
    await user.click(notSaved());
    await user.click(button("Retry"));
    await waitFor(() => expect(drive.files.size).toBe(2));
    expect([...drive.files.values()].map((file) => file.memo.name).sort()).toEqual(
      [`${refused}.webm`, `${second}.webm`].sort(),
    );
    expect(screen.queryByRole("option", { name: /Not saved/ })).toBeNull();
  });

  it("never saves a take twice: a retry waits for the save under way, and a lost answer makes no copy", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    const save = drive.save.getMockImplementation();
    // The drive keeps the file, but its answer is lost on the way back.
    drive.save.mockImplementationOnce(async (blob, name) => {
      await save?.(blob, name);
      throw new Error("The connection was lost.");
    });
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    expect(drive.files.size).toBe(1);
    // A slow retry: while it is under way the row says so, and Retry and Discard wait.
    let answer: () => void = () => {};
    drive.save.mockImplementationOnce(
      (blob, name) =>
        new Promise<VoiceMemoFile>((resolve, reject) => {
          answer = () => void save?.(blob, name).then(resolve, reject);
        }),
    );
    await user.click(button("Retry"));
    expect(screen.getByRole("option", { name: /Saving/ })).toBeInTheDocument();
    expect(button("Retry")).toHaveAttribute("aria-disabled", "true");
    expect(button("Discard")).toHaveAttribute("aria-disabled", "true");
    await user.click(button("Retry"));
    expect(drive.save).toHaveBeenCalledTimes(2);
    await act(async () => answer());
    // The retry used the same name, so the drive answered the file it had: one copy.
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /Saving|Not saved/ })).toBeNull(),
    );
    expect(drive.save).toHaveBeenCalledTimes(2);
    expect(drive.save.mock.calls[1]?.[1]).toMatch(TAKE_FILE);
    expect(drive.save.mock.calls[1]?.[1]).toBe(drive.save.mock.calls[0]?.[1]);
    expect(drive.files.size).toBe(1);
    expect(rows()).toHaveLength(1);
  });

  it("keeps a take unsaved when another recording of its size already has its name", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    const save = drive.save.getMockImplementation();
    // Another recording of exactly the same size took the take's name before it was saved.
    drive.save.mockImplementationOnce(async (blob, name) => {
      const other = new Blob([new Uint8Array(blob.size).fill(7)], { type: blob.type });
      await save?.(other, name);
      throw new Error("The connection was lost.");
    });
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(button("Retry"));
    // Same name, same size, other bytes: not this take, so it stays unsaved, and nothing is lost.
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists in that folder");
    expect(notSaved()).toBeInTheDocument();
    expect(drive.files.size).toBe(1);
  });

  it("discards a take that is not saved only once the person confirms", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    const title = await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(button("Discard"));
    let sheet = await screen.findByRole("dialog", { name: `Discard “${title}”?` });
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(notSaved()).toBeInTheDocument();
    await user.click(button("Discard"));
    sheet = await screen.findByRole("dialog", { name: `Discard “${title}”?` });
    await user.click(within(sheet).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /Not saved/ })).toBeNull());
    expect(drive.save).toHaveBeenCalledTimes(1);
    expect(drive.files.size).toBe(0);
  });

  it("asks before the window or the page closes on a take that is not saved", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    const onClose = vi.fn();
    render(<VoiceMemosApp drive={drive} onClose={onClose} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    // Nothing held: the window closes at once, and the page leaves without asking.
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(leave()).toBe(false);

    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    expect(leave()).toBe(true);
    await user.click(button("Close"));
    let sheet = await screen.findByRole("dialog", { name: "Close Voice Memos?" });
    expect(sheet).toHaveTextContent("A recording is not saved; closing the window loses it.");
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(button("Close"));
    sheet = await screen.findByRole("dialog", { name: "Close Voice Memos?" });
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("warns of every take closing would lose: one under way and one not saved", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    const onClose = vi.fn();
    render(<VoiceMemosApp drive={drive} onClose={onClose} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Done"));
    await findNotSaved();
    await user.click(button("New Recording"));
    await takeTitle();
    await user.click(button("Close"));
    const sheet = await screen.findByRole("dialog", { name: "Close Voice Memos?" });
    expect(sheet).toHaveTextContent("A recording is under way:");
    expect(sheet).toHaveTextContent("A recording is not saved; closing the window loses it.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks before closing while the microphone is still being asked for", async () => {
    const user = userEvent.setup();
    let grant: () => void = () => {};
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = () => {
            const track = { stop: vi.fn() };
            tracks.push(track);
            resolve({ getTracks: () => [track] } as unknown as MediaStream);
          };
        }),
    );
    const drive = memoryDrive();
    const onClose = vi.fn();
    render(<VoiceMemosApp drive={drive} onClose={onClose} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    // The permission prompt is open: closing the window or leaving the page asks first.
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(button("Close"));
    const sheet = await screen.findByRole("dialog", { name: "Close Voice Memos?" });
    expect(sheet).toHaveTextContent("A recording is under way:");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    // Granted, the take runs in this window as usual.
    await act(async () => grant());
    await takeTitle();
    expect(button("Pause Recording")).toBeEnabled();
  });

  it("keeps a take whose microphone opened only after the window closed", async () => {
    const user = userEvent.setup();
    let grant: () => void = () => {};
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = () => {
            const track = { stop: vi.fn() };
            tracks.push(track);
            resolve({ getTracks: () => [track] } as unknown as MediaStream);
          };
        }),
    );
    const drive = memoryDrive();
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => grant());
    await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
    expect(drive.save.mock.calls[0]?.[1]).toMatch(TAKE_FILE);
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  it("keeps a take that is under way when the window closes", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    const { unmount } = render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    const title = await takeTitle();
    unmount();
    await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
    expect(drive.save.mock.calls[0]?.[1]).toBe(`${title}.webm`);
    expect(tracks[0]?.stop).toHaveBeenCalled();
  });

  it("ends a take at the longest a recording gets, also in a page that gets no animation frames", async () => {
    // A hidden page: no animation frame ever comes, while timers still run.
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const drive = memoryDrive();
      render(<VoiceMemosApp drive={drive} />);
      await screen.findByRole("region", { name: "Voice Memos" });
      await user.click(button("New Recording"));
      await takeTitle();
      now += MAX_DURATION * 1000;
      await act(() => vi.advanceTimersByTimeAsync(61_000));
      await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
      expect(recorders[0]?.state).toBe("inactive");
      expect(tracks[0]?.stop).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps what was recorded, and releases the microphone, when the recorder stops by itself", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    const recorder = recorders[0] as FakeMediaRecorder;
    act(() => {
      recorder.dispatchEvent(
        Object.assign(new Event("error"), {
          error: new DOMException("Device lost", "UnknownError"),
        }),
      );
      // The recorder ends on its own, as it does when it fails or its input goes away.
      recorder.stop();
    });
    await waitFor(() => expect(drive.save).toHaveBeenCalledTimes(1));
    expect(drive.save.mock.calls[0]?.[1]).toMatch(TAKE_FILE);
    expect(tracks[0]?.stop).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The recording stopped (Device lost). What was recorded is kept.",
    );
    // The window is back on the list, with no take running.
    expect(button("New Recording")).toBeEnabled();
  });

  it("keeps a take the recorder ended by itself as a Not saved row when the drive refuses it", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    drive.save.mockRejectedValueOnce(new Error("The drive is full."));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    act(() => (recorders[0] as FakeMediaRecorder).stop());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be saved: The drive is full.",
    );
    await user.click(button("Retry"));
    await waitFor(() => expect(drive.files.size).toBe(1));
    expect(drive.save.mock.calls[1]?.[0]).toBe(drive.save.mock.calls[0]?.[0]);
  });

  it("keeps a take under way on its own drive when the window is given another", async () => {
    const user = userEvent.setup();
    const first = memoryDrive();
    const second = memoryDrive();
    const { rerender } = render(<VoiceMemosApp drive={first} />);
    await screen.findByRole("region", { name: "Voice Memos" });
    await user.click(button("New Recording"));
    await takeTitle();
    rerender(<VoiceMemosApp drive={second} />);
    await waitFor(() => expect(first.save).toHaveBeenCalledTimes(1));
    expect(second.save).not.toHaveBeenCalled();
    expect(tracks[0]?.stop).toHaveBeenCalled();
    // The window of the other drive starts with no take.
    expect(await screen.findByRole("button", { name: "New Recording" })).toBeEnabled();
  });

  it("shows only the recordings of the drive it is given, after that drive changes", async () => {
    const first = memoryDrive([{ name: "Ada's memo.wav", seconds: 1, created: Date.now() }]);
    const second = memoryDrive([{ name: "Bob's memo.wav", seconds: 1, created: Date.now() }]);
    const { rerender } = render(<VoiceMemosApp drive={first} />);
    await waitFor(() => expect(rows()[0]).toHaveTextContent(/^Ada's memo/));
    rerender(<VoiceMemosApp drive={second} />);
    await waitFor(() => expect(rows()[0]).toHaveTextContent(/^Bob's memo/));
    expect(rows()).toHaveLength(1);
  });

  it("renames a recording from its row, keeping its extension", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([
      { name: "New Recording.webm", seconds: 1, created: Date.now() },
      { name: "Taken.ogg", seconds: 1, created: Date.now() - 1000 },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "New Recording" });
    // A double click on the row, or Return, makes its title a field, which holds the title.
    await user.dblClick(row(/^New Recording/));
    const field = await screen.findByRole("textbox", { name: "Recording name" });
    expect(field).toHaveValue("New Recording");
    expect(field).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.clear(field);
    await user.type(field, "Interview{Enter}");
    await waitFor(() =>
      expect(drive.rename).toHaveBeenCalledWith(idOf(drive, "Interview.webm"), "Interview.webm"),
    );
    expect(drive.rename).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(row(/^Interview/)).toBeInTheDocument());
    expect(screen.queryByRole("textbox", { name: "Recording name" })).toBeNull();
    expect(screen.getByRole("region", { name: "Interview" })).toBeInTheDocument();

    // Return on the list does the same, and Escape leaves the title as it was.
    await user.keyboard("{Enter}");
    const again = await screen.findByRole("textbox", { name: "Recording name" });
    await user.type(again, "X{Delete}{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Recording name" })).toBeNull(),
    );
    expect(drive.rename).toHaveBeenCalledTimes(1);
    expect(drive.trash).not.toHaveBeenCalled();

    // The toolbar's Rename is a sheet: a menu can ask for it with the list hidden.
    await user.click(button("Rename"));
    const sheet = await screen.findByRole("dialog", { name: "Rename Recording" });
    const second = within(sheet).getByRole("textbox", { name: "Recording name" });
    await user.clear(second);
    await user.type(second, "Talk");
    await user.click(within(sheet).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(drive.rename).toHaveBeenCalledTimes(2));
    expect(drive.rename.mock.calls[1]?.[1]).toBe("Talk.webm");
    await waitFor(() => expect(screen.getByRole("region", { name: "Talk" })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the drive refuses a name", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([
      { name: "One.wav", seconds: 1, created: Date.now() },
      { name: "Two.wav", seconds: 1, created: Date.now() - 1000 },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "One" });
    await user.click(button("Rename"));
    const sheet = await screen.findByRole("dialog", { name: "Rename Recording" });
    const field = within(sheet).getByRole("textbox", { name: "Recording name" });
    await user.clear(field);
    await user.type(field, "two");
    await user.click(within(sheet).getByRole("button", { name: "Rename" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "“One” could not be renamed: an item named “two.wav” already exists in that folder",
    );
    expect(row(/^One/)).toBeInTheDocument();
  });

  it("moves a recording to the drive's Trash with Delete, and shows the next", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([
      { name: "One.wav", seconds: 1, created: Date.now() - 2000 },
      { name: "Two.wav", seconds: 1, created: Date.now() - 1000 },
      { name: "Three.wav", seconds: 1, created: Date.now() },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Three" });
    await user.click(row(/^Two/));
    await user.click(button("Delete"));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(drive.trash).toHaveBeenCalledTimes(1);
    expect(drive.trashed.map((memo) => memo.name)).toEqual(["Two.wav"]);
    expect(screen.getByRole("region", { name: "One" })).toBeInTheDocument();

    // The Delete key in the list does the same.
    screen.getByRole("listbox", { name: "Recordings" }).focus();
    await user.keyboard("{Delete}");
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(drive.trashed.map((memo) => memo.name)).toEqual(["Two.wav", "One.wav"]);
  });

  it("trims a recording into a WAV file that replaces it, and lists the shorter length", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Speech.webm", seconds: 3, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Speech" });
    await loaded(3);
    await waitFor(() => expect(position()).toHaveAttribute("max", "3"));
    await user.click(button("Edit"));
    await user.click(button("Trim"));
    expect(button("Trim")).toHaveAttribute("aria-pressed", "true");
    const start = screen.getByRole("slider", { name: "Trim start" });
    const end = screen.getByRole("slider", { name: "Trim end" });
    expect(start).toHaveAttribute("aria-valuetext", "00:00.00");
    expect(end).toHaveAttribute("aria-valuetext", "00:03.00");
    // Page Up and Page Down move a handle a second; the playhead marks the cut.
    start.focus();
    await user.keyboard("{PageUp}");
    expect(start).toHaveAttribute("aria-valuetext", "00:01.00");
    expect(audio().currentTime).toBe(1);
    end.focus();
    await user.keyboard("{PageDown}");
    expect(end).toHaveAttribute("aria-valuetext", "00:02.00");

    await user.click(button("Save"));
    await waitFor(() => expect(drive.replace).toHaveBeenCalledTimes(1));
    const [original, blob, name] = drive.replace.mock.calls[0] ?? [];
    expect(original?.name).toBe("Speech.webm");
    expect(name).toBe("Speech.wav");
    expect(blob?.type).toBe("audio/wav");
    // One second of mono 16-bit samples at the file's rate, after the 44-byte header.
    expect(blob?.size).toBe(44 + RATE * 2);
    // The trimmed file replaces the original, is shown with its length, and the editing view
    // stays; the list behind Done has it in the original's place.
    await waitFor(() => expect(position()).toHaveAttribute("max", "1"));
    expect(screen.getByRole("region", { name: "Speech" })).toBeInTheDocument();
    expect(drive.trashed.map((memo) => memo.name)).toEqual(["Speech.webm"]);
    expect(screen.queryByRole("slider", { name: "Trim start" })).toBeNull();
    expect(button("Trim")).toHaveAttribute("aria-pressed", "false");
    await user.click(button("Done"));
    expect(rows().map((option) => option.textContent)).toEqual(["SpeechToday00:01"]);
    expect(drive.files.get(idOf(drive, "Speech.wav") ?? "")?.blob).toBe(blob);
  });

  it("cancels a trim, and saves nothing for a trim that keeps the whole recording", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Speech.wav", seconds: 2, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Speech" });
    await loaded(2);
    await user.click(button("Edit"));
    await waitFor(() => expect(button("Trim")).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(button("Trim"));
    await user.click(button("Cancel"));
    expect(screen.queryByRole("slider", { name: "Trim start" })).toBeNull();
    expect(timer()).toBe("00:00.00");
    await user.click(button("Trim"));
    await user.click(button("Save"));
    expect(drive.replace).not.toHaveBeenCalled();
    expect(button("Done")).toBeEnabled();
  });

  /** Opens the recording's trim, the handles holding one second to two of its three. */
  async function trimmingMiddleOfThree(user: ReturnType<typeof userEvent.setup>) {
    const drive = memoryDrive([{ name: "Speech.wav", seconds: 3, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Speech" });
    await loaded(3);
    await user.click(button("Edit"));
    await waitFor(() => expect(button("Trim")).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(button("Trim"));
    const start = screen.getByRole("slider", { name: "Trim start" });
    const end = screen.getByRole("slider", { name: "Trim end" });
    start.focus();
    await user.keyboard("{PageUp}");
    end.focus();
    await user.keyboard("{PageDown}");
    return drive;
  }

  it("keeps the handles' stretch on Trim, shows it, and saves only on Save", async () => {
    const user = userEvent.setup();
    const drive = await trimmingMiddleOfThree(user);
    await user.click(button("Trim to Selection"));
    await waitFor(() => expect(position()).toHaveAttribute("max", "1"));
    expect(drive.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("slider", { name: "Trim end" })).toHaveAttribute(
      "aria-valuetext",
      "00:01.00",
    );
    await user.click(button("Save"));
    await waitFor(() => expect(drive.replace).toHaveBeenCalledTimes(1));
    expect(drive.replace.mock.calls[0]?.[1]?.size).toBe(44 + RATE * 2);
  });

  it("removes the handles' stretch on Delete, keeping what is around it", async () => {
    const user = userEvent.setup();
    const drive = await trimmingMiddleOfThree(user);
    await user.click(button("Delete Selection"));
    await waitFor(() => expect(position()).toHaveAttribute("max", "2"));
    await user.click(button("Save"));
    await waitFor(() => expect(drive.replace).toHaveBeenCalledTimes(1));
    expect(drive.replace.mock.calls[0]?.[1]?.size).toBe(44 + 2 * RATE * 2);
  });

  it("undoes, redoes and reverts edits, and Cancel leaves the recording as it was", async () => {
    const user = userEvent.setup();
    const drive = await trimmingMiddleOfThree(user);
    await user.click(button("Delete Selection"));
    await waitFor(() => expect(position()).toHaveAttribute("max", "2"));
    await user.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => expect(position()).toHaveAttribute("max", "3"));
    await user.keyboard("{Meta>}{Shift>}z{/Shift}{/Meta}");
    await waitFor(() => expect(position()).toHaveAttribute("max", "2"));
    await user.click(button("Revert"));
    await waitFor(() => expect(position()).toHaveAttribute("max", "3"));
    expect(button("Revert")).toBeDisabled();
    await user.click(button("Cancel"));
    expect(screen.queryByRole("slider", { name: "Trim start" })).toBeNull();
    expect(drive.replace).not.toHaveBeenCalled();
  });

  it("has no Replace or Resume on a recording longer than a WAV file of the drive holds", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Lecture.wav", seconds: 800, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Lecture" });
    await loaded(800);
    await user.click(button("Edit"));
    await waitFor(() => expect(button("Trim")).not.toHaveAttribute("aria-disabled", "true"));
    const replace = button("Replace Recording");
    expect(replace).toBeDisabled();
    expect(replace).toHaveAttribute(
      "title",
      "A changed recording is saved uncompressed, and the drive holds 12 minutes of that in a file.",
    );
  });

  it("keeps what was recorded onto a saved recording as its own when the change fails", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Speech.wav", seconds: 3, created: Date.now() }]);
    drive.replace.mockRejectedValue(new Error("the drive said no"));
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Speech" });
    await loaded(3);
    await user.click(button("Edit"));
    await waitFor(() => expect(button("Replace Recording")).toBeEnabled());
    await user.click(button("Replace Recording"));
    await user.click(await screen.findByRole("button", { name: "Pause Recording" }));
    await user.click(button("Done"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /“Speech” could not be changed: the drive said no\. What you recorded is kept as “New Recording”/,
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(drive.save.mock.calls[0]?.[1]).toBe("New Recording.webm");
    expect([...drive.files.values()].map((file) => file.memo.name)).toContain("Speech.wav");
  });

  it("splices a take over a saved recording from the playhead, in one new file", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive([{ name: "Speech.wav", seconds: 3, created: Date.now() }]);
    render(<VoiceMemosApp drive={drive} />);
    await screen.findByRole("region", { name: "Speech" });
    await loaded(3);
    await user.click(button("Edit"));
    await waitFor(() => expect(button("Replace Recording")).toBeEnabled());
    await user.click(button("Replace Recording"));
    await user.click(await screen.findByRole("button", { name: "Pause Recording" }));
    await user.click(button("Done"));
    await waitFor(() => expect(drive.replace).toHaveBeenCalledTimes(1));
    const [original, blob, name] = drive.replace.mock.calls[0] ?? [];
    expect(original?.name).toBe("Speech.wav");
    expect(name).toBe("Speech.wav");
    // The fake take is a second, written over the first of the three.
    expect(blob?.size).toBe(44 + 3 * RATE * 2);
    expect(drive.save).not.toHaveBeenCalled();
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it("takes several rows: Command-click adds one, and Delete moves them all", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const drive = memoryDrive([
      { name: "One.wav", seconds: 1, created: now },
      { name: "Two.wav", seconds: 1, created: now - 1 },
      { name: "Three.wav", seconds: 1, created: now - 2 },
    ]);
    render(<VoiceMemosApp drive={drive} />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.click(row(/^One/));
    await user.keyboard("{Meta>}");
    await user.click(row(/^Three/));
    await user.keyboard("{/Meta}");
    expect(row(/^One/)).toHaveAttribute("aria-selected", "true");
    expect(row(/^Three/)).toHaveAttribute("aria-selected", "true");
    expect(row(/^Two/)).toHaveAttribute("aria-selected", "false");
    await waitFor(() => expect(button("Rename")).toHaveAttribute("aria-disabled", "true"));
    await user.click(button("Delete"));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(drive.trashed.map((memo) => memo.name).sort()).toEqual(["One.wav", "Three.wav"]);
    expect(row(/^Two/)).toHaveAttribute("aria-selected", "true");
  });

  it("says when a recording cannot be read or played", async () => {
    const drive = memoryDrive([{ name: "Lost.wav", seconds: 1, created: Date.now() }]);
    drive.read.mockRejectedValue(new Error("The drive could not be reached."));
    render(<VoiceMemosApp drive={drive} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The recording could not be read: The drive could not be reached.",
    );
    expect(button("Play")).toBeDisabled();
    // Its length stays unknown, and the list says so.
    expect(row(/^Lost/)).toHaveTextContent("--:--");
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/** The Edit menu as the menu bar shows it: its popup mounts, and reads the keyboard, as it opens. */
function EditMenu() {
  const items = useDesktopAppMenuItems("voice-memos", "Edit");
  return (
    <Menu>
      <MenuTrigger>Open Edit</MenuTrigger>
      <MenuPopup aria-label="Edit">{items}</MenuPopup>
    </Menu>
  );
}
const editRow = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Open Edit" }));
  return screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
};
const closeEdit = async () => {
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
};
const STANDARD_ROWS = ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"];

describe("Voice Memos' Edit menu", () => {
  const twoMemos = () =>
    memoryDrive([
      { name: "Speech.wav", seconds: 3, created: Date.now() },
      { name: "Song.wav", seconds: 2, created: Date.now() - DAY },
    ]);
  const chosen = () =>
    rows()
      .filter((each) => each.getAttribute("aria-selected") === "true")
      .map((each) => each.textContent?.match(/^(Speech|Song)/)?.[0]);

  it("has every standard row, Cut to Paste dimmed with a reason while no field has the keyboard", async () => {
    render(
      <>
        <VoiceMemosApp drive={twoMemos()} />
        <EditMenu />
      </>,
    );
    await screen.findByRole("region", { name: "Speech" });
    await editRow("Undo");
    for (const name of STANDARD_ROWS) {
      expect(screen.getByRole("menuitem", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    for (const name of ["Cut", "Copy", "Paste"]) {
      const dimmed = screen.getByRole("menuitem", { name: new RegExp(`^${name}`) });
      expect(dimmed).toHaveAttribute("aria-disabled", "true");
      expect(dimmed).toHaveAttribute("title", "Click in the search field, or select text, first.");
    }
    await closeEdit();
  });

  it("chooses every recording with Select All, and the recording shown stays", async () => {
    render(
      <>
        <VoiceMemosApp drive={twoMemos()} />
        <EditMenu />
      </>,
    );
    await screen.findByRole("region", { name: "Speech" });
    expect(chosen()).toEqual(["Speech"]);
    fireEvent.click(await editRow("Select All"));
    await waitFor(() => expect(chosen()).toEqual(["Speech", "Song"]));
    expect(screen.getByRole("region", { name: "Speech" })).toBeInTheDocument();
  });

  it("chooses only the recordings a search lists, with Command-A in the list", async () => {
    render(<VoiceMemosApp drive={twoMemos()} />);
    await screen.findByRole("region", { name: "Speech" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search recordings" }), {
      target: { value: "song" },
    });
    expect(rows()).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Recordings" }), {
      key: "a",
      metaKey: true,
    });
    await waitFor(() => expect(chosen()).toEqual(["Song"]));
    expect(screen.getByRole("region", { name: "Song" })).toBeInTheDocument();
  });

  it("leaves Command-A in the search field to the field", async () => {
    render(<VoiceMemosApp drive={twoMemos()} />);
    await screen.findByRole("region", { name: "Speech" });
    const pressed = fireEvent.keyDown(
      screen.getByRole("searchbox", { name: "Search recordings" }),
      {
        key: "a",
        metaKey: true,
      },
    );
    expect(pressed).toBe(true);
    expect(chosen()).toEqual(["Speech"]);
  });

  it("acts on the search field that has the keyboard", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <>
        <VoiceMemosApp drive={twoMemos()} />
        <EditMenu />
      </>,
    );
    await screen.findByRole("region", { name: "Speech" });
    const field = screen.getByRole("searchbox", { name: "Search recordings" }) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "song" } });
    act(() => field.focus());
    field.setSelectionRange(0, 4);
    const cut = await editRow("Cut");
    expect(cut).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(cut);
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("cut"));
    fireEvent.click(await editRow("Select All"));
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("selectAll"));
    expect(chosen()).toEqual([]);
    act(() => field.blur());
  });

  it("while trimming, says why the clipboard rows are dimmed, and Select All holds the whole recording", async () => {
    const user = userEvent.setup();
    render(
      <>
        <VoiceMemosApp
          drive={memoryDrive([{ name: "Speech.wav", seconds: 3, created: Date.now() }])}
        />
        <EditMenu />
      </>,
    );
    await screen.findByRole("region", { name: "Speech" });
    await loaded(3);
    await user.click(button("Edit"));
    await waitFor(() => expect(button("Trim")).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(button("Trim"));
    const start = screen.getByRole("slider", { name: "Trim start" });
    start.focus();
    await user.keyboard("{PageUp}");
    expect(start).not.toHaveAttribute("aria-valuenow", "0");
    const cut = await editRow("Cut");
    expect(cut).toHaveAttribute("aria-disabled", "true");
    expect(cut).toHaveAttribute(
      "title",
      "A browser takes no sound onto the clipboard. Trim and Delete change the recording here.",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /^Select All/ }));
    await waitFor(() => expect(start).toHaveAttribute("aria-valuenow", "0"));
  });

  it("dims Select All, saying why, while the list is hidden", async () => {
    const user = userEvent.setup();
    render(
      <>
        <VoiceMemosApp drive={twoMemos()} />
        <EditMenu />
      </>,
    );
    await screen.findByRole("region", { name: "Speech" });
    await user.click(button("Edit"));
    const all = await editRow("Select All");
    expect(all).toHaveAttribute("aria-disabled", "true");
    expect(all).toHaveAttribute("title", "The list of recordings is hidden: click Done first.");
    await closeEdit();
  });
});
