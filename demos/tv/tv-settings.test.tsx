import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, type TvSettings } from "./tv-data";
import {
  nextToPlay,
  TV_UNAVAILABLE_SETTINGS,
  tvSettingsFromServer,
  tvSettingsToServer,
  withChecked,
} from "./tv-settings";
import { PAUSED_SAVER_MS, TvYouTubePlayer } from "./tv-youtube-player";

const startSaver = vi.hoisted(() => vi.fn());
vi.mock("../system-preferences/panes/desktop-and-screen-saver/screen-saver", () => ({
  startScreenSaverNow: startSaver,
}));

describe("what TV keeps of its Preferences", () => {
  it("reads a document that holds List Size alone, as older ones do", () => {
    expect(tvSettingsFromServer({ preferences: { listSize: "large" } }, defaultSettings)).toEqual({
      ...defaultSettings,
      listSize: "large",
      screenSaver: false,
      checkboxes: false,
      unchecked: [],
    });
  });

  it("reads back what it wrote", () => {
    const kept: TvSettings = {
      ...defaultSettings,
      listSize: "small",
      screenSaver: true,
      checkboxes: true,
      unchecked: ["a"],
    };
    const body = tvSettingsToServer(kept);
    expect(body).toEqual({
      preferences: { listSize: "small", screenSaver: true, checkboxes: true, unchecked: ["a"] },
    });
    expect(tvSettingsFromServer(body, defaultSettings)).toEqual(kept);
  });

  it("refuses a field it does not know, so that it is never saved over", () => {
    expect(
      tvSettingsFromServer(
        { preferences: { listSize: "large", restrictMature: true } },
        defaultSettings,
      ),
    ).toBeUndefined();
  });

  it("leaves dimmed only what a page cannot do, each with its reason", () => {
    expect(Object.keys(TV_UNAVAILABLE_SETTINGS)).toEqual([
      "checkDownloads",
      "keepOrganized",
      "restrictMature",
      "resetWarnings",
    ]);
  });
});

describe("the Library's checkboxes", () => {
  it("clears and sets one video's box", () => {
    const cleared = withChecked(defaultSettings, "a", false);
    expect(cleared.unchecked).toEqual(["a"]);
    expect(withChecked(cleared, "a", true).unchecked).toEqual([]);
  });

  it("has Up Next pass over a video whose box is cleared", () => {
    expect(nextToPlay(["now", "a", "b"], "now", ["a"])).toBe("b");
    expect(nextToPlay(["now", "a"], "now", ["a"])).toBeUndefined();
  });
});

describe("the screen saver while paused", () => {
  /** A home video element the player drives, and the media element's own pause. */
  async function pausedPlayer(screenSaverWhilePaused: boolean) {
    const created: HTMLMediaElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const element = realCreate(tag);
      if (tag === "video") created.push(element as HTMLMediaElement);
      return element;
    }) as typeof document.createElement);
    render(
      <TvYouTubePlayer
        video={{ id: "file", title: "Film", channel: "" }}
        readHome={async () => new Blob(["film"], { type: "video/webm" })}
        onProgress={() => {}}
        onEnded={() => {}}
        onDetails={() => {}}
        onDone={() => {}}
        screenSaverWhilePaused={screenSaverWhilePaused}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const video = created[0];
    if (!video) throw new Error("no video was made");
    await act(async () => {
      video.dispatchEvent(new Event("loadedmetadata"));
      video.dispatchEvent(new Event("playing"));
      video.dispatchEvent(new Event("pause"));
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    startSaver.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    URL.createObjectURL = () => "blob:film";
    URL.revokeObjectURL = () => {};
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts after the wait with no input, and input puts the wait off", async () => {
    await pausedPlayer(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAUSED_SAVER_MS - 1000);
    });
    expect(startSaver).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event("pointermove"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAUSED_SAVER_MS - 1000);
    });
    expect(startSaver).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(startSaver).toHaveBeenCalledTimes(1);
  });

  it("never starts with the preference off", async () => {
    await pausedPlayer(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAUSED_SAVER_MS * 2);
    });
    expect(startSaver).not.toHaveBeenCalled();
  });
});
