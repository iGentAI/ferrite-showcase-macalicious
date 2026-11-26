import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { HomekitTile, HomekitTileGrid } from "./index";

describe("HomekitTile", () => {
  it("is a toggle button named by its lines, off by default", () => {
    render(<HomekitTile room="Front" name="Light" status="Off" />);
    const tile = screen.getByRole("button", { name: "Front Light Off" });
    expect(tile).toHaveClass("mac-homekit-tile");
    expect(tile).toHaveAttribute("data-kind", "accessory");
    expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(tile).not.toHaveAttribute("data-active");
  });

  it("toggles on a click and with Space and Return, and reports the state", async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();
    render(<HomekitTile name="Light" onActiveChange={onActiveChange} />);
    const tile = screen.getByRole("button", { name: "Light" });
    await user.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(tile).toHaveAttribute("data-active", "");
    await user.keyboard(" ");
    expect(tile).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Enter}");
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(onActiveChange.mock.calls.map((call) => call[0])).toEqual([true, false, true]);
  });

  it("starts on with defaultActive", () => {
    render(<HomekitTile name="Light" defaultActive />);
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  });

  it("stays as given when controlled, and follows its owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [on, setOn] = useState(false);
      return (
        <>
          <HomekitTile name="Held" active={false} />
          <HomekitTile name="Owned" active={on} onActiveChange={setOn} />
        </>
      );
    }
    render(<Owner />);
    await user.click(screen.getByRole("button", { name: "Held" }));
    expect(screen.getByRole("button", { name: "Held" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Owned" }));
    expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
  });

  it("hides the glyph and its badge from assistive technology", () => {
    render(
      <HomekitTile
        name="HomePod"
        icon={<svg data-testid="glyph" />}
        badge={<svg data-testid="badge" />}
      />,
    );
    const icon = screen.getByTestId("glyph").parentElement;
    expect(icon).toHaveClass("mac-homekit-tile-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("badge").parentElement).toHaveClass("mac-homekit-tile-badge");
    expect(screen.getByRole("button", { name: "HomePod" })).toBeInTheDocument();
  });

  it("renders no glyph slot and no empty lines when they are not given", () => {
    render(<HomekitTile name="Light" data-testid="tile" />);
    const tile = screen.getByTestId("tile");
    expect(tile.querySelector(".mac-homekit-tile-icon")).toBeNull();
    expect(tile.querySelector(".mac-homekit-tile-room")).toBeNull();
    expect(tile.querySelector(".mac-homekit-tile-status")).toBeNull();
  });

  it("sets the glyph's colour from tint and keeps the owner's style", () => {
    render(<HomekitTile name="Lamp" tint="#34aadc" style={{ margin: 4 }} />);
    const tile = screen.getByRole("button", { name: "Lamp" });
    expect(tile.style.getPropertyValue("--mac-homekit-tile-tint")).toBe("#34aadc");
    expect(tile.style.margin).toBe("4px");
  });

  it("asks for more contrast with an attribute, and not by default", () => {
    render(
      <>
        <HomekitTile name="Plain" />
        <HomekitTile name="Clear" contrast="more" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Plain" })).not.toHaveAttribute("data-contrast");
    expect(screen.getByRole("button", { name: "Clear" })).toHaveAttribute("data-contrast", "more");
  });

  it("passes props, className and ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<HomekitTile ref={ref} name="Light" className="mine" id="t1" />);
    const tile = screen.getByRole("button", { name: "Light" });
    expect(ref.current).toBe(tile);
    expect(tile).toHaveClass("mac-homekit-tile", "mine");
    expect(tile).toHaveAttribute("id", "t1");
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();
    render(
      <HomekitTile name="Light" status="No Response" disabled onActiveChange={onActiveChange} />,
    );
    const tile = screen.getByRole("button", { name: "Light No Response" });
    expect(tile).toBeDisabled();
    await user.click(tile);
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  describe("scene", () => {
    it("is a button with one line that runs on a click and does not toggle by itself", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onActiveChange = vi.fn();
      render(
        <HomekitTile
          kind="scene"
          name="Good Night"
          room="Ignored"
          status="Ignored"
          onClick={onClick}
          onActiveChange={onActiveChange}
        />,
      );
      const tile = screen.getByRole("button", { name: "Good Night" });
      expect(tile).toHaveAttribute("data-kind", "scene");
      expect(tile).toHaveAttribute("aria-pressed", "false");
      await user.click(tile);
      await user.keyboard("{Enter}");
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(onActiveChange).not.toHaveBeenCalled();
      expect(tile).not.toHaveAttribute("data-active");
      expect(tile).toHaveAttribute("aria-pressed", "false");
    });

    it("shows the active look and says so to assistive technology when its owner says so", () => {
      const { rerender } = render(<HomekitTile kind="scene" name="Good Night" active />);
      const tile = screen.getByRole("button", { name: "Good Night", pressed: true });
      expect(tile).toHaveAttribute("data-active", "");
      rerender(<HomekitTile kind="scene" name="Good Night" active={false} />);
      expect(tile).toHaveAttribute("aria-pressed", "false");
      expect(tile).not.toHaveAttribute("data-active");
    });

    it("leaves aria-pressed to its owner when the owner sets it", () => {
      render(<HomekitTile kind="scene" name="Good Night" active aria-pressed="mixed" />);
      expect(screen.getByRole("button", { name: "Good Night" })).toHaveAttribute(
        "aria-pressed",
        "mixed",
      );
    });
  });
});

describe("HomekitTileGrid", () => {
  it("is a named group that passes props, className and ref to its root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <HomekitTileGrid ref={ref} aria-label="Favorite Accessories" className="mine">
        <HomekitTile name="Light" />
      </HomekitTileGrid>,
    );
    const grid = screen.getByRole("group", { name: "Favorite Accessories" });
    expect(ref.current).toBe(grid);
    expect(grid).toHaveClass("mac-homekit-tile-grid", "mine");
  });

  it("takes its name from a heading", () => {
    render(
      <>
        <h2 id="scenes">Favorite Scenes</h2>
        <HomekitTileGrid aria-labelledby="scenes" />
      </>,
    );
    expect(screen.getByRole("group", { name: "Favorite Scenes" })).toBeInTheDocument();
  });
});
