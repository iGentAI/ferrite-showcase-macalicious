import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type QuickTimeDrive, QuickTimePlayerApp } from "./quicktime-player-app";
import { QuickTimeRecording } from "./quicktime-player-recording";
import { unsavedTakes } from "./quicktime-player-unsaved-takes";

/*
 * Test doubles: `FakeRecorder` stands in for MediaRecorder, `fakeStream` for what the browser's
 * getUserMedia and getDisplayMedia answer, and a memory drive for the person's drive. Real recording
 * through the real drive is e2e/quicktime-recording-journey.mjs.
 */
const fakeTrack = (kind: "audio" | "video") => ({
  kind,
  stop: vi.fn(),
  addEventListener: vi.fn(),
  getSettings: () => ({ deviceId: "device" }),
});
const fakeStream = (kinds: ("audio" | "video")[] = ["video"]) => {
  const tracks = kinds.map(fakeTrack);
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
  } as unknown as MediaStream & { getTracks(): ReturnType<typeof fakeTrack>[] };
};

class FakeRecorder extends EventTarget {
  static made: FakeRecorder[] = [];
  static refuse = false;
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "video/webm";
  constructor() {
    super();
    if (FakeRecorder.refuse) throw new DOMException("no", "NotSupportedError");
    FakeRecorder.made.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    const data = new Event("dataavailable") as Event & { data: Blob };
    data.data = new Blob(["frames"], { type: "video/webm" });
    this.dispatchEvent(data);
    this.dispatchEvent(new Event("stop"));
  }
}

const getUserMedia = vi.fn();
const getDisplayMedia = vi.fn();

beforeEach(() => {
  FakeRecorder.made = [];
  FakeRecorder.refuse = false;
  getUserMedia.mockReset();
  getDisplayMedia.mockReset();
  getUserMedia.mockImplementation(async () => fakeStream(["audio"]));
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "MediaStream",
    class {
      constructor(readonly tracks: ReturnType<typeof fakeTrack>[]) {}
      getTracks = () => this.tracks;
      getVideoTracks = () => this.tracks.filter((track) => track.kind === "video");
      getAudioTracks = () => this.tracks.filter((track) => track.kind === "audio");
    },
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = async () => {};
      close = async () => {};
      createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
      createAnalyser = () => ({ fftSize: 1024, getByteTimeDomainData() {} });
    },
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, getDisplayMedia, enumerateDevices: async () => [] },
  });
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:take"), revokeObjectURL: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ recents: null, rev: 0 }), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const take of unsavedTakes.list()) unsavedTakes.remove(take.file);
});

const screenWindow = () => (
  <QuickTimeRecording
    kind="screen"
    busy={null}
    onFinished={async () => {}}
    onTakingChange={() => {}}
  />
);
const startButton = () =>
  screen.getByRole("button", { name: "Start Recording" }) as HTMLButtonElement;

