import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { FontBook } from "./font-book";
import { fitSize } from "./font-book-data";

function OneMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("font-book", title);
  return <MenuBarMenu title={title}>{items}</MenuBarMenu>;
}

const setup = () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <>
      <MenuBar aria-label="Menus">
        {["File", "Edit", "View"].map((title) => (
          <OneMenu key={title} title={title} />
        ))}
      </MenuBar>
      <FontBook />
    </>,
  );
  return user;
};
const frame = () => screen.getByRole("region");
const collection = (name: string) => screen.getByRole("treeitem", { name });
const sizeField = () => screen.getByRole("combobox", { name: "Size:" });
const pressed = () =>
  within(screen.getByRole("group", { name: "Preview" }))
    .getAllByRole("button")
    .filter((each) => each.ariaPressed === "true")
    .map((each) => each.getAttribute("aria-label"));

type User = ReturnType<typeof setup>;
async function choose(user: User, title: string, item: string) {
  await user.click(screen.getByRole("menuitem", { name: title }));
  await user.click(await screen.findByRole("menuitem", { name: new RegExp(item) }));
}
async function chooseView(user: User, item: string) {
  await user.click(screen.getByRole("menuitem", { name: "View" }));
  await user.click(await screen.findByRole("menuitemradio", { name: new RegExp(item) }));
}

describe("Font Book's menu bar", () => {
  it("makes a collection from File and from Command-N", async () => {
    const user = setup();
    await choose(user, "File", "New Collection");
    await screen.findByRole("textbox", { name: "Collection name" });
    await user.keyboard("{Enter}");
    expect(collection("New Collection")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(frame(), { key: "n", ctrlKey: true });
    await screen.findByRole("textbox", { name: "Collection name" });
    await user.keyboard("{Enter}");
    expect(collection("New Collection 2")).toHaveAttribute("aria-selected", "true");
  });

  it("opens the file chooser from File and from Command-O", async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    const user = setup();
    await choose(user, "File", "Add Fonts");
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(frame(), { key: "o", ctrlKey: true });
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });

  it("turns the family off and on from Edit and Shift-Command-D, but never a required one", async () => {
    const user = setup();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(
      await screen.findByRole("menuitem", { name: /Disable “Zapf Dingbats” Family/ }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    fireEvent.keyDown(frame(), { key: "d", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("button", { name: "Disable “Zapf Dingbats”" })).toBeInTheDocument();

    await user.click(collection("Fixed Width"));
    await choose(user, "Edit", "Disable “Andale Mono” Family");
    expect(screen.getByRole("button", { name: "Enable “Andale Mono”" })).toBeInTheDocument();
    fireEvent.keyDown(frame(), { key: "D", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("button", { name: "Disable “Andale Mono”" })).toBeInTheDocument();
  });

  it("changes the view from View and Command-1, 2 and 3, and Command-I goes to Info and back", async () => {
    const user = setup();
    await chooseView(user, "Repertoire");
    expect(pressed()).toEqual(["Repertoire"]);
    fireEvent.keyDown(frame(), { key: "3", ctrlKey: true });
    expect(pressed()).toEqual(["Custom"]);
    fireEvent.keyDown(frame(), { key: "i", ctrlKey: true });
    expect(pressed()).toEqual(["Info"]);
    await choose(user, "View", "Hide Font Info");
    expect(pressed()).toEqual(["Custom"]);
    fireEvent.keyDown(frame(), { key: "1", ctrlKey: true });
    expect(pressed()).toEqual(["Sample"]);
  });

  it("steps through the size list with Bigger and Smaller, and dims each at its end", async () => {
    const user = setup();
    await choose(user, "View", "Bigger");
    expect(sizeField()).toHaveValue("48");
    fireEvent.keyDown(frame(), { key: "-", ctrlKey: true });
    expect(sizeField()).toHaveValue("36");
    fireEvent.keyDown(frame(), { key: "+", ctrlKey: true, shiftKey: true });
    expect(sizeField()).toHaveValue("48");

    fireEvent.change(sizeField(), { target: { value: "288" } });
    fireEvent.keyDown(sizeField(), { key: "Enter" });
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(await screen.findByRole("menuitem", { name: /Bigger/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("hides and shows the collections and the fonts", async () => {
    const user = setup();
    const pane = (name: string) =>
      screen
        .getByRole(name === "Fonts" ? "treegrid" : "tree", { name, hidden: true })
        .closest(".mac-split-view-pane");
    expect(pane("Collections")).not.toHaveAttribute("data-collapsed");
    await choose(user, "View", "Hide Collections");
    expect(pane("Collections")).toHaveAttribute("data-collapsed");
    await choose(user, "View", "Hide Fonts");
    expect(pane("Fonts")).toHaveAttribute("data-collapsed");
    await choose(user, "View", "Show Collections");
    await choose(user, "View", "Show Fonts");
    expect(pane("Collections")).not.toHaveAttribute("data-collapsed");
    expect(pane("Fonts")).not.toHaveAttribute("data-collapsed");
  });

  it("puts Search's keyboard in the search field and Edit's commands on the custom text", async () => {
    const user = setup();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Copy/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");

    fireEvent.keyDown(frame(), { key: "f", code: "KeyF", ctrlKey: true, altKey: true });
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus());

    fireEvent.keyDown(frame(), { key: "3", ctrlKey: true });
    const text = screen.getByRole("textbox", { name: "Custom text" }) as HTMLTextAreaElement;
    text.focus();
    text.setSelectionRange(0, 3);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Copy/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("selects the whole list from Edit", async () => {
    const user = setup();
    await user.click(collection("Fixed Width"));
    await choose(user, "Edit", "Select All");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("6 Fonts");
  });

  it("takes no key from another window: an inactive one ignores them", () => {
    render(<FontBook state="inactive" />);
    fireEvent.keyDown(frame(), { key: "n", ctrlKey: true });
    expect(screen.queryByRole("treeitem", { name: "New Collection" })).not.toBeInTheDocument();
  });
});

describe("fitSize", () => {
  it("takes the size at which the widest line fills the width, or the lines the height", () => {
    // 500 wide at 100 pt: 800 wide fits it at 160 pt; two lines of 1.25 in 300 high fit at 120 pt.
    expect(fitSize(500, 2, 1.25, 800, 1000)).toBe(160);
    expect(fitSize(500, 2, 1.25, 800, 300)).toBe(120);
  });

  it("stays within the slider's range", () => {
    expect(fitSize(5000, 1, 1.2, 100, 100)).toBe(9);
    expect(fitSize(10, 1, 1.2, 5000, 5000)).toBe(288);
  });
});
