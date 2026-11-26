import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RemoteVideo } from "./facetime-live";

/*
 * The remote picture and sound of a FaceTime call (`RemoteVideo` in facetime-live.tsx) when the
 * browser refuses to start media by itself, as Safari does with sound until the person acts. The
 * browser's `play()` is replaced by a stand-in that refuses, then accepts; the stream is a stand-in
 * object, since no real call runs here.
 */
const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "play");

afterEach(() => {
  if (original) Object.defineProperty(HTMLMediaElement.prototype, "play", original);
});

describe("remote media the browser will not start by itself", () => {
  it("asks to play, offers a button when refused, and plays when the person presses it", async () => {
    const user = userEvent.setup();
    const play = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new DOMException("autoplay refused", "NotAllowedError"))
      .mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
    await act(async () => {
      render(<RemoteVideo stream={{} as MediaStream} name="Martin Example" kind="audio" />);
    });
    // Playing was asked for at once, and refused: the call offers to start it.
    expect(play).toHaveBeenCalledTimes(1);
    const start = await screen.findByRole("button", { name: "Play Martin Example's sound" });
    await user.click(start);
    expect(play).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /^Play / })).toBeNull();
  });
});

describe("the output of remote sound", () => {
  afterEach(() => {
    Reflect.deleteProperty(HTMLMediaElement.prototype, "setSinkId");
  });
  const showWith = async (setSinkId: unknown) => {
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
      configurable: true,
      value: setSinkId,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: () => Promise.resolve(),
    });
    const onOutput = vi.fn();
    await act(async () => {
      render(
        <RemoteVideo
          stream={{} as MediaStream}
          name="Martin"
          kind="video"
          output="speaker"
          onOutput={onOutput}
        />,
      );
    });
    return onOutput;
  };
  it("reports the output it moved to", async () => {
    const setSinkId = vi.fn(() => Promise.resolve());
    const onOutput = await showWith(setSinkId);
    expect(setSinkId).toHaveBeenCalledWith("speaker");
    expect(onOutput).toHaveBeenCalledWith("speaker", false);
  });
  it("reports a refusal, with the sound where it was", async () => {
    const onOutput = await showWith(() =>
      Promise.reject(new DOMException("gone", "NotFoundError")),
    );
    expect(onOutput).toHaveBeenCalledWith("", true);
  });
});
