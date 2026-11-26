import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "./index";

function Note(props: Parameters<typeof StickyNote>[0]) {
  return (
    <StickyNote aria-label="Shopping" {...props}>
      <StickyNoteTitleBar>Shopping</StickyNoteTitleBar>
      <StickyNoteText>Milk</StickyNoteText>
    </StickyNote>
  );
}

describe("StickyNote", () => {
  it("is a named group that is yellow, key and expanded by default", () => {
    render(<Note />);
    const note = screen.getByRole("group", { name: "Shopping" });
    expect(note).toHaveClass("mac-sticky-note");
    expect(note).toHaveAttribute("data-color", "yellow");
    expect(note).toHaveAttribute("data-window-state", "key");
    expect(note).not.toHaveAttribute("data-collapsed");
    expect(note).not.toHaveAttribute("data-translucent");
  });

  it("reflects colour, window state and translucency as attributes", () => {
    render(<Note color="blue" state="inactive" translucent />);
    const note = screen.getByRole("group", { name: "Shopping" });
    expect(note).toHaveAttribute("data-color", "blue");
    expect(note).toHaveAttribute("data-window-state", "inactive");
    expect(note).toHaveAttribute("data-translucent", "");
  });

  it("passes props, className and ref to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Note ref={ref} className="mine" id="n1" />);
    expect(ref.current).toBe(screen.getByRole("group", { name: "Shopping" }));
    expect(ref.current).toHaveClass("mac-sticky-note", "mine");
    expect(ref.current).toHaveAttribute("id", "n1");
  });

  it("is as tall as its title bar when collapsed, over a minimum height given inline", async () => {
    const user = userEvent.setup();
    render(<Note style={{ height: 120, minHeight: 80 }} />);
    const note = screen.getByRole("group", { name: "Shopping" });
    expect(note.style.minHeight).toBe("80px");
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(note.style.minHeight).toBe("0px");
    expect(note.style.height).toBe("120px");
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(note.style.minHeight).toBe("80px");
  });

  it("clears a minimum height when collapsed without a style, so no class rule keeps it tall", async () => {
    const user = userEvent.setup();
    render(<Note className="tall" />);
    const note = screen.getByRole("group", { name: "Shopping" });
    expect(note.style.minHeight).toBe("");
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(note.style.minHeight).toBe("0px");
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(note.style.minHeight).toBe("");
  });

  it("clears a minimum height given on a rendered element, by itself or from a function", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Note render={<section style={{ minHeight: 80, width: 200 }} />} />
        <StickyNote
          aria-label="Other"
          defaultCollapsed
          render={(props) => (
            <div {...props} data-own="" style={{ ...props.style, minHeight: 80, width: 100 }} />
          )}
        />
      </>,
    );
    const note = screen.getByRole("group", { name: "Shopping" });
    expect(note.tagName).toBe("SECTION");
    expect(note.style.minHeight).toBe("80px");
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(note.style.minHeight).toBe("0px");
    expect(note.style.width).toBe("200px");
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(note.style.minHeight).toBe("80px");
    const other = screen.getByRole("group", { name: "Other" });
    expect(other).toHaveAttribute("data-own");
    expect(other.style.minHeight).toBe("0px");
    expect(other.style.width).toBe("100px");
  });

  it("collapses and expands from the collapse box, a toggle button", async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    render(<Note onCollapsedChange={onCollapsedChange} />);
    const note = screen.getByRole("group", { name: "Shopping" });
    const collapse = screen.getByRole("button", { name: "Collapse" });
    expect(collapse).toHaveAttribute("aria-pressed", "false");
    await user.click(collapse);
    expect(note).toHaveAttribute("data-collapsed", "");
    expect(collapse).toHaveAttribute("aria-pressed", "true");
    await user.click(collapse);
    expect(note).not.toHaveAttribute("data-collapsed");
    expect(onCollapsedChange.mock.calls.map((call) => call[0])).toEqual([true, false]);
  });

  it("collapses on a double click on the title bar, but not on one of its widgets", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <StickyNote aria-label="Shopping">
        <StickyNoteTitleBar data-testid="bar" onClose={onClose}>
          Shopping
        </StickyNoteTitleBar>
        <StickyNoteText>Milk</StickyNoteText>
      </StickyNote>,
    );
    const note = screen.getByRole("group", { name: "Shopping" });
    await user.dblClick(screen.getByTestId("bar"));
    expect(note).toHaveAttribute("data-collapsed", "");
    await user.dblClick(screen.getByRole("button", { name: "Close" }));
    expect(note).toHaveAttribute("data-collapsed", "");
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.dblClick(screen.getByTestId("bar"));
    expect(note).not.toHaveAttribute("data-collapsed");
  });

  it("leaves the note alone when the owner's double-click handler prevents the default", async () => {
    const user = userEvent.setup();
    render(
      <StickyNote aria-label="Shopping">
        <StickyNoteTitleBar data-testid="bar" onDoubleClick={(event) => event.preventDefault()} />
        <StickyNoteText>Milk</StickyNoteText>
      </StickyNote>,
    );
    await user.dblClick(screen.getByTestId("bar"));
    expect(screen.getByRole("group", { name: "Shopping" })).not.toHaveAttribute("data-collapsed");
  });

  it("stays as given when controlled, and follows its owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [collapsed, setCollapsed] = useState(true);
      return (
        <>
          <StickyNote aria-label="Held" collapsed={false}>
            <StickyNoteTitleBar collapseLabel="Collapse held" />
          </StickyNote>
          <StickyNote aria-label="Owned" collapsed={collapsed} onCollapsedChange={setCollapsed}>
            <StickyNoteTitleBar collapseLabel="Collapse owned" />
          </StickyNote>
        </>
      );
    }
    render(<Owner />);
    await user.click(screen.getByRole("button", { name: "Collapse held" }));
    expect(screen.getByRole("group", { name: "Held" })).not.toHaveAttribute("data-collapsed");
    const owned = screen.getByRole("group", { name: "Owned" });
    expect(owned).toHaveAttribute("data-collapsed", "");
    await user.click(screen.getByRole("button", { name: "Collapse owned" }));
    expect(owned).not.toHaveAttribute("data-collapsed");
  });

  it("reports the close and zoom boxes to its owner and changes nothing itself", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onZoom = vi.fn();
    render(
      <StickyNote aria-label="Shopping">
        <StickyNoteTitleBar onClose={onClose} onZoom={onZoom} closeLabel="Schliessen" />
        <StickyNoteText>Milk</StickyNoteText>
      </StickyNote>,
    );
    await user.click(screen.getByRole("button", { name: "Schliessen" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("group", { name: "Shopping" })).toBeInTheDocument();
  });

  it("reaches the widgets and the text with Tab, and activates a widget with the keyboard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <StickyNote aria-label="Shopping">
        <StickyNoteTitleBar onClose={onClose} />
        <StickyNoteText>Milk</StickyNoteText>
      </StickyNote>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.tab();
    await user.tab();
    const collapse = screen.getByRole("button", { name: "Collapse" });
    expect(collapse).toHaveFocus();
    await user.keyboard(" ");
    expect(collapse).toHaveAttribute("aria-pressed", "true");
    await user.keyboard(" ");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus();
  });
});

