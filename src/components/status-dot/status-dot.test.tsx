import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { StatusDot } from "./index";

describe("StatusDot", () => {
  it("is decorative by default: hidden from assistive technology, grey, regular size", () => {
    render(<StatusDot data-testid="dot" />);
    const dot = screen.getByTestId("dot");
    expect(dot).toHaveClass("mac-status-dot");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).not.toHaveAttribute("role");
    expect(dot).toHaveAttribute("data-status", "none");
    expect(dot).toHaveAttribute("data-size", "regular");
  });

  it("reflects status and size as data attributes", () => {
    render(<StatusDot data-testid="dot" status="unavailable" size="small" />);
    const dot = screen.getByTestId("dot");
    expect(dot).toHaveAttribute("data-status", "unavailable");
    expect(dot).toHaveAttribute("data-size", "small");
  });

  it("becomes an image when it is given a name", () => {
    render(<StatusDot status="available" aria-label="Connected" />);
    const dot = screen.getByRole("img", { name: "Connected" });
    expect(dot).not.toHaveAttribute("aria-hidden");
    expect(dot).toHaveAttribute("data-status", "available");
  });

  it("can be named by another element", () => {
    render(
      <>
        <StatusDot status="available" aria-labelledby="state" />
        <span id="state">File Sharing: On</span>
      </>,
    );
    expect(screen.getByRole("img", { name: "File Sharing: On" })).toBeInTheDocument();
  });

  it("is not focusable", () => {
    render(<StatusDot aria-label="Connected" />);
    expect(screen.getByRole("img")).not.toHaveAttribute("tabindex");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<StatusDot ref={ref} className="extra" id="dot" style={{ marginRight: 6 }} />);
    expect(ref.current).toHaveClass("mac-status-dot", "extra");
    expect(ref.current).toHaveAttribute("id", "dot");
    expect(ref.current?.style.marginRight).toBe("6px");
  });
});
