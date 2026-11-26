import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalMedia } from "./facetime-devices";

/*
 * `useLocalMedia` with the browser's media devices replaced: `getUserMedia` hands out stand-in
 * streams, and a stand-in sender holds its answer back until the test lets it go, which no real call
 * can be made to do on demand. What is verified is the order of taking over, not a real device.
 */
const track = (kind: string) =>
  ({ kind, readyState: "live", stop: vi.fn() }) as unknown as MediaStreamTrack;
const streamOf = (...tracks: MediaStreamTrack[]) =>
  ({ getTracks: () => tracks }) as unknown as MediaStream;
const devices = [
  { kind: "videoinput", deviceId: "one", label: "One" },
  { kind: "videoinput", deviceId: "two", label: "Two" },
] as MediaDeviceInfo[];

function stubMedia(streams: readonly MediaStream[]) {
  const left = [...streams];
  const getUserMedia = vi.fn(async (_asked: MediaStreamConstraints) => left.shift() as MediaStream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, enumerateDevices: async () => devices },
  });
  return getUserMedia;
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("useLocalMedia", () => {
  it("lets a stream go when the window closes while the call is still taking it", async () => {
    const first = track("video");
    const second = track("video");
    stubMedia([streamOf(first), streamOf(second)]);
    let release = () => {};
    const sender = {
      track: first,
      replaceTrack: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    };
    const props = { camera: undefined as string | undefined };
    const view = renderHook(
      ({ camera }) =>
        useLocalMedia(
          { camera },
          () => [sender],
          () => {},
        ),
      {
        initialProps: props,
      },
    );
    await waitFor(() => expect(view.result.current.local).not.toBeNull());
    await waitFor(() => expect(view.result.current.lists.cameras).toHaveLength(2));
    view.rerender({ camera: "Two" });
    await waitFor(() => expect(sender.replaceTrack).toHaveBeenCalledWith(second));
    view.unmount();
    await act(async () => release());
    await waitFor(() => expect(second.stop).toHaveBeenCalled());
    expect(first.stop).toHaveBeenCalled();
  });

  it("ends on the latest choice, however quickly they come", async () => {
    const first = track("video");
    const middle = track("video");
    const last = track("video");
    const getUserMedia = stubMedia([streamOf(first), streamOf(middle), streamOf(last)]);
    const sender = {
      track: first,
      replaceTrack: vi.fn(async (_next: MediaStreamTrack | null) => {}),
    };
    const view = renderHook(
      ({ camera }) =>
        useLocalMedia(
          { camera },
          () => [sender],
          () => {},
        ),
      {
        initialProps: { camera: undefined as string | undefined },
      },
    );
    await waitFor(() => expect(view.result.current.lists.cameras).toHaveLength(2));
    view.rerender({ camera: "One" });
    view.rerender({ camera: "Two" });
    await waitFor(() =>
      expect(view.result.current.local?.getTracks()).toEqual([
        expect.objectContaining({ kind: "video" }),
      ]),
    );
    await waitFor(() =>
      expect(getUserMedia.mock.calls.at(-1)?.[0]).toMatchObject({
        video: { deviceId: { exact: "two" } },
      }),
    );
    await waitFor(() => expect(view.result.current.local?.getTracks()[0]).not.toBe(first));
    expect(sender.replaceTrack.mock.calls.at(-1)?.[0]).toBe(
      view.result.current.local?.getTracks()[0],
    );
  });
});
