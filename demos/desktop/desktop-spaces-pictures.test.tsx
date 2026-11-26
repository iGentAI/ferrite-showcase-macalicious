import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeDesktopValue,
  connectDesktopValues,
  desktopValues,
  forgetDesktopValues,
  lastDesktopPicture,
  notePictureFile,
  showDesktopPicture,
} from "./desktop-personal";
import { DESKTOP_SPACE_PICTURES, useSpacePictures } from "./desktop-spaces";

const readFile = vi.hoisted(() => vi.fn());
vi.mock("./desktop-files", () => ({ readFile }));

const picture = () => new Blob(["x"], { type: "image/png" });

describe("the picture of a Space", () => {
  let made = 0;
  let disconnect: () => void;

  beforeEach(() => {
    made = 0;
    URL.createObjectURL = vi.fn(() => `blob:read-${++made}`);
    URL.revokeObjectURL = vi.fn();
    readFile.mockReset();
    readFile.mockImplementation(async () => picture());
    disconnect = connectDesktopValues((key, value) => {
      changeDesktopValue(key, value);
    });
  });

  afterEach(() => {
    disconnect();
    forgetDesktopValues();
  });

  it("keeps a picture of the drive by its file, never by the page's address", async () => {
    const { result } = renderHook(() => useSpacePictures("1", ["1", "2"], true));
    act(() =>
      showDesktopPicture({ day: "blob:chosen", night: "blob:chosen", look: "auto", file: "f1" }),
    );
    await waitFor(() =>
      expect(desktopValues()[DESKTOP_SPACE_PICTURES]).toEqual({ 1: { file: "f1", look: "auto" } }),
    );
    await waitFor(() => expect(result.current("1")).toBe("blob:read-1"));
  });

  it("shows the kept file again after a reload, read afresh", async () => {
    changeDesktopValue(DESKTOP_SPACE_PICTURES, { 1: { file: "f1", look: "auto" } });
    renderHook(() => useSpacePictures("1", ["1"], true));
    await waitFor(() => expect(lastDesktopPicture()?.day).toBe("blob:read-1"));
    expect(readFile).toHaveBeenCalledWith("f1", expect.anything());
    expect(lastDesktopPicture()).toMatchObject({ file: "f1", restored: true });
  });

  it("goes on showing what was showing when the Space's file is gone from the drive", async () => {
    readFile.mockRejectedValue(new Error("gone"));
    changeDesktopValue(DESKTOP_SPACE_PICTURES, { 1: { file: "gone", look: "auto" } });
    act(() => showDesktopPicture({ day: "mountains.jpg", restored: true }));
    const { result } = renderHook(() => useSpacePictures("1", ["1"], true));
    await waitFor(() => expect(readFile).toHaveBeenCalled());
    expect(lastDesktopPicture()?.day).toBe("mountains.jpg");
    expect(result.current("1")).toBeUndefined();
  });

  it("does not make the picture of the Space left the picture of one whose file is still being read", async () => {
    changeDesktopValue(DESKTOP_SPACE_PICTURES, { 2: { file: "f2", look: "auto" } });
    let finish: (blob: Blob) => void = () => undefined;
    readFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = renderHook(({ on }) => useSpacePictures(on, ["1", "2"], true), {
      initialProps: { on: "1" },
    });
    act(() => showDesktopPicture({ day: "mountains.jpg", look: "auto" }));
    rerender({ on: "2" });
    expect(desktopValues()[DESKTOP_SPACE_PICTURES]).toMatchObject({
      1: { day: "mountains.jpg" },
      2: { file: "f2" },
    });
    await act(async () => finish(picture()));
    await waitFor(() => expect(lastDesktopPicture()?.file).toBe("f2"));
  });

  it("keeps a photo by its file once it is saved, with another Space showing by then", async () => {
    const { rerender } = renderHook(({ on }) => useSpacePictures(on, ["1", "2"], true), {
      initialProps: { on: "1" },
    });
    act(() => showDesktopPicture({ day: "blob:photo", night: "blob:photo", look: "auto" }));
    rerender({ on: "2" });
    act(() => showDesktopPicture({ day: "other.jpg", look: "auto" }));
    act(() => notePictureFile("blob:photo", "saved"));
    await waitFor(() =>
      expect(desktopValues()[DESKTOP_SPACE_PICTURES]).toMatchObject({
        1: { file: "saved", look: "auto" },
        2: { day: "other.jpg" },
      }),
    );
    expect(lastDesktopPicture()?.day).toBe("other.jpg");
  });

  it("keeps the file for every Space holding a photo when it is saved, the one showing among them", async () => {
    const { rerender } = renderHook(({ on }) => useSpacePictures(on, ["1", "2"], true), {
      initialProps: { on: "1" },
    });
    const photo = { day: "blob:same", night: "blob:same", look: "auto" } as const;
    act(() => showDesktopPicture(photo));
    rerender({ on: "2" });
    act(() => showDesktopPicture(photo));
    act(() => notePictureFile("blob:same", "saved"));
    await waitFor(() =>
      expect(desktopValues()[DESKTOP_SPACE_PICTURES]).toEqual({
        1: { file: "saved", look: "auto" },
        2: { file: "saved", look: "auto" },
      }),
    );
  });

  it("gives an address back only once no Space holds its file and the desktop has stopped showing it", async () => {
    changeDesktopValue(DESKTOP_SPACE_PICTURES, { 1: { file: "f1", look: "auto" } });
    const { rerender } = renderHook(({ on, all }) => useSpacePictures(on, all, true), {
      initialProps: { on: "1", all: ["1", "2"] },
    });
    await waitFor(() => expect(lastDesktopPicture()?.day).toBe("blob:read-1"));
    rerender({ on: "2", all: ["2"] });
    await waitFor(() => expect(desktopValues()[DESKTOP_SPACE_PICTURES]).toHaveProperty("2"));
    expect(lastDesktopPicture()?.day).toBe("blob:read-1");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => showDesktopPicture({ day: "other.jpg", look: "auto" }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:read-1"));
  });

  it("draws nothing of one person's pictures for the next, from the render that ends the session", async () => {
    changeDesktopValue(DESKTOP_SPACE_PICTURES, { 2: { file: "f2", look: "auto" } });
    const { result } = renderHook(() => {
      const of = useSpacePictures("1", ["1", "2"], true);
      return [of("1"), of("2")];
    });
    act(() => showDesktopPicture({ day: "blob:photo", night: "blob:photo", look: "auto" }));
    await waitFor(() => expect(result.current).toEqual(["blob:photo", "blob:read-1"]));
    act(() => forgetDesktopValues());
    expect(result.current).toEqual([undefined, undefined]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:read-1");
  });
});
