import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoBooth, type PhotoBoothProps } from "./photo-booth";
import type { PhotoBoothPicture } from "./photo-booth-data";

const PICTURES: PhotoBoothPicture[] = [
  { number: 1, effect: "normal", id: "a", baked: true },
  { number: 2, effect: "normal", id: "b", baked: true },
  { number: 3, effect: "normal", id: "c", baked: true, clip: true },
];

function Owned(props: Partial<PhotoBoothProps>) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  return (
    <PhotoBooth
      defaultView="camera"
      pictures={PICTURES}
      selected={selected}
      onSelectedChange={setSelected}
      onDeletePictures={() => {}}
      {...props}
    />
  );
}

const chosen = () =>
  [...document.querySelectorAll(".mac-photo-booth-thumb-button[data-selected]")].map((each) =>
    each.getAttribute("data-picture-id"),
  );
const strip = (name: string) => screen.getByRole("button", { name });

afterEach(() => vi.useRealTimers());

describe("the strip's selection", () => {
  it("adds with Command-click, takes a range with Shift-click, and a plain click starts over", () => {
    render(<Owned />);
    fireEvent.click(strip("Photo 1, Normal"), { metaKey: true });
    expect(chosen()).toEqual(["a"]);
    fireEvent.click(strip("Clip 3, Normal"), { shiftKey: true });
    expect(chosen()).toEqual(["a", "b", "c"]);
    fireEvent.click(strip("Photo 2, Normal"), { metaKey: true });
    expect(chosen()).toEqual(["a", "c"]);
    fireEvent.click(strip("Photo 2, Normal"));
    expect(chosen()).toEqual([]);
    expect(strip("Photo 2, Normal")).toHaveAttribute("aria-pressed", "true");
  });

  it("deletes the whole selection when Delete is pressed on one of it, and only that one otherwise", () => {
    const onDeletePictures = vi.fn();
    render(<Owned onDeletePictures={onDeletePictures} />);
    fireEvent.click(strip("Photo 1, Normal"), { metaKey: true });
    fireEvent.click(strip("Photo 2, Normal"), { metaKey: true });
    fireEvent.keyDown(strip("Photo 1, Normal"), { key: "Delete" });
    expect(onDeletePictures.mock.lastCall?.[0].map((each: { id: string }) => each.id)).toEqual([
      "a",
      "b",
    ]);
    onDeletePictures.mockClear();
    fireEvent.keyDown(strip("Clip 3, Normal"), { key: "Delete" });
    expect(onDeletePictures.mock.lastCall?.[0].map((each: { id: string }) => each.id)).toEqual([
      "c",
    ]);
  });
});

describe("the mode switch", () => {
  const capture = (clipping = false) => ({
    clipping,
    four: vi.fn(async () => {}),
    startClip: vi.fn(async () => {}),
    stopClip: vi.fn(),
  });

  it("is not shown without a capture owner: the demo stays as the captures show it", () => {
    render(<PhotoBooth defaultView="camera" />);
    expect(screen.queryByRole("group", { name: "Capture mode" })).toBeNull();
    expect(screen.getByRole("button", { name: "Take Photo" })).toBeTruthy();
  });

  it("takes four pictures in its second mode, and the countdown ends in them", async () => {
    vi.useFakeTimers();
    const owner = capture();
    const onPictureTaken = vi.fn();
    render(<PhotoBooth defaultView="camera" capture={owner} onPictureTaken={onPictureTaken} />);
    fireEvent.click(screen.getByRole("button", { name: "Take four quick pictures" }));
    fireEvent.click(screen.getByRole("button", { name: "Take Four Photos" }));
    for (const _count of [3, 2, 1]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(owner.four).toHaveBeenCalledTimes(1);
    expect(onPictureTaken).not.toHaveBeenCalled();
  });

  it("shows Stop for as long as its owner says a clip runs, also when it ends by itself", () => {
    const owner = capture(true);
    const { rerender } = render(<PhotoBooth defaultView="camera" capture={owner} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(owner.stopClip).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Effects" })).toBeDisabled();
    rerender(<PhotoBooth defaultView="camera" capture={capture(false)} />);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect(screen.getByRole("button", { name: "Effects" })).toBeEnabled();
  });

  it("starts a clip in its third mode after the shutter", async () => {
    const owner = capture();
    render(<PhotoBooth defaultView="camera" capture={owner} />);
    fireEvent.click(screen.getByRole("button", { name: "Record a movie clip" }));
    fireEvent.click(screen.getByRole("button", { name: "Record Clip" }), { altKey: true });
    await vi.waitFor(() => expect(owner.startClip).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Record Clip" })).toBeEnabled(),
    );
  });
});
