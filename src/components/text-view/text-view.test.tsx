import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RichTextView, TextView } from "./index";

const view = () => screen.getByRole("textbox", { name: "Note" }) as HTMLTextAreaElement;

describe("TextView", () => {
  it("renders a multi-line text box", () => {
    render(<TextView aria-label="Note" />);
    expect(view().tagName).toBe("TEXTAREA");
    expect(view()).toHaveClass("mac-text-view");
    expect(view()).not.toHaveAttribute("data-monospace");
  });

  it("takes several lines of typed text and reports each change", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(<TextView aria-label="Note" onValueChange={onValueChange} onChange={onChange} />);
    await user.type(view(), "a{Enter}b");
    expect(view()).toHaveValue("a\nb");
    expect(onValueChange).toHaveBeenLastCalledWith("a\nb");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("shows the value it is given when controlled", async () => {
    const user = userEvent.setup();
    function Upper() {
      const [value, setValue] = useState("");
      return (
        <TextView
          aria-label="Note"
          value={value}
          onValueChange={(v) => setValue(v.toUpperCase())}
        />
      );
    }
    render(<Upper />);
    await user.type(view(), "mac");
    expect(view()).toHaveValue("MAC");
  });

  it("reflects monospace as a data attribute", () => {
    render(<TextView aria-label="Note" monospace />);
    expect(view()).toHaveAttribute("data-monospace");
  });

  it("moves on with Tab by default", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextView aria-label="Note" />
        <button type="button">Next</button>
      </>,
    );
    await user.click(view());
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(view()).toHaveValue("");
  });

  it("inserts a tab with insertsTab, and leaves with Escape then Tab", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <TextView aria-label="Note" insertsTab defaultValue="ab" onValueChange={onValueChange} />
        <button type="button">Next</button>
      </>,
    );
    await user.click(view());
    view().setSelectionRange(1, 1);
    await user.keyboard("{Tab}");
    expect(view()).toHaveFocus();
    expect(view()).toHaveValue("a\tb");
    expect(view().selectionStart).toBe(2);
    expect(onValueChange).toHaveBeenLastCalledWith("a\tb");

    await user.keyboard("{Escape}{Tab}");
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(view()).toHaveValue("a\tb");
  });

  it("does not insert a tab past maxLength, but replaces a selection within it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TextView
        aria-label="Note"
        insertsTab
        maxLength={3}
        defaultValue="abc"
        onValueChange={onValueChange}
      />,
    );
    await user.click(view());
    view().setSelectionRange(3, 3);
    await user.keyboard("{Tab}");
    expect(view()).toHaveFocus();
    expect(view()).toHaveValue("abc");
    expect(onValueChange).not.toHaveBeenCalled();

    view().setSelectionRange(1, 3);
    await user.keyboard("{Tab}");
    expect(view()).toHaveValue("a\t");
    expect(onValueChange).toHaveBeenLastCalledWith("a\t");
  });

  it("still moves backwards with Shift-Tab when insertsTab is set", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Previous</button>
        <TextView aria-label="Note" insertsTab />
      </>,
    );
    await user.click(view());
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();
  });

  it("does not insert a tab into a read-only view", async () => {
    const user = userEvent.setup();
    render(<TextView aria-label="Note" insertsTab readOnly defaultValue="ab" />);
    await user.click(view());
    await user.keyboard("{Tab}");
    expect(view()).toHaveValue("ab");
  });

  it("is really disabled", async () => {
    const user = userEvent.setup();
    render(<TextView aria-label="Note" disabled defaultValue="a" />);
    expect(view()).toBeDisabled();
    await user.tab();
    expect(view()).not.toHaveFocus();
  });

  it("forwards ref, className and other attributes", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<TextView aria-label="Note" ref={ref} className="paper" rows={4} id="note" />);
    expect(ref.current).toBe(view());
    expect(view()).toHaveClass("mac-text-view", "paper");
    expect(view()).toHaveAttribute("rows", "4");
    expect(view()).toHaveAttribute("id", "note");
  });
});

describe("RichTextView", () => {
  const rich = () => screen.getByRole("textbox", { name: "Document" });

  it("renders an editable multi-line text box holding its children", () => {
    render(
      <RichTextView aria-label="Document">
        <b>Bold</b> text
      </RichTextView>,
    );
    expect(rich()).toHaveClass("mac-text-view");
    expect(rich()).toHaveAttribute("aria-multiline", "true");
    expect(rich()).toHaveAttribute("contenteditable", "true");
    expect(rich()).toHaveAttribute("tabindex", "0");
    expect(rich()).toHaveTextContent("Bold text");
    expect(rich().querySelector("b")).toHaveTextContent("Bold");
  });

  it("is in the tab order", async () => {
    const user = userEvent.setup();
    render(<RichTextView aria-label="Document" />);
    await user.tab();
    expect(rich()).toHaveFocus();
  });

  it("stays focusable but not editable when read-only", async () => {
    const user = userEvent.setup();
    render(<RichTextView aria-label="Document" readOnly />);
    expect(rich()).toHaveAttribute("contenteditable", "false");
    expect(rich()).toHaveAttribute("aria-readonly", "true");
    await user.tab();
    expect(rich()).toHaveFocus();
  });

  it("leaves the tab order and says so when disabled", async () => {
    const user = userEvent.setup();
    render(<RichTextView aria-label="Document" disabled />);
    expect(rich()).toHaveAttribute("contenteditable", "false");
    expect(rich()).toHaveAttribute("aria-disabled", "true");
    expect(rich()).toHaveAttribute("data-disabled");
    await user.tab();
    expect(rich()).not.toHaveFocus();
  });

  it("forwards ref, className and event handlers", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onKeyDown = vi.fn();
    render(
      <RichTextView aria-label="Document" ref={ref} className="paper" onKeyDown={onKeyDown} />,
    );
    expect(ref.current).toBe(rich());
    expect(rich()).toHaveClass("mac-text-view", "paper");
    await user.click(rich());
    await user.keyboard("a");
    expect(onKeyDown).toHaveBeenCalled();
  });
});
