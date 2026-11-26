import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { app, photoBoothApp } from "./app";
import { PhotoBooth } from "./photo-booth";
import { clampPage, EFFECT_PAGES, findEffect, NORMAL, takePicture } from "./photo-booth-data";

const frame = () => screen.getByRole("region", { name: "Photo Booth" });
const button = (name: string) => screen.getByRole("button", { name });
const status = () => screen.getByRole("status");
/** The names of the previews the browser shows, row by row; empty in the camera view. */
const previews = () => {
  const grid = screen.queryByRole("group", { name: /^Effects, page/ });
  return grid
    ? within(grid)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"))
    : [];
};
/** The camera's picture, named with its effect. */
const picture = () => screen.getByRole("img", { name: /^The camera's picture/ });
/** The pictures in the strip, by their names. */
const strip = () => {
  const list = screen.queryByRole("list", { name: "Photos" });
  return list
    ? within(list)
        .getAllByRole("img")
        .map((each) => each.getAttribute("aria-label") ?? each.getAttribute("alt"))
    : [];
};
/** Let the countdown run for some milliseconds of fake time. */
const run = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));
/** A click while the timers are faked: the user-event library waits on real ones. */
const click = (name: string) => fireEvent.click(button(name));

afterEach(() => {
  vi.useRealTimers();
});

describe("the effects", () => {
  it("has four pages of nine with the picture as it is in the middle", () => {
    expect(EFFECT_PAGES).toHaveLength(4);
    for (const page of EFFECT_PAGES) {
      expect(page).toHaveLength(9);
      expect(page[4]).toBe(NORMAL);
    }
    // No two effects share an id, apart from Normal on each page.
    const ids = EFFECT_PAGES.flat()
      .map((effect) => effect.id)
      .filter((id) => id !== "normal");
    expect(new Set(ids).size).toBe(ids.length);
    expect(EFFECT_PAGES[1]?.map((effect) => effect.name)).toEqual([
      "Sepia",
      "Black and White",
      "Plastic Camera",
      "Comic Book",
      "Normal",
      "Color Pencil",
      "Glow",
      "Thermal Camera",
      "X-Ray",
    ]);
  });

  it("finds an effect, clamps a page and numbers the pictures", () => {
    expect(findEffect("sepia").filter).toBe("sepia(1)");
    expect(findEffect("nothing")).toBe(NORMAL);
    expect(clampPage(-2)).toBe(0);
    expect(clampPage(1.8)).toBe(1);
    expect(clampPage(9)).toBe(3);
    expect(clampPage(Number.NaN)).toBe(0);
    const one = takePicture([], "sepia");
    expect(one).toEqual([{ number: 1, effect: "sepia" }]);
    expect(takePicture(one, "nothing")).toEqual([
      { number: 1, effect: "sepia" },
      { number: 2, effect: "normal" },
    ]);
  });
});

