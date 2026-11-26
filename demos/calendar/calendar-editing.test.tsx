import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Calendar, type CalendarProps } from "./calendar";
import { type CalendarEntry, defaultEvents } from "./calendar-data";
import { EventDetails } from "./calendar-editor";

const open = (props: CalendarProps = {}) => {
  const user = userEvent.setup();
  render(<Calendar {...props} />);
  return user;
};

const event = (name: RegExp) => screen.queryByRole("button", { name });
const popover = () => screen.getByRole("dialog");
const next = () =>
  within(screen.getByRole("group", { name: "Go to" })).getByRole("button", { name: "Next week" });

const standup: CalendarEntry = {
  id: "standup",
  title: "Standup",
  start: new Date(2019, 9, 1, 9, 30),
  end: new Date(2019, 9, 1, 10),
  calendar: "work",
  repeat: { freq: "weekly" },
};

describe("Calendar's events", () => {
  it("edits the title and the location in the event's popover", async () => {
    const user = open({ defaultSelectedEvent: "screenshots", defaultPopoverOpen: true });
    await user.click(
      within(popover()).getByRole("button", { name: "Title: Make Catalina Screenshots" }),
    );
    const title = within(popover()).getByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Ship Catalina{Enter}");
    expect(event(/^Ship Catalina, /)).toBeInTheDocument();

    await user.click(within(popover()).getByRole("button", { name: "Add Location" }));
    await user.type(
      within(popover()).getByRole("textbox", { name: "Location" }),
      "Cupertino{Enter}",
    );
    expect(within(popover()).getByText("Cupertino")).toBeInTheDocument();
  });

  it("shows a repeating event in every week it repeats in, with its repeat under the date", async () => {
    const user = open({ events: [...defaultEvents, standup], defaultSelectedEvent: undefined });
    expect(event(/^Standup, /)).toBeInTheDocument();
    await user.click(next());
    expect(event(/^Standup, /)).toBeInTheDocument();
    await user.dblClick(event(/^Standup, /) as HTMLElement);
    expect(within(popover()).getByText("Every Week")).toBeInTheDocument();
  });

  it("deletes an event with the Delete key, and asks about one occurrence of a repeating event", async () => {
    const user = open({ events: [...defaultEvents, standup] });
    await user.click(event(/^Make Catalina Screenshots, /) as HTMLElement);
    await user.keyboard("{Delete}");
    expect(event(/^Make Catalina Screenshots, /)).not.toBeInTheDocument();

    await user.click(event(/^Standup, /) as HTMLElement);
    await user.keyboard("{Backspace}");
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Delete Only This Event" }));
    expect(event(/^Standup, /)).not.toBeInTheDocument();
    await user.click(next());
    expect(event(/^Standup, /)).toBeInTheDocument();
  });

  it("draws a repeating event on its days in the month, and a day's number opens that day", async () => {
    const user = open({ events: [standup], defaultView: "month" });
    const cells = [...document.querySelectorAll<HTMLElement>("[data-day]")];
    expect(
      cells.filter((cell) => cell.textContent?.includes("Standup")).map((cell) => cell.dataset.day),
    ).toEqual(["2019-10-01", "2019-10-08", "2019-10-15", "2019-10-22", "2019-10-29"]);
    const fifteenth = document.querySelector<HTMLElement>('[data-day="2019-10-15"]');
    await user.dblClick(
      within(fifteenth as HTMLElement).getByRole("button", { name: "Tuesday, October 15, 2019" }),
    );
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".mac-calendar-week-grid-day")?.textContent).toBe("Tue 15");
    expect(event(/^Standup, /)).toBeInTheDocument();
  });

  it("opens the popover of the event double-clicked in a crowded day of the month", async () => {
    const crowd = ["One", "Two", "Three", "Four", "Five"].map((title, at) => ({
      id: title,
      title,
      start: new Date(2019, 9, 16, 9 + at),
      end: new Date(2019, 9, 16, 10 + at),
      calendar: "home",
    }));
    const user = open({ events: crowd, defaultView: "month" });
    expect(screen.getByRole("button", { name: "2 more…" })).toBeVisible();
    await user.dblClick(event(/^Two, /) as HTMLElement);
    expect(await screen.findByRole("dialog", { name: "Two" })).toBeVisible();
    expect(event(/^Two, /)).toHaveAttribute("aria-pressed", "true");
    expect(event(/^One, /)).toHaveAttribute("aria-pressed", "false");
  });

  it("refuses to remove a 201st occurrence of a repeating event, and still deletes the series", async () => {
    const removed = Array.from({ length: 200 }, (_, index) =>
      new Date(2020, 0, 7 + 7 * index, 9, 30).getTime(),
    );
    const user = open({ events: [{ ...standup, exdates: removed }] });
    await user.click(event(/^Standup, /) as HTMLElement);
    await user.keyboard("{Delete}");
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Delete Only This Event" }));
    const report = await screen.findByRole("alertdialog", {
      name: /This event can’t lose more occurrences/,
    });
    expect(report).toHaveTextContent("keeps at most 200 removed occurrences");
    await user.click(within(report).getByRole("button", { name: "OK" }));
    expect(event(/^Standup, /)).toBeInTheDocument();

    await user.click(event(/^Standup, /) as HTMLElement);
    await user.keyboard("{Delete}");
    const again = await screen.findByRole("alertdialog");
    await user.click(within(again).getByRole("button", { name: "Delete All Future Events" }));
    await waitFor(() => expect(event(/^Standup, /)).not.toBeInTheDocument());
    await user.click(next());
    expect(event(/^Standup, /)).not.toBeInTheDocument();
  });

  it("lists every match of the search and goes to one", async () => {
    const user = open();
    await user.type(screen.getByRole("searchbox"), "hallo");
    const results = screen.getByRole("listbox", { name: "Search results" });
    expect(within(results).getByText("Halloween")).toBeInTheDocument();
    expect(within(results).queryByText("Labor Day")).not.toBeInTheDocument();
    await user.dblClick(within(results).getByText("Halloween"));
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".mac-calendar-week-grid-day")?.textContent).toBe("Thu 31");
  });

  it("makes a calendar of the person's own from the list's contextual menu", async () => {
    const user = open();
    const list = screen.getByRole("tree", { name: "Calendars" });
    fireEvent.contextMenu(within(list).getByRole("treeitem", { name: /Work/ }));
    await user.click(await screen.findByRole("menuitem", { name: "New Calendar" }));
    const name = await screen.findByRole("textbox", { name: "Calendar name" });
    await user.clear(name);
    await user.type(name, "Running{Enter}");
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole("treeitem")
          .map((row) => row.textContent),
      ).toEqual(["Home", "Work", "Running", "US Holidays", "Siri Suggestions"]),
    );
  });
});

