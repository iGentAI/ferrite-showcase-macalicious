import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TitleBar } from "../title-bar";
import ManagerHooks from "./examples/manager-hooks";
import { Window, WindowBody } from "./index";

describe("Window", () => {
  it("is a region that always writes its state, key by default", () => {
    render(<Window aria-label="Notes">Body</Window>);
    const frame = screen.getByRole("region", { name: "Notes" });
    expect(frame).toHaveClass("mac-window");
    expect(frame).toHaveAttribute("data-window-state", "key");
    expect(frame).toHaveAttribute("data-variant", "standard");
    expect(frame).not.toHaveAttribute("data-full-screen");
    expect(frame).not.toHaveAttribute("data-top-highlight");
  });

  it("marks a window that asks for the top highlight rows", () => {
    render(<Window topHighlight aria-label="App Store" />);
    expect(screen.getByRole("region", { name: "App Store" })).toHaveAttribute(
      "data-top-highlight",
      "",
    );
  });

  it("keeps both marks for a full-screen window that asks for the top highlight rows", () => {
    render(<Window topHighlight fullScreen aria-label="App Store" />);
    const frame = screen.getByRole("region", { name: "App Store" });
    // The stylesheet drops the rows with the rim in full screen (window.browser.test.tsx).
    expect(frame).toHaveAttribute("data-top-highlight", "");
    expect(frame).toHaveAttribute("data-full-screen", "");
    expect(frame).toHaveAttribute("data-level", "none");
  });

  it.each(["key", "main", "inactive"] as const)("exposes the %s state to its content", (state) => {
    render(
      <Window state={state} aria-label="Notes">
        <button type="button">OK</button>
      </Window>,
    );
    const button = screen.getByRole("button", { name: "OK" });
    expect(button.closest("[data-window-state]")).toHaveAttribute("data-window-state", state);
  });

  it("is named by the title of the title bar inside it", () => {
    render(
      <Window>
        <TitleBar title="Untitled" />
      </Window>,
    );
    expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument();
  });

  it("keeps an explicit name over the title", () => {
    render(
      <Window aria-label="Document">
        <TitleBar title="Untitled" />
      </Window>,
    );
    const frame = screen.getByRole("region", { name: "Document" });
    expect(frame).not.toHaveAttribute("aria-labelledby");
  });

  it("drops the generated title reference when the title goes, and takes it back", () => {
    const { rerender } = render(
      <Window data-testid="frame">
        <TitleBar title="Untitled" />
      </Window>,
    );
    const frame = screen.getByTestId("frame");
    const titleId = screen.getByText("Untitled").id;
    expect(titleId).not.toBe("");
    expect(frame).toHaveAttribute("aria-labelledby", titleId);

    rerender(
      <Window data-testid="frame">
        <TitleBar />
      </Window>,
    );
    expect(frame).not.toHaveAttribute("aria-labelledby");

    rerender(
      <Window data-testid="frame">
        <TitleBar title="Renamed" />
      </Window>,
    );
    expect(frame).toHaveAttribute("aria-labelledby", screen.getByText("Renamed").id);
    expect(frame).toHaveAccessibleName("Renamed");
  });

  it("takes its size from width and height, and lets style override and position it", () => {
    render(<Window aria-label="Sized" width={480} height="50%" style={{ left: 20, width: 500 }} />);
    const frame = screen.getByRole("region");
    expect(frame).toHaveStyle({ width: "500px", height: "50%", left: "20px" });
  });

  it("casts the panel shadow as a panel and none in full screen", () => {
    const { rerender } = render(<Window aria-label="Help" variant="panel" />);
    const frame = screen.getByRole("region");
    expect(frame).toHaveAttribute("data-variant", "panel");
    expect(frame).toHaveAttribute("data-level", "panel");

    rerender(<Window aria-label="Help" fullScreen />);
    expect(frame).toHaveAttribute("data-full-screen");
    expect(frame).toHaveAttribute("data-level", "none");
  });

  it("accepts another role, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Window ref={ref} role="dialog" aria-label="Go to Folder" className="extra" id="go" />);
    const dialog = screen.getByRole("dialog", { name: "Go to Folder" });
    expect(ref.current).toBe(dialog);
    expect(dialog).toHaveClass("mac-window", "mac-window-shadow", "extra");
    expect(dialog).toHaveAttribute("id", "go");
  });
});

