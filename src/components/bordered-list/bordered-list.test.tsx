import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Profiler, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { GradientButton } from "../gradient-button";
import {
  BorderedList,
  BorderedListGroupRow,
  BorderedListRow,
  BorderedListRows,
  type BorderedListRowsProps,
} from "./index";

/*
 * jsdom has no layout: scrolling the selected row into view, the colours of the selection
 * and the focus ring are checked in Chromium by bordered-list.visual.json.
 */
function List(props: Partial<BorderedListRowsProps>) {
  return (
    <BorderedListRows aria-label="Services" {...props}>
      <BorderedListGroupRow>Wireless</BorderedListGroupRow>
      <BorderedListRow value="wifi" title="Wi-Fi" subtitle="Connected" />
      <BorderedListRow value="bluetooth" title="Bluetooth PAN" />
      <BorderedListGroupRow>Wired</BorderedListGroupRow>
      <BorderedListRow value="modem" title="Modem" disabled />
      <BorderedListRow value="ethernet" title="Ethernet" />
    </BorderedListRows>
  );
}

const list = () => screen.getByRole("listbox", { name: "Services" });
const option = (name: string | RegExp) => screen.getByRole("option", { name });
const selected = () =>
  screen.getAllByRole("option", { selected: true }).map((element) => element.dataset.value);

describe("BorderedList", () => {
  it("frames its child and has no footer by default", () => {
    render(
      <BorderedList data-testid="root">
        <List />
      </BorderedList>,
    );
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-bordered-list");
    expect(root).not.toHaveAttribute("data-footer");
    expect(root.querySelector(".mac-bordered-list-frame")).toContainElement(list());
    expect(root.querySelector(".mac-bordered-list-footer")).toBeNull();
  });

  it("puts the footer buttons in a named group that runs to the list's edge", () => {
    render(
      <BorderedList
        data-testid="root"
        footerLabel="Edit services"
        footer={<GradientButton glyph="add" aria-label="Add" />}
      >
        <List />
      </BorderedList>,
    );
    expect(screen.getByTestId("root")).toHaveAttribute("data-footer", "attached");
    const group = screen.getByRole("group", { name: "Edit services" });
    expect(within(group).getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(group.querySelector(".mac-gradient-button-filler")).not.toBeNull();
    expect(group).toHaveAttribute("data-variant", "standard");
  });

  it("gives the footer's bar the variant it is asked for", () => {
    render(
      <BorderedList
        footerLabel="Edit services"
        footerVariant="network"
        footer={<GradientButton glyph="add" aria-label="Add" />}
      >
        <List />
      </BorderedList>,
    );
    expect(screen.getByRole("group", { name: "Edit services" })).toHaveAttribute(
      "data-variant",
      "network",
    );
  });

  it("detaches the footer without a filler cell", () => {
    render(
      <BorderedList
        data-testid="root"
        footerPlacement="detached"
        footer={<GradientButton glyph="add" aria-label="Add" />}
      >
        <List />
      </BorderedList>,
    );
    const root = screen.getByTestId("root");
    expect(root).toHaveAttribute("data-footer", "detached");
    expect(root.querySelector(".mac-bordered-list-footer")).not.toBeNull();
    expect(root.querySelector(".mac-gradient-button-filler")).toBeNull();
  });

  it("forwards ref, className, style and attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<BorderedList ref={ref} className="extra" id="list" style={{ width: 170 }} />);
    expect(ref.current).toHaveClass("mac-bordered-list", "extra");
    expect(ref.current).toHaveAttribute("id", "list");
    expect(ref.current?.style.width).toBe("170px");
  });
});

