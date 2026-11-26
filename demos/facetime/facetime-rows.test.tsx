import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CARDS_DRAG } from "../contacts/contacts-groups";
import { FaceTime } from "./facetime";
import { type FaceTimeCall, groupCalls } from "./facetime-data";

const call = (id: string, name: string, fields: Partial<FaceTimeCall> = {}): FaceTimeCall => ({
  id,
  name,
  kind: "video",
  status: "outgoing",
  when: "9:41 AM",
  ...fields,
});

describe("groupCalls", () => {
  it("makes one row of calls next to each other with one person, kind and way", () => {
    const rows = groupCalls([
      call("a", "Ada"),
      call("b", "Ada"),
      call("c", "Robin"),
      call("d", "Ada"),
    ]);
    expect(rows.map(({ id, ids }) => [id, ids])).toEqual([
      ["a", ["a", "b"]],
      ["c", ["c"]],
      ["d", ["d"]],
    ]);
  });
  it("keeps a call of several people apart from one with the first of them alone", () => {
    const rows = groupCalls([call("a", "Ada"), call("b", "Ada", { also: 2 })]);
    expect(rows).toHaveLength(2);
  });
  it("keeps apart another kind, a missed call and another account of one name", () => {
    const rows = groupCalls([
      call("a", "Ada"),
      call("b", "Ada", { kind: "audio" }),
      call("c", "Ada", { kind: "audio", status: "missed" }),
      call("d", "Ada", { kind: "audio", status: "missed", to: "ada2" }),
    ]);
    expect(rows).toHaveLength(4);
  });
});

