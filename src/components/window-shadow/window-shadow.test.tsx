import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { WindowShadow } from "./index";

describe("WindowShadow", () => {
  it("casts the window shadow by default", () => {
    render(<WindowShadow data-testid="surface">Content</WindowShadow>);
    const surface = screen.getByTestId("surface");
    expect(surface).toHaveClass("mac-window-shadow");
    expect(surface).toHaveAttribute("data-level", "window");
    expect(surface).toHaveTextContent("Content");
  });

  it.each(["window", "panel", "menu", "popover", "banner", "none"] as const)(
    "reflects the %s level",
    (level) => {
      render(<WindowShadow level={level} data-testid="surface" />);
      expect(screen.getByTestId("surface")).toHaveAttribute("data-level", level);
    },
  );

  it("forwards ref, className, style and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <WindowShadow ref={ref} className="extra" id="surface" style={{ width: 120 }} role="note" />,
    );
    expect(ref.current).toBe(screen.getByRole("note"));
    expect(ref.current).toHaveClass("mac-window-shadow", "extra");
    expect(ref.current).toHaveAttribute("id", "surface");
    expect(ref.current).toHaveStyle({ width: "120px" });
  });
});