describe("StickyNoteText", () => {
  it("is an editable multi-line text box named Note", () => {
    render(<StickyNoteText>Milk</StickyNoteText>);
    const text = screen.getByRole("textbox", { name: "Note" });
    expect(text).toHaveAttribute("aria-multiline", "true");
    expect(text).toHaveAttribute("contenteditable", "true");
    expect(text).not.toHaveAttribute("aria-readonly");
    expect(text).toHaveTextContent("Milk");
  });

  it("is not editable when read-only, and says so", () => {
    render(<StickyNoteText readOnly>Milk</StickyNoteText>);
    const text = screen.getByRole("textbox", { name: "Note" });
    expect(text).toHaveAttribute("contenteditable", "false");
    expect(text).toHaveAttribute("aria-readonly", "true");
    expect(text).toHaveAttribute("tabindex", "0");
  });

  it("keeps an edit when its owner renders again, even with other children", () => {
    function Owner({ text }: { text: string }) {
      return <StickyNoteText>{text}</StickyNoteText>;
    }
    const { rerender } = render(<Owner text="Milk" />);
    const text = screen.getByRole("textbox", { name: "Note" });
    text.textContent = "Milk, eggs";
    rerender(<Owner text="Milk" />);
    expect(text).toHaveTextContent("Milk, eggs");
    rerender(<Owner text="Bread" />);
    expect(text).toHaveTextContent("Milk, eggs");
    expect(screen.getByRole("textbox", { name: "Note" })).toBe(text);
  });

  it("starts again from its children when it is given another key", () => {
    const { rerender } = render(<StickyNoteText key="a">Milk</StickyNoteText>);
    screen.getByRole("textbox", { name: "Note" }).textContent = "Milk, eggs";
    rerender(<StickyNoteText key="b">Bread</StickyNoteText>);
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveTextContent("Bread");
  });

  it("takes another name and reports input to its owner", async () => {
    const onInput = vi.fn();
    render(
      <StickyNoteText aria-label="Shopping list" onInput={onInput}>
        Milk
      </StickyNoteText>,
    );
    const text = screen.getByRole("textbox", { name: "Shopping list" });
    text.textContent = "Milk, eggs";
    text.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onInput).toHaveBeenCalledTimes(1);
  });
});
