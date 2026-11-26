import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, remindersApp } from "./app";
import { Reminders } from "./reminders";
import { countOf, defaultReminders, inSource, matches, type Reminder } from "./reminders-data";
import {
  completeReminder,
  dateOf,
  dueLabel,
  nextOccurrence,
  parseEntry,
  timeOf,
} from "./reminders-dates";
import { alertOf, dismissalRetryDelay, isReminderShape } from "./reminders-sync";

/**
 * jsdom has no layout, so the list view renders its first 40 rows and nothing scrolls; the
 * popover is placed by Base UI without measurements. Geometry is checked by the visual
 * comparisons in Chromium.
 */
const frame = () => screen.getByRole("region", { name: "Reminders" });
const heading = () => screen.getByRole("heading", { level: 2 });
const rows = () =>
  screen
    .queryAllByRole("option")
    .filter((row) => row.querySelector(".mac-reminders-text"))
    .map((row) => titleOf(row));
const titleOf = (row: HTMLElement) => row.querySelector(".mac-reminders-text")?.textContent ?? "";
const row = (title: string) => {
  const found = screen.getAllByRole("option").find((item) => titleOf(item) === title);
  if (!found) throw new Error(`no reminder titled ${title}`);
  return found;
};
const circle = (title: string) => row(title).querySelector("[data-reminder-toggle]") as Element;
const mark = (title: string) => row(title).querySelector("[data-reminder-info]") as Element;
const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name} \\d+$`) });
// The sidebar joins a row's label and its count without a space between them.
const listRow = (name: string) =>
  screen.getByRole("treeitem", { name: new RegExp(`^${name}\\s*\\d+$`) });
const listbox = () => screen.getByRole("listbox");
const count = () => frame().querySelector(".mac-reminders-count")?.textContent;
/** The zone the tests run in: a saved reminder with a due day names it (`timeZone`). */
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("Reminders", () => {
  it("shows the lists, the tiles and the reminders of the captured list", () => {
    render(<Reminders />);
    expect(frame()).toHaveClass("mac-window", "mac-reminders");
    expect(heading()).toHaveTextContent("iMac Colors");
    expect(count()).toBe("13 to do");
    expect(rows()).toHaveLength(13);
    expect(rows().slice(0, 3)).toEqual(["Bondi", "Blueberry", "Strawberry"]);
    expect(listRow("iMac Colors")).toHaveAttribute("aria-selected", "true");
    expect(listRow("iMac Colors")).toHaveTextContent("13");
    expect(listRow("Work")).toHaveTextContent("5");
    expect(listRow("Reminders")).toHaveTextContent("0");
    expect(tile("All")).toHaveTextContent("18");
    for (const name of ["Today", "Scheduled", "Flagged"]) {
      expect(tile(name)).toHaveTextContent("0");
      expect(tile(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows another list when its row is pressed, and tells the caller", async () => {
    const user = userEvent.setup();
    const onSourceChange = vi.fn();
    render(<Reminders onSourceChange={onSourceChange} />);
    await user.click(listRow("Work"));
    expect(onSourceChange).toHaveBeenCalledExactlyOnceWith("work");
    expect(heading()).toHaveTextContent("Work");
    expect(count()).toBe("5 to do");
    expect(rows()).toHaveLength(5);
    expect(listRow("Work")).toHaveAttribute("aria-selected", "true");
    expect(listRow("iMac Colors")).toHaveAttribute("aria-selected", "false");
    await user.click(listRow("Reminders"));
    expect(rows()).toHaveLength(0);
    expect(screen.getByText("No Reminders")).toBeInTheDocument();
  });

  it("shows a smart list when its tile is pressed, with the list each reminder is from", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(tile("All"));
    expect(tile("All")).toHaveAttribute("aria-pressed", "true");
    expect(heading()).toHaveTextContent("All");
    expect(rows()).toHaveLength(18);
    expect(screen.queryByRole("treeitem", { selected: true })).not.toBeInTheDocument();
    expect(within(row("Bondi")).getByText("iMac Colors")).toBeInTheDocument();
    expect(within(row("File the expense report")).getByText("Work")).toBeInTheDocument();
    await user.click(tile("Flagged"));
    expect(tile("All")).toHaveAttribute("aria-pressed", "false");
    expect(rows()).toHaveLength(0);
  });

  it("starts with the list or the smart list it is given", () => {
    render(<Reminders defaultSource="all" />);
    expect(tile("All")).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toHaveLength(18);
  });

  it("completes a reminder when its circle is clicked, and counts it out", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(circle("Bondi"));
    // It stays in view, marked, until another list is shown.
    expect(row("Bondi")).toHaveTextContent("Bondi, completed");
    // The option's accessible name says so too: it comes from the row's content.
    expect(screen.getByRole("option", { name: /^Bondi\s*, completed$/ })).toBe(row("Bondi"));
    expect(circle("Bondi")).toHaveAttribute("data-completed");
    expect(row("Bondi")).toHaveAttribute("aria-selected", "false");
    expect(count()).toBe("12 to do");
    expect(listRow("iMac Colors")).toHaveTextContent("12");
    expect(tile("All")).toHaveTextContent("17");
    // A second click takes the completion back.
    await user.click(circle("Bondi"));
    expect(row("Bondi")).not.toHaveTextContent("completed");
    expect(count()).toBe("13 to do");
    await user.click(circle("Bondi"));
    await user.click(listRow("Work"));
    await user.click(listRow("iMac Colors"));
    expect(rows()).toHaveLength(12);
    expect(rows()).not.toContain("Bondi");
  });

  it("selects a reminder, and completes and removes the selected one from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(row("Grape"));
    expect(row("Grape")).toHaveAttribute("aria-selected", "true");
    expect(listbox()).toHaveFocus();
    await user.keyboard(" ");
    expect(row("Grape")).toHaveTextContent("Grape, completed");
    await user.keyboard(" ");
    expect(row("Grape")).not.toHaveTextContent("completed");
    await user.keyboard("{ArrowDown}");
    expect(row("Lime")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Backspace}");
    expect(rows()).not.toContain("Lime");
    expect(rows()).toHaveLength(12);
    // The selection moves to the reminder that followed.
    expect(row("Tangerine")).toHaveAttribute("aria-selected", "true");
    expect(count()).toBe("12 to do");
  });

  it("adds a reminder to the list that is shown", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    const field = screen.getByRole("textbox", { name: "Title" });
    expect(field).toHaveFocus();
    await user.keyboard("Key Lime{Enter}");
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(rows()).toHaveLength(14);
    expect(rows().at(-1)).toBe("Key Lime");
    expect(row("Key Lime")).toHaveAttribute("aria-selected", "true");
    expect(listbox()).toHaveFocus();
    expect(count()).toBe("14 to do");
    expect(tile("All")).toHaveTextContent("19");
  });

  it("drops a new reminder that is left without text", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    const add = screen.getByRole("button", { name: "New Reminder" });
    await user.click(add);
    await user.keyboard("{Escape}");
    expect(rows()).toHaveLength(13);
    await user.click(add);
    await user.keyboard("   {Enter}");
    expect(rows()).toHaveLength(13);
    await user.click(add);
    await user.keyboard("Slate");
    // Leaving the field keeps what was typed.
    await user.click(screen.getByRole("searchbox"));
    expect(rows().at(-1)).toBe("Slate");
    expect(tile("All")).toHaveTextContent("19");
  });

  it("adds to the first list from a smart list, so that the reminder belongs to the view", async () => {
    const user = userEvent.setup();
    render(<Reminders today="2019-10-07" />);
    await user.click(tile("Flagged"));
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Call back{Enter}");
    expect(rows()).toEqual(["Call back"]);
    expect(tile("Flagged")).toHaveTextContent("1");
    expect(listRow("Reminders")).toHaveTextContent("1");
    await user.click(tile("Today"));
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Water the plants{Enter}");
    expect(tile("Today")).toHaveTextContent("1");
    expect(tile("Scheduled")).toHaveTextContent("1");
    // One added in Scheduled is scheduled: it is still there when the view is shown again.
    await user.click(tile("Scheduled"));
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Renew the pass{Enter}");
    expect(tile("Scheduled")).toHaveTextContent("2");
    await user.click(tile("All"));
    await user.click(tile("Scheduled"));
    expect(rows()).toEqual(["Water the plants", "Renew the pass"]);
  });

  it("keeps the text being typed when another list is pressed before the field is left", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Slate");
    // The sidebar acts on the press, before the field loses the focus.
    fireEvent.mouseDown(listRow("Work"));
    expect(heading()).toHaveTextContent("Work");
    expect(listRow("iMac Colors")).toHaveTextContent("14");
    await user.click(listRow("iMac Colors"));
    expect(rows().at(-1)).toBe("Slate");
    // An edit of a reminder that exists is kept the same way, by a tile's click.
    await user.dblClick(row("Bondi"));
    await user.keyboard(" Blue");
    fireEvent.click(tile("All"));
    expect(rows()).toContain("Bondi Blue");
    expect(rows()).not.toContain("Bondi");
  });

  it("keeps the text typed in one reminder when another is opened without the field being left", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.dblClick(row("Bondi"));
    await user.keyboard(" Blue");
    // A field scrolled out of the rendered rows is gone without losing the focus; a double
    // click that moves no focus stands for that here, where nothing is laid out.
    fireEvent.doubleClick(row("Lime"));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Lime");
    expect(rows()).toContain("Bondi Blue");
    expect(rows()).not.toContain("Bondi");
    await user.keyboard("{Escape}");
    // The same for a reminder that was just added: it is not dropped.
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Slate");
    fireEvent.doubleClick(row("Grape"));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Grape");
    expect(rows().at(-1)).toBe("Slate");
    expect(count()).toBe("14 to do");
    await user.keyboard("{Escape}");
    // Return on the row whose field is open does not open it afresh: the text typed so far
    // is still what a list change keeps.
    await user.dblClick(row("Snow"));
    await user.keyboard(" White");
    fireEvent.keyDown(listbox(), { key: "Enter" });
    fireEvent.mouseDown(listRow("Work"));
    await user.click(listRow("iMac Colors"));
    expect(rows()).toContain("Snow White");
  });

  it("clears a search before adding, and adds to the list that was shown", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.type(screen.getByRole("searchbox"), "blue");
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(heading()).toHaveTextContent("iMac Colors");
    await user.keyboard("Teal{Enter}");
    expect(rows().at(-1)).toBe("Teal");
    expect(listRow("iMac Colors")).toHaveTextContent("14");
    expect(listRow("Reminders")).toHaveTextContent("0");
  });

  it("gives new reminders and lists ids that the given ones do not use", async () => {
    const user = userEvent.setup();
    render(
      <Reminders
        defaultLists={[
          { id: "list-1", name: "Home", color: "purple" },
          { id: "list-2", name: "Garden", color: "green" },
        ]}
        defaultReminders={[
          { id: "new-1", listId: "list-1", title: "Sweep" },
          { id: "new-2", listId: "list-1", title: "Dust" },
        ]}
        defaultSource="list-1"
      />,
    );
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Mop{Enter}");
    expect(rows()).toEqual(["Sweep", "Dust", "Mop"]);
    // Completing the new one touches no other.
    await user.click(circle("Mop"));
    expect(row("Sweep")).not.toHaveTextContent("completed");
    expect(row("Dust")).not.toHaveTextContent("completed");
    expect(listRow("Home")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Add List" }));
    expect(screen.getAllByRole("treeitem")).toHaveLength(3);
    expect(screen.getAllByRole("treeitem", { selected: true })).toHaveLength(1);
    expect(rows()).toHaveLength(0);
    await user.click(listRow("Home"));
    expect(rows()).toEqual(["Sweep", "Dust"]);
  });

  it("moves on to the new day at midnight, unless the day is given", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2019, 9, 7, 23, 59, 0));
      const reminders = [{ id: "a", listId: "home", title: "Sweep", due: "2019-10-08" }];
      const lists = [{ id: "home", name: "Home", color: "purple" as const }];
      const { unmount } = render(<Reminders defaultLists={lists} defaultReminders={reminders} />);
      expect(tile("Today")).toHaveTextContent("0");
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });
      expect(tile("Today")).toHaveTextContent("1");
      unmount();
      vi.setSystemTime(new Date(2019, 9, 7, 23, 59, 0));
      const given = render(
        <Reminders defaultLists={lists} defaultReminders={reminders} today="2019-10-07" />,
      );
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });
      expect(tile("Today")).toHaveTextContent("0");
      // The given day is taken away after midnight: the window reads the day itself, at once.
      given.rerender(<Reminders defaultLists={lists} defaultReminders={reminders} />);
      expect(tile("Today")).toHaveTextContent("1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("edits a reminder's text on a double click and on Return", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.dblClick(row("Bondi"));
    const field = screen.getByRole("textbox", { name: "Title" });
    expect(field).toHaveValue("Bondi");
    expect(field).toHaveFocus();
    await user.keyboard(" Blue{Enter}");
    expect(rows()[0]).toBe("Bondi Blue");
    expect(listbox()).toHaveFocus();
    // Return on the selected row opens the field again; Escape gives the change up.
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Bondi Blue");
    await user.keyboard("!!!{Escape}");
    expect(rows()[0]).toBe("Bondi Blue");
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    // The keys typed in the field were the field's: nothing was completed or removed.
    expect(rows()).toHaveLength(13);
    expect(count()).toBe("13 to do");
  });

  it("removes a reminder whose text is deleted", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.dblClick(row("Snow"));
    await user.clear(screen.getByRole("textbox", { name: "Title" }));
    await user.keyboard("{Enter}");
    expect(rows()).not.toContain("Snow");
    expect(rows()).toHaveLength(12);
  });

  it("searches every list, and comes back to the list when the search is cleared", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    const search = screen.getByRole("searchbox");
    await user.type(search, "blue");
    expect(heading()).toHaveTextContent("Results for “blue”");
    expect(rows()).toEqual(["Blueberry", "Blue Dalmation"]);
    expect(count()).toBe("2 to do");
    expect(screen.queryByRole("treeitem", { selected: true })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "ra");
    // Titles from both lists: Work's reminders are found too, and say where they are from.
    expect(rows()).toContain("Review the budget draft");
    expect(rows()).toContain("Grape");
    expect(within(row("Review the budget draft")).getByText("Work")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "zzz");
    expect(rows()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
    await user.clear(search);
    expect(heading()).toHaveTextContent("iMac Colors");
    expect(rows()).toHaveLength(13);
    expect(listRow("iMac Colors")).toHaveAttribute("aria-selected", "true");
  });

  it("adds a list with the footer button and shows it", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    const add = screen.getByRole("button", { name: "Add List" });
    await user.click(add);
    expect(listRow("New List")).toHaveAttribute("aria-selected", "true");
    expect(heading()).toHaveTextContent("New List");
    expect(screen.getByText("No Reminders")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("First{Enter}");
    expect(listRow("New List")).toHaveTextContent("1");
    await user.click(add);
    expect(listRow("New List 2")).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("treeitem")).toHaveLength(5);
  });

  it("opens a reminder's info popover from its mark and changes the reminder in it", async () => {
    const user = userEvent.setup();
    render(<Reminders today="2019-10-07" />);
    await user.click(mark("Graphite"));
    const info = screen.getByRole("dialog", { name: "Graphite" });
    expect(row("Graphite")).toHaveAttribute("aria-selected", "true");
    // As captured: only When Messaging a Person is checked, no flag, no priority, one image.
    const remind = within(info).getByRole("group", { name: "remind me" });
    expect(within(remind).getByRole("checkbox", { name: "On a Day" })).not.toBeChecked();
    expect(within(remind).getByRole("checkbox", { name: "At a Location" })).not.toBeChecked();
    expect(within(remind).getByRole("checkbox", { name: "When Messaging a Person" })).toBeChecked();
    expect(within(info).getByText("Add Contact")).toBeInTheDocument();
    expect(within(info).getByRole("combobox", { name: "priority" })).toHaveTextContent("None");
    expect(within(info).getByRole("combobox", { name: "images" })).toHaveTextContent("Image");

    const flag = within(info).getByRole("button", { name: "Flag" });
    expect(flag).toHaveAttribute("aria-pressed", "false");
    await user.click(flag);
    expect(flag).toHaveAttribute("aria-pressed", "true");
    expect(tile("Flagged")).toHaveTextContent("1");

    await user.click(within(remind).getByRole("checkbox", { name: "On a Day" }));
    expect(tile("Today")).toHaveTextContent("1");
    expect(tile("Scheduled")).toHaveTextContent("1");
    await user.click(within(remind).getByRole("checkbox", { name: "When Messaging a Person" }));
    expect(within(info).queryByText("Add Contact")).not.toBeInTheDocument();

    await user.type(within(info).getByRole("textbox", { name: "Notes" }), "The grey one");
    expect(within(info).getByRole("textbox", { name: "Notes" })).toHaveValue("The grey one");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(listbox()).toHaveFocus();
    // The notes are searched with the titles.
    await user.type(screen.getByRole("searchbox"), "grey");
    expect(rows()).toEqual(["Graphite"]);
  });

  it("keeps the priority, the URL and the location choice made in the info popover", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(mark("Ruby"));
    let info = screen.getByRole("dialog", { name: "Ruby" });
    await user.click(within(info).getByRole("checkbox", { name: "At a Location" }));
    await user.type(within(info).getByRole("textbox", { name: "URL" }), "https://example.com");
    await user.click(within(info).getByRole("combobox", { name: "priority" }));
    await user.click(await screen.findByRole("option", { name: "High" }));
    // Choosing in the menu does not dismiss the popover it belongs to.
    info = screen.getByRole("dialog", { name: "Ruby" });
    await waitFor(() =>
      expect(within(info).getByRole("combobox", { name: "priority" })).toHaveTextContent("High"),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Another reminder's info starts empty; Ruby's comes back as it was left.
    await user.click(mark("Sage"));
    info = screen.getByRole("dialog", { name: "Sage" });
    expect(within(info).getByRole("checkbox", { name: "At a Location" })).not.toBeChecked();
    expect(within(info).getByRole("textbox", { name: "URL" })).toHaveValue("");
    expect(within(info).getByRole("combobox", { name: "priority" })).toHaveTextContent("None");
    await user.click(mark("Ruby"));
    info = screen.getByRole("dialog", { name: "Ruby" });
    expect(within(info).getByRole("checkbox", { name: "At a Location" })).toBeChecked();
    expect(within(info).getByRole("textbox", { name: "URL" })).toHaveValue("https://example.com");
    expect(within(info).getByRole("combobox", { name: "priority" })).toHaveTextContent("High");
  });

  it("shows the selected reminder's info with Command-I, and one popover at a time", async () => {
    const user = userEvent.setup();
    render(<Reminders />);
    await user.click(row("Ruby"));
    await user.keyboard("{Meta>}i{/Meta}");
    expect(screen.getByRole("dialog", { name: "Ruby" })).toBeInTheDocument();
    // Ruby has no picture: the images row offers only to add one.
    const info = screen.getByRole("dialog");
    expect(within(info).queryByRole("combobox", { name: "images" })).not.toBeInTheDocument();
    await user.click(within(info).getByRole("button", { name: "Add Image…" }));
    expect(within(info).getByLabelText("Image file")).toHaveAttribute("accept", "image/*");
    await user.click(mark("Sage"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Sage" })).toBeInTheDocument();
    // A click on the mark of the reminder that is shown hides its info.
    await user.click(mark("Sage"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Choosing another list closes it too.
    await user.click(mark("Sage"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(listRow("Work"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a library window that takes the window's props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Reminders
        ref={ref}
        state="inactive"
        width={900}
        height={500}
        className="mine"
        style={{ left: 40 }}
        data-testid="frame"
      />,
    );
    const root = screen.getByTestId("frame");
    expect(root).toBe(frame());
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-reminders", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveStyle({ width: "900px", height: "500px", left: "40px" });
  });

  it("opens at the captured frame and is key by default", () => {
    render(<Reminders />);
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "768px", height: "624px" });
  });

  it("reports its window controls and passes their settings on", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <Reminders onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(onZoom).toHaveBeenCalledOnce();
    rerender(<Reminders minimizeDisabled zoomDisabled controlsProps={{ closeLabel: "Shut" }} />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /full screen/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Shut" })).toBeEnabled();
  });

  it("reports presses and double clicks on its drag regions, not on the controls in them", () => {
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Reminders
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const regions = frame().querySelectorAll("[data-window-drag-region]");
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      fireEvent.pointerDown(region, { button: 0 });
      fireEvent.doubleClick(region);
    }
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(2);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(2);
    // Another button, and a press on a control, do not move the window.
    fireEvent.pointerDown(regions[0] as Element, { button: 2 });
    for (const control of [
      screen.getByRole("searchbox"),
      tile("Today"),
      screen.getByRole("button", { name: "Close" }),
      screen.getByRole("button", { name: "New Reminder" }),
    ]) {
      fireEvent.pointerDown(control, { button: 0 });
      fireEvent.doubleClick(control);
    }
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(2);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(2);
  });

  it("starts from the lists and reminders it is given", () => {
    render(
      <Reminders
        defaultLists={[{ id: "home", name: "Home", color: "purple" }]}
        defaultReminders={[
          { id: "a", listId: "home", title: "Sweep" },
          { id: "b", listId: "home", title: "Dust", completed: true },
          { id: "c", listId: "home", title: "Mop", flagged: true, due: "2019-10-07" },
        ]}
        defaultSource="home"
        today="2019-10-08"
      />,
    );
    expect(rows()).toEqual(["Sweep", "Mop"]);
    expect(listRow("Home")).toHaveTextContent("2");
    expect(tile("Flagged")).toHaveTextContent("1");
    expect(tile("Scheduled")).toHaveTextContent("1");
    // Due yesterday: still to do today.
    expect(tile("Today")).toHaveTextContent("1");
    expect(frame().querySelector(".mac-reminders-header")).toHaveAttribute("data-color", "purple");
  });
});

describe("the reminders' rules", () => {
  const reminder = { id: "r", listId: "work", title: "Send the Agenda", notes: "before noon" };

  it("puts a reminder in its list and in the smart lists its fields name", () => {
    expect(inSource(reminder, "work", "2019-10-07")).toBe(true);
    expect(inSource(reminder, "reminders", "2019-10-07")).toBe(false);
    expect(inSource(reminder, "all", "2019-10-07")).toBe(true);
    expect(inSource(reminder, "flagged", "2019-10-07")).toBe(false);
    expect(inSource({ ...reminder, flagged: true }, "flagged", "2019-10-07")).toBe(true);
    expect(inSource(reminder, "scheduled", "2019-10-07")).toBe(false);
    const due = { ...reminder, due: "2019-10-08" };
    expect(inSource(due, "scheduled", "2019-10-07")).toBe(true);
    expect(inSource(due, "today", "2019-10-07")).toBe(false);
    expect(inSource(due, "today", "2019-10-08")).toBe(true);
    expect(inSource(due, "today", "2019-10-09")).toBe(true);
  });

  it("counts what is still to do", () => {
    expect(countOf(defaultReminders, "all", "2019-10-07")).toBe(18);
    expect(countOf(defaultReminders, "imac-colors", "2019-10-07")).toBe(13);
    expect(countOf([{ ...reminder, completed: true }], "work", "2019-10-07")).toBe(0);
  });

  it("matches titles and notes whatever the case", () => {
    expect(matches(reminder, " AGENDA ")).toBe(true);
    expect(matches(reminder, "Noon")).toBe(true);
    expect(matches(reminder, "budget")).toBe(false);
  });
});

describe("the app descriptor", () => {
  it("names the app, its window, its size and its menus", () => {
    expect(app).toBe(remindersApp);
    expect(app.id).toBe("reminders");
    expect(app.name).toBe("Reminders");
    expect(app.defaultSize).toEqual({ width: 768, height: 624 });
    expect(app.menus[0]).toBe("Reminders");
    expect(app.menus).toContain("Help");
  });

  it("renders its component as a window that a host places and sizes", () => {
    const App = app.component;
    render(<App {...app.defaultSize} state="main" style={{ position: "absolute", top: 30 }} />);
    expect(frame()).toHaveAttribute("data-window-state", "main");
    expect(frame()).toHaveStyle({ position: "absolute", top: "30px", width: "768px" });
  });
});

describe("on the Ferrite application", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fetches nothing elsewhere", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Reminders />);
    expect(rows()).toHaveLength(13);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("takes a malformed document for no read, asks again, and writes nothing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    // Arrays of the right names, but a reminder that is not one, one in a list that does not
    // exist, and a revision below 0.
    const bodies = [
      { data: { lists: [bills], reminders: [null] }, rev: 1 },
      { data: { lists: [bills], reminders: [{ id: "a", listId: "gone", title: "A" }] }, rev: 1 },
      { data: { lists: [bills], reminders: [] }, rev: -1 },
    ];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method) return new Response('{"rev":2}', { status: 200 });
      if (url === "/api/reminders/alerts") {
        return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(bodies.shift()), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh />);
    // The read is tried three times before the sample reminders can be edited.
    await vi.waitFor(
      () =>
        expect(
          fetch.mock.calls.filter((call) => (call as unknown[])[0] === "/api/reminders/data"),
        ).toHaveLength(3),
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    await user.click(circle("Bondi"));
    await new Promise((resolve) => setTimeout(resolve, 600));
    const inits = fetch.mock.calls.map((call) => (call as unknown[])[1] as RequestInit | undefined);
    expect(inits.some((init) => init?.method === "PUT")).toBe(false);
  });

  it("asks for no alerts when the session's reminders could not be read", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    render(<Fresh />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3), { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    // The sample reminders are shown, and their due dates raise nothing from the server.
    expect(rows()).toHaveLength(13);
    const urls = fetch.mock.calls.map((call) => (call as unknown[])[0]);
    expect(urls).toEqual(["/api/reminders/data", "/api/reminders/data", "/api/reminders/data"]);
  });

  it("starts from the saved reminders, shows the alert of one that fell due, and completes it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const at = new Date(2026, 9, 12, 9).getTime();
    const sent: { url: string; body: unknown }[] = [];
    let alerts = [{ id: "rent", title: "Pay rent", at }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method) {
          if (url.endsWith("/shown")) return new Response('{"told":1}', { status: 200 });
          sent.push({ url, body: JSON.parse(String(init.body)) });
          if (url.endsWith("/dismiss")) alerts = [];
          return new Response('{"rev":2}', { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts }), { status: 200 });
        }
        expect(url).toBe("/api/reminders/data");
        const data = {
          lists: [{ id: "bills", name: "Bills", color: "orange" }],
          reminders: [{ id: "rent", listId: "bills", title: "Pay rent", due: "2026-10-12" }],
        };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    render(<Reminders defaultSource="bills" today="2026-10-12" />);
    await waitFor(() => expect(rows()).toEqual(["Pay rent"]));
    const alert = await screen.findByRole("alert", { name: "Reminders" });
    expect(alert).toHaveTextContent("Pay rent");

    await user.click(within(alert).getByRole("button", { name: "Complete" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: 2000 });
    expect(sent).toContainEqual({ url: "/api/reminders/alerts/rent/dismiss", body: { at } });
    expect(sent).toContainEqual({
      url: "/api/reminders/data",
      body: {
        base: 1,
        data: {
          lists: [{ id: "bills", name: "Bills", color: "orange" }],
          reminders: [
            {
              id: "rent",
              listId: "bills",
              title: "Pay rent",
              due: "2026-10-12",
              completed: true,
              timeZone: zone,
            },
          ],
        },
        // A completed reminder has no alert any more.
        alerts: {},
      },
    });
  });

  it("opens on the first saved list when the session deleted the list it would open", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const data = {
      lists: [{ id: "bills", name: "Bills", color: "orange" }],
      reminders: [{ id: "rent", listId: "bills", title: "Pay rent" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/reminders/alerts"
          ? new Response(JSON.stringify({ alerts: [] }), { status: 200 })
          : new Response(JSON.stringify({ data, rev: 1 }), { status: 200 }),
      ),
    );
    const { Reminders: Fresh } = await import("./reminders");
    render(<Fresh />);
    await waitFor(() => expect(rows()).toEqual(["Pay rent"]));
  });

  it("keeps a reminder still being typed when its window takes in another window's change", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent" };
    const gas = { id: "gas", listId: "bills", title: "Pay gas" };
    let rev = 1;
    const puts: { data: { reminders: Reminder[] } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
        }
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          rev += 1;
          return new Response(JSON.stringify({ rev }), { status: 200 });
        }
        const data = { lists: [bills], reminders: [rent, gas] };
        return new Response(JSON.stringify({ data, rev }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(
      <>
        <Fresh defaultSource="bills" today="2026-10-12" />
        <Fresh defaultSource="bills" today="2026-10-12" />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("region", { name: "Reminders" })).toHaveLength(2),
    );
    const [first, second] = screen.getAllByRole("region", { name: "Reminders" }) as [
      HTMLElement,
      HTMLElement,
    ];
    await waitFor(() => expect(within(first).getAllByRole("option")).toHaveLength(2));
    // The first window starts a reminder and leaves it untitled.
    await user.click(within(first).getByRole("button", { name: "New Reminder" }));
    expect(within(first).getAllByRole("option")).toHaveLength(3);
    // The second window completes a reminder: the first takes that document in, and what is
    // being typed there stays, its field open.
    const gasRow = within(second)
      .getAllByRole("option")
      .find((item) => titleOf(item) === "Pay gas") as HTMLElement;
    await user.click(gasRow.querySelector("[data-reminder-toggle]") as Element);
    await vi.waitFor(() => expect(rev).toBe(2), { timeout: 2000 });
    await waitFor(() =>
      expect(within(first).getAllByRole("option").map(titleOf)).toEqual(["Pay rent", ""]),
    );
    const field = within(first).getByRole("textbox", { name: "Title" });
    // Finished, it is saved with the other window's change.
    await user.type(field, "Pay water{Enter}");
    await vi.waitFor(() => expect(rev).toBe(3), { timeout: 2000 });
    expect(
      puts.at(-1)?.data.reminders.map((each) => [each.title, each.completed === true]),
    ).toEqual([
      ["Pay rent", false],
      ["Pay gas", true],
      ["Pay water", false],
    ]);
  });

  it("opens a server-created reminder after the page cached its earlier document", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent" };
    let server = { data: { lists: [bills], reminders: [rent] }, rev: 1 };
    const fetch = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/api/reminders/alerts"
              ? { alerts: [] }
              : url === "/api/reminders/shared"
                ? { lists: [] }
                : server,
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    const { loadReminders } = await import("./reminders-sync");
    const { openItem } = await import("../desktop/desktop-open-item");
    // The desktop imports the app before Siri or another tab creates this item.
    await loadReminders();
    server = {
      data: {
        lists: [bills],
        reminders: [rent, { id: "water", listId: "bills", title: "Pay water" }],
      },
      rev: 2,
    };
    openItem({ app: "reminders", id: "water", title: "Pay water" });
    render(<Fresh defaultSource="bills" />);
    await waitFor(() => expect(row("Pay water")).toHaveAttribute("aria-selected", "true"));
    expect(fetch.mock.calls.filter(([url]) => url === "/api/reminders/data")).toHaveLength(2);
  });

  it("retains an open request while the initial document is still loading", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const water = { id: "water", listId: "bills", title: "Pay water" };
    let finishInitial: (response: Response) => void = () => {
      throw new Error("read not started");
    };
    const initial = new Promise<Response>((resolve) => {
      finishInitial = resolve;
    });
    const fetch = vi.fn(async (url: string) =>
      url === "/api/reminders/data"
        ? initial
        : new Response(JSON.stringify(url.endsWith("/alerts") ? { alerts: [] } : { lists: [] })),
    );
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    const { openItem } = await import("../desktop/desktop-open-item");
    openItem({ app: "reminders", id: "water", title: "Pay water" });
    render(<Fresh defaultSource="bills" />);
    expect(frame()).toHaveAttribute("aria-busy");
    await act(async () =>
      finishInitial(
        new Response(
          JSON.stringify({
            data: { lists: [bills], reminders: [water] },
            rev: 1,
          }),
        ),
      ),
    );
    await waitFor(() => expect(row("Pay water")).toHaveAttribute("aria-selected", "true"));
    expect(fetch.mock.calls.filter(([url]) => url === "/api/reminders/data")).toHaveLength(1);
  });

  it("waits for a held save before refreshing an unknown requested reminder", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent" };
    let server = { data: { lists: [bills], reminders: [rent] as Reminder[] }, rev: 1 };
    let finishSave: (response: Response) => void = () => {
      throw new Error("save not started");
    };
    const saved = new Promise<Response>((resolve) => {
      finishSave = resolve;
    });
    let sent: typeof server.data | undefined;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/reminders/data" && init?.method === "PUT") {
        sent = JSON.parse(String(init.body)).data;
        return saved;
      }
      return new Response(
        JSON.stringify(
          url === "/api/reminders/data"
            ? server
            : url.endsWith("/alerts")
              ? { alerts: [] }
              : { lists: [] },
        ),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    const { openItem } = await import("../desktop/desktop-open-item");
    render(<Fresh defaultSource="bills" />);
    await waitFor(() => expect(rows()).toEqual(["Pay rent"]));
    await userEvent.setup().click(circle("Pay rent"));
    await waitFor(() => expect(sent?.reminders[0]?.completed).toBe(true), { timeout: 2000 });
    act(() => openItem({ app: "reminders", id: "water", title: "Pay water" }));
    expect(
      fetch.mock.calls.filter(([url, init]) => url === "/api/reminders/data" && !init?.method),
    ).toHaveLength(1);
    // The save commits, then another writer creates the item; the next read must retain both.
    if (!sent) throw new Error("the actual save did not start");
    server = {
      data: {
        ...sent,
        reminders: [...sent.reminders, { id: "water", listId: "bills", title: "Pay water" }],
      },
      rev: 3,
    };
    await act(async () => finishSave(new Response('{"rev":2}')));
    await waitFor(() => expect(row("Pay water")).toHaveAttribute("aria-selected", "true"));
    expect(server.data.reminders.find(({ id }) => id === "rent")?.completed).toBe(true);
    expect(
      fetch.mock.calls.filter(([url, init]) => url === "/api/reminders/data" && !init?.method),
    ).toHaveLength(2);
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  });

  it("reads once for a genuinely missing open request without polling or writes", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const fetch = vi.fn(
      async (url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify(
            url === "/api/reminders/data"
              ? { data: { lists: [bills], reminders: [] }, rev: 1 }
              : url.endsWith("/alerts")
                ? { alerts: [] }
                : { lists: [] },
          ),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    const { loadReminders } = await import("./reminders-sync");
    const { openItem } = await import("../desktop/desktop-open-item");
    await loadReminders();
    openItem({ app: "reminders", id: "gone", title: "Gone" });
    const view = render(<Fresh defaultSource="bills" />);
    await waitFor(() =>
      expect(fetch.mock.calls.filter(([url]) => url === "/api/reminders/data")).toHaveLength(2),
    );
    view.rerender(<Fresh defaultSource="bills" state="main" />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(fetch.mock.calls.filter(([url]) => url === "/api/reminders/data")).toHaveLength(2);
    expect(fetch.mock.calls.some(([, init]) => init?.method)).toBe(false);
    expect(rows()).toEqual([]);
  });

  it("keeps its open info popover when it takes in a change read from the server", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent" };
    const gas = { id: "gas", listId: "bills", title: "Pay gas" };
    let server = { data: { lists: [bills], reminders: [rent, gas] as Reminder[] }, rev: 1 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/reminders/alerts"
          ? new Response(JSON.stringify({ alerts: [] }), { status: 200 })
          : new Response(JSON.stringify(server), { status: 200 }),
      ),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const { refreshReminders } = await import("./reminders-sync");
    const user = userEvent.setup();
    render(<Fresh defaultSource="bills" today="2026-10-12" />);
    await waitFor(() => expect(rows()).toEqual(["Pay rent", "Pay gas"]));
    await user.click(mark("Pay rent"));
    expect(screen.getByRole("dialog", { name: "Pay rent" })).toBeInTheDocument();
    // Another browser adds a reminder; the stored reminders are read again.
    server = {
      data: {
        lists: [bills],
        reminders: [rent, gas, { id: "water", listId: "bills", title: "Pay water" }],
      },
      rev: 2,
    };
    await act(() => refreshReminders());
    await waitFor(() => expect(rows()).toEqual(["Pay rent", "Pay gas", "Pay water"]));
    expect(screen.getByRole("dialog", { name: "Pay rent" })).toBeInTheDocument();
  });

  it("shows each alert once with two windows open, and closing it closes it for both", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const at = new Date(2026, 9, 12, 9).getTime();
    let alerts = [{ id: "rent", title: "Pay rent", at }];
    let polls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method) {
          if (url.endsWith("/dismiss")) alerts = [];
          return new Response('{"rev":2}', { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          polls += 1;
          return new Response(JSON.stringify({ alerts }), { status: 200 });
        }
        const data = {
          lists: [{ id: "bills", name: "Bills", color: "orange" }],
          reminders: [{ id: "rent", listId: "bills", title: "Pay rent", due: "2026-10-12" }],
        };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(
      <>
        <Fresh defaultSource="bills" today="2026-10-12" />
        <Fresh defaultSource="bills" today="2026-10-12" />
      </>,
    );
    const alert = await screen.findByRole("alert", { name: "Reminders" });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    // The page asks for its alerts once, not once per window.
    expect(polls).toBe(1);
    await user.click(within(alert).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows no alert of a reminder it does not know, and reads the stored reminders again", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const at = new Date(2026, 9, 12, 9).getTime();
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent", due: "2026-10-12" };
    // Another tab adds the reminder after this window read the reminders.
    let server = { data: { lists: [bills], reminders: [] as (typeof rent)[] }, rev: 1 };
    let reads = 0;
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method) {
          sent.push(url);
          return new Response('{"rev":3}', { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [{ id: "rent", title: "Pay rent", at }] }), {
            status: 200,
          });
        }
        if (url === "/api/reminders/shared") {
          return new Response('{"lists":[],"can_share":false,"me":null}', { status: 200 });
        }
        reads += 1;
        const answer = JSON.stringify(server);
        server = { data: { lists: [bills], reminders: [rent] }, rev: 2 };
        return new Response(answer, { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    render(<Fresh defaultSource="bills" today="2026-10-12" />);
    // The alert names a reminder this window does not hold: it reads the reminders again first.
    const alert = await screen.findByRole("alert", { name: "Reminders" }, { timeout: 3000 });
    expect(reads).toBe(2);
    expect(rows()).toEqual(["Pay rent"]);
    expect(alert).toHaveTextContent("Pay rent");
    // Nothing was dismissed or saved while the reminder was unknown; once it shows, the module is
    // told so, to keep it out of Notification Center.
    expect(sent).toEqual(["/api/reminders/alerts/shown"]);
  });

  it("makes a save refused for a newer revision again on the stored reminders, losing nothing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    type Saved = { lists: unknown[]; reminders: { id: string; completed?: boolean }[] };
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent" };
    const gas = { id: "gas", listId: "bills", title: "Pay gas" };
    const water = { id: "water", listId: "bills", title: "Pay water" };
    let server: { data: Saved; rev: number } = {
      data: { lists: [bills], reminders: [rent, gas] },
      rev: 1,
    };
    const puts: { base: number; data: Saved }[] = [];
    const stored: Saved[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
        }
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          puts.push(body);
          // Another window adds a reminder just before this window's first save arrives.
          if (puts.length === 1) {
            server = { data: { lists: [bills], reminders: [rent, gas, water] }, rev: 2 };
          }
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ error: "changed", rev: server.rev }), {
              status: 409,
            });
          }
          server = { data: body.data, rev: server.rev + 1 };
          stored.push(body.data);
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh defaultSource="bills" today="2026-10-12" />);
    await waitFor(() => expect(rows()).toEqual(["Pay rent", "Pay gas"]));

    await user.click(circle("Pay rent"));
    // The save is refused (409): the window takes in the stored reminders, with the other
    // window's, makes its change again on them, and saves that on the stored revision.
    await waitFor(() => expect(rows()).toContain("Pay water"), { timeout: 2000 });
    await vi.waitFor(() => expect(stored).toHaveLength(1), { timeout: 2000 });
    expect(puts.map((put) => put.base)).toEqual([1, 2]);
    expect(stored[0]?.reminders).toEqual([{ ...rent, completed: true }, gas, water]);

    // The next change is saved on the revision after it.
    await user.click(circle("Pay gas"));
    await vi.waitFor(() => expect(stored).toHaveLength(2), { timeout: 2000 });
    expect(puts.at(-1)?.base).toBe(3);
    expect(stored[1]?.reminders).toEqual([
      { ...rent, completed: true },
      { ...gas, completed: true },
      water,
    ]);
  });

  it("returns to the starting reminders when a first save fails, and sends nothing more", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/reminders/alerts") {
        return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
      }
      return init?.method === "PUT"
        ? new Response("unavailable", { status: 503 })
        : new Response(JSON.stringify({ data: null, rev: 0 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const first = rows()[0] as string;
    await user.click(circle(first));
    const puts = () => fetch.mock.calls.filter(([, init]) => init?.method === "PUT");
    await vi.waitFor(() => expect(puts()).toHaveLength(1), { timeout: 2000 });
    // The outcome is not known: nothing is stored, so the starting reminders are shown again,
    // and showing them is no edit of this window's.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(puts()).toHaveLength(1);
  });

  it("saves nothing on opening, even when React runs its effects twice", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/reminders/alerts") {
        return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
      }
      return init?.method === "PUT"
        ? new Response('{"rev":1}', { status: 200 })
        : new Response(JSON.stringify({ data: null, rev: 0 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    const { Reminders: Fresh } = await import("./reminders");
    render(
      <StrictMode>
        <Fresh />
      </StrictMode>,
    );
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it("reads the reminders again until an alert's reminder is known, when a read fails", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const at = new Date(2026, 9, 12, 9).getTime();
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const rent = { id: "rent", listId: "bills", title: "Pay rent", due: "2026-10-12" };
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method) return new Response('{"rev":3}', { status: 200 });
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [{ id: "rent", title: "Pay rent", at }] }), {
            status: 200,
          });
        }
        if (url === "/api/reminders/shared") {
          return new Response('{"lists":[],"can_share":false,"me":null}', { status: 200 });
        }
        reads += 1;
        // The first read misses the reminder another tab adds; the read after it fails.
        if (reads === 1) {
          return new Response(JSON.stringify({ data: { lists: [bills], reminders: [] }, rev: 1 }));
        }
        if (reads === 2) return new Response("unavailable", { status: 503 });
        return new Response(
          JSON.stringify({ data: { lists: [bills], reminders: [rent] }, rev: 2 }),
        );
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    render(<Fresh defaultSource="bills" today="2026-10-12" />);
    const alert = await screen.findByRole("alert", { name: "Reminders" }, { timeout: 6000 });
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(alert).toHaveTextContent("Pay rent");
  }, 10_000);
});

describe("a dismissal the server did not take", () => {
  it("is not asked again once answered or refused for good", () => {
    expect(dismissalRetryDelay(200)).toBe("heard");
    expect(dismissalRetryDelay(404)).toBe("heard");
  });

  it("is asked again after a failure, a timeout or a rate limit, never before Retry-After", () => {
    expect(dismissalRetryDelay(undefined)).toBe(2000);
    expect(dismissalRetryDelay(503)).toBe(2000);
    expect(dismissalRetryDelay(429)).toBe(2000);
    expect(dismissalRetryDelay(429, "7")).toBe(7000);
    expect(dismissalRetryDelay(429, "30")).toBe(30_000);
    expect(dismissalRetryDelay(408, "0")).toBe(2000);
    const now = Date.UTC(2026, 9, 12, 9);
    expect(dismissalRetryDelay(429, new Date(now + 10_000).toUTCString(), now)).toBe(10_000);
  });

  it("is given up, not asked early, when Retry-After asks for longer than the page waits", () => {
    expect(dismissalRetryDelay(429, "31")).toBe("give-up");
    expect(dismissalRetryDelay(429, "3600")).toBe("give-up");
    const now = Date.UTC(2026, 9, 12, 9);
    expect(dismissalRetryDelay(408, new Date(now + 60_000).toUTCString(), now)).toBe("give-up");
  });
});

describe("the reminders' dates", () => {
  const base: Reminder = { id: "r", listId: "home", title: "Put the bins out" };

  it("finds a repeating reminder's next day by the calendar", () => {
    expect(nextOccurrence("2026-12-31", "daily")).toBe("2027-01-01");
    expect(nextOccurrence("2026-10-12", "weekly")).toBe("2026-10-19");
    expect(nextOccurrence("2026-10-12", "biweekly")).toBe("2026-10-26");
    // Friday, Saturday and Sunday all go on to Monday.
    for (const day of ["2026-10-16", "2026-10-17", "2026-10-18"]) {
      expect(nextOccurrence(day, "weekdays")).toBe("2026-10-19");
    }
    expect(nextOccurrence("2026-10-12", "weekdays")).toBe("2026-10-13");
    expect(nextOccurrence("2026-10-12", "custom")).toBeUndefined();
    expect(nextOccurrence("2026-10-12", "custom", { every: 10, unit: "day" })).toBe("2026-10-22");
    expect(nextOccurrence("2026-01-31", "custom", { every: 3, unit: "month" })).toBe("2026-07-31");
    expect(nextOccurrence("2024-02-29", "custom", { every: 2, unit: "year" })).toBe("2028-02-29");
    // Monday 12 October 2026: Wednesday of that week, then Monday two weeks on.
    const rule = { every: 2, unit: "week", weekdays: [1, 3] } as const;
    expect(nextOccurrence("2026-10-12", "custom", rule)).toBe("2026-10-14");
    expect(nextOccurrence("2026-10-14", "custom", rule)).toBe("2026-10-26");
    expect(nextOccurrence("2026-12-15", "monthly")).toBe("2027-01-15");
    // The 31st skips the months that lack it, and does not drift.
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-03-31");
    expect(nextOccurrence("2026-03-31", "monthly")).toBe("2026-05-31");
    expect(nextOccurrence("2024-02-29", "yearly")).toBe("2028-02-29");
    expect(nextOccurrence("9999-12-31", "daily")).toBeUndefined();
  });

  it("completes a reminder, or moves one that repeats to its next day", () => {
    const weekly: Reminder = { ...base, due: "2026-10-12", repeat: "weekly" };
    const moved = completeReminder(weekly);
    expect(moved).toMatchObject({ due: "2026-10-19" });
    expect(moved.completed).toBeUndefined();
    expect(completeReminder({ ...weekly, repeatEnd: "2026-10-18" })).toMatchObject({
      due: "2026-10-12",
      completed: true,
    });
    expect(completeReminder({ ...base, due: "2026-10-12" })).toMatchObject({ completed: true });
  });

  it("says when a reminder is due, as its row does, and whether that has passed", () => {
    const label = (due: string, dueTime?: string) =>
      dueLabel({ ...base, due, dueTime }, "2026-10-12", "14:00");
    expect(label("2026-10-12")).toEqual({ text: "Today", overdue: false });
    expect(label("2026-10-12", "15:00")).toEqual({ text: "Today, 3:00 PM", overdue: false });
    expect(label("2026-10-12", "09:30")).toEqual({ text: "Today, 9:30 AM", overdue: true });
    expect(label("2026-10-13", "00:05")).toEqual({ text: "Tomorrow, 12:05 AM", overdue: false });
    expect(label("2026-10-11")).toEqual({ text: "Yesterday", overdue: true });
    expect(label("2026-11-02", "12:00")).toEqual({ text: "11/2/26, 12:00 PM", overdue: false });
    expect(dueLabel(base, "2026-10-12", "14:00")).toBeNull();
  });

  it("alerts at the due minute, and at 9:00 without one", () => {
    const nine = new Date(2026, 9, 12, 9).getTime();
    const half = new Date(2026, 9, 12, 15, 30).getTime();
    expect(alertOf({ ...base, due: "2026-10-12" })).toBe(nine);
    expect(alertOf({ ...base, due: "2026-10-12", dueTime: "15:30" })).toBe(half);
    expect(alertOf({ ...base, due: "2026-10-12", dueTime: "15:30", earlyMinutes: 15 })).toBe(
      half - 15 * 60_000,
    );
    expect(alertOf({ ...base, due: "2026-10-12", earlyMinutes: 15 })).toBe(nine);
    // What the server takes, the browser reads, so a document with any of them stays readable.
    for (const earlyMinutes of [1, 10, 2880, 10_080]) {
      expect(isReminderShape({ ...base, earlyMinutes })).toBe(true);
    }
    for (const earlyMinutes of [0, 10_081, 1.5, "5"]) {
      expect(isReminderShape({ ...base, earlyMinutes })).toBe(false);
    }
    expect(alertOf({ ...base, due: "2026-10-12", completed: true })).toBeUndefined();
    expect(alertOf(base)).toBeUndefined();
  });

  it("keeps a minute that exists in its own year, whatever the clocks did in another", () => {
    const zone = process.env.TZ;
    // New York's clocks skipped 02:00 to 03:00 on 2 April 2000, but not on 2 April 2026.
    process.env.TZ = "America/New_York";
    try {
      expect(timeOf(dateOf("2026-04-02", "02:30"))).toBe("02:30");
      expect(dateOf("2026-04-02", "02:30").getDate()).toBe(2);
      // On 8 March 2026 they did skip it: that minute is moved by that day's change.
      expect(timeOf(dateOf("2026-03-08", "02:30"))).toBe("03:30");
      expect(dateOf("0099-12-31", "23:59").getFullYear()).toBe(99);
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("reads the day and the minute a new reminder's text names", () => {
    // Monday 12 October 2026, 10:00.
    const now = new Date(2026, 9, 12, 10);
    expect(parseEntry("call Martin tomorrow 3pm", now)).toEqual({
      title: "call Martin",
      due: "2026-10-13",
      dueTime: "15:00",
    });
    expect(parseEntry("Pay rent today", now)).toEqual({ title: "Pay rent", due: "2026-10-12" });
    expect(parseEntry("Dinner with Ada tonight", now)).toEqual({
      title: "Dinner with Ada",
      due: "2026-10-12",
      dueTime: "20:00",
    });
    expect(parseEntry("Team lunch on Friday at noon", now)).toEqual({
      title: "Team lunch",
      due: "2026-10-16",
      dueTime: "12:00",
    });
    expect(parseEntry("Monday stand-up", now)).toEqual({ title: "stand-up", due: "2026-10-19" });
    expect(parseEntry("Plan the trip next week", now)).toEqual({
      title: "Plan the trip",
      due: "2026-10-19",
    });
    expect(parseEntry("Water the plants at 15:00", now)).toEqual({
      title: "Water the plants",
      due: "2026-10-12",
      dueTime: "15:00",
    });
    // 9:00 has passed today, so it is tomorrow's. An hour from 1 to 6 alone is the afternoon.
    expect(parseEntry("Stand-up at 9", now)).toEqual({
      title: "Stand-up",
      due: "2026-10-13",
      dueTime: "09:00",
    });
    expect(parseEntry("Call back at 3", now)).toEqual({
      title: "Call back",
      due: "2026-10-12",
      dueTime: "15:00",
    });
    expect(parseEntry("Gym 7:30 am Saturday", now)).toEqual({
      title: "Gym",
      due: "2026-10-17",
      dueTime: "07:30",
    });
    // Text that names no date, or that would leave no title, stays as it is.
    expect(parseEntry("Read 2 chapters", now)).toEqual({ title: "Read 2 chapters" });
    expect(parseEntry("Todays news", now)).toEqual({ title: "Todays news" });
    expect(parseEntry("tomorrow", now)).toEqual({ title: "tomorrow" });
  });
});

describe("Reminders with dates, repeats and priorities", () => {
  const lists = [{ id: "home", name: "Home", color: "purple" as const }];

  it("sets a due day and a minute in the info popover, and the row says when", async () => {
    const user = userEvent.setup();
    render(<Reminders today="2026-10-12" />);
    await user.click(mark("Graphite"));
    const info = screen.getByRole("dialog", { name: "Graphite" });
    // As captured, a reminder with no day has no minute and no repeat.
    expect(within(info).queryByRole("checkbox", { name: "At a Time" })).not.toBeInTheDocument();
    expect(within(info).queryByRole("combobox", { name: "repeat" })).not.toBeInTheDocument();
    await user.click(within(info).getByRole("checkbox", { name: "On a Day" }));
    const date = within(info).getByRole("group", { name: "Date" });
    expect(within(date).getByRole("spinbutton", { name: "Day" })).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    expect(within(row("Graphite")).getByText("Today")).toBeInTheDocument();
    await user.click(within(info).getByRole("checkbox", { name: "At a Time" }));
    expect(within(row("Graphite")).getByText("Today, 9:00 AM")).toBeInTheDocument();
    const time = within(info).getByRole("group", { name: "Time" });
    fireEvent.keyDown(within(time).getByRole("spinbutton", { name: "Hour" }), { key: "ArrowUp" });
    expect(within(row("Graphite")).getByText("Today, 10:00 AM")).toBeInTheDocument();
    // The day moves with its field: tomorrow is no longer in Today.
    fireEvent.keyDown(within(date).getByRole("spinbutton", { name: "Day" }), { key: "ArrowUp" });
    expect(within(row("Graphite")).getByText("Tomorrow, 10:00 AM")).toBeInTheDocument();
    expect(tile("Today")).toHaveTextContent("0");
    expect(tile("Scheduled")).toHaveTextContent("1");
    // Without a day there is no minute either.
    await user.click(within(info).getByRole("checkbox", { name: "On a Day" }));
    expect(within(info).queryByRole("group", { name: "Time" })).not.toBeInTheDocument();
    expect(row("Graphite").querySelector(".mac-reminders-due")).toBeNull();
    expect(tile("Scheduled")).toHaveTextContent("0");
  });

  it("shows a day that has passed in red", () => {
    render(
      <Reminders
        defaultLists={lists}
        defaultReminders={[
          { id: "a", listId: "home", title: "Renew the pass", due: "2026-10-09" },
          { id: "b", listId: "home", title: "Book the dentist", due: "2026-10-14" },
        ]}
        defaultSource="home"
        today="2026-10-12"
      />,
    );
    const late = row("Renew the pass").querySelector(".mac-reminders-due");
    expect(late).toHaveTextContent("10/9/26");
    expect(late).toHaveAttribute("data-overdue");
    const ahead = row("Book the dentist").querySelector(".mac-reminders-due");
    expect(ahead).toHaveTextContent("10/14/26");
    expect(ahead).not.toHaveAttribute("data-overdue");
  });

  it("repeats a reminder: completing it moves it to its next day and keeps it to do", async () => {
    const user = userEvent.setup();
    render(
      <Reminders
        defaultLists={lists}
        defaultReminders={[
          { id: "bins", listId: "home", title: "Put the bins out", due: "2026-10-12" },
        ]}
        defaultSource="home"
        today="2026-10-12"
      />,
    );
    await user.click(mark("Put the bins out"));
    const info = screen.getByRole("dialog", { name: "Put the bins out" });
    await user.click(within(info).getByRole("combobox", { name: "repeat" }));
    await user.click(await screen.findByRole("option", { name: "Every Week" }));
    await waitFor(() =>
      expect(within(info).getByRole("combobox", { name: "repeat" })).toHaveTextContent(
        "Every Week",
      ),
    );
    expect(within(info).getByRole("combobox", { name: "end repeat" })).toHaveTextContent("Never");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(tile("Today")).toHaveTextContent("1");
    await user.click(circle("Put the bins out"));
    // Still to do, a week on.
    expect(row("Put the bins out")).not.toHaveTextContent("completed");
    expect(within(row("Put the bins out")).getByText("10/19/26")).toBeInTheDocument();
    expect(count()).toBe("1 to do");
    expect(tile("Today")).toHaveTextContent("0");
    expect(tile("Scheduled")).toHaveTextContent("1");
  });

  it("marks a reminder's priority before its title, and says it", () => {
    render(
      <Reminders
        defaultLists={lists}
        defaultReminders={[
          { id: "a", listId: "home", title: "Sweep", priority: "high" },
          { id: "b", listId: "home", title: "Dust", priority: "low" },
          { id: "c", listId: "home", title: "Mop", priority: "none" },
        ]}
        defaultSource="home"
      />,
    );
    expect(rows()).toEqual(["Sweep", "Dust", "Mop"]);
    expect(row("Sweep").querySelector(".mac-reminders-priority")).toHaveTextContent(/^!!!$/);
    expect(row("Dust").querySelector(".mac-reminders-priority")).toHaveTextContent(/^!$/);
    expect(row("Mop").querySelector(".mac-reminders-priority")).toBeNull();
    expect(screen.getByRole("option", { name: /^Sweep\s*, high priority$/ })).toBe(row("Sweep"));
  });

  it("takes the day and the minute out of a new reminder's text, and only a new one's", async () => {
    const user = userEvent.setup();
    render(<Reminders today="2026-10-12" />);
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Call Martin tomorrow 3pm{Enter}");
    expect(rows().at(-1)).toBe("Call Martin");
    expect(within(row("Call Martin")).getByText("Tomorrow, 3:00 PM")).toBeInTheDocument();
    expect(tile("Scheduled")).toHaveTextContent("1");
    await user.dblClick(row("Bondi"));
    await user.keyboard(" today{Enter}");
    expect(rows()[0]).toBe("Bondi today");
    expect(tile("Scheduled")).toHaveTextContent("1");
  });
});

describe("due times and repeats on the Ferrite application", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("saves a reminder's alert at its due minute", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const puts: { alerts: Record<string, number> }[] = [];
    const bills = { id: "bills", name: "Bills", color: "orange" };
    const call = {
      id: "call",
      listId: "bills",
      title: "Call the bank",
      due: "2026-10-12",
      dueTime: "15:30",
    };
    const rent = { id: "rent", listId: "bills", title: "Pay rent" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
        }
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response('{"rev":2}', { status: 200 });
        }
        const data = { lists: [bills], reminders: [call, rent] };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh defaultSource="bills" today="2026-10-12" />);
    await waitFor(() => expect(rows()).toEqual(["Call the bank", "Pay rent"]));
    expect(within(row("Call the bank")).getByText("Today, 3:30 PM")).toBeInTheDocument();
    await user.click(circle("Pay rent"));
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]?.alerts).toEqual({ call: new Date(2026, 9, 12, 15, 30).getTime() });
  });

  it("moves a repeating reminder a week on from its alert's Complete, with its next alert", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const at = new Date(2026, 9, 12, 7, 30).getTime();
    const sent: { url: string; body: { data?: { reminders: Reminder[] }; alerts?: unknown } }[] =
      [];
    let alerts = [{ id: "bins", title: "Put the bins out", at }];
    const bins = {
      id: "bins",
      listId: "home",
      title: "Put the bins out",
      due: "2026-10-12",
      dueTime: "07:30",
      repeat: "weekly",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method) {
          if (url.endsWith("/shown")) return new Response('{"told":1}', { status: 200 });
          sent.push({ url, body: JSON.parse(String(init.body)) });
          if (url.endsWith("/dismiss")) alerts = [];
          return new Response('{"rev":2}', { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts }), { status: 200 });
        }
        const data = { lists: [{ id: "home", name: "Home", color: "purple" }], reminders: [bins] };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh defaultSource="home" today="2026-10-12" />);
    const alert = await screen.findByRole("alert", { name: "Reminders" });
    await user.click(within(alert).getByRole("button", { name: "Complete" }));
    await vi.waitFor(() => expect(sent).toHaveLength(2), { timeout: 2000 });
    expect(sent).toContainEqual({ url: "/api/reminders/alerts/bins/dismiss", body: { at } });
    const save = sent.find((each) => each.url === "/api/reminders/data");
    // Still to do, a week on, alerting at the same minute that day, in the zone it is read in.
    expect(save?.body.data?.reminders).toEqual([{ ...bins, due: "2026-10-19", timeZone: zone }]);
    expect(save?.body.alerts).toEqual({ bins: new Date(2026, 9, 19, 7, 30).getTime() });
    expect(within(row("Put the bins out")).getByText("10/19/26, 7:30 AM")).toBeInTheDocument();
  });

  it("does not move a repeating reminder again from an alert of the occurrence already done", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const at = new Date(2026, 9, 12, 7, 30).getTime();
    const sent: { url: string; body: { data?: { reminders: Reminder[] } } }[] = [];
    const alerts = [{ id: "bins", title: "Put the bins out", at }];
    const bins = {
      id: "bins",
      listId: "home",
      title: "Put the bins out",
      due: "2026-10-12",
      dueTime: "07:30",
      repeat: "weekly",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method) {
          if (url.endsWith("/shown")) return new Response('{"told":1}', { status: 200 });
          sent.push({ url, body: JSON.parse(String(init.body)) });
          return new Response(JSON.stringify({ rev: sent.length + 1 }), { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts }), { status: 200 });
        }
        const data = { lists: [{ id: "home", name: "Home", color: "purple" }], reminders: [bins] };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh defaultSource="home" today="2026-10-12" />);
    const alert = await screen.findByRole("alert", { name: "Reminders" });
    // The circle moves it a week on while the alert of the 12th still shows.
    await user.click(circle("Put the bins out"));
    await vi.waitFor(() => expect(sent).toHaveLength(1), { timeout: 2000 });
    await user.click(within(alert).getByRole("button", { name: "Complete" }));
    await vi.waitFor(() => expect(sent.some((each) => each.url.endsWith("/dismiss"))).toBe(true), {
      timeout: 2000,
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    // The alert is dismissed, and the reminder stays on the 19th, not the 26th.
    const saves = sent.filter((each) => each.url === "/api/reminders/data");
    expect(saves).toHaveLength(1);
    expect(saves[0]?.body.data?.reminders).toEqual([
      { ...bins, due: "2026-10-19", timeZone: zone },
    ]);
    expect(within(row("Put the bins out")).getByText("10/19/26, 7:30 AM")).toBeInTheDocument();
  });

  it("goes past a day's heading with one press of an arrow key, either way", async () => {
    const user = userEvent.setup();
    const lists = [{ id: "home", name: "Home", color: "blue" as const }];
    const reminders = [
      { id: "a", listId: "home", title: "Sweep", due: "2019-10-08" },
      { id: "b", listId: "home", title: "Mop", due: "2019-10-09" },
    ];
    render(<Reminders defaultLists={lists} defaultReminders={reminders} today="2019-10-07" />);
    await user.click(tile("Scheduled"));
    await user.click(row("Sweep"));
    expect(row("Sweep")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(row("Mop")).toHaveAttribute("aria-selected", "true");
    expect(row("Sweep")).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{ArrowUp}");
    expect(row("Sweep")).toHaveAttribute("aria-selected", "true");
  });
});
