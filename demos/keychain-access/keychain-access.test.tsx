import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { KeychainAccess } from "./keychain-access";
import {
  arrange,
  darkCaptureItems,
  darkCaptureToday,
  defaultItems,
  formatDate,
  type KeychainAccessItem,
} from "./keychain-access-data";

/*
 * jsdom has no layout, so a table is never measured and renders its first 40 rows: all 37
 * items of the login keychain.
 */
const frame = () => screen.getByRole("region", { name: "Keychain Access" });
const grid = (name: string) => screen.getByRole("grid", { name });
const dataRows = (name = "Items") =>
  within(grid(name))
    .getAllByRole("row")
    .filter((row) => row.hasAttribute("aria-selected"));
const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole("gridcell")
    .map((cell) => cell.textContent);
const names = () => dataRows().map((row) => cells(row)[0]);
/** The first row of a table whose first cell is the text: an item, a keychain or a category. */
const rowOf = (text: string, table = "Items") => {
  const row = dataRows(table).find((candidate) => cells(candidate)[0] === text);
  if (!row) throw new Error(`no row named ${text} in ${table}`);
  return row;
};
const heading = (name: string) => screen.getByRole("columnheader", { name });
const summary = () => screen.getByRole("group", { name: "Selected item" });
/** The name the summary is headed by; a detail's value can be the same text. */
const summaryName = () => within(summary()).getByText(/./, { selector: "span" }).textContent;
/** The value beside a label of the summary. */
const detail = (label: string) =>
  within(summary()).getByText(label).nextElementSibling?.textContent;
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) => {
  const button = screen.getByRole("button", { name });
  return button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled");
};
const inLogin = defaultItems.filter((item) => item.keychain === "login");

describe("the window", () => {
  it("opens on the login keychain and All Items, sorted by name, at the captured size", () => {
    render(<KeychainAccess />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("877px");
    expect(frame().style.height).toBe("593px");
    expect(rowOf("login", "Keychains")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("All Items", "Category")).toHaveAttribute("aria-selected", "true");
    expect(
      within(grid("Items"))
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Name", "Kind", "Date Modified", "Expires", "Keychain"]);
    expect(heading("Name")).toHaveAttribute("aria-sort", "ascending");
    expect(dataRows()).toHaveLength(inLogin.length);
    expect(cells(dataRows()[0] as HTMLElement)).toEqual([
      "<key>",
      "public key",
      "--",
      "--",
      "login",
    ]);
    // A long name is in the page whole; the table shows it without its middle.
    expect(cells(dataRows()[4] as HTMLElement)).toEqual([
      "com.apple.account.AppleAccount.cloudkit-token",
      "application password",
      "Today, 2:57 PM",
      "--",
      "login",
    ]);
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <KeychainAccess
        ref={ref}
        state="inactive"
        width={700}
        height="50vh"
        className="mine"
        data-kind="app"
        style={{ left: 12 }}
        zoomRole="zoom"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("700px");
    expect(frame().style.height).toBe("50vh");
    expect(frame().style.left).toBe("12px");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    const bar = screen.getByRole("toolbar", { name: "Toolbar" });
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a toolbar control is the control's, not a drag.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Info" }), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<KeychainAccess minimizeDisabled zoomDisabled />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();
  });
});

describe("the two lists", () => {
  it("opens on the first keychain when the one asked for does not exist", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<KeychainAccess defaultKeychain="missing" onAdd={onAdd} />);
    expect(rowOf("login", "Keychains")).toHaveAttribute("aria-selected", "true");
    expect(dataRows()).toHaveLength(inLogin.length);
    // "+" speaks of the keychain the list shows as selected.
    await user.click(screen.getByRole("button", { name: "New Keychain Item" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "login" }));
  });

  it("lists the items of the keychain chosen", () => {
    render(<KeychainAccess />);
    fireEvent.mouseDown(rowOf("System Roots", "Keychains"));
    expect(rowOf("System Roots", "Keychains")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("login", "Keychains")).toHaveAttribute("aria-selected", "false");
    expect(names()).toHaveLength(8);
    expect(cells(dataRows()[0] as HTMLElement)).toEqual([
      "Aldgate Trust Root CA",
      "certificate",
      "--",
      "Nov 9, 2031 at 11:59:59 PM",
      "System Roots",
    ]);

    fireEvent.mouseDown(rowOf("Local Items", "Keychains"));
    expect(names()).toEqual([
      "accounts.example.org",
      "Harbour Cafe Guest",
      "Home Network",
      "Safari Forms AutoFill Encryption Key",
      "shop.example.net",
    ]);
  });

  it("lists the items of the category chosen, in the selected keychain", () => {
    render(<KeychainAccess />);
    const kinds = () => new Set(dataRows().map((row) => cells(row)[1]));

    fireEvent.mouseDown(rowOf("Keys", "Category"));
    expect(rowOf("Keys", "Category")).toHaveAttribute("aria-selected", "true");
    expect(names()).toHaveLength(8);
    expect(kinds()).toEqual(new Set(["public key", "private key"]));

    fireEvent.mouseDown(rowOf("Secure Notes", "Category"));
    expect(names()).toEqual(["Garden shed inventory", "Travel checklist"]);

    fireEvent.mouseDown(rowOf("Passwords", "Category"));
    expect(kinds()).toEqual(new Set(["application password", "Internet password"]));

    // My Certificates holds only the certificates whose private key is in the keychain.
    fireEvent.mouseDown(rowOf("My Certificates", "Category"));
    expect(names()).toEqual(["Local Signing Identity"]);
    fireEvent.mouseDown(rowOf("System Roots", "Keychains"));
    expect(dataRows()).toHaveLength(0);
    fireEvent.mouseDown(rowOf("Certificates", "Category"));
    expect(dataRows()).toHaveLength(8);
  });
});

