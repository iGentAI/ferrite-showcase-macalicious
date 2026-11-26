import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressBar } from "./index";

/** A stand-in for IntersectionObserver that the test drives by hand. */
function fakeIntersectionObserver() {
  const observed = new Set<Element>();
  let report: IntersectionObserverCallback = () => {};
  let instances = 0;
  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      report = callback;
      instances++;
    }
    observe(element: Element) {
      observed.add(element);
    }
    unobserve(element: Element) {
      observed.delete(element);
    }
    disconnect() {
      observed.clear();
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return {
    observed,
    instances: () => instances,
    scroll(element: Element, isIntersecting: boolean) {
      act(() => {
        report(
          [{ target: element, isIntersecting } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProgressBar", () => {
  it("is indeterminate and animating by default", () => {
    render(<ProgressBar aria-label="Copying" />);
    const bar = screen.getByRole("progressbar", { name: "Copying" });
    expect(bar).toHaveClass("mac-progress-bar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("data-indeterminate");
    expect(bar).toHaveAttribute("data-animating");
    expect(bar).toHaveAttribute("data-size", "regular");
  });

  it("reports a determinate value to assistive technology", () => {
    render(<ProgressBar value={64} aria-label="Backing up" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "64");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("data-progressing");
    expect(bar).not.toHaveAttribute("data-indeterminate");
  });

  it("sizes the fill from the value within min and max", () => {
    const { container, rerender } = render(
      <ProgressBar value={3} min={0} max={12} aria-label="Step" />,
    );
    const fill = container.querySelector<HTMLElement>(".mac-progress-bar-indicator");
    expect(fill?.style.width).toBe("25%");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "12");

    rerender(<ProgressBar value={12} min={0} max={12} aria-label="Step" />);
    expect(fill?.style.width).toBe("100%");
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-complete");
  });

  it("does not size the fill while indeterminate", () => {
    const { container } = render(<ProgressBar aria-label="Working" />);
    const fill = container.querySelector<HTMLElement>(".mac-progress-bar-indicator");
    expect(fill?.style.width).toBe("");
    expect(fill).toHaveAttribute("data-indeterminate");
  });

  it("reflects size and a stopped animation as data attributes", () => {
    render(<ProgressBar size="small" animating={false} aria-label="Working" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("data-size", "small");
    expect(bar).not.toHaveAttribute("data-animating");
  });

  it("is not focusable", () => {
    render(<ProgressBar value={10} aria-label="Working" />);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("tabindex");
  });

  it("passes a custom value text through", () => {
    render(
      <ProgressBar
        value={2}
        max={8}
        getAriaValueText={(_, value) => `${value} of 8 items`}
        aria-label="Copying"
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "2 of 8 items");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<ProgressBar className="extra" aria-label="Working" />);
    expect(screen.getByRole("progressbar")).toHaveClass("mac-progress-bar", "extra");

    rerender(<ProgressBar value={100} className={(state) => state.status} aria-label="Working" />);
    expect(screen.getByRole("progressbar")).toHaveClass("mac-progress-bar", "complete");
  });

  it("forwards ref and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    const { unmount } = render(
      <ProgressBar ref={ref} id="bar" style={{ width: 200 }} aria-label="Working" />,
    );
    expect(ref.current).toBe(screen.getByRole("progressbar"));
    expect(ref.current).toHaveAttribute("id", "bar");
    expect(ref.current?.style.width).toBe("200px");
    unmount();
    expect(ref.current).toBeNull();
  });

  it("supports a callback ref", () => {
    const ref = vi.fn();
    const { unmount } = render(<ProgressBar ref={ref} aria-label="Working" />);
    expect(ref).toHaveBeenLastCalledWith(screen.getByRole("progressbar"));
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it("runs the cleanup a callback ref returns instead of calling it with null", () => {
    const cleanup = vi.fn();
    const ref = vi.fn((_element: HTMLDivElement | null) => cleanup);
    const { unmount } = render(<ProgressBar ref={ref} aria-label="Working" />);
    expect(ref).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledTimes(1);
  });

  it("marks an animating indeterminate bar while it is off screen, and stops watching it on unmount", () => {
    const viewport = fakeIntersectionObserver();
    const { unmount } = render(<ProgressBar aria-label="Working" />);
    const bar = screen.getByRole("progressbar");
    expect(viewport.observed.has(bar)).toBe(true);
    expect(bar).not.toHaveAttribute("data-offscreen");

    viewport.scroll(bar, false);
    expect(bar).toHaveAttribute("data-offscreen");
    viewport.scroll(bar, true);
    expect(bar).not.toHaveAttribute("data-offscreen");

    unmount();
    expect(viewport.observed.size).toBe(0);
  });

  it("does not watch a bar that has nothing to animate", () => {
    const viewport = fakeIntersectionObserver();
    const { rerender } = render(<ProgressBar value={40} aria-label="Working" />);
    expect(viewport.observed.size).toBe(0);

    rerender(<ProgressBar animating={false} aria-label="Working" />);
    expect(viewport.observed.size).toBe(0);

    rerender(<ProgressBar aria-label="Working" />);
    expect(viewport.observed.size).toBe(1);

    // Becoming determinate stops the watch and clears the mark.
    const bar = screen.getByRole("progressbar");
    viewport.scroll(bar, false);
    rerender(<ProgressBar value={10} aria-label="Working" />);
    expect(viewport.observed.size).toBe(0);
    expect(bar).not.toHaveAttribute("data-offscreen");
  });

  it("shares one observer between bars", () => {
    const viewport = fakeIntersectionObserver();
    render(
      <>
        <ProgressBar aria-label="One" />
        <ProgressBar aria-label="Two" />
      </>,
    );
    expect(viewport.observed.size).toBe(2);
    expect(viewport.instances()).toBe(1);
  });
});