describe("BorderedListRows", () => {
  it("renders a listbox of options, with group rows that are not options", () => {
    render(<List />);
    expect(list()).toHaveClass("mac-bordered-list-rows");
    expect(list()).toHaveAttribute("tabindex", "0");
    expect(list()).not.toHaveAttribute("aria-multiselectable");
    expect(screen.getAllByRole("option").map((element) => element.dataset.value)).toEqual([
      "wifi",
      "bluetooth",
      "modem",
      "ethernet",
    ]);
    expect(screen.getByText("Wireless")).toHaveClass("mac-bordered-list-group-row");
    expect(option(/Wi-Fi/)).toHaveAttribute("aria-selected", "false");
    expect(option("Modem")).toHaveAttribute("aria-disabled", "true");
  });

  it("reflects row height and stripes", () => {
    render(<List rowHeight={42} alternatingRows />);
    expect(list()).toHaveAttribute("data-alternating");
    const content = list().querySelector<HTMLElement>(".mac-bordered-list-content");
    expect(content?.style.getPropertyValue("--_row")).toBe("42px");
  });

  it("selects the clicked row and takes the keyboard focus", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<List onValueChange={onValueChange} />);
    await user.click(option("Bluetooth PAN"));
    expect(selected()).toEqual(["bluetooth"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["bluetooth"]);
    expect(list()).toHaveFocus();
    expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id);
  });

  it("does not select a disabled row or a group row", async () => {
    const user = userEvent.setup();
    render(<List defaultValue={["wifi"]} />);
    await user.click(option("Modem"));
    await user.click(screen.getByText("Wired"));
    expect(selected()).toEqual(["wifi"]);
  });

  it("moves with the arrow keys, Home and End, skipping disabled and group rows", async () => {
    const user = userEvent.setup();
    render(<List defaultValue={["wifi"]} />);
    await user.tab();
    expect(list()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["bluetooth"]);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["ethernet"]);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["ethernet"]);
    await user.keyboard("{Home}");
    expect(selected()).toEqual(["wifi"]);
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["wifi"]);
    await user.keyboard("{End}");
    expect(selected()).toEqual(["ethernet"]);
  });

  it("starts at the first or last row when nothing is selected", async () => {
    const user = userEvent.setup();
    render(<List />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["ethernet"]);
  });

  it("selects by typing the start of a title", async () => {
    const user = userEvent.setup();
    render(<List />);
    await user.tab();
    await user.keyboard("blu");
    expect(selected()).toEqual(["bluetooth"]);
    // A disabled row is never matched. The keys arrive two seconds later, by their own
    // time stamps: after a pause of a second a new search starts.
    await user.keyboard("{Home}");
    const later = performance.now() + 2000;
    for (const [index, key] of ["m", "o"].entries()) {
      const event = createEvent.keyDown(list(), { key });
      Object.defineProperty(event, "timeStamp", { value: later + index * 100 });
      fireEvent(list(), event);
    }
    expect(selected()).toEqual(["wifi"]);
    // The search did start afresh: "e" on its own finds Ethernet, where "blue" finds nothing.
    const event = createEvent.keyDown(list(), { key: "e" });
    Object.defineProperty(event, "timeStamp", { value: later + 5000 });
    fireEvent(list(), event);
    expect(selected()).toEqual(["ethernet"]);
  });

  it("puts no handler on a row, however many rows there are", () => {
    // A row's handlers would not depend on how many rows there are: 300 rows, the last
    // selected, prove it as well as thousands would, and render in jsdom well inside the
    // default 5 s timeout (3,000 took 6.9 s on a 2-CPU machine).
    const count = 300;
    const last = `row-${count - 1}`;
    const values = Array.from({ length: count }, (_, index) => `row-${index}`);
    render(
      <BorderedListRows aria-label="Services" defaultValue={[last]}>
        {values.map((value) => (
          <BorderedListRow key={value} value={value} title={value} />
        ))}
      </BorderedListRows>,
    );
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(count);
    expect(selected()).toEqual([last]);
    // React keeps an element's props under a __reactProps$ key: count the on… handlers of
    // the rows and of everything inside them.
    let handlers = 0;
    for (const row of rows)
      for (const element of [row, ...row.querySelectorAll("*")])
        for (const [name, props] of Object.entries(element))
          if (name.startsWith("__reactProps$"))
            handlers += Object.keys(props as object).filter((prop) => /^on[A-Z]/.test(prop)).length;
    expect(handlers).toBe(0);
  });

  it("extends and toggles with multiple selection", async () => {
    const user = userEvent.setup();
    render(<List selectionMode="multiple" />);
    expect(list()).toHaveAttribute("aria-multiselectable", "true");
    await user.click(option(/Wi-Fi/));
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(selected()).toEqual(["wifi", "bluetooth", "ethernet"]);
    await user.keyboard("{Meta>}");
    await user.click(option("Bluetooth PAN"));
    await user.keyboard("{/Meta}");
    expect(selected()).toEqual(["wifi", "ethernet"]);
  });

  it("moves the current row with Control and toggles it with Control-Space", async () => {
    const user = userEvent.setup();
    render(<List selectionMode="multiple" defaultValue={["wifi"]} />);
    await user.tab();
    await user.keyboard("{Control>}{ArrowDown}{ArrowDown}{/Control}");
    expect(selected()).toEqual(["wifi"]);
    expect(list()).toHaveAttribute("aria-activedescendant", option("Ethernet").id);
    await user.keyboard("{Control>} {/Control}");
    expect(selected()).toEqual(["wifi", "ethernet"]);
    await user.keyboard("{Control>} {/Control}");
    expect(selected()).toEqual(["wifi"]);
  });

  it("names the selected row as active when the current row goes or is disabled", async () => {
    const user = userEvent.setup();
    function Services({ change }: { change?: "gone" | "disabled" }) {
      return (
        <BorderedListRows aria-label="Services" selectionMode="multiple" defaultValue={["wifi"]}>
          <BorderedListRow value="wifi" title="Wi-Fi" />
          {change !== "gone" && (
            <BorderedListRow
              value="bluetooth"
              title="Bluetooth PAN"
              disabled={change === "disabled"}
            />
          )}
        </BorderedListRows>
      );
    }
    const { rerender } = render(<Services />);
    await user.tab();
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id);
    rerender(<Services change="disabled" />);
    expect(list()).toHaveAttribute("aria-activedescendant", option("Wi-Fi").id);
    rerender(<Services />);
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id);
    rerender(<Services change="gone" />);
    expect(list()).toHaveAttribute("aria-activedescendant", option("Wi-Fi").id);
  });

  it("names the selected row as active when the current row is disabled on its own", async () => {
    const user = userEvent.setup();
    let disable = () => {};
    // Only this row renders again when it is disabled.
    function Bluetooth() {
      const [disabled, setDisabled] = useState(false);
      disable = () => setDisabled(true);
      return <BorderedListRow value="bluetooth" title="Bluetooth PAN" disabled={disabled} />;
    }
    render(
      <BorderedListRows aria-label="Services" selectionMode="multiple" defaultValue={["wifi"]}>
        <BorderedListRow value="wifi" title="Wi-Fi" />
        <Bluetooth />
      </BorderedListRows>,
    );
    await user.tab();
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id);
    act(() => disable());
    await waitFor(() =>
      expect(list()).toHaveAttribute("aria-activedescendant", option("Wi-Fi").id),
    );
  });

  it("moves the current row and a range's start to a selection set from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<readonly string[]>([]);
      return (
        <>
          <List selectionMode="multiple" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(["bluetooth"])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(option(/Wi-Fi/));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    list().focus();
    expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selected()).toEqual(["bluetooth", "ethernet"]);
  });

  it("starts a Shift range at an outside selection after Control has moved the current row", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<readonly string[]>([]);
      return (
        <>
          <List selectionMode="multiple" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(["bluetooth"])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(option(/Wi-Fi/));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    list().focus();
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(list()).toHaveAttribute("aria-activedescendant", option("Ethernet").id);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    // From Bluetooth PAN, not from the row clicked before the selection was set from outside.
    expect(selected()).toEqual(["bluetooth", "ethernet"]);
  });

  it("names a row selected from outside as active again after the selection was cleared", async () => {
    const user = userEvent.setup();
    let set: (value: readonly string[]) => void = () => {};
    function Owner() {
      const [value, setValue] = useState<readonly string[]>([]);
      set = setValue;
      return <List selectionMode="multiple" value={value} onValueChange={setValue} />;
    }
    render(<Owner />);
    await user.click(option(/Wi-Fi/));
    expect(list()).toHaveFocus();
    act(() => set([]));
    expect(list()).not.toHaveAttribute("aria-activedescendant");
    act(() => set(["ethernet"]));
    expect(list()).toHaveAttribute("aria-activedescendant", option("Ethernet").id);
  });

  it("starts a Shift range at the current row when an outside selection still holds it", async () => {
    const user = userEvent.setup();
    let set: (value: readonly string[]) => void = () => {};
    function Owner() {
      const [value, setValue] = useState<readonly string[]>([]);
      set = setValue;
      return <List selectionMode="multiple" value={value} onValueChange={setValue} />;
    }
    render(<Owner />);
    await user.click(option("Bluetooth PAN"));
    act(() => set(["wifi", "bluetooth"]));
    expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    // From Bluetooth PAN, the current row, not from the first selected row.
    expect(selected()).toEqual(["bluetooth", "ethernet"]);
  });

  it.each([
    ["ArrowDown", "wifi"],
    ["ArrowUp", "ethernet"],
    ["Home", "wifi"],
    ["End", "ethernet"],
    // jsdom has no layout, so a page is one row.
    ["PageDown", "wifi"],
    ["PageUp", "wifi"],
  ])("with nothing selected, %s selects %s", async (key, value) => {
    const user = userEvent.setup();
    render(<List />);
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(selected()).toEqual([value]);
  });

  it("does nothing with keys when every row is disabled or there is none", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onRowAction = vi.fn();
    const { rerender } = render(
      <BorderedListRows
        aria-label="Services"
        onValueChange={onValueChange}
        onRowAction={onRowAction}
      >
        <BorderedListGroupRow>Wired</BorderedListGroupRow>
        <BorderedListRow value="modem" title="Modem" disabled />
      </BorderedListRows>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{PageDown}{PageUp}m{Enter}");
    rerender(
      <BorderedListRows
        aria-label="Services"
        onValueChange={onValueChange}
        onRowAction={onRowAction}
      />,
    );
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{PageDown}{PageUp}m{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onRowAction).not.toHaveBeenCalled();
    expect(list()).not.toHaveAttribute("aria-activedescendant");
  });

  it("extends from the row selected at first, moves by a page and selects all", async () => {
    const user = userEvent.setup();
    render(<List selectionMode="multiple" defaultValue={["wifi"]} />);
    await user.tab();
    expect(list()).toHaveAttribute("aria-activedescendant", option(/Wi-Fi/).id);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selected()).toEqual(["wifi", "bluetooth"]);
    // jsdom has no layout, so a page is one row.
    await user.keyboard("{PageDown}");
    expect(selected()).toEqual(["ethernet"]);
    await user.keyboard("{PageUp}");
    expect(selected()).toEqual(["bluetooth"]);
    await user.keyboard("{Meta>}a{/Meta}");
    expect(selected()).toEqual(["wifi", "bluetooth", "ethernet"]);
  });

  it("moves the selection without rendering any row again", async () => {
    const user = userEvent.setup();
    const onRender = vi.fn();
    render(
      <BorderedListRows aria-label="Services" defaultValue={["a"]}>
        {["a", "b", "c"].map((id) => (
          <Profiler key={id} id={id} onRender={onRender}>
            <BorderedListRow value={id} title={id.toUpperCase()} />
          </Profiler>
        ))}
      </BorderedListRows>,
    );
    onRender.mockClear();
    await user.click(option("B"));
    expect(selected()).toEqual(["b"]);
    expect(onRender).not.toHaveBeenCalled();
  });

  it("selects nothing with selectionMode none", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<List selectionMode="none" onValueChange={onValueChange} />);
    await user.click(option("Ethernet"));
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows no row as selected with selectionMode none, whatever the value names", () => {
    const { rerender } = render(<List selectionMode="none" value={["wifi"]} />);
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
    expect(list()).not.toHaveAttribute("aria-activedescendant");
    rerender(<List selectionMode="single" value={["wifi"]} />);
    expect(selected()).toEqual(["wifi"]);
    rerender(<List selectionMode="none" value={["wifi"]} />);
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("scrolls the current row into view when the keyboard focus arrives", async () => {
    const user = userEvent.setup();
    render(<List defaultValue={["ethernet"]} />);
    const scrollIntoView = vi.fn();
    option("Ethernet").scrollIntoView = scrollIntoView;
    await user.tab();
    expect(list()).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("names a selected row as active when it arrives on its own, with no current row before", async () => {
    let add = () => {};
    function Late() {
      const [shown, setShown] = useState(false);
      add = () => setShown(true);
      return shown ? <BorderedListRow value="bluetooth" title="Bluetooth PAN" /> : null;
    }
    render(
      <BorderedListRows aria-label="Services" defaultValue={["bluetooth"]}>
        <BorderedListRow value="wifi" title="Wi-Fi" />
        <Late />
      </BorderedListRows>,
    );
    expect(list()).not.toHaveAttribute("aria-activedescendant");
    act(() => add());
    await waitFor(() =>
      expect(list()).toHaveAttribute("aria-activedescendant", option("Bluetooth PAN").id),
    );
  });

  it("calls onRowAction for a double click and for Return", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<List onRowAction={onRowAction} />);
    await user.dblClick(option("Ethernet"));
    expect(onRowAction).toHaveBeenLastCalledWith("ethernet");
    await user.keyboard("{Home}{Enter}");
    expect(onRowAction).toHaveBeenLastCalledWith("wifi");
  });

  it("leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<readonly string[]>(["wifi"]);
      // The owner never lets Ethernet be selected.
      return (
        <List
          value={value}
          onValueChange={(next) => setValue(next.filter((id) => id !== "ethernet"))}
        />
      );
    }
    render(<Controlled />);
    await user.click(option("Bluetooth PAN"));
    expect(selected()).toEqual(["bluetooth"]);
    await user.click(option("Ethernet"));
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("leaves a control inside a row to itself", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BorderedListRows aria-label="Services">
        <BorderedListRow
          value="sharing"
          title="Screen Sharing"
          leading={<input type="checkbox" aria-label="On" onChange={onChange} />}
        />
      </BorderedListRows>,
    );
    await user.click(screen.getByRole("checkbox", { name: "On" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("lets the caller's handlers cancel selection and keys", async () => {
    const user = userEvent.setup();
    render(
      <List
        onMouseDown={(event) => event.preventDefault()}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );
    await user.click(option("Ethernet"));
    fireEvent.keyDown(list(), { key: "ArrowDown" });
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("forwards ref, className and attributes on the list and its rows", () => {
    const listRef = createRef<HTMLDivElement>();
    const rowRef = createRef<HTMLDivElement>();
    const groupRef = createRef<HTMLDivElement>();
    render(
      <BorderedListRows ref={listRef} aria-label="Services" className="a" id="rows">
        <BorderedListGroupRow ref={groupRef} className="b" id="group">
          Wired
        </BorderedListGroupRow>
        <BorderedListRow
          ref={rowRef}
          value="x"
          title="X"
          className="c"
          data-kind="port"
          trailing="T"
        />
      </BorderedListRows>,
    );
    expect(listRef.current).toBe(list());
    expect(list()).toHaveClass("mac-bordered-list-rows", "a");
    expect(list()).toHaveAttribute("id", "rows");
    expect(groupRef.current).toHaveClass("mac-bordered-list-group-row", "b");
    expect(rowRef.current).toHaveClass("mac-bordered-list-row", "c");
    expect(rowRef.current).toHaveAttribute("data-kind", "port");
    expect(rowRef.current?.querySelector(".mac-bordered-list-row-trailing")).toHaveTextContent("T");
  });

  it("keeps its current row when a row's id holds a quote or a backslash", async () => {
    const user = userEvent.setup();
    render(
      <BorderedListRows aria-label="Services">
        <BorderedListRow value="wifi" title="Wi-Fi" />
        <BorderedListRow value="modem" title="Modem" id={'mo"d\\em'} />
      </BorderedListRows>,
    );
    await user.click(option("Modem"));
    expect(selected()).toEqual(["modem"]);
    expect(list()).toHaveAttribute("aria-activedescendant", 'mo"d\\em');
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["wifi"]);
  });

  it("leaves editable text inside a row alone, and treats text marked not editable as the row", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <BorderedListRows aria-label="Services" onRowAction={onRowAction}>
        <BorderedListRow
          value="wifi"
          title={
            <span contentEditable suppressContentEditableWarning>
              Wi-Fi
            </span>
          }
        />
        <BorderedListRow value="modem" title={<span contentEditable={false}>Modem</span>} />
      </BorderedListRows>,
    );
    expect(screen.getByText("Modem")).toHaveAttribute("contenteditable", "false");
    await user.dblClick(screen.getByText("Wi-Fi"));
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
    expect(onRowAction).not.toHaveBeenCalled();
    await user.dblClick(screen.getByText("Modem"));
    expect(selected()).toEqual(["modem"]);
    expect(onRowAction).toHaveBeenCalledWith("modem");
  });

  it('treats a row with aria-disabled="false" as enabled', async () => {
    const user = userEvent.setup();
    render(
      <BorderedListRows aria-label="Services">
        <BorderedListRow value="wifi" title="Wi-Fi" />
        <BorderedListRow value="modem" title="Modem" aria-disabled="false" />
      </BorderedListRows>,
    );
    await user.click(option("Modem"));
    expect(selected()).toEqual(["modem"]);
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["wifi"]);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["modem"]);
  });
});
