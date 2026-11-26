import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type KeyboardEvent, type PointerEvent, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PictureInPicture, type PictureInPictureProps } from "./index";

/*
 * jsdom has no layout: the screen is given 800 x 600 points and the window 320 x 180 in the
 * corner its data-corner names, 20 points from the edges. Real geometry is covered by
 * picture-in-picture.visual.json.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const corner = this.getAttribute("data-corner");
    const rect = corner
      ? {
          left: corner.endsWith("left") ? 20 : 460,
          top: corner.startsWith("top") ? 20 : 400,
          width: 320,
          height: 180,
        }
      : { left: 0, top: 0, width: 800, height: 600 };
    return {
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    } as DOMRect;
  });
});

function Example(props: PictureInPictureProps) {
  return (
    <div style={{ position: "relative" }}>
      <PictureInPicture defaultWidth={320} {...props}>
        <div data-testid="video" />
      </PictureInPicture>
    </div>
  );
}

const pip = () => screen.getByRole("group", { name: "Picture in Picture" });
const button = (name: string) => screen.getByRole("button", { name });
const handle = () => {
  const element = pip().querySelector(".mac-picture-in-picture-resize");
  if (!element) throw new Error("no resize handle");
  return element;
};
const variable = (name: string) => pip().style.getPropertyValue(name);

describe("PictureInPicture", () => {
  it("renders a labelled group in the top-right corner with the video and three buttons", () => {
    render(<Example />);
    expect(pip()).toHaveClass("mac-picture-in-picture");
    expect(pip()).toHaveAttribute("data-corner", "top-right");
    expect(pip()).toHaveAttribute("data-playing");
    expect(variable("--_width")).toBe("320px");
    expect(Number(variable("--_ratio"))).toBeCloseTo(16 / 9);
    expect(pip()).toContainElement(screen.getByTestId("video"));
    expect(
      screen.getAllByRole("button").map((element) => element.getAttribute("aria-label")),
    ).toEqual(["Close", "Return to Window", "Pause"]);
    for (const element of screen.getAllByRole("button")) expect(element.tagName).toBe("BUTTON");
  });

  it("opens 420 points wide by default and takes the ratio of the video", () => {
    render(<PictureInPicture aspectRatio={4 / 3} />);
    expect(variable("--_width")).toBe("420px");
    expect(Number(variable("--_ratio"))).toBeCloseTo(4 / 3);
  });

  it("renders nothing while it is closed", () => {
    render(<Example defaultOpen={false} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByTestId("video")).toBeNull();
  });

  it("closes with the close button", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example onOpenChange={onOpenChange} />);
    await user.click(button("Close"));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("leaves the arrow keys, + and - to the video while focus is in it, and still closes with Escape", async () => {
    const user = userEvent.setup();
    const onCornerChange = vi.fn();
    const onWidthChange = vi.fn();
    render(
      <div style={{ position: "relative" }}>
        <PictureInPicture onCornerChange={onCornerChange} onWidthChange={onWidthChange}>
          <input aria-label="Scrubber" />
        </PictureInPicture>
      </div>,
    );
    screen.getByRole("textbox", { name: "Scrubber" }).focus();
    await user.keyboard("{ArrowLeft}{ArrowDown}+-");
    expect(onCornerChange).not.toHaveBeenCalled();
    expect(onWidthChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("+-");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("closes with Escape while focus is inside", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example onOpenChange={onOpenChange} />);
    await user.tab();
    expect(button("Close")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("reports the return to the window and then closes", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <Example onReturn={() => calls.push("return")} onOpenChange={() => calls.push("close")} />,
    );
    await user.tab();
    await user.tab();
    expect(button("Return to Window")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(calls).toEqual(["return", "close"]);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("leaves a controlled window open until its owner closes it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open onOpenChange={onOpenChange} />);
    await user.click(button("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(pip()).toBeInTheDocument();
    rerender(<Example open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("toggles between pause and play", async () => {
    const user = userEvent.setup();
    const onPlayingChange = vi.fn();
    render(<Example onPlayingChange={onPlayingChange} />);
    await user.click(button("Pause"));
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
    expect(pip()).not.toHaveAttribute("data-playing");
    button("Play").focus();
    await user.keyboard(" ");
    expect(onPlayingChange).toHaveBeenLastCalledWith(true);
    expect(button("Pause")).toBeInTheDocument();
  });

  it("starts paused with defaultPlaying and leaves controlled playing to its owner", async () => {
    const user = userEvent.setup();
    const onPlayingChange = vi.fn();
    const { unmount } = render(<Example defaultPlaying={false} />);
    expect(button("Play")).toBeInTheDocument();
    unmount();
    render(<Example playing onPlayingChange={onPlayingChange} />);
    await user.click(button("Pause"));
    expect(onPlayingChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(button("Pause")).toBeInTheDocument();
  });

  it("moves between the corners with the arrow keys", async () => {
    const user = userEvent.setup();
    const onCornerChange = vi.fn();
    render(<Example onCornerChange={onCornerChange} />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(pip()).toHaveAttribute("data-corner", "top-left");
    await user.keyboard("{ArrowDown}");
    expect(pip()).toHaveAttribute("data-corner", "bottom-left");
    await user.keyboard("{ArrowRight}");
    expect(pip()).toHaveAttribute("data-corner", "bottom-right");
    await user.keyboard("{ArrowUp}");
    expect(pip()).toHaveAttribute("data-corner", "top-right");
    // Already at the top and on the right: nothing to report.
    await user.keyboard("{ArrowUp}{ArrowRight}");
    expect(onCornerChange.mock.calls.map(([value]) => value)).toEqual([
      "top-left",
      "bottom-left",
      "bottom-right",
      "top-right",
    ]);
    // The window is the same element throughout, so focus stays on its button.
    expect(button("Close")).toHaveFocus();
  });

  it("starts in defaultCorner and leaves a controlled corner to its owner", async () => {
    const user = userEvent.setup();
    const onCornerChange = vi.fn();
    const { unmount } = render(<Example defaultCorner="bottom-left" />);
    expect(pip()).toHaveAttribute("data-corner", "bottom-left");
    unmount();
    render(<Example corner="top-left" onCornerChange={onCornerChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onCornerChange).toHaveBeenCalledExactlyOnceWith("top-right");
    expect(pip()).toHaveAttribute("data-corner", "top-left");
  });

  it("resizes with + and - within its limits", async () => {
    const user = userEvent.setup();
    const onWidthChange = vi.fn();
    render(<Example minWidth={300} maxWidth={400} onWidthChange={onWidthChange} />);
    await user.tab();
    await user.keyboard("+");
    expect(variable("--_width")).toBe("352px");
    await user.keyboard("=");
    expect(variable("--_width")).toBe("384px");
    await user.keyboard("++");
    expect(variable("--_width")).toBe("400px");
    await user.keyboard("----");
    expect(variable("--_width")).toBe("300px");
    await user.keyboard("-");
    expect(onWidthChange.mock.calls.map(([value]) => value)).toEqual([
      352, 384, 400, 368, 336, 304, 300,
    ]);
  });

  it("leaves other keys and keys with a modifier alone", async () => {
    const user = userEvent.setup();
    const onCornerChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<Example onCornerChange={onCornerChange} onOpenChange={onOpenChange} />);
    await user.tab();
    await user.keyboard("{Control>}{ArrowLeft}{/Control}{Meta>}-{/Meta}{Alt>}{Escape}{/Alt}a");
    expect(onCornerChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(variable("--_width")).toBe("320px");
  });

  it("follows the pointer while it is dragged and snaps to the corner it is dropped in", () => {
    const onCornerChange = vi.fn();
    render(<Example onCornerChange={onCornerChange} />);
    fireEvent.pointerDown(screen.getByTestId("video"), {
      button: 0,
      clientX: 600,
      clientY: 100,
      pointerId: 1,
    });
    // A press alone is not a drag: nothing is marked or captured until the pointer moves.
    expect(pip()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(pip(), { clientX: 560, clientY: 130, pointerId: 1 });
    expect(pip()).toHaveAttribute("data-dragging");
    expect(variable("--_drag")).toBe("-40px 30px");
    // The centre starts 220 right of and 190 above the screen's centre.
    fireEvent.pointerMove(pip(), { clientX: 300, clientY: 400, pointerId: 1 });
    expect(variable("--_drag")).toBe("-300px 300px");
    // Nothing has reached React yet.
    expect(onCornerChange).not.toHaveBeenCalled();
    expect(pip()).toHaveAttribute("data-corner", "top-right");
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    expect(onCornerChange).toHaveBeenCalledExactlyOnceWith("bottom-left");
    expect(pip()).toHaveAttribute("data-corner", "bottom-left");
    expect(variable("--_drag")).toBe("");
    expect(pip()).not.toHaveAttribute("data-dragging");
    // The release is not reported twice, and the pointer no longer moves anything.
    fireEvent.lostPointerCapture(pip(), { pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 700, clientY: 0, pointerId: 1 });
    expect(onCornerChange).toHaveBeenCalledTimes(1);
    expect(variable("--_drag")).toBe("");
  });

  it("returns to its corner when it is dropped in the same quarter, or not moved", () => {
    const onCornerChange = vi.fn();
    render(<Example onCornerChange={onCornerChange} />);
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 500, clientY: 200, pointerId: 1 });
    fireEvent.pointerCancel(pip(), { pointerId: 1 });
    expect(pip()).not.toHaveAttribute("data-dragging");
    expect(variable("--_drag")).toBe("");
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 2 });
    fireEvent.lostPointerCapture(pip(), { pointerId: 2 });
    expect(pip()).not.toHaveAttribute("data-dragging");
    expect(onCornerChange).not.toHaveBeenCalled();
    expect(pip()).toHaveAttribute("data-corner", "top-right");
  });

  it("lets only the pointer that started a drag move it or end it", () => {
    render(<Example />);
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 100, clientY: 500, pointerId: 2 });
    expect(variable("--_drag")).toBe("");
    fireEvent.pointerDown(pip(), { button: 0, clientX: 100, clientY: 500, pointerId: 2 });
    fireEvent.pointerUp(pip(), { pointerId: 2 });
    fireEvent.pointerMove(pip(), { clientX: 590, clientY: 400, pointerId: 1 });
    expect(pip()).toHaveAttribute("data-dragging");
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    expect(pip()).toHaveAttribute("data-corner", "bottom-right");
  });

  it("leaves a click, and a press on a link or a control in the video, to the video", () => {
    const setPointerCapture = vi.fn();
    // jsdom has no pointer capture; a stand-in for the length of this test.
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    const onClick = vi.fn();
    render(
      <div style={{ position: "relative" }}>
        <PictureInPicture defaultWidth={320}>
          <div data-testid="video">
            <a href="#chapter">Chapter 2</a>
            <input aria-label="Volume" type="range" />
          </div>
        </PictureInPicture>
      </div>,
    );
    // A click with a pointer that barely moves: no capture, so the click is the video's.
    const video = screen.getByTestId("video");
    video.addEventListener("click", onClick);
    fireEvent.pointerDown(video, { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 601, clientY: 102, pointerId: 1 });
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    fireEvent.click(video);
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(pip()).not.toHaveAttribute("data-dragging");
    expect(variable("--_drag")).toBe("");
    expect(onClick).toHaveBeenCalledTimes(1);
    // A press on a link or a form control never moves the window.
    for (const control of [screen.getByRole("link"), screen.getByRole("slider")]) {
      fireEvent.pointerDown(control, { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(pip(), { clientX: 100, clientY: 500, pointerId: 1 });
      fireEvent.pointerUp(pip(), { pointerId: 1 });
    }
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(pip()).toHaveAttribute("data-corner", "top-right");
    // And a real drag captures the pointer once.
    fireEvent.pointerDown(video, { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 560, clientY: 130, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 500, clientY: 200, pointerId: 1 });
    expect(setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  });

  it("forgets a press that leaves before it became a drag", () => {
    render(<Example />);
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerLeave(pip(), { pointerId: 1 });
    // Not held as a gesture in progress: another pointer can drag.
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(pip(), { clientX: 300, clientY: 400, pointerId: 2 });
    expect(variable("--_drag")).toBe("-300px 300px");
    fireEvent.pointerUp(pip(), { pointerId: 2 });
    expect(pip()).toHaveAttribute("data-corner", "bottom-left");
  });

  it("can be dragged again after it was closed during a drag and reopened", () => {
    const { rerender } = render(<Example open />);
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 560, clientY: 130, pointerId: 1 });
    expect(pip()).toHaveAttribute("data-dragging");
    rerender(<Example open={false} />);
    expect(screen.queryByRole("group")).toBeNull();
    rerender(<Example open />);
    expect(pip()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 300, clientY: 400, pointerId: 1 });
    expect(variable("--_drag")).toBe("-300px 300px");
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    expect(pip()).toHaveAttribute("data-corner", "bottom-left");
  });

  it("shows a width within its limits, whatever it was given", () => {
    const { rerender } = render(<Example maxWidth={300} />);
    expect(variable("--_width")).toBe("300px");
    rerender(<Example width={100} />);
    expect(variable("--_width")).toBe("210px");
  });

  it("does not drag with another mouse button or from a control", () => {
    render(<Example />);
    fireEvent.pointerDown(pip(), { button: 2, clientX: 600, clientY: 100, pointerId: 1 });
    expect(pip()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerDown(button("Pause"), { button: 0, clientX: 620, clientY: 110, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 100, clientY: 500, pointerId: 1 });
    expect(pip()).not.toHaveAttribute("data-dragging");
    expect(variable("--_drag")).toBe("");
  });

  it("resizes from its free corner, keeping the screen corner in place", () => {
    const onWidthChange = vi.fn();
    render(<Example onWidthChange={onWidthChange} />);
    // In the top-right corner the handle is at the bottom left: dragging left widens.
    fireEvent.pointerDown(handle(), { button: 0, clientX: 462, clientY: 198, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 422, clientY: 230, pointerId: 1 });
    expect(pip()).toHaveAttribute("data-dragging");
    expect(variable("--_resize")).toBe("360px");
    expect(variable("--_drag")).toBe("");
    fireEvent.pointerMove(pip(), { clientX: -900, clientY: 230, pointerId: 1 });
    expect(variable("--_resize")).toBe("840px");
    fireEvent.pointerMove(pip(), { clientX: 502.4, clientY: 180, pointerId: 1 });
    expect(variable("--_resize")).toBe("280px");
    expect(onWidthChange).not.toHaveBeenCalled();
    expect(variable("--_width")).toBe("320px");
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    expect(onWidthChange).toHaveBeenCalledExactlyOnceWith(280);
    expect(variable("--_width")).toBe("280px");
    expect(variable("--_resize")).toBe("");
    expect(pip()).toHaveAttribute("data-corner", "top-right");
    expect(pip()).not.toHaveAttribute("data-dragging");
  });

  it("widens to the right when it sits on the left", () => {
    render(<Example defaultCorner="bottom-left" minWidth={200} />);
    fireEvent.pointerDown(handle(), { button: 0, clientX: 338, clientY: 402, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 378, clientY: 402, pointerId: 1 });
    expect(variable("--_resize")).toBe("360px");
    fireEvent.pointerMove(pip(), { clientX: 0, clientY: 402, pointerId: 1 });
    expect(variable("--_resize")).toBe("200px");
    fireEvent.lostPointerCapture(pip(), { pointerId: 1 });
    expect(variable("--_width")).toBe("200px");
  });

  it("leaves a controlled width where its owner has it after a resize", () => {
    const onWidthChange = vi.fn();
    render(<Example width={320} onWidthChange={onWidthChange} />);
    fireEvent.pointerDown(handle(), { button: 0, clientX: 462, clientY: 198, pointerId: 1 });
    fireEvent.pointerMove(pip(), { clientX: 442, clientY: 198, pointerId: 1 });
    fireEvent.pointerUp(pip(), { pointerId: 1 });
    expect(onWidthChange).toHaveBeenCalledExactlyOnceWith(340);
    expect(variable("--_width")).toBe("320px");
    expect(variable("--_resize")).toBe("");
  });

  it("follows controlled props", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [corner, setCorner] = useState<PictureInPictureProps["corner"]>("top-left");
      const [width, setWidth] = useState(300);
      return (
        <Example
          corner={corner}
          onCornerChange={setCorner}
          width={width}
          onWidthChange={setWidth}
        />
      );
    }
    render(<Controlled />);
    await user.tab();
    await user.keyboard("{ArrowDown}+");
    expect(pip()).toHaveAttribute("data-corner", "bottom-left");
    expect(variable("--_width")).toBe("332px");
  });

  it("calls the caller's handlers first and stops when they prevent the default", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    const onPointerDown = vi.fn((event: PointerEvent) => event.preventDefault());
    render(<Example onKeyDown={onKeyDown} onPointerDown={onPointerDown} />);
    await user.tab();
    await user.keyboard("{ArrowLeft}{Escape}");
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(pip()).toHaveAttribute("data-corner", "top-right");
    fireEvent.pointerDown(pip(), { button: 0, clientX: 600, clientY: 100, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalled();
    expect(pip()).not.toHaveAttribute("data-dragging");
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <PictureInPicture
        ref={ref}
        className="player"
        style={{ zIndex: 5 }}
        id="pip"
        aria-label="Keynote video"
        data-test="pip"
      />,
    );
    expect(ref.current).toBe(screen.getByRole("group", { name: "Keynote video" }));
    expect(ref.current).toHaveClass("mac-picture-in-picture", "player");
    expect(ref.current).toHaveStyle({ zIndex: "5" });
    expect(ref.current?.style.getPropertyValue("--_width")).toBe("420px");
    expect(ref.current).toHaveAttribute("id", "pip");
    expect(ref.current).toHaveAttribute("data-test", "pip");
  });
});
