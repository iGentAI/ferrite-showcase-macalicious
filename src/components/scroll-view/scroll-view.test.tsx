import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollView } from "./index";

/** jsdom has no layout: give every element a 100 pt box holding 400 pt of content. */
function overflowing(axis: "y" | "both" = "y") {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
    axis === "both" ? 400 : 100,
  );
}

/** The same for content that fits: a 100 pt box holding 100 pt of content. */
function fitting() {
  for (const name of ["clientHeight", "offsetHeight", "scrollHeight"] as const)
    vi.spyOn(HTMLElement.prototype, name, "get").mockReturnValue(100);
  for (const name of ["clientWidth", "offsetWidth", "scrollWidth"] as const)
    vi.spyOn(HTMLElement.prototype, name, "get").mockReturnValue(100);
}

/** Base UI measures the viewport in a microtask after mount. */
const measured = () => act(async () => {});

const scrollers = (root: HTMLElement) => root.querySelectorAll(".mac-scroll-view-scroller");

describe("ScrollView", () => {
  it("renders its children in a viewport, with overlay scroll bars by default", () => {
    render(<ScrollView data-testid="root">Content</ScrollView>);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-scroll-view");
    expect(root).toHaveAttribute("data-scroller-style", "overlay");
    expect(root).toHaveAttribute("data-knob-style", "default");
    expect(root).toHaveAttribute("data-size", "regular");
    const viewport = root.querySelector(".mac-scroll-view-viewport");
    expect(viewport).toHaveTextContent("Content");
  });

  it("reflects scroller style, knob style and size as data attributes", () => {
    render(
      <ScrollView data-testid="root" scrollerStyle="legacy" knobStyle="light" size="small">
        Content
      </ScrollView>,
    );
    const root = screen.getByTestId("root");
    expect(root).toHaveAttribute("data-scroller-style", "legacy");
    expect(root).toHaveAttribute("data-knob-style", "light");
    expect(root).toHaveAttribute("data-size", "small");
  });

  it("scrolls along the chosen axis only", () => {
    const { rerender } = render(
      <ScrollView viewportProps={{ "aria-label": "view" }}>Content</ScrollView>,
    );
    const viewport = screen.getByLabelText("view");
    expect(viewport.style.overflow).toBe("hidden scroll");
    rerender(
      <ScrollView axis="horizontal" viewportProps={{ "aria-label": "view" }}>
        Content
      </ScrollView>,
    );
    expect(viewport.style.overflow).toBe("scroll hidden");
    rerender(
      <ScrollView axis="both" viewportProps={{ "aria-label": "view" }}>
        Content
      </ScrollView>,
    );
    expect(viewport.style.overflow).toBe("scroll");
  });

  it("shows a vertical scroll bar with a knob when the content is taller than the view", async () => {
    overflowing();
    render(<ScrollView data-testid="root">Content</ScrollView>);
    await measured();
    const root = screen.getByTestId("root");
    expect(root).toHaveAttribute("data-has-overflow-y");
    expect(scrollers(root)).toHaveLength(1);
    const scroller = scrollers(root)[0];
    expect(scroller).toHaveAttribute("data-orientation", "vertical");
    expect(scroller?.querySelector(".mac-scroll-view-knob")).not.toBeNull();
    // Decorative: the content is scrolled natively, by keyboard and by assistive technology.
    expect(scroller).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no scroll bar when the content fits", async () => {
    fitting();
    render(<ScrollView data-testid="root">Content</ScrollView>);
    await measured();
    const root = screen.getByTestId("root");
    expect(root).not.toHaveAttribute("data-has-overflow-y");
    expect(scrollers(root)).toHaveLength(0);
  });

  it("shows both scroll bars and their corner with axis both", async () => {
    overflowing("both");
    render(
      <ScrollView data-testid="root" axis="both">
        Content
      </ScrollView>,
    );
    await measured();
    const root = screen.getByTestId("root");
    const orientations = [...scrollers(root)].map((el) => el.getAttribute("data-orientation"));
    expect(orientations.sort()).toEqual(["horizontal", "vertical"]);
    expect(root.querySelectorAll(":scope > .mac-scroll-view-corner")).toHaveLength(1);
  });

  it("never renders a horizontal scroll bar with the vertical axis", async () => {
    overflowing("both");
    render(<ScrollView data-testid="root">Content</ScrollView>);
    await measured();
    const root = screen.getByTestId("root");
    expect(scrollers(root)).toHaveLength(1);
    expect(scrollers(root)[0]).toHaveAttribute("data-orientation", "vertical");
  });

  it("marks the scroll bar while the user scrolls", async () => {
    overflowing();
    render(
      <ScrollView data-testid="root" viewportProps={{ "aria-label": "view" }}>
        Content
      </ScrollView>,
    );
    await measured();
    const viewport = screen.getByLabelText("view");
    const scroller = scrollers(screen.getByTestId("root"))[0];
    expect(scroller).not.toHaveAttribute("data-scrolling");
    fireEvent.wheel(viewport);
    viewport.scrollTop = 40;
    fireEvent.scroll(viewport);
    expect(scroller).toHaveAttribute("data-scrolling");
  });

  it("makes a scrollable viewport a tab stop and leaves one that fits out of the tab order", async () => {
    fitting();
    const { unmount } = render(
      <ScrollView viewportProps={{ "aria-label": "view" }}>Content</ScrollView>,
    );
    await measured();
    expect(screen.getByLabelText("view")).toHaveAttribute("tabindex", "-1");
    unmount();
    vi.restoreAllMocks();
    overflowing();
    render(<ScrollView viewportProps={{ "aria-label": "view" }}>Content</ScrollView>);
    await measured();
    expect(screen.getByLabelText("view")).toHaveAttribute("tabindex", "0");
  });

  it("passes viewportProps to the scrolling element", () => {
    const ref = createRef<HTMLDivElement>();
    const onScroll = vi.fn();
    render(
      <ScrollView
        viewportProps={{
          ref,
          onScroll,
          className: "extra",
          style: { padding: 4 },
          tabIndex: -1,
          "aria-label": "view",
        }}
      >
        Content
      </ScrollView>,
    );
    const viewport = screen.getByLabelText("view");
    expect(ref.current).toBe(viewport);
    expect(viewport).toHaveClass("mac-scroll-view-viewport", "extra");
    expect(viewport.style.padding).toBe("4px");
    expect(viewport.style.overflow).toBe("hidden scroll");
    expect(viewport).toHaveAttribute("tabindex", "-1");
    fireEvent.scroll(viewport);
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ScrollView ref={ref} className="extra" id="scroll" style={{ height: 120 }}>
        Content
      </ScrollView>,
    );
    expect(ref.current).toHaveClass("mac-scroll-view", "extra");
    expect(ref.current).toHaveAttribute("id", "scroll");
    expect(ref.current?.style.height).toBe("120px");
  });

  it("accepts Base UI's function form of className", () => {
    render(
      <ScrollView data-testid="root" className={(state) => (state.scrolling ? "moving" : "still")}>
        Content
      </ScrollView>,
    );
    expect(screen.getByTestId("root")).toHaveClass("mac-scroll-view", "still");
  });
});