describe("the rows of the list", () => {
  const calls = [
    call("a", "Ada"),
    call("b", "Ada"),
    call("c", "Robin"),
    call("d", "Sam"),
    call("e", "Kim"),
  ];
  const rows = () =>
    within(screen.getByRole("tree", { name: "Recent calls" })).queryAllByRole("treeitem");
  const names = () => rows().map((row) => row.textContent);
  const row = (name: RegExp) => rows().find((each) => name.test(each.textContent ?? "")) as Element;

  it("names the first person of a group and how many others there were", () => {
    render(
      <FaceTime
        defaultCalls={[
          call("a", "Ada", { also: 2 }),
          call("b", "Bo", { also: 1 }),
          call("c", "Bo", { also: 1 }),
        ]}
      />,
    );
    expect(names()[0]).toContain("Ada and 2 others");
    expect(names()[1]).toContain("Bo and 1 other (2)");
  });
  it("counts the calls a row stands for", () => {
    render(<FaceTime defaultCalls={calls} />);
    expect(names()[0]).toContain("Ada (2)");
    expect(rows()).toHaveLength(4);
  });
  it("chooses more rows with Command-click and removes every call of them", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.click(row(/Sam/));
    await user.keyboard("{Control>}");
    await user.click(row(/Ada/));
    await user.keyboard("{/Control}");
    expect(document.querySelectorAll("[data-chosen]")).toHaveLength(1);
    await user.keyboard("{Delete}");
    expect(names().join()).not.toMatch(/Ada|Sam/);
    expect(rows()).toHaveLength(2);
  });
  it("chooses a range with Shift-click", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.click(row(/Ada/));
    await user.keyboard("{Shift>}");
    await user.click(row(/Sam/));
    await user.keyboard("{/Shift}");
    expect(document.querySelectorAll("[data-chosen]")).toHaveLength(2);
    await user.click(row(/Kim/));
    expect(document.querySelectorAll("[data-chosen]")).toHaveLength(0);
  });
  it("goes back to one row on an arrow key, so Delete takes only that row", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.click(row(/Ada/));
    await user.keyboard("{Control>}");
    await user.click(row(/Sam/));
    await user.keyboard("{/Control}");
    await user.keyboard("{ArrowDown}");
    expect(document.querySelectorAll("[data-chosen]")).toHaveLength(0);
    await user.keyboard("{Delete}");
    expect(names().join()).toContain("Sam");
    expect(names().join()).toContain("Ada");
    expect(rows()).toHaveLength(3);
  });
  it("says how many are chosen as a range is made and as it is cleared", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.click(row(/Ada/));
    await user.keyboard("{Shift>}");
    await user.click(row(/Sam/));
    await user.keyboard("{/Shift}");
    expect(screen.getByRole("status")).toHaveTextContent("3 calls selected");
    await user.click(row(/Kim/));
    expect(screen.getByRole("status")).toHaveTextContent("1 call selected");
  });
  it("says so when a menu's row replaces what is chosen, and when it is removed", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.click(row(/Ada/));
    await user.keyboard("{Shift>}");
    await user.click(row(/Robin/));
    await user.keyboard("{/Shift}");
    expect(screen.getByRole("status")).toHaveTextContent("2 calls selected");
    await user.pointer({ keys: "[MouseRight]", target: row(/Kim/) });
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("1 call selected");
    await user.click(await screen.findByRole("menuitem", { name: "Remove from Recents" }));
    expect(screen.getByRole("status")).toHaveTextContent("No calls selected");
    await user.pointer({ keys: "[MouseRight]", target: row(/Sam/) });
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("1 call selected");
  });
  it("chooses nothing once every recent call is removed", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.click(row(/Ada/));
    await user.keyboard("{Shift>}");
    await user.click(row(/Sam/));
    await user.keyboard("{/Shift}");
    await user.pointer({ keys: "[MouseRight]", target: row(/Robin/) });
    await user.click(await screen.findByRole("menuitem", { name: "Remove All Recents" }));
    expect(rows()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No calls selected");
  });
  it("takes Shift-click as a plain click when the selected row has gone", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FaceTime calls={calls} onRemoveCalls={() => {}} />);
    await user.click(row(/Sam/));
    rerender(<FaceTime calls={calls.filter((each) => each.id !== "d")} onRemoveCalls={() => {}} />);
    await user.keyboard("{Shift>}");
    await user.click(row(/Kim/));
    await user.keyboard("{/Shift}");
    expect(document.querySelectorAll("[data-chosen]")).toHaveLength(0);
    expect(row(/Kim/)).toHaveAttribute("aria-selected", "true");
  });
  it("removes the row under the menu when it is not among those chosen", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={calls} />);
    await user.pointer({ keys: "[MouseRight]", target: row(/Ada/) });
    await user.click(await screen.findByRole("menuitem", { name: "Remove from Recents" }));
    expect(rows()).toHaveLength(3);
    expect(names().join()).not.toContain("Ada");
  });
  it("calls back the row under the menu", async () => {
    const user = userEvent.setup();
    const started = vi.fn();
    render(<FaceTime defaultCalls={calls} onCallStart={started} />);
    await user.pointer({ keys: "[MouseRight]", target: row(/Sam/) });
    await user.click(await screen.findByRole("menuitem", { name: "Call Back" }));
    expect(started).toHaveBeenCalledWith({ name: "Sam", kind: "video" });
  });
  it("blocks and unblocks the account of the row under the menu", async () => {
    const user = userEvent.setup();
    const onBlock = vi.fn();
    const placed = [call("a", "Ada", { to: "ada" })];
    const { rerender } = render(<FaceTime calls={placed} onBlock={onBlock} blocked={new Set()} />);
    await user.pointer({ keys: "[MouseRight]", target: row(/Ada/) });
    await user.click(await screen.findByRole("menuitem", { name: "Block This Caller" }));
    expect(onBlock).toHaveBeenCalledWith("ada", true);
    rerender(<FaceTime calls={placed} onBlock={onBlock} blocked={new Set(["ada"])} />);
    await user.pointer({ keys: "[MouseRight]", target: row(/Ada/) });
    await user.click(await screen.findByRole("menuitem", { name: "Unblock This Caller" }));
    expect(onBlock).toHaveBeenCalledWith("ada", false);
  });
});