describe("A screen recording's picker", () => {
  it("starts nothing when it answers after the window closed, and stops what it gave", async () => {
    let answer: (stream: MediaStream) => void = () => {};
    getDisplayMedia.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { unmount } = render(screenWindow());
    fireEvent.click(startButton());
    unmount();
    const display = fakeStream();
    await act(async () => answer(display));
    expect(display.getTracks()[0]?.stop).toHaveBeenCalledTimes(1);
    expect(FakeRecorder.made).toHaveLength(0);
  });

  it("is asked once however often Start Recording is pressed while it is open", async () => {
    let answer: (stream: MediaStream) => void = () => {};
    getDisplayMedia.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    render(screenWindow());
    const button = startButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.keyDown(button.closest(".mac-quicktime-player-recording") as Element, { key: " " });
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => answer(fakeStream()));
    expect(FakeRecorder.made).toHaveLength(1);
  });

  it("stops the screen and the microphone when the recorder cannot be made", async () => {
    FakeRecorder.refuse = true;
    const display = fakeStream();
    const voice = fakeStream(["audio"]);
    getDisplayMedia.mockResolvedValue(display);
    getUserMedia.mockResolvedValue(voice);
    render(screenWindow());
    fireEvent.click(screen.getByRole("button", { name: "Recording Options" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Microphone" }));
    await act(async () => fireEvent.click(startButton()));
    expect(display.getTracks()[0]?.stop).toHaveBeenCalledTimes(1);
    expect(voice.getTracks()[0]?.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("could not be started");
  });
});

describe("A screen recording's timer", () => {
  it("counts down with the screen chosen, then records; a press takes it back and stops the screen", async () => {
    const display = fakeStream();
    getDisplayMedia.mockResolvedValue(display);
    render(screenWindow());
    fireEvent.click(screen.getByRole("button", { name: "Recording Options" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "5 Seconds" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    vi.useFakeTimers();
    try {
      await act(async () => fireEvent.click(startButton()));
      expect(FakeRecorder.made).toHaveLength(0);
      expect(screen.getByLabelText("Recording starts in")).toHaveTextContent("5");
      await act(async () => vi.advanceTimersByTime(4000));
      expect(screen.getByLabelText("Recording starts in")).toHaveTextContent("1");
      expect(FakeRecorder.made).toHaveLength(0);
      await act(async () => vi.advanceTimersByTime(1000));
      expect(FakeRecorder.made).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Stop Recording" })).toBeInTheDocument();
      await act(async () => {
        FakeRecorder.made[0]?.stop();
      });

      const again = fakeStream();
      getDisplayMedia.mockResolvedValue(again);
      await act(async () => fireEvent.click(startButton()));
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Cancel Countdown" })),
      );
      await act(async () => vi.advanceTimersByTime(6000));
      expect(FakeRecorder.made).toHaveLength(1);
      expect(again.getTracks()[0]?.stop).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rings a press on the page while a take runs with Show Mouse Clicks on, and not otherwise", async () => {
    const display = fakeStream();
    getDisplayMedia.mockResolvedValue(display);
    render(screenWindow());
    const rings = () => document.querySelectorAll(".mac-quicktime-player-click-ring");
    fireEvent.click(screen.getByRole("button", { name: "Recording Options" }));
    const row = await screen.findByRole("menuitemcheckbox", { name: "Show Mouse Clicks" });
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(row).toHaveAttribute("title", expect.stringMatching(/only clicks made in it/));
    fireEvent.click(row);
    fireEvent.pointerDown(document.body, { clientX: 10, clientY: 20 });
    expect(rings()).toHaveLength(0);
    await act(async () => fireEvent.click(startButton()));
    await waitFor(() => expect(FakeRecorder.made).toHaveLength(1));
    fireEvent.pointerDown(document.body, { clientX: 10, clientY: 20 });
    expect(rings()).toHaveLength(1);
    expect((rings()[0] as HTMLElement).style.left).toBe("10px");
    expect((rings()[0] as HTMLElement).style.top).toBe("20px");
    await waitFor(() => expect(rings()).toHaveLength(0));
  });
});

describe("A take the drive refuses", () => {
  it("is offered again after its window closed, and saves the same file", async () => {
    const sent: File[] = [];
    let refuse = true;
    const drive: QuickTimeDrive = {
      movies: async () => [],
      upload: async (file) => {
        sent.push(file);
        if (refuse) throw new Error("the drive is full");
        return { id: "f1", name: file.name, size: file.size, type: file.type };
      },
      read: async () => new Blob(["frames"], { type: "video/webm" }),
    };
    const first = render(<QuickTimePlayerApp drive={drive} served={false} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "From This Computer…" })).toBeTruthy(),
    );
    fireEvent.keyDown(document.querySelector(".mac-quicktime-player-open") as Element, {
      code: "KeyN",
      metaKey: true,
      altKey: true,
    });
    const start = await screen.findByRole("button", { name: "Start Recording" });
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(start);
    await screen.findByRole("button", { name: "Stop Recording" });
    await act(async () => first.unmount());
    expect(sent).toHaveLength(1);
    expect(unsavedTakes.list().map((take) => take.reason)).toEqual(["the drive is full"]);

    refuse = false;
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    const again = await screen.findByRole("button", { name: "Try Again" });
    expect(screen.getByRole("alert").textContent).toContain("the drive is full");
    await act(async () => fireEvent.click(again));
    await waitFor(() => expect(unsavedTakes.list()).toHaveLength(0));
    expect(sent[1]).toBe(sent[0]);
  });
});
