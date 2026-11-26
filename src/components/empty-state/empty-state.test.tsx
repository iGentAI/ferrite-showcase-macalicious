import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./index";

describe("EmptyState", () => {
  it("renders its text in a div with the plain variant", () => {
    render(<EmptyState data-testid="empty">No Selection</EmptyState>);
    const root = screen.getByTestId("empty");
    expect(root.tagName).toBe("DIV");
    expect(root).toHaveClass("mac-empty-state");
    expect(root).toHaveAttribute("data-variant", "plain");
    expect(root).toHaveTextContent("No Selection");
  });

  it("reflects the variant", () => {
    render(
      <EmptyState data-testid="empty" variant="capsule">
        Drag files here.
      </EmptyState>,
    );
    expect(screen.getByTestId("empty")).toHaveAttribute("data-variant", "capsule");
  });

  it("is static text: no role of its own and not focusable", async () => {
    const user = userEvent.setup();
    render(<EmptyState data-testid="empty">No Selection</EmptyState>);
    const root = screen.getByTestId("empty");
    expect(root).not.toHaveAttribute("role");
    expect(root).not.toHaveAttribute("tabindex");
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("can be a live region for a result that appears after an action", () => {
    render(<EmptyState role="status">No Results</EmptyState>);
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
  });

  it("renders another element through render, keeping its class and text", () => {
    render(
      <EmptyState render={<section aria-label="Viewer" />} variant="capsule">
        No Message Selected
      </EmptyState>,
    );
    const region = screen.getByRole("region", { name: "Viewer" });
    expect(region.tagName).toBe("SECTION");
    expect(region).toHaveClass("mac-empty-state");
    expect(region).toHaveAttribute("data-variant", "capsule");
    expect(region).toHaveTextContent("No Message Selected");
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <EmptyState ref={ref} className="viewer" style={{ height: 200 }} id="empty">
        No Selection
      </EmptyState>,
    );
    expect(ref.current).toHaveClass("mac-empty-state", "viewer");
    expect(ref.current).toHaveStyle({ height: "200px" });
    expect(ref.current).toHaveAttribute("id", "empty");
  });
});
