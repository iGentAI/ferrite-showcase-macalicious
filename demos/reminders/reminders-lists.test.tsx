import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Reminders } from "./reminders";
import { listNameProblem } from "./reminders-list-info";

/*
 * Managing the person's lists (Show Info: name and colour; Delete), seeing completed reminders
 * again (View > Show Completed) and the menu bar's File and View items of Reminders.
 */

const frame = () => screen.getByRole("region", { name: "Reminders" });
const heading = () => screen.getByRole("heading", { level: 2 });
const titleOf = (row: HTMLElement) => row.querySelector(".mac-reminders-text")?.textContent ?? "";
const rows = () => screen.queryAllByRole("option").map((row) => titleOf(row));
const row = (title: string) => {
  const found = screen.getAllByRole("option").find((item) => titleOf(item) === title);
  if (!found) throw new Error(`no reminder titled ${title}`);
  return found;
};
const circle = (title: string) => row(title).querySelector("[data-reminder-toggle]") as Element;
const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name} \\d+$`) });
// The sidebar joins a row's label and its count without a space between them.
const listRow = (name: string) =>
  screen.getByRole("treeitem", { name: new RegExp(`^${name}\\s*\\d+$`) });
const count = () => frame().querySelector(".mac-reminders-count")?.textContent;

/** Opens a list's contextual menu and chooses `item` in it. */
async function listCommand(user: ReturnType<typeof userEvent.setup>, list: string, item: string) {
  fireEvent.contextMenu(listRow(list), { clientX: 10, clientY: 10 });
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

/** The menu bar's menu `title` of Reminders, as the desktop fills it from the window's items. */
function AppMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("reminders", title);
  return (
    <Menu>
      <MenuTrigger>{title}</MenuTrigger>
      <MenuPopup>{items}</MenuPopup>
    </Menu>
  );
}

describe("Reminders' lists", () => {
  it("renames and recolours a list from Show Info, and keeps a name it cannot save out", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await listCommand(user, "Work", "Show Info");
    const info = await screen.findByRole("dialog", { name: "List Info" });
    const name = within(info).getByRole("textbox", { name: "Name:" });
    expect(name).toHaveValue("Work");
    expect(within(info).getByRole("button", { name: "Green" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // An empty name is refused in the window, as the server would refuse it: OK does nothing.
    await user.clear(name);
    expect(within(info).getByRole("alert")).toHaveTextContent("A list needs a name.");
    await user.click(within(info).getByRole("button", { name: "OK" }));
    expect(screen.getByRole("dialog", { name: "List Info" })).toBeInTheDocument();

    await user.type(name, "  Office  ");
    await user.click(within(info).getByRole("button", { name: "Purple" }));
    expect(within(info).getByRole("button", { name: "Purple" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(info).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "List Info" })).toBeNull());
    expect(listRow("Office")).toHaveTextContent("5");
    expect(listRow("Office").querySelector(".mac-reminders-disc")).toHaveAttribute(
      "data-color",
      "purple",
    );

    // Cancel leaves the list as it was.
    await listCommand(user, "Office", "Show Info");
    const again = await screen.findByRole("dialog", { name: "List Info" });
    await user.type(within(again).getByRole("textbox", { name: "Name:" }), " 2");
    await user.click(within(again).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "List Info" })).toBeNull());
    expect(listRow("Office")).toBeInTheDocument();
  });

  it("refuses an empty name and one longer than the server keeps", () => {
    expect(listNameProblem("   ")).toBe("A list needs a name.");
    expect(listNameProblem("a".repeat(100))).toBeNull();
    expect(listNameProblem("a".repeat(101))).toMatch(/at most 100 characters/);
    // Characters, not UTF-16 units, as the server counts them.
    expect(listNameProblem("\u{1F600}".repeat(100))).toBeNull();
  });

  it("deletes a list and its reminders once asked, and shows the first list left", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    expect(tile("All")).toHaveTextContent("18");
    await listCommand(user, "Work", "Delete");
    const ask = await screen.findByRole("alertdialog");
    expect(ask).toHaveTextContent("Are you sure you want to delete the list \u201cWork\u201d?");
    expect(ask).toHaveTextContent("All 5 of its reminders will be deleted.");
    await user.click(within(ask).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(listRow("Work")).toBeInTheDocument();
    expect(tile("All")).toHaveTextContent("18");

    // The list that is shown goes: the window moves to the first list left.
    await listCommand(user, "iMac Colors", "Delete");
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("treeitem", { name: /^iMac Colors/ })).toBeNull(),
    );
    expect(tile("All")).toHaveTextContent("5");
    expect(heading()).toHaveTextContent("Reminders");
    expect(listRow("Reminders")).toHaveAttribute("aria-selected", "true");
  });

  it("shows completed reminders with View > Show Completed, where one is made to do again", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AppMenu title="View" />
        <Reminders />
      </>,
    );
    await user.click(circle("Bondi"));
    // Leaving the list and coming back hides a completed reminder.
    await user.click(listRow("Work"));
    await user.click(listRow("iMac Colors"));
    expect(rows()).not.toContain("Bondi");
    expect(count()).toBe("12 to do");

    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Show Completed/ }));
    await waitFor(() => expect(rows()).toContain("Bondi"));
    expect(row("Bondi").querySelector("[data-completed]")).not.toBeNull();
    expect(count()).toBe("12 to do");
    await user.click(circle("Bondi"));
    expect(count()).toBe("13 to do");

    // Turned off again, completed reminders leave the views once more.
    await user.click(circle("Snow"));
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Show Completed/ }));
    await user.click(listRow("Work"));
    await user.click(listRow("iMac Colors"));
    expect(rows()).toContain("Bondi");
    expect(rows()).not.toContain("Snow");
  });

  it("adds a list from the menu bar's File menu, and offers New Reminder there", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AppMenu title="File" />
        <Reminders />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(await screen.findByRole("menuitem", { name: "New Reminder" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "New List" }));
    await waitFor(() => expect(listRow("New List")).toHaveAttribute("aria-selected", "true"));
    expect(heading()).toHaveTextContent("New List");
  });
});

describe("Reminders' lists on the Ferrite application", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("saves a list renamed in its Info, and a deleted list without its reminders", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const sent: unknown[] = [];
    let rev = 1;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          sent.push(JSON.parse(String(init.body)));
          rev += 1;
          return new Response(JSON.stringify({ rev }), { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
        }
        const data = {
          lists: [
            { id: "bills", name: "Bills", color: "orange" },
            { id: "trip", name: "Trip", color: "blue" },
          ],
          reminders: [
            { id: "rent", listId: "bills", title: "Pay rent" },
            { id: "pack", listId: "trip", title: "Pack" },
          ],
        };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh defaultSource="bills" />);
    await waitFor(() => expect(rows()).toEqual(["Pay rent"]));

    await listCommand(user, "Trip", "Show Info");
    const info = await screen.findByRole("dialog", { name: "List Info" });
    const name = within(info).getByRole("textbox", { name: "Name:" });
    await user.clear(name);
    await user.type(name, "Holiday");
    await user.click(within(info).getByRole("button", { name: "Yellow" }));
    await user.click(within(info).getByRole("button", { name: "OK" }));
    await vi.waitFor(() => expect(sent).toHaveLength(1), { timeout: 3000 });
    expect(sent[0]).toMatchObject({
      base: 1,
      data: {
        lists: [
          { id: "bills", name: "Bills", color: "orange" },
          { id: "trip", name: "Holiday", color: "yellow" },
        ],
      },
    });

    await listCommand(user, "Bills", "Delete");
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: 3000 });
    expect(sent[1]).toEqual({
      base: 2,
      data: {
        lists: [{ id: "trip", name: "Holiday", color: "yellow" }],
        reminders: [{ id: "pack", listId: "trip", title: "Pack" }],
      },
      alerts: {},
    });
    expect(heading()).toHaveTextContent("Holiday");
    expect(rows()).toEqual(["Pack"]);
  });
});
