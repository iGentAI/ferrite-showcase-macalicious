import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Profiler, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar, SidebarFooter, SidebarItem, type SidebarProps, SidebarSection } from "./index";

function Folders(props: SidebarProps) {
  return (
    <Sidebar aria-label="Folders" {...props}>
      <SidebarSection title="Favorites">
        <SidebarItem value="recents" label="Recents" />
        <SidebarItem value="documents" label="Documents" />
        <SidebarItem value="desktop" label="Desktop" disabled />
        <SidebarItem value="downloads" label="Downloads" />
      </SidebarSection>
      <SidebarSection title="iCloud">
        <SidebarItem value="drive" label="iCloud Drive" />
      </SidebarSection>
    </Sidebar>
  );
}

function Outline(props: SidebarProps & { onExpandedChange?: (expanded: boolean) => void }) {
  const { onExpandedChange, ...rest } = props;
  return (
    <Sidebar aria-label="Devices" {...rest}>
      <SidebarItem value="disk" label="Disk" onExpandedChange={onExpandedChange}>
        <SidebarItem value="container" label="Container" defaultExpanded>
          <SidebarItem value="system" label="System" />
          <SidebarItem value="data" label="Data" />
        </SidebarItem>
      </SidebarItem>
      <SidebarItem value="backup" label="Backup" />
    </Sidebar>
  );
}

const row = (name: string) => screen.getByRole("treeitem", { name });
const selected = () => screen.queryByRole("treeitem", { selected: true });