describe("sorting", () => {
  it("sorts by the heading clicked, ascending first, and reverses on a second click", async () => {
    const user = userEvent.setup();
    render(<KeychainAccess />);
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(heading("Name")).toHaveAttribute("aria-sort", "descending");
    expect(names().slice(0, 2)).toEqual(["Travel checklist", "Safari Session State Key"]);

    // Items without a date come first, then the oldest change.
    await user.click(screen.getByRole("button", { name: "Date Modified" }));
    expect(heading("Date Modified")).toHaveAttribute("aria-sort", "ascending");
    expect(heading("Name")).toHaveAttribute("aria-sort", "none");
    const dated = dataRows().filter((row) => cells(row)[2] !== "--");
    expect(cells(dated[0] as HTMLElement).slice(0, 3)).toEqual([
      "BeaconStore",
      "application password",
      "Sep 29, 2019 at 6:20:00 PM",
    ]);
    expect(dataRows().indexOf(dated[0] as HTMLElement)).toBe(9);

    await user.click(screen.getByRole("button", { name: "Date Modified" }));
    expect(heading("Date Modified")).toHaveAttribute("aria-sort", "descending");
    expect(cells(dataRows()[0] as HTMLElement).slice(0, 3)).toEqual([
      "com.apple.account.AppleAccount.cloudkit-token",
      "application password",
      "Today, 2:57 PM",
    ]);
  });

  it("keeps the order of the list among equal values, in both directions", () => {
    const ids = (direction: "ascending" | "descending") =>
      arrange(defaultItems, { keychain: "system-roots", sort: { column: "kind", direction } }).map(
        (item) => item.id,
      );
    const given = defaultItems
      .filter((item) => item.keychain === "system-roots")
      .map((item) => item.id);
    expect(ids("ascending")).toEqual(given);
    expect(ids("descending")).toEqual(given);
  });
});

describe("search", () => {
  it("lists the items whose name or kind contains the text, whatever its case", async () => {
    const user = userEvent.setup();
    render(<KeychainAccess />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "ASSISTANT");
    expect(names()).toEqual(["com.apple.assistant", "com.apple.assistant"]);
    expect(grid("Items")).toHaveAttribute("aria-rowcount", "3");

    await user.clear(field);
    await user.type(field, "private");
    expect(names()).toEqual([
      "<key>",
      "iMessage Encryption Key",
      "iMessage Signing Key",
      "Local Signing Identity",
    ]);

    await user.clear(field);
    await user.type(field, "no such item");
    expect(dataRows()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(field).toHaveValue("");
    expect(dataRows()).toHaveLength(inLogin.length);
  });

  it("empties the summary and makes Info unavailable while it hides the selected item", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    render(<KeychainAccess defaultSelectedItemId="login-4" onInspect={onInspect} />);
    expect(summaryName()).toBe("BeaconStore");
    expect(unavailable("Info")).toBe(false);

    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "assistant");
    expect(summary()).toBeEmptyDOMElement();
    expect(unavailable("Info")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Info" }));
    expect(onInspect).not.toHaveBeenCalled();

    // The selection is kept, so the summary returns with the item.
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(rowOf("BeaconStore")).toHaveAttribute("aria-selected", "true");
    expect(summaryName()).toBe("BeaconStore");
    expect(unavailable("Info")).toBe(false);
  });
});

