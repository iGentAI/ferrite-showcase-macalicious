import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Stocks } from "./stocks";

afterEach(() => {
  document.body.textContent = "";
});

function EditMenu() {
  const items = useDesktopAppMenuItems("stocks", "Edit");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Edit">{items}</MenuBarMenu>
    </MenuBar>
  );
}

const state = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("menuitem", { name: "Edit" }));
  const row = await screen.findByRole("menuitem", { name });
  const dimmed = row.getAttribute("aria-disabled") === "true";
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menuitem", { name })).toBeNull());
  return dimmed;
};

describe("Stocks' Edit menu", () => {
  it("acts on the search field while it has the keyboard, and is dimmed with nothing to act on", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <EditMenu />
        <Stocks />
      </>,
    );
    expect(await state(user, "Undo")).toBe(true);
    expect(await state(user, "Paste")).toBe(true);

    const field = screen.getByRole("searchbox") as HTMLInputElement;
    await user.click(field);
    await user.type(field, "apple");
    fireEvent.focusIn(field);
    field.setSelectionRange(0, 5);
    expect(await state(user, "Undo")).toBe(false);
    expect(await state(user, "Cut")).toBe(false);
    expect(await state(user, "Copy")).toBe(false);
  });
});
