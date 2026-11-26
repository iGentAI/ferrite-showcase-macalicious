import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressSpinner } from "./index";

/** A stand-in for IntersectionObserver that the test drives by hand. */
function fakeIntersectionObserver() {
  const observed = new Set<Element>();
  let report: IntersectionObserverCallback = () => {};
  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      report = callback;
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

describe("ProgressSpinner", () => {
  it("is an indeterminate, animating, regular-size progress indicator by default", () => {
    render(<ProgressSpinner aria-label="Loading" />);
    const spinner = screen.getByRole("progressbar", { name: "Loading" });
    expect(spinner).toHaveClass("mac-progress-spinner");
    expect(spinner).not.toHaveAttribute("aria-valuenow");
    expect(spinner).toHaveAttribute("data-indeterminate");
    expect(spinner).toHaveAttribute("data-animating");
    expect(spinner).not.toHaveAttribute("data-displayed-when-stopped");
    expect(spinner).toHaveAttribute("data-size", "regular");
    expect(spinner.querySelector(".mac-progress-spinner-spokes")).toBeInTheDocument();
    expect(spinner.querySelector(".mac-progress-spinner-pie")).not.toBeInTheDocument();
  });

  it("reflects size, a stopped animation and displayedWhenStopped as data attributes", () => {
    render(
      <ProgressSpinner size="mini" animating={false} displayedWhenStopped aria-label="Loading" />,
    );
    const spinner = screen.getByRole("progressbar");
    expect(spinner).toHaveAttribute("data-size", "mini");
    expect(spinner).not.toHaveAttribute("data-animating");
    expect(spinner).toHaveAttribute("data-displayed-when-stopped");
  });

  it("shows the determinate form with a value and reports it", () => {
    render(<ProgressSpinner value={3} max={12} aria-label="Downloading" />);
    const spinner = screen.getByRole("progressbar");
    expect(spinner).toHaveAttribute("aria-valuenow", "3");
    expect(spinner).toHaveAttribute("aria-valuemax", "12");
    expect(spinner).toHaveAttribute("data-progressing");
    const pie = spinner.querySelector<HTMLElement>(".mac-progress-spinner-pie");
    expect(pie?.style.getPropertyValue("--_fraction")).toBe("0.25");
    expect(spinner.querySelector(".mac-progress-spinner-spokes")).not.toBeInTheDocument();
  });

  it("keeps the filled part between nothing and the whole circle", () => {
    const { rerender } = render(<ProgressSpinner value={250} aria-label="Downloading" />);
    const fraction = () =>
      screen
        .getByRole("progressbar")
        .querySelector<HTMLElement>(".mac-progress-spinner-pie")
        ?.style.getPropertyValue("--_fraction");
    expect(fraction()).toBe("1");
    rerender(<ProgressSpinner value={-5} aria-label="Downloading" />);
    expect(fraction()).toBe("0");
  });

  it("is not focusable", () => {
    render(<ProgressSpinner aria-label="Loading" />);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("tabindex");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<ProgressSpinner className="extra" aria-label="Loading" />);
    expect(screen.getByRole("progressbar")).toHaveClass("mac-progress-spinner", "extra");

    rerender(<ProgressSpinner className={(state) => state.status} aria-label="Loading" />);
    expect(screen.getByRole("progressbar")).toHaveClass("mac-progress-spinner", "indeterminate");
  });

  it("forwards ref and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    const { unmount } = render(<ProgressSpinner ref={ref} id="spinner" aria-label="Loading" />);
    expect(ref.current).toBe(screen.getByRole("progressbar"));
    expect(ref.current).toHaveAttribute("id", "spinner");
    unmount();
    expect(ref.current).toBeNull();
  });

  it("runs the cleanup a callback ref returns, and calls one without a cleanup with null", () => {
    const cleanup = vi.fn();
    const withCleanup = vi.fn((_element: HTMLDivElement | null) => cleanup);
    const first = render(<ProgressSpinner ref={withCleanup} aria-label="Loading" />);
    first.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(withCleanup).toHaveBeenCalledTimes(1);

    const plain = vi.fn();
    const second = render(<ProgressSpinner ref={plain} aria-label="Loading" />);
    expect(plain).toHaveBeenLastCalledWith(screen.getByRole("progressbar"));
    second.unmount();
    expect(plain).toHaveBeenLastCalledWith(null);
  });

  it("marks a spinning spinner while it is off screen, and stops watching it on unmount", () => {
    const viewport = fakeIntersectionObserver();
    const { unmount } = render(<ProgressSpinner aria-label="Loading" />);
    const spinner = screen.getByRole("progressbar");
    expect(viewport.observed.has(spinner)).toBe(true);

    viewport.scroll(spinner, false);
    expect(spinner).toHaveAttribute("data-offscreen");
    viewport.scroll(spinner, true);
    expect(spinner).not.toHaveAttribute("data-offscreen");

    unmount();
    expect(viewport.observed.size).toBe(0);
  });

  it("does not watch a stopped or a determinate spinner", () => {
    const viewport = fakeIntersectionObserver();
    const { rerender } = render(<ProgressSpinner animating={false} aria-label="Loading" />);
    expect(viewport.observed.size).toBe(0);
    rerender(<ProgressSpinner value={30} aria-label="Loading" />);
    expect(viewport.observed.size).toBe(0);
    rerender(<ProgressSpinner aria-label="Loading" />);
    expect(viewport.observed.size).toBe(1);
  });
});