describe("WindowBody", () => {
  it("defaults to the window background and can use the content background", () => {
    const { rerender } = render(<WindowBody data-testid="body">Content</WindowBody>);
    const body = screen.getByTestId("body");
    expect(body).toHaveClass("mac-window-body");
    expect(body).toHaveAttribute("data-background", "window");

    rerender(
      <WindowBody data-testid="body" background="content">
        Content
      </WindowBody>,
    );
    expect(body).toHaveAttribute("data-background", "content");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<WindowBody ref={ref} className="extra" id="body" />);
    expect(ref.current).toHaveClass("mac-window-body", "extra");
    expect(ref.current).toHaveAttribute("id", "body");
  });
});

describe("the manager-hooks example", () => {
  // jsdom has no pointer capture. This stands in for the browser's record of the pointers an
  // element holds, for this file only; the events below are dispatched on the bar itself,
  // where a captured pointer's events go.
  const METHODS = ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"] as const;
  const originals = METHODS.map((name) => Object.getOwnPropertyDescriptor(Element.prototype, name));
  const captured = new WeakMap<Element, Set<number>>();
  const held = (element: Element) => {
    const pointers = captured.get(element) ?? new Set<number>();
    captured.set(element, pointers);
    return pointers;
  };

  beforeAll(() => {
    Object.assign(Element.prototype, {
      setPointerCapture(this: Element, pointerId: number) {
        held(this).add(pointerId);
      },
      releasePointerCapture(this: Element, pointerId: number) {
        held(this).delete(pointerId);
      },
      hasPointerCapture(this: Element, pointerId: number) {
        return held(this).has(pointerId);
      },
    });
  });

  afterAll(() => {
    METHODS.forEach((name, index) => {
      const original = originals[index];
      if (original) Object.defineProperty(Element.prototype, name, original);
      else Reflect.deleteProperty(Element.prototype, name);
    });
  });

  function second() {
    const { unmount } = render(<ManagerHooks />);
    const frame = screen.getByRole("region", { name: "Second" });
    const bar = frame.querySelector("[data-window-drag-region]") as HTMLElement;
    return { frame, bar, unmount };
  }

  it("moves a window with the pointer that pressed its title bar, and with no other", () => {
    const { frame, bar } = second();
    expect(frame).toHaveStyle({ left: "150px", top: "70px" });

    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 200, clientY: 80 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 210, clientY: 85 });
    expect(frame).toHaveStyle({ left: "160px", top: "75px" });

    // Another finger moving over the bar and lifting neither moves the window nor ends the drag.
    fireEvent.pointerMove(bar, { pointerId: 2, clientX: 400, clientY: 300 });
    fireEvent.pointerUp(bar, { pointerId: 2 });
    expect(frame).toHaveStyle({ left: "160px", top: "75px" });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 220, clientY: 90 });
    expect(frame).toHaveStyle({ left: "170px", top: "80px" });

    fireEvent.pointerUp(bar, { pointerId: 1 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 300, clientY: 200 });
    expect(frame).toHaveStyle({ left: "170px", top: "80px" });
  });

  it("hands the drag to a second pointer that presses the same title bar", () => {
    const { frame, bar } = second();
    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 200, clientY: 80 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 210, clientY: 85 });
    fireEvent.pointerDown(bar, { pointerId: 2, button: 0, clientX: 300, clientY: 80 });

    // Two drags of one window would each place it from their own starting point.
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 250, clientY: 100 });
    expect(frame).toHaveStyle({ left: "160px", top: "75px" });
    fireEvent.pointerMove(bar, { pointerId: 2, clientX: 305, clientY: 90 });
    expect(frame).toHaveStyle({ left: "165px", top: "85px" });

    // The first pointer no longer drags, so the bar does not keep it captured either.
    expect(bar.hasPointerCapture(1)).toBe(false);
    expect(bar.hasPointerCapture(2)).toBe(true);
  });

  it("lets go of the pointer when the dragged window is closed", () => {
    const { frame, bar } = second();
    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 200, clientY: 80 });
    expect(bar.hasPointerCapture(1)).toBe(true);

    fireEvent.click(within(frame).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Second" })).toBeNull();
    expect(bar.hasPointerCapture(1)).toBe(false);
  });

  it("lets go of the pointer when the manager goes away during a drag", () => {
    const { bar, unmount } = second();
    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 200, clientY: 80 });
    unmount();
    expect(bar.hasPointerCapture(1)).toBe(false);
  });
});