describe("a row's info button", () => {
  const placed = [call("a", "Ada", { to: "ada" }), call("b", "Robin", { to: "robin" })];
  const people = [{ name: "Ada", to: "ada" }];

  it("shows a person in Contacts, and is dimmed with the reason for anyone else", async () => {
    const user = userEvent.setup();
    const shown = vi.fn();
    render(<FaceTime calls={placed} recipientSuggestions={people} onShowContact={shown} />);
    await user.click(screen.getByRole("button", { name: "Show Ada in Contacts" }));
    expect(shown).toHaveBeenCalledWith("ada", "Ada");
    const robin = screen.getByRole("button", { name: "Show Robin in Contacts" });
    expect(robin).toBeDisabled();
    expect(robin).toHaveAttribute(
      "title",
      "Robin is not in your Contacts. Choose Add to Contacts.",
    );
  });
  it("is absent without a way to show the card", () => {
    render(<FaceTime calls={placed} recipientSuggestions={people} />);
    expect(screen.queryByRole("button", { name: /in Contacts$/ })).toBeNull();
  });
});

describe("what the recipient field offers", () => {
  const people = [
    { name: "Ada Lovelace", to: "ada" },
    { name: "Adam Smith", to: "adam" },
  ];
  const field = () => screen.getByRole("textbox", { name: "Recipient" });
  const offers = () => screen.queryByRole("group", { name: "Contacts" });

  it("lists the names under the field, over the rows", async () => {
    const user = userEvent.setup();
    render(<FaceTime recipientSuggestions={people} />);
    await user.type(field(), "ad");
    expect(offers()?.parentElement).toHaveClass("mac-facetime-header");
    expect(
      within(offers() as HTMLElement)
        .getAllByRole("button")
        .map((each) => each.textContent),
    ).toEqual(["Ada Lovelace", "Adam Smith"]);
  });
  it("walks the names with the arrow keys and chooses with Return", async () => {
    const user = userEvent.setup();
    render(<FaceTime recipientSuggestions={people} />);
    await user.type(field(), "ad");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Ada Lovelace" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Adam Smith" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(field()).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(field()).toHaveValue("adam");
    expect(field()).toHaveFocus();
  });
  it("puts the names away on Escape until the text changes", async () => {
    const user = userEvent.setup();
    render(<FaceTime recipientSuggestions={people} />);
    await user.type(field(), "ad");
    await user.keyboard("{Escape}");
    expect(offers()).toBeNull();
    expect(field()).toHaveValue("ad");
    await user.keyboard("a");
    expect(offers()).toBeVisible();
    await user.keyboard("{ArrowDown}{Escape}");
    expect(offers()).toBeNull();
    expect(field()).toHaveFocus();
  });
});

describe("a contact dragged onto the window", () => {
  const people = [{ name: "Ada Lovelace", to: "ada" }];
  const dragOf = (types: Record<string, string>) => ({
    dataTransfer: {
      types: Object.keys(types),
      dropEffect: "none",
      getData: (type: string) => types[type] ?? "",
    },
  });
  const cards = { [CARDS_DRAG]: '["c1","c2"]', "text/plain": "Ada Lovelace\nRobin Hood" };
  const pane = () => document.querySelector(".mac-facetime-camera") as HTMLElement;
  const field = () => screen.getByRole("textbox", { name: "Recipient" });

  it("fills the field with the account of the first card and takes the keyboard", () => {
    render(<FaceTime recipientSuggestions={people} />);
    const drag = dragOf(cards);
    expect(fireEvent.dragOver(pane(), drag)).toBe(false);
    expect(drag.dataTransfer.dropEffect).toBe("copy");
    fireEvent.drop(pane(), drag);
    expect(field()).toHaveValue("ada");
    expect(field()).toHaveFocus();
    expect(screen.getByRole("group", { name: "Call ada" })).toBeVisible();
  });
  it("fills the field with the name of a card that names no account", () => {
    render(<FaceTime />);
    fireEvent.drop(pane(), dragOf(cards));
    expect(field()).toHaveValue("Ada Lovelace");
  });
  it("refuses other drags, and any while FaceTime is off", () => {
    const { unmount } = render(<FaceTime />);
    expect(fireEvent.dragOver(pane(), dragOf({ "text/plain": "Ada" }))).toBe(true);
    fireEvent.drop(pane(), dragOf({ "text/plain": "Ada" }));
    expect(field()).toHaveValue("");
    unmount();
    render(<FaceTime off />);
    expect(fireEvent.dragOver(pane(), dragOf(cards))).toBe(true);
  });
});