describe("Sidebar", () => {
  it("lets the caller's onMouseDown and onKeyDown cancel a press or a key", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onMouseDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onKeyDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Folders onValueChange={onValueChange} onMouseDown={onMouseDown} onKeyDown={onKeyDown} />,
    );
    fireEvent.mouseDown(row("Documents"));
    screen.getByRole("tree").focus();
    await user.keyboard("{ArrowDown}{End}d");
    expect(onMouseDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(3);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(selected()).toBeNull();
  });

  it.each([
    ["ArrowDown", "Recents"],
    ["ArrowUp", "iCloud Drive"],
    ["Home", "Recents"],
    ["End", "iCloud Drive"],
  ])("with nothing selected, %s selects %s", async (key, name) => {
    const user = userEvent.setup();
    render(<Folders />);
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(selected()).toBe(row(name));
  });

  it("does nothing with keys when every row is disabled or there is none", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Sidebar aria-label="Folders" onValueChange={onValueChange}>
        <SidebarItem value="desktop" label="Desktop" disabled />
      </Sidebar>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{ArrowLeft}{ArrowRight}d");
    rerender(<Sidebar aria-label="Folders" onValueChange={onValueChange} />);
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{ArrowLeft}{ArrowRight}d");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("tree")).not.toHaveAttribute("aria-activedescendant");
  });

  it("renders a tree of groups named by their headers, with nothing selected by default", () => {
    const { container } = render(<Folders />);
    const tree = screen.getByRole("tree", { name: "Folders" });
    const root = container.firstElementChild;
    expect(root).toHaveClass("mac-sidebar");
    expect(root).toHaveAttribute("data-size", "medium");
    expect(root).toHaveAttribute("data-material", "translucent");
    expect(root).toContainElement(tree);
    const favorites = within(tree).getByRole("group", { name: "Favorites" });
    expect(within(favorites).getAllByRole("treeitem")).toHaveLength(4);
    expect(within(tree).getByRole("group", { name: "iCloud" })).toContainElement(
      row("iCloud Drive"),
    );
    expect(row("Recents")).toHaveAttribute("aria-level", "1");
    expect(selected()).toBeNull();
    expect(tree).not.toHaveAttribute("aria-activedescendant");
  });

  it("reflects size and material as data attributes", () => {
    const { container } = render(<Folders size="large" material="opaque" />);
    expect(container.firstElementChild).toHaveAttribute("data-size", "large");
    expect(container.firstElementChild).toHaveAttribute("data-material", "opaque");
  });

  it("is one tab stop: the tree takes the focus and names the selected row", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Folders defaultValue="documents" />
        <button type="button">After</button>
      </>,
    );
    const tree = screen.getByRole("tree");
    await user.tab();
    expect(tree).toHaveFocus();
    expect(tree).toHaveAttribute("aria-activedescendant", row("Documents").id);
    for (const item of screen.getAllByRole("treeitem")) {
      expect(item).not.toHaveAttribute("tabindex");
    }
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("selects a row on mouse down (uncontrolled)", () => {
    const onValueChange = vi.fn();
    render(<Folders defaultValue="recents" onValueChange={onValueChange} />);
    expect(selected()).toBe(row("Recents"));
    fireEvent.mouseDown(screen.getByText("Downloads"));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("downloads");
    expect(selected()).toBe(row("Downloads"));
    expect(row("Recents")).toHaveAttribute("aria-selected", "false");
    // The same row again, another mouse button, or a header change nothing.
    fireEvent.mouseDown(screen.getByText("Downloads"));
    fireEvent.mouseDown(screen.getByText("Recents"), { button: 2 });
    fireEvent.mouseDown(screen.getByText("iCloud"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(selected()).toBe(row("Downloads"));
  });

  it("leaves the selection to the owner when controlled", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Folders value="recents" onValueChange={onValueChange} />);
    fireEvent.mouseDown(screen.getByText("Documents"));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("documents");
    expect(selected()).toBe(row("Recents"));
    rerender(<Folders value="documents" onValueChange={onValueChange} />);
    expect(selected()).toBe(row("Documents"));
    expect(screen.getByRole("tree")).toHaveAttribute("aria-activedescendant", row("Documents").id);
    rerender(<Folders value={null} onValueChange={onValueChange} />);
    expect(selected()).toBeNull();
  });

  it("moves the selection with the arrow keys, Home and End, past headers and disabled rows", async () => {
    const user = userEvent.setup();
    render(<Folders />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(selected()).toBe(row("Recents"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(selected()).toBe(row("Downloads"));
    await user.keyboard("{ArrowDown}");
    expect(selected()).toBe(row("iCloud Drive"));
    await user.keyboard("{ArrowDown}");
    expect(selected()).toBe(row("iCloud Drive"));
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(selected()).toBe(row("Documents"));
    await user.keyboard("{End}");
    expect(selected()).toBe(row("iCloud Drive"));
    await user.keyboard("{Home}");
    expect(selected()).toBe(row("Recents"));
    await user.keyboard("{ArrowUp}");
    expect(selected()).toBe(row("Recents"));
  });

  it("selects the last row with Up Arrow when nothing is selected", async () => {
    const user = userEvent.setup();
    render(<Folders />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(selected()).toBe(row("iCloud Drive"));
  });

  it("selects by typing the start of a label", async () => {
    const user = userEvent.setup();
    render(<Folders defaultValue="recents" />);
    await user.tab();
    await user.keyboard("do");
    expect(selected()).toBe(row("Documents"));
    await user.keyboard("w");
    expect(selected()).toBe(row("Downloads"));
    // A disabled row is not matched, and a shortcut is not typing.
    await user.keyboard("{Control>}i{/Control}");
    expect(selected()).toBe(row("Downloads"));
  });

  it("does not select a disabled row", () => {
    const onValueChange = vi.fn();
    render(<Folders onValueChange={onValueChange} />);
    expect(row("Desktop")).toHaveAttribute("aria-disabled", "true");
    fireEvent.mouseDown(screen.getByText("Desktop"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(selected()).toBeNull();
  });

  it("does not show a disabled row as selected or active, whatever the value names", () => {
    const { rerender } = render(<Folders value="desktop" />);
    expect(row("Desktop")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tree")).not.toHaveAttribute("aria-activedescendant");
    rerender(<Folders value="documents" />);
    expect(selected()).toBe(row("Documents"));
    rerender(<Folders value="desktop" />);
    expect(selected()).toBeNull();
  });

  it("moves the selection without rendering any row again", () => {
    const onRender = vi.fn();
    render(
      <Sidebar aria-label="Folders" defaultValue="a">
        {["a", "b", "c"].map((id) => (
          <Profiler key={id} id={id} onRender={onRender}>
            <SidebarItem value={id} label={id.toUpperCase()} />
          </Profiler>
        ))}
      </Sidebar>,
    );
    onRender.mockClear();
    fireEvent.mouseDown(screen.getByText("B"));
    expect(selected()).toBe(row("B"));
    expect(row("A")).toHaveAttribute("aria-selected", "false");
    expect(onRender).not.toHaveBeenCalled();
  });

  it("forwards ref, className, style and attributes to the pane, and the name to the tree", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sidebar ref={ref} className="extra" id="pane" style={{ width: 200 }} aria-label="Folders">
        <SidebarItem value="a" label="A" />
      </Sidebar>,
    );
    expect(ref.current).toHaveClass("mac-sidebar", "extra");
    expect(ref.current).toHaveAttribute("id", "pane");
    expect(ref.current?.style.width).toBe("200px");
    expect(ref.current).not.toHaveAttribute("aria-label");
    expect(screen.getByRole("tree", { name: "Folders" })).toBeInTheDocument();
  });
});

describe("SidebarItem", () => {
  it("shows its icon and accessory, and forwards ref, className and attributes to the row", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sidebar aria-label="Mailboxes">
        <SidebarItem
          ref={ref}
          value="drafts"
          label="Drafts"
          icon={<svg data-testid="icon" aria-hidden="true" />}
          accessory={<span>1</span>}
          className="extra"
          data-kind="mailbox"
        />
      </Sidebar>,
    );
    // The accessory is part of the row's name, a space apart from the label.
    const item = screen.getByRole("treeitem", { name: "Drafts 1" });
    expect(ref.current).toBe(item);
    expect(item).toHaveClass("mac-sidebar-item", "extra");
    expect(item).toHaveAttribute("data-kind", "mailbox");
    expect(item).toContainElement(screen.getByTestId("icon"));
    expect(item).not.toHaveAttribute("aria-expanded");
  });

  it("gives rows whose values hold spaces distinct ids without spaces", () => {
    render(
      <Sidebar aria-label="Tags" defaultValue="all tags">
        <SidebarItem value="all tags" label="All Tags" />
        <SidebarItem value="all-tags" label="Other" />
      </Sidebar>,
    );
    const id = row("All Tags").id;
    expect(id).not.toMatch(/\s/);
    expect(id).not.toBe(row("Other").id);
    expect(screen.getByRole("tree")).toHaveAttribute("aria-activedescendant", id);
  });

  it("is an outline row when it has children: collapsed at first, levels for the children", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<Outline onExpandedChange={onExpandedChange} />);
    expect(row("Disk")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: "Container" })).toBeNull();
    expect(row("Backup")).not.toHaveAttribute("aria-expanded");

    // The triangle is the pointer's way in; it does not select its row.
    const triangle = row("Disk").querySelector("button");
    expect(triangle).toHaveAttribute("tabindex", "-1");
    expect(triangle).toHaveAttribute("aria-hidden", "true");
    await user.click(triangle as HTMLElement);
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(row("Disk")).toHaveAttribute("aria-expanded", "true");
    expect(selected()).toBeNull();
    expect(row("Container")).toHaveAttribute("aria-level", "2");
    expect(row("Container")).toHaveAttribute("aria-expanded", "true");
    expect(row("System")).toHaveAttribute("aria-level", "3");
  });

  it("expands and collapses with Right and Left Arrow, and moves between parent and child", async () => {
    const user = userEvent.setup();
    render(<Outline defaultValue="disk" />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(row("Disk")).toHaveAttribute("aria-expanded", "true");
    expect(selected()).toBe(row("Disk"));
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe(row("Container"));
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe(row("System"));
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe(row("System"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(selected()).toBe(row("Backup"));
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(selected()).toBe(row("Container"));
    await user.keyboard("{ArrowLeft}");
    expect(row("Container")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: "System" })).toBeNull();
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe(row("Disk"));
    await user.keyboard("{ArrowLeft}");
    expect(row("Disk")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe(row("Disk"));
  });

  it("swaps Right and Left Arrow in a right-to-left layout, and owns its group of rows", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl" style={{ direction: "rtl" }}>
        <Outline defaultValue="disk" />
      </div>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(row("Disk")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowLeft}");
    expect(row("Disk")).toHaveAttribute("aria-expanded", "true");
    const group = document.getElementById(row("Disk").getAttribute("aria-owns") ?? "");
    expect(group).toHaveAttribute("role", "group");
    expect(group).toContainElement(row("Container"));
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe(row("Container"));
  });

  it("selects a row that is collapsed over the selection", () => {
    function Controlled() {
      const [expanded, setExpanded] = useState(true);
      return (
        <Sidebar aria-label="Devices" defaultValue="system">
          <SidebarItem value="disk" label="Disk" expanded={expanded} onExpandedChange={setExpanded}>
            <SidebarItem value="system" label="System" />
          </SidebarItem>
        </Sidebar>
      );
    }
    render(<Controlled />);
    expect(selected()).toBe(row("System"));
    const triangle = row("Disk").querySelector("button") as HTMLElement;
    fireEvent.mouseDown(triangle);
    fireEvent.click(triangle);
    expect(row("Disk")).toHaveAttribute("aria-expanded", "false");
    expect(selected()).toBe(row("Disk"));
  });

  it("does not name a row as active while a collapsed row hides it", () => {
    function Devices({ expanded }: { expanded: boolean }) {
      return (
        <Sidebar aria-label="Devices" value="system">
          <SidebarItem value="disk" label="Disk" expanded={expanded}>
            <SidebarItem value="system" label="System" />
          </SidebarItem>
        </Sidebar>
      );
    }
    const { rerender } = render(<Devices expanded />);
    const tree = screen.getByRole("tree");
    expect(tree).toHaveAttribute("aria-activedescendant", row("System").id);
    rerender(<Devices expanded={false} />);
    expect(tree).not.toHaveAttribute("aria-activedescendant");
  });

  it("stops naming a row as active when a row collapsed on its own hides it", async () => {
    render(
      <Sidebar aria-label="Devices" value="system">
        <SidebarItem value="disk" label="Disk" defaultExpanded>
          <SidebarItem value="system" label="System" />
        </SidebarItem>
      </Sidebar>,
    );
    const tree = screen.getByRole("tree");
    expect(tree).toHaveAttribute("aria-activedescendant", row("System").id);
    // The owner keeps the selection, and only the row itself renders again.
    fireEvent.click(row("Disk").querySelector("button") as HTMLElement);
    expect(row("Disk")).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(tree).not.toHaveAttribute("aria-activedescendant"));
  });

  it("leaves a control in a row's accessory its presses and keys", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Sidebar aria-label="Devices" defaultValue="disk">
        <SidebarItem value="disk" label="Disk" />
        <SidebarItem
          value="disc"
          label="Disc"
          accessory={<button type="button" aria-label="Eject" onClick={onClick} />}
        />
      </Sidebar>,
    );
    const eject = screen.getByRole("button", { name: "Eject" });
    await user.click(eject);
    expect(onClick).toHaveBeenCalledTimes(1);
    // The press was not cancelled, so the button has the focus; its row is not selected.
    expect(eject).toHaveFocus();
    expect(selected()).toBe(screen.getByRole("treeitem", { name: "Disk" }));
    await user.keyboard("{ArrowDown}");
    expect(selected()).toBe(screen.getByRole("treeitem", { name: "Disk" }));
  });

  it("leaves a press on the label of a control in a row's accessory to the control", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar aria-label="Devices" defaultValue="disk">
        <SidebarItem value="disk" label="Disk" />
        <SidebarItem
          value="disc"
          label="Disc"
          accessory={
            <label>
              Keep
              <input type="checkbox" />
            </label>
          }
        />
      </Sidebar>,
    );
    await user.click(screen.getByText("Keep"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(selected()).toBe(screen.getByRole("treeitem", { name: "Disk" }));
  });

  it("leaves editable text in a row alone, and treats text marked not editable as the row", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar aria-label="Devices" defaultValue="disk">
        <SidebarItem value="disk" label="Disk" />
        <SidebarItem
          value="disc"
          label="Disc"
          accessory={
            <span contentEditable suppressContentEditableWarning>
              Note
            </span>
          }
        />
        <SidebarItem
          value="tape"
          label="Tape"
          accessory={<span contentEditable={false}>Fixed</span>}
        />
      </Sidebar>,
    );
    expect(screen.getByText("Fixed")).toHaveAttribute("contenteditable", "false");
    await user.click(screen.getByText("Note"));
    expect(selected()).toBe(screen.getByRole("treeitem", { name: "Disk" }));
    await user.click(screen.getByText("Fixed"));
    expect(selected()).toBe(screen.getByRole("treeitem", { name: /Tape/ }));
  });

  it("keeps the ids of a row, its group and its label apart for any values", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Sidebar aria-label="Letters">
        <SidebarItem value="a" label="A" defaultExpanded>
          <SidebarItem value="b" label="B" />
        </SidebarItem>
        <SidebarItem value="ag" label="AG" />
        <SidebarItem value="al" label="AL" />
      </Sidebar>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tree = screen.getByRole("tree", { name: "Letters" });
    for (const name of ["AG", "AL"]) {
      const row = screen.getByRole("treeitem", { name });
      await user.click(row);
      expect(selected()).toBe(row);
      expect(tree).toHaveAttribute("aria-activedescendant", row.id);
    }
    expect(screen.getByRole("treeitem", { name: "A" })).toBeInTheDocument();
  });

  it("takes any text for a value, and gives every value its own id", async () => {
    const user = userEvent.setup();
    // Half a surrogate pair, text that is already percent-encoded, and its decoded form.
    const values = ["\ud83d", "a%2Fb", "a/b", "a b", "a_b", ""];
    const { container } = render(
      <Sidebar aria-label="Odd">
        {values.map((value, index) => (
          <SidebarItem key={value} value={value} label={`Row ${index}`} />
        ))}
      </Sidebar>,
    );
    const ids = [...container.querySelectorAll("[role=treeitem]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(values.length);
    const tree = screen.getByRole("tree", { name: "Odd" });
    for (const index of values.keys()) {
      const row = screen.getByRole("treeitem", { name: `Row ${index}` });
      await user.click(row);
      expect(selected()).toBe(row);
      expect(tree).toHaveAttribute("aria-activedescendant", row.id);
    }
  });

  it("leaves a press that a handler inside a row cancelled", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar aria-label="Devices" defaultValue="disk">
        <SidebarItem value="disk" label="Disk" />
        <SidebarItem
          value="disc"
          label={
            // biome-ignore lint/a11y/noStaticElementInteractions: stands for content that keeps its own presses
            <span onMouseDown={(event) => event.preventDefault()}>Disc</span>
          }
        />
      </Sidebar>,
    );
    await user.click(screen.getByText("Disc"));
    expect(selected()).toBe(screen.getByRole("treeitem", { name: "Disk" }));
  });

  it("keeps a controlled outline row as its owner sets it", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <Sidebar aria-label="Devices" defaultValue="disk">
        <SidebarItem value="disk" label="Disk" expanded onExpandedChange={onExpandedChange}>
          <SidebarItem value="system" label="System" />
        </SidebarItem>
      </Sidebar>,
    );
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(row("Disk")).toHaveAttribute("aria-expanded", "true");
  });
});

