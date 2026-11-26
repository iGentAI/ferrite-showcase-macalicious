import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MenuItem } from "../menu-item";
import { MenuBar, MenuBarMenu } from "./menu-bar";

function Bar() {
  return (
    <MenuBar aria-label="Menus" modal={false}>
      <MenuBarMenu title="View">
        <MenuItem>Enter Full Screen</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Window">
        <MenuItem>Minimize</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}

const openMenus = () => document.querySelectorAll('[role="menu"][data-open]');

describe("a click on another title while a menu is open", () => {
  it("shows that title's menu: the pointer opened it on the way, and the click closes nothing", async () => {
    const user = userEvent.setup();
    render(<Bar />);
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(await screen.findByRole("menuitem", { name: "Enter Full Screen" })).toBeVisible();
    // Pointing at Window while View is open switches to it; the click that follows is the person choosing the title.
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByRole("menuitem", { name: "Minimize" })).toBeVisible();
    expect(openMenus()).toHaveLength(1);
  });

  it("closes on a second click right away: only the click that follows the switch is the person choosing the title", async () => {
    const user = userEvent.setup();
    render(<Bar />);
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(await screen.findByRole("menuitem", { name: "Enter Full Screen" })).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    expect(await screen.findByRole("menuitem", { name: "Minimize" })).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(openMenus()).toHaveLength(0);
  });

  it("still closes the open menu when its own title is clicked", async () => {
    const user = userEvent.setup();
    render(<Bar />);
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(await screen.findByRole("menuitem", { name: "Enter Full Screen" })).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(openMenus()).toHaveLength(0);
  });
});