describe("PhotoBooth", () => {
  it("opens as captured: the Effects browser on its second page", () => {
    render(<PhotoBooth />);
    expect(frame().style.width).toBe("720px");
    expect(frame().style.height).toBe("562px");
    expect(screen.getByRole("group", { name: "Effects, page 2 of 4" })).toBeInTheDocument();
    expect(previews()).toEqual([
      "Sepia",
      "Black and White",
      "Plastic Camera",
      "Comic Book",
      "Normal",
      "Color Pencil",
      "Glow",
      "Thermal Camera",
      "X-Ray",
    ]);
    expect(button("Normal")).toHaveAttribute("aria-current", "true");
    expect(button("Sepia")).not.toHaveAttribute("aria-current");
    expect(button("Page 2 of 4")).toHaveAttribute("aria-current", "page");
    expect(button("Effects")).toBeEnabled();
  });

  it("shows only the pages it is given, as the captures have three", async () => {
    const user = userEvent.setup();
    render(<PhotoBooth effectPages={EFFECT_PAGES.slice(0, 3)} defaultPage={3} />);
    expect(screen.getByRole("group", { name: "Effects, page 3 of 3" })).toBeInTheDocument();
    expect(previews()).toContain("Chipmunk");
    expect(button("Next page")).toHaveAttribute("aria-disabled", "true");
    await user.click(button("Page 1 of 3"));
    expect(previews()[0]).toBe("Bulge");
  });

  it("pages through the effects with the dots, the arrows and the arrow keys", async () => {
    const user = userEvent.setup();
    render(<PhotoBooth />);
    await user.click(button("Next page"));
    expect(screen.getByRole("group", { name: "Effects, page 3 of 4" })).toBeInTheDocument();
    expect(previews()).toContain("Chipmunk");
    expect(previews()).not.toContain("Sepia");
    await user.click(button("Next page"));
    expect(previews()).toContain("Sunset");
    expect(button("Next page")).toHaveAttribute("aria-disabled", "true");

    await user.click(button("Page 1 of 4"));
    expect(previews()[0]).toBe("Bulge");
    expect(button("Previous page")).toHaveAttribute("aria-disabled", "true");

    // The dots are one tab stop; the arrow keys move between them.
    await user.keyboard("{ArrowRight}");
    expect(previews()[0]).toBe("Sepia");
    expect(button("Page 2 of 4")).toHaveFocus();
    await user.keyboard("{End}");
    expect(previews()).toContain("Sunset");
    // Normal is in the middle of every page, and stays the chosen effect.
    expect(button("Normal")).toHaveAttribute("aria-current", "true");
  });

  it("turns to the camera with the effect that is chosen, and back", async () => {
    const user = userEvent.setup();
    const onEffectChange = vi.fn();
    render(<PhotoBooth onEffectChange={onEffectChange} />);
    await user.click(button("Sepia"));
    expect(previews()).toEqual([]);
    expect(picture()).toHaveAccessibleName(
      "The camera's picture of an empty, lamp-lit living room, Sepia",
    );
    expect(picture().querySelector("svg")).toHaveStyle({ filter: "sepia(1)" });
    expect(status()).toHaveTextContent("Sepia effect");
    expect(onEffectChange).toHaveBeenCalledTimes(1);
    expect(onEffectChange).toHaveBeenLastCalledWith("sepia");
    expect(button("Take Photo")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Effects pages" })).toBeNull();

    await user.click(button("Effects"));
    expect(button("Sepia")).toHaveAttribute("aria-current", "true");
    expect(button("Normal")).not.toHaveAttribute("aria-current");
    // Choosing the same effect again goes to the camera without another change.
    await user.click(button("Sepia"));
    expect(onEffectChange).toHaveBeenCalledTimes(1);

    // A distortion is a transform of the picture.
    await user.click(button("Effects"));
    await user.click(button("Previous page"));
    await user.click(button("Mirror"));
    expect(picture().querySelector("svg")).toHaveStyle({ transform: "scaleX(-1)" });
    expect(onEffectChange).toHaveBeenLastCalledWith("mirror");
  });

  it("counts down from three and takes a picture with the effect", () => {
    vi.useFakeTimers();
    const onPictureTaken = vi.fn();
    render(
      <PhotoBooth
        defaultView="camera"
        defaultEffect="x-ray"
        countdownStepDuration={200}
        onPictureTaken={onPictureTaken}
      />,
    );
    expect(strip()).toEqual([]);
    click("Take Photo");
    expect(status()).toHaveTextContent("3");
    expect(frame().querySelector(".mac-photo-booth-count")).toHaveTextContent("3");
    // Effects waits for the picture; the shutter has become Cancel.
    expect(button("Effects")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
    run(200);
    expect(status()).toHaveTextContent("2");
    run(200);
    expect(status()).toHaveTextContent("1");
    expect(onPictureTaken).not.toHaveBeenCalled();
    run(200);
    expect(status()).toHaveTextContent("Photo 1 taken, X-Ray");
    expect(frame().querySelector(".mac-photo-booth-count")).toBeNull();
    expect(strip()).toEqual(["Photo 1, X-Ray"]);
    expect(onPictureTaken).toHaveBeenCalledTimes(1);
    expect(onPictureTaken).toHaveBeenLastCalledWith({ number: 1, effect: "x-ray" });
    expect(button("Effects")).toBeEnabled();

    // A second picture, with another effect, joins the first.
    click("Effects");
    click("Glow");
    click("Take Photo");
    // Each count sets the next one's timer once it is shown.
    run(200);
    run(200);
    run(200);
    expect(strip()).toEqual(["Photo 1, X-Ray", "Photo 2, Glow"]);
    expect(onPictureTaken).toHaveBeenLastCalledWith({ number: 2, effect: "glow" });
    // Nothing more happens once the countdown is over.
    run(2000);
    expect(onPictureTaken).toHaveBeenCalledTimes(2);
  });

  it("takes no picture when the countdown is cancelled, by the button or by Escape", () => {
    vi.useFakeTimers();
    const onPictureTaken = vi.fn();
    render(
      <PhotoBooth
        defaultView="camera"
        countdownStepDuration={200}
        onPictureTaken={onPictureTaken}
      />,
    );
    click("Take Photo");
    run(300);
    click("Cancel");
    expect(status()).toHaveTextContent("Cancelled");
    run(2000);
    expect(strip()).toEqual([]);
    expect(button("Take Photo")).toBeInTheDocument();

    click("Take Photo");
    run(200);
    fireEvent.keyDown(button("Cancel"), { key: "Escape" });
    expect(status()).toHaveTextContent("Cancelled");
    run(2000);
    expect(onPictureTaken).not.toHaveBeenCalled();
  });

  it("opens on the page, the effect and the view it is given", () => {
    render(<PhotoBooth defaultPage={7} defaultEffect="unknown" />);
    expect(screen.getByRole("group", { name: "Effects, page 4 of 4" })).toBeInTheDocument();
    expect(button("Normal")).toHaveAttribute("aria-current", "true");
  });

  it("shows a backdrop slot with no picture as the way to fill it, leading nowhere", async () => {
    const user = userEvent.setup();
    render(<PhotoBooth defaultPage={3} filledBackdrops={["backdrop-user-1"]} />);
    expect(screen.getAllByRole("button", { name: "Drag Backdrops Here" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "User Backdrop" })).toHaveLength(1);
    await user.click(
      screen.getAllByRole("button", { name: "Drag Backdrops Here" })[0] as HTMLElement,
    );
    expect(screen.getByRole("group", { name: "Effects, page 4 of 4" })).toBeInTheDocument();
    await user.click(button("User Backdrop"));
    expect(screen.queryByRole("group", { name: "Effects, page 4 of 4" })).toBeNull();
  });

  it("is used from the keyboard", async () => {
    const user = userEvent.setup();
    render(<PhotoBooth />);
    // Close, minimize, zoom, then the nine previews in reading order.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(button("Sepia")).toHaveFocus();
    await user.tab();
    expect(button("Black and White")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(picture()).toHaveAccessibleName(
      "The camera's picture of an empty, lamp-lit living room, Black and White",
    );
    // The preview is gone; the focus is on the shutter, which keeps it through a countdown.
    expect(button("Take Photo")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(button("Cancel")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(button("Take Photo")).toHaveFocus();
  });

  it("takes a picture at once on Option, flashes unless Shift is held, and counts down on Command-T", () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    render(<PhotoBooth defaultView="camera" />);
    const shutter = () => screen.getByRole("button", { name: "Take Photo" });
    const flash = () => document.querySelector(".mac-photo-booth-flash");
    fireEvent.click(shutter(), { altKey: true });
    expect(strip()).toEqual(["Photo 1, Normal"]);
    expect(flash()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(flash()).toBeNull();
    fireEvent.click(shutter(), { altKey: true, shiftKey: true });
    expect(strip()).toHaveLength(2);
    expect(flash()).toBeNull();
    fireEvent.keyDown(shutter(), { key: "t", metaKey: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(strip()).toHaveLength(2);
  });

  it("shows a picture large on a click, with no owner to delete or export it", () => {
    render(
      <PhotoBooth
        defaultView="camera"
        pictures={Array.from({ length: 2 }, (_, index) => ({
          number: index + 1,
          effect: "normal",
        }))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Camera" }));
    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
  });

  it("keeps every picture in the strip, whatever their number", () => {
    vi.useFakeTimers();
    render(<PhotoBooth defaultView="camera" countdownStepDuration={10} />);
    for (let taken = 0; taken < 12; taken += 1) {
      click("Take Photo");
      run(10);
      run(10);
      run(10);
    }
    expect(strip()).toHaveLength(12);
    expect(strip()[0]).toBe("Photo 1, Normal");
    expect(strip()[11]).toBe("Photo 12, Normal");
  });

  it("passes the window's props on and hands the callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <PhotoBooth
        ref={ref}
        className="mine"
        state="inactive"
        style={{ left: 12 }}
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="zoom"
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        onKeyDown={onKeyDown}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mac-photo-booth", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame().style.left).toBe("12px");

    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    const title = screen.getByText("Photo Booth");
    fireEvent.pointerDown(title, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(title);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a window control is the control's, not a drag.
    fireEvent.pointerDown(button("Close"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The caller's own handler runs beside the window's.
    fireEvent.keyDown(button("Effects"), { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<PhotoBooth minimizeDisabled zoomDisabled zoomRole="zoom" />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Zoom")).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor", () => {
    expect(app).toBe(photoBoothApp);
    expect(app).toMatchObject({
      id: "photo-booth",
      name: "Photo Booth",
      defaultSize: { width: 720, height: 562 },
      minSize: { width: 720, height: 562 },
      resizable: true,
      menus: ["Photo Booth", "File", "Edit", "View", "Camera", "Window", "Help"],
    });
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(previews()).toHaveLength(9);
  });
});
