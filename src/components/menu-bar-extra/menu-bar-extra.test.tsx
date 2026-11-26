import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuBar, MenuBarMenu } from "../menu-bar";
import { MenuItem } from "../menu-item";
import { MenuBarExtra, MenuBarExtraMenu, MenuBarExtras } from "./index";

function Bar({ onSearch = () => {} }) {
  return (
    <MenuBar
      aria-label="Finder menus"
      extras={
        <MenuBarExtras data-testid="extras">
          <MenuBarExtraMenu title={<svg aria-hidden="true" />} aria-label="Battery">
            <MenuItem>Show Percentage</MenuItem>
          </MenuBarExtraMenu>
          <MenuBarExtraMenu title="Stephen" emphasized popup={{ className: "users" }}>
            <MenuItem>Login Window…</MenuItem>
          </MenuBarExtraMenu>
          <MenuBarExtra aria-label="Spotlight" onClick={onSearch}>
            <svg aria-hidden="true" />
          </MenuBarExtra>
        </MenuBarExtras>
      }
    >
      <MenuBarMenu title="File">
        <MenuItem>New Window</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}

const extra = (name: string) => screen.getByRole("menuitem", { name });

describe("MenuBarExtras", () => {
  it("is a second menubar at the end of the bar, with a name of its own", () => {
    render(<Bar />);
    const extras = screen.getByRole("menubar", { name: "Status menus" });
    expect(extras).toBe(screen.getByTestId("extras"));
    expect(extras).toHaveClass("mac-menu-bar-extra-group");
    expect(extras.parentElement).toHaveClass("mac-menu-bar");
    expect(extras.previousElementSibling).toBe(
      screen.getByRole("menubar", { name: "Finder menus" }),
    );
    for (const name of ["Battery", "Stephen", "Spotlight"]) {
      expect(extras).toContainElement(extra(name));
      expect(extra(name)).toHaveClass("mac-menu-bar-title", "mac-menu-bar-extra");
    }
  });

  it("moves between the extras with the arrow keys, the one without a menu included", async () => {
    const user = userEvent.setup();
    render(<Bar />);
    extra("Battery").focus();
    await user.keyboard("{ArrowRight}");
    expect(extra("Stephen")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(extra("Spotlight")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(extra("Stephen")).toHaveFocus();
  });
});

describe("MenuBarExtraMenu", () => {
  it("opens its menu attached under the cell", async () => {
    const user = userEvent.setup();
    render(<Bar />);
    expect(extra("Stephen")).toHaveAttribute("data-emphasized");
    expect(extra("Battery")).not.toHaveAttribute("data-emphasized");
    expect(extra("Stephen")).toHaveAttribute("aria-haspopup", "menu");

    await user.click(extra("Stephen"));
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-menu", "users");
    expect(menu).toHaveAttribute("data-attached");
    expect(extra("Stephen")).toHaveAttribute("data-popup-open");
  });

  // Switching extras by moving the pointer along the bar needs real mouse events: it is
  // checked in a browser (menu-bar-extra.visual.json, hover-switch).
});

describe("MenuBarExtra", () => {
  it("acts when clicked and announces no menu", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<Bar onSearch={onSearch} />);
    const spotlight = extra("Spotlight");
    expect(spotlight).not.toHaveAttribute("aria-haspopup");
    expect(spotlight).not.toHaveAttribute("aria-expanded");
    expect(spotlight).not.toHaveAttribute("data-active");
    await user.click(spotlight);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    spotlight.focus();
    await user.keyboard("{Enter}");
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(spotlight).not.toHaveAttribute("data-popup-open");
  });

  it("is highlighted while active, and announces the panel its owner names", () => {
    render(
      <MenuBarExtras>
        <MenuBarExtra aria-label="Spotlight" active aria-expanded aria-controls="search-panel" />
      </MenuBarExtras>,
    );
    expect(extra("Spotlight")).toHaveAttribute("data-active");
    expect(extra("Spotlight")).toHaveAttribute("aria-expanded", "true");
    expect(extra("Spotlight")).toHaveAttribute("aria-controls", "search-panel");
    expect(extra("Spotlight")).not.toHaveAttribute("aria-haspopup");
  });
});