describe("SidebarSection", () => {
  it("hides its rows and keeps its header when collapsed", () => {
    render(
      <Sidebar aria-label="Folders">
        <SidebarSection title="Favorites" collapsed className="extra" data-kind="section">
          <SidebarItem value="recents" label="Recents" />
        </SidebarSection>
      </Sidebar>,
    );
    const group = screen.getByRole("group", { name: "Favorites" });
    expect(group).toHaveClass("mac-sidebar-section", "extra");
    expect(group).toHaveAttribute("data-kind", "section");
    expect(screen.queryByRole("treeitem")).toBeNull();
  });
});

describe("SidebarFooter", () => {
  it("is a button under the list, outside the tree", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Sidebar
        aria-label="Folders"
        footer={
          <SidebarFooter ref={ref} className="extra" onClick={onClick}>
            New Folder
          </SidebarFooter>
        }
      >
        <SidebarItem value="notes" label="Notes" />
      </Sidebar>,
    );
    const button = screen.getByRole("button", { name: "New Folder" });
    expect(ref.current).toBe(button);
    expect(button).toHaveClass("mac-sidebar-footer", "extra");
    expect(button).toHaveAttribute("type", "button");
    expect(screen.getByRole("tree")).not.toContainElement(button);
    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).not.toHaveAttribute("data-filled");
  });

  it("puts a header on the pane, before the tree and outside it", () => {
    render(
      <Sidebar
        aria-label="Bookmarks"
        data-testid="pane"
        header={<button type="button">Reading List</button>}
      >
        <SidebarItem value="news" label="News" />
      </Sidebar>,
    );
    const header = screen.getByRole("button", { name: "Reading List" });
    const tree = screen.getByRole("tree");
    expect(screen.getByTestId("pane")).toContainElement(header);
    expect(tree).not.toContainElement(header);
    expect(header.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reflects filled as a data attribute and keeps its name", () => {
    render(
      <Sidebar aria-label="Lists" footer={<SidebarFooter filled>Add List</SidebarFooter>}>
        <SidebarItem value="work" label="Work" accessory="5" />
      </Sidebar>,
    );
    expect(screen.getByRole("button", { name: "Add List" })).toHaveAttribute("data-filled", "");
    // A count given as text is named apart from the label too.
    expect(screen.getByRole("treeitem", { name: "Work 5" })).toBeInTheDocument();
  });

  it("keeps a row's accessory in its name when the row is expanded", () => {
    render(
      <Sidebar aria-label="Lists">
        <SidebarItem value="work" label="Work" accessory="5" defaultExpanded>
          <SidebarItem value="today" label="Today" />
        </SidebarItem>
      </Sidebar>,
    );
    expect(screen.getByRole("treeitem", { name: "Work 5" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("treeitem", { name: "Today" })).toBeInTheDocument();
  });
});
