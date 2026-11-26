import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SmartListTile, SmartListTileGrid } from "./index";

describe("SmartListTile", () => {
  it("is a toggle button named by its name and count, not pressed by default", () => {
    render(<SmartListTile count={3}>Today</SmartListTile>);
    const tile = screen.getByRole("button", { name: "Today 3" });
    expect(tile).toHaveClass("mac-smart-list-tile");
    expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(tile).not.toHaveAttribute("data-pressed");
    expect(tile).toHaveAttribute("type", "button");
  });

  it("toggles on a click and with Space and Return, and reports the state", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(<SmartListTile onPressedChange={onPressedChange}>All</SmartListTile>);
    const tile = screen.getByRole("button", { name: "All" });
    await user.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(tile).toHaveAttribute("data-pressed");
    await user.keyboard(" ");
    expect(tile).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Enter}");
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(onPressedChange.mock.calls.map((call) => call[0])).toEqual([true, false, true]);
  });

  it("starts pressed with defaultPressed", () => {
    render(<SmartListTile defaultPressed>All</SmartListTile>);
    expect(screen.getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
  });

  it("stays as given when controlled, so that one tile of several is the one shown", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [shown, setShown] = useState("today");
      return (
        <SmartListTileGrid aria-label="Smart Lists">
          {["today", "all"].map((id) => (
            <SmartListTile
              key={id}
              pressed={shown === id}
              onPressedChange={(pressed) => {
                if (pressed) setShown(id);
              }}
            >
              {id}
            </SmartListTile>
          ))}
        </SmartListTileGrid>
      );
    }
    render(<Owner />);
    const today = screen.getByRole("button", { name: "today" });
    const all = screen.getByRole("button", { name: "all" });
    // A click on the tile that is shown leaves it shown.
    await user.click(today);
    expect(today).toHaveAttribute("aria-pressed", "true");
    await user.click(all);
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(today).toHaveAttribute("aria-pressed", "false");
  });

  it("hides the glyph from assistive technology and leaves out a count that is not given", () => {
    render(
      <SmartListTile icon={<svg data-testid="glyph" />} data-testid="tile">
        Flagged
      </SmartListTile>,
    );
    const disc = screen.getByTestId("glyph").parentElement;
    expect(disc).toHaveClass("mac-smart-list-tile-disc");
    expect(disc).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("tile").querySelector(".mac-smart-list-tile-count")).toBeNull();
    expect(screen.getByRole("button", { name: "Flagged" })).toBeInTheDocument();
  });

  it("shows a count of zero", () => {
    render(<SmartListTile count={0}>Today</SmartListTile>);
    expect(screen.getByRole("button", { name: "Today 0" })).toBeInTheDocument();
  });

  it("sets the list's colour from tint and keeps the owner's style", () => {
    render(
      <SmartListTile tint="#ff9500" style={{ margin: 4 }}>
        Scheduled
      </SmartListTile>,
    );
    const tile = screen.getByRole("button", { name: "Scheduled" });
    expect(tile.style.getPropertyValue("--mac-smart-list-tile-tint")).toBe("#ff9500");
    expect(tile.style.margin).toBe("4px");
  });

  it("passes props, className and ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <SmartListTile ref={ref} className="mine" id="t1">
        All
      </SmartListTile>,
    );
    const tile = screen.getByRole("button", { name: "All" });
    expect(ref.current).toBe(tile);
    expect(tile).toHaveClass("mac-smart-list-tile", "mine");
    expect(tile).toHaveAttribute("id", "t1");
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <SmartListTile disabled onPressedChange={onPressedChange}>
        All
      </SmartListTile>,
    );
    const tile = screen.getByRole("button", { name: "All" });
    expect(tile).toBeDisabled();
    await user.click(tile);
    expect(onPressedChange).not.toHaveBeenCalled();
  });
});

describe("SmartListTileGrid", () => {
  it("is a named group that passes props, className and ref to its root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SmartListTileGrid ref={ref} aria-label="Smart Lists" className="mine">
        <SmartListTile>All</SmartListTile>
      </SmartListTileGrid>,
    );
    const grid = screen.getByRole("group", { name: "Smart Lists" });
    expect(ref.current).toBe(grid);
    expect(grid).toHaveClass("mac-smart-list-tile-grid", "mine");
  });
});
