import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Separator } from "./index";

describe("Separator", () => {
  it("renders a horizontal separator by default", () => {
    render(<Separator />);
    const separator = screen.getByRole("separator");
    expect(separator).toHaveClass("mac-separator");
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("reflects a vertical orientation to CSS and to assistive technology", () => {
    render(<Separator orientation="vertical" />);
    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
  });

  it("is not focusable", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).not.toHaveAttribute("tabindex");
  });

  it("can be hidden from assistive technology when it is purely visual", () => {
    render(<Separator aria-hidden data-testid="line" />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByTestId("line")).toHaveClass("mac-separator");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<Separator className="extra" />);
    expect(screen.getByRole("separator")).toHaveClass("mac-separator", "extra");

    rerender(<Separator orientation="vertical" className={(state) => `is-${state.orientation}`} />);
    expect(screen.getByRole("separator")).toHaveClass("mac-separator", "is-vertical");
  });

  it("forwards ref and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Separator ref={ref} id="line" style={{ marginBlock: 20 }} />);
    expect(ref.current).toBe(screen.getByRole("separator"));
    expect(ref.current).toHaveAttribute("id", "line");
  });

  it("can render another element through Base UI's render prop", () => {
    render(<Separator render={<hr />} />);
    const separator = screen.getByRole("separator");
    expect(separator.tagName).toBe("HR");
    expect(separator).toHaveClass("mac-separator");
  });
});