describe("the selected item", () => {
  it("shows the summary of the row pressed", () => {
    render(<KeychainAccess defaultSelectedItemId="login-1" />);
    expect(rowOf("<key>")).toHaveAttribute("aria-selected", "true");
    expect(summaryName()).toBe("<key>");
    expect(detail("Kind:")).toBe("public key, RSA, 2,048-bit");
    expect(detail("Usage:")).toBe("Encrypt, Derive, Verify");

    fireEvent.mouseDown(rowOf("BeaconStore"));
    expect(rowOf("BeaconStore")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("<key>")).toHaveAttribute("aria-selected", "false");
    expect(grid("Items")).toHaveFocus();
    expect(summaryName()).toBe("BeaconStore");
    expect(detail("Kind:")).toBe("application password");
    expect(detail("Where:")).toBe("BeaconStore");
    expect(detail("Modified:")).toBe("Sep 29, 2019 at 6:20:00 PM");
    expect(within(summary()).queryByText("Usage:")).toBeNull();

    fireEvent.mouseDown(rowOf("Local Signing Identity"));
    expect(detail("Kind:")).toBe("certificate");
    expect(detail("Expires:")).toBe("Sep 26, 2029 at 6:25:00 PM");
  });

  it("hands the item to the host for Info, a double click and Return", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    render(<KeychainAccess onInspect={onInspect} />);
    expect(summary()).toBeEmptyDOMElement();
    expect(unavailable("Info")).toBe(true);

    fireEvent.mouseDown(rowOf("BeaconStore"));
    await user.click(screen.getByRole("button", { name: "Info" }));
    expect(onInspect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "login-4" }));

    fireEvent.doubleClick(rowOf("Travel checklist"));
    expect(onInspect).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Travel checklist", kind: "secure note" }),
    );

    act(() => grid("Items").focus());
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onInspect).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "com.apple.account.AppleAccount.cloudkit-token" }),
    );
    expect(onInspect).toHaveBeenCalledTimes(3);
  });

  it("hands the selected keychain to the host for a new item", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<KeychainAccess onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: "New Keychain Item" }));
    expect(onAdd).toHaveBeenLastCalledWith(expect.objectContaining({ id: "login" }));
    fireEvent.mouseDown(rowOf("System", "Keychains"));
    await user.click(screen.getByRole("button", { name: "New Keychain Item" }));
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "system", name: "System" }),
    );
  });
});

describe("dates", () => {
  it("counts Today and Yesterday from the day given", () => {
    expect(formatDate("2019-10-07T14:57:00", "2019-10-07")).toBe("Today, 2:57 PM");
    expect(formatDate("2019-10-07T08:59:00", "2019-10-08")).toBe("Yesterday, 8:59 AM");
    expect(formatDate("2019-10-07T00:05:09", "2019-10-09")).toBe("Oct 7, 2019 at 12:05:09 AM");
    // The day before the first of a month is yesterday too.
    expect(formatDate("2019-09-30T12:00:00", "2019-10-01")).toBe("Yesterday, 12:00 PM");
    expect(formatDate(undefined, "2019-10-07")).toBe("--");
  });

  it("writes a date that does not exist as no date", () => {
    for (const stamp of [
      "2019-13-01T10:00:00",
      "2019-09-31T10:00:00",
      "2019-02-29T10:00:00",
      "2019-10-00T10:00:00",
      "2019-10-07T24:00:00",
      "2019-10-07T10:60:00",
      "2019-10-07T10:00:60",
      "yesterday",
    ])
      expect([stamp, formatDate(stamp, "2019-10-07")]).toEqual([stamp, "--"]);
    // A leap day that exists is a date, and an impossible `today` leaves nothing to count from.
    expect(formatDate("2020-02-29T10:00:00", "2020-03-01")).toBe("Yesterday, 10:00 AM");
    expect(formatDate("2019-10-07T10:00:00", "2019-10-32")).toBe("--");
    // Years are read as written: year 0 is a leap year, and its days count like any other's.
    expect(formatDate("0000-02-29T10:00:00", "2019-10-07")).toBe("Feb 29, 0 at 10:00:00 AM");
    expect(formatDate("0099-12-31T10:00:00", "0100-01-01")).toBe("Yesterday, 10:00 AM");
  });

  it("lists an item with an impossible date among those without one", async () => {
    const user = userEvent.setup();
    const item = (id: string, modified?: string): KeychainAccessItem => ({
      id,
      name: id,
      kind: "application password",
      keychain: "login",
      modified,
    });
    render(
      <KeychainAccess
        items={[
          item("late", "2019-10-06T09:00:00"),
          item("broken", "2019-13-45T09:00:00"),
          item("early", "2019-10-01T09:00:00"),
        ]}
      />,
    );
    expect(cells(rowOf("broken"))[2]).toBe("--");
    await user.click(screen.getByRole("button", { name: "Date Modified" }));
    expect(names()).toEqual(["broken", "early", "late"]);
  });

  it("lists the dark capture's items as that day dates them", () => {
    render(<KeychainAccess items={darkCaptureItems} today={darkCaptureToday} />);
    expect(cells(rowOf("Apple Persistent State Encryption"))[2]).toBe("Yesterday, 8:59 AM");
    expect(cells(rowOf("com.apple.account.AppleAccount.cloudkit-token"))[2]).toBe(
      "Today, 10:21 AM",
    );
    expect(cells(rowOf("BeaconStore"))[2]).toBe("Sep 29, 2019 at 6:20:00 PM");
  });
});