/** The event popover's content alone, keeping the changes it makes, each reported to `seen`. */
function Editor({
  initial,
  field,
  seen,
}: {
  initial: CalendarEntry;
  field: "date";
  seen: (entry: CalendarEntry) => void;
}) {
  const [entry, setEntry] = useState(initial);
  return (
    <EventDetails
      entry={entry}
      calendars={[]}
      colorOf={() => undefined}
      initialField={field}
      onChange={(change) => {
        const next = { ...entry, ...change };
        seen(next);
        setEntry(next);
      }}
    />
  );
}

describe("the event popover's editors", () => {
  it("sets a repeat's number of occurrences once the field is left, from what was typed", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    render(
      <Editor
        initial={{ ...standup, repeat: { freq: "weekly", count: 10 } }}
        field="date"
        seen={seen}
      />,
    );
    const count = screen.getByRole("textbox", { name: "Occurrences" });
    await user.clear(count);
    await user.type(count, "12");
    // Nothing is set while typing: an empty field is not one occurrence.
    expect(seen).not.toHaveBeenCalled();
    expect(count).toHaveValue("12");
    await user.tab();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.lastCall?.[0].repeat).toEqual({ freq: "weekly", count: 12 });
    // Out of range is brought into it.
    await user.clear(count);
    await user.type(count, "5000{Enter}");
    expect(seen.mock.lastCall?.[0].repeat).toEqual({ freq: "weekly", count: 999 });
  });
});
