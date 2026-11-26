import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WindowControls } from "./window-controls";

describe("a dimmed zoom button", () => {
  it("says the window has a fixed size", () => {
    render(<WindowControls zoomDisabled />);
    const zoom = screen.getByRole("button", { name: "Enter Full Screen" });
    expect(zoom).toBeDisabled();
    expect(zoom).toHaveAttribute("title", "This window has a fixed size");
    expect(zoom).toHaveAccessibleDescription("This window has a fixed size");
  });

  it("gives the reason it is told", () => {
    render(<WindowControls zoomDisabled zoomDisabledReason="A sheet is open" />);
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toHaveAttribute(
      "title",
      "A sheet is open",
    );
  });

  it("carries no reason while it is enabled", () => {
    render(<WindowControls />);
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).not.toHaveAttribute("title");
  });

  it("leaves the reason to the group when the group has one of its own (a panel's)", () => {
    render(
      <WindowControls
        zoomDisabled
        title="A panel closes; it does not minimize or go full screen"
      />,
    );
    expect(screen.getByRole("group", { name: "Window controls" })).toHaveAttribute(
      "title",
      "A panel closes; it does not minimize or go full screen",
    );
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).not.toHaveAttribute("title");
  });

  it("still gives an explicit reason over the group's", () => {
    render(
      <WindowControls zoomDisabled zoomDisabledReason="A sheet is open" title="A panel closes" />,
    );
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toHaveAttribute(
      "title",
      "A sheet is open",
    );
  });
});
