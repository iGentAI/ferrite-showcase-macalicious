import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "./index";

describe("StatusBar", () => {
  it("is the information bar by default, with its text in a polite live region", () => {
    render(<StatusBar data-testid="bar">12 items, 250 GB available</StatusBar>);
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveClass("mac-status-bar");
    expect(bar).toHaveAttribute("data-variant", "information");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("12 items, 250 GB available");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it.each(["gradient", "flat", "breadcrumb"] as const)(
    "reflects the %s variant and is not a live region there",
    (variant) => {
      render(
        <StatusBar data-testid="bar" variant={variant}>
          Hardware
        </StatusBar>,
      );
      expect(screen.getByTestId("bar")).toHaveAttribute("data-variant", variant);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByText("Hardware")).not.toHaveAttribute("aria-live");
    },
  );

  it("places leading and trailing content beside the centred text", () => {
    const { container } = render(
      <StatusBar
        leading={<button type="button">Info</button>}
        trailing={<input type="range" aria-label="Icon size" />}
      >
        3 items
      </StatusBar>,
    );
    expect(container.querySelector(".mac-status-bar-leading")).toContainElement(
      screen.getByRole("button", { name: "Info" }),
    );
    expect(container.querySelector(".mac-status-bar-trailing")).toContainElement(
      screen.getByRole("slider", { name: "Icon size" }),
    );
    expect(container.querySelector(".mac-status-bar-center")).toHaveTextContent("3 items");
  });

  it("renders no leading or trailing box when there is nothing to put in it", () => {
    const { container } = render(<StatusBar leading={false}>3 items</StatusBar>);
    expect(container.querySelector(".mac-status-bar-leading")).toBeNull();
    expect(container.querySelector(".mac-status-bar-trailing")).toBeNull();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<StatusBar ref={ref} className="extra" id="status" />);
    expect(ref.current).toHaveClass("mac-status-bar", "extra");
    expect(ref.current).toHaveAttribute("id", "status");
  });
});
