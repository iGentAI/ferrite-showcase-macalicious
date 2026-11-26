import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Spotlight, SpotlightGroup, type SpotlightProps, SpotlightResult } from "./index";

function Results(props: SpotlightProps) {
  return (
    <Spotlight {...props}>
      <SpotlightGroup label="Definition">
        <SpotlightResult value="macos">macOS</SpotlightResult>
      </SpotlightGroup>
      <SpotlightGroup label="Folders">
        <SpotlightResult value="osx">OS X</SpotlightResult>
        <SpotlightResult value="installers">OS X Installers</SpotlightResult>
      </SpotlightGroup>
      <SpotlightGroup label="Documents">
        <SpotlightResult value="catalina">catalina.md</SpotlightResult>
      </SpotlightGroup>
    </Spotlight>
  );
}

const selected = () => screen.getByRole("option", { selected: true });

describe("Spotlight", () => {
  it("is the field alone without results", () => {
    render(<Spotlight data-testid="root" />);
    const field = screen.getByRole("combobox", { name: "Spotlight Search" });
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(field).not.toHaveAttribute("aria-controls");
    expect(field).toHaveAttribute("placeholder", "Spotlight Search");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("root")).toHaveClass("mac-spotlight");
    expect(screen.getByTestId("root")).not.toHaveAttribute("data-expanded");
  });

  it("is the field alone when the results are an empty list", () => {
    render(<Spotlight data-testid="root">{[]}</Spotlight>);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("root")).not.toHaveAttribute("data-expanded");
  });

  it("drops a selection whose result is gone, and Return then opens nothing", async () => {
    const onOpenResult = vi.fn();
    const onSelectedValueChange = vi.fn();
    const props = { defaultSelectedValue: "gone", onOpenResult, onSelectedValueChange };
    const { rerender } = render(
      <Spotlight {...props}>
        <SpotlightGroup label="Folders">
          <SpotlightResult value="gone">Gone</SpotlightResult>
          <SpotlightResult value="kept">Kept</SpotlightResult>
        </SpotlightGroup>
      </Spotlight>,
    );
    const field = screen.getByRole("combobox");
    expect(field).toHaveAttribute("aria-activedescendant", selected().id);
    rerender(
      <Spotlight {...props}>
        <SpotlightGroup label="Folders">
          <SpotlightResult value="kept">Kept</SpotlightResult>
        </SpotlightGroup>
      </Spotlight>,
    );
    expect(field).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
    expect(onSelectedValueChange).toHaveBeenLastCalledWith(null);
    field.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenResult).not.toHaveBeenCalled();
    // Nor with the results gone altogether.
    rerender(<Spotlight {...props} />);
    await userEvent.keyboard("{Enter}");
    expect(onOpenResult).not.toHaveBeenCalled();
  });

  it("drops the selection when its result goes by an update of a child alone", async () => {
    const onSelectedValueChange = vi.fn();
    function Found() {
      const [found, setFound] = useState(["gone", "kept"]);
      return (
        <SpotlightGroup label="Folders">
          {found.map((value) => (
            <SpotlightResult key={value} value={value}>
              {value}
            </SpotlightResult>
          ))}
          <button type="button" onClick={() => setFound(["kept"])}>
            Search again
          </button>
        </SpotlightGroup>
      );
    }
    render(
      <Spotlight defaultSelectedValue="gone" onSelectedValueChange={onSelectedValueChange}>
        <Found />
      </Spotlight>,
    );
    const field = screen.getByRole("combobox");
    expect(field).toHaveAttribute("aria-activedescendant", selected().id);
    await userEvent.click(screen.getByRole("button", { name: "Search again" }));
    expect(field).not.toHaveAttribute("aria-activedescendant");
    expect(onSelectedValueChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it("names a controlled selection whose result comes by an update of a child alone", async () => {
    function Found() {
      const [found, setFound] = useState(["kept"]);
      return (
        <SpotlightGroup label="Folders">
          {found.map((value) => (
            <SpotlightResult key={value} value={value}>
              {value}
            </SpotlightResult>
          ))}
          <button type="button" onClick={() => setFound(["kept", "late"])}>
            Search again
          </button>
        </SpotlightGroup>
      );
    }
    render(
      <Spotlight selectedValue="late">
        <Found />
      </Spotlight>,
    );
    const field = screen.getByRole("combobox");
    expect(field).not.toHaveAttribute("aria-activedescendant");
    await userEvent.click(screen.getByRole("button", { name: "Search again" }));
    expect(field).toHaveAttribute("aria-activedescendant", selected().id);
  });

  it("reports a controlled selection that stays without its result once", () => {
    const onSelectedValueChange = vi.fn();
    const { rerender } = render(
      <Results selectedValue="missing" onSelectedValueChange={onSelectedValueChange} />,
    );
    rerender(<Results selectedValue="missing" onSelectedValueChange={onSelectedValueChange} />);
    rerender(<Results selectedValue="missing" onSelectedValueChange={onSelectedValueChange} />);
    expect(onSelectedValueChange).toHaveBeenCalledTimes(1);
    expect(onSelectedValueChange).toHaveBeenLastCalledWith(null);
  });

  it("gives every value an id of its own, an unpaired surrogate included", () => {
    const values = ["a b", "a_b", "a%20b", "\ud800", "\udc00"];
    render(
      <Spotlight selectedValue={values[3]}>
        <SpotlightGroup label="Folders">
          {values.map((value) => (
            <SpotlightResult key={value} value={value}>
              result
            </SpotlightResult>
          ))}
        </SpotlightGroup>
      </Spotlight>,
    );
    const ids = screen.getAllByRole("option").map((option) => option.id);
    expect(new Set(ids).size).toBe(values.length);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", ids[3]);
  });

  it("names no result from the field, and opens none, while a controlled selection is not among the results", async () => {
    const onOpenResult = vi.fn();
    render(<Results selectedValue="missing" onOpenResult={onOpenResult} />);
    const field = screen.getByRole("combobox");
    expect(field).not.toHaveAttribute("aria-activedescendant");
    field.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenResult).not.toHaveBeenCalled();
  });

  it("lists results in named groups and names the selected one from the field", () => {
    render(<Results defaultSelectedValue="macos" data-testid="root" />);
    const field = screen.getByRole("combobox");
    const list = screen.getByRole("listbox", { name: "Results" });
    expect(screen.getByTestId("root")).toHaveAttribute("data-expanded");
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(field).toHaveAttribute("aria-controls", list.id);
    expect(within(list).getAllByRole("option")).toHaveLength(4);
    const folders = within(list).getByRole("group", { name: "Folders" });
    expect(within(folders).getAllByRole("option")).toHaveLength(2);
    expect(selected()).toHaveTextContent("macOS");
    expect(field).toHaveAttribute("aria-activedescendant", selected().id);
  });

  it("keeps its own text and reports it", async () => {
    const onValueChange = vi.fn();
    render(<Spotlight defaultValue="OS" onValueChange={onValueChange} />);
    const field = screen.getByRole("combobox");
    expect(field).toHaveValue("OS");
    await userEvent.type(field, " X");
    expect(field).toHaveValue("OS X");
    expect(onValueChange).toHaveBeenLastCalledWith("OS X");
  });

  it("shows the text it is given when controlled", async () => {
    const onValueChange = vi.fn();
    render(<Spotlight value="OS" onValueChange={onValueChange} />);
    const field = screen.getByRole("combobox");
    await userEvent.type(field, "X");
    expect(onValueChange).toHaveBeenLastCalledWith("OSX");
    expect(field).toHaveValue("OS");
  });

  it("moves the selection with the arrow keys and stops at the ends", async () => {
    const onSelectedValueChange = vi.fn();
    render(<Results onSelectedValueChange={onSelectedValueChange} />);
    const field = screen.getByRole("combobox");
    field.focus();
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    expect(selected()).toHaveTextContent("macOS");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(selected()).toHaveTextContent("OS X Installers");
    expect(onSelectedValueChange).toHaveBeenLastCalledWith("installers");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(selected()).toHaveTextContent("catalina.md");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(selected()).toHaveTextContent("macOS");
    expect(field).toHaveFocus();
  });

  it("selects the last result with Up Arrow when nothing is selected", async () => {
    render(<Results />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(selected()).toHaveTextContent("catalina.md");
  });

  it("jumps between categories with Command and the arrow keys", async () => {
    render(<Results defaultSelectedValue="installers" />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{Meta>}{ArrowDown}{/Meta}");
    expect(selected()).toHaveTextContent("catalina.md");
    await userEvent.keyboard("{Meta>}{ArrowUp}{/Meta}");
    expect(selected()).toHaveTextContent("OS X");
    await userEvent.keyboard("{Meta>}{ArrowUp}{ArrowUp}{/Meta}");
    expect(selected()).toHaveTextContent("macOS");
  });

  it("follows a controlled selection", async () => {
    const onSelectedValueChange = vi.fn();
    render(<Results selectedValue="osx" onSelectedValueChange={onSelectedValueChange} />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(onSelectedValueChange).toHaveBeenLastCalledWith("installers");
    expect(selected()).toHaveTextContent("OS X");
  });

  it("opens the selection with Return and reveals it with Command-Return", async () => {
    const onOpenResult = vi.fn();
    render(<Results defaultSelectedValue="osx" onOpenResult={onOpenResult} />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenResult).toHaveBeenLastCalledWith("osx", { reveal: false });
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onOpenResult).toHaveBeenLastCalledWith("osx", { reveal: true });
  });

  it("does not open anything with Return while nothing is selected", async () => {
    const onOpenResult = vi.fn();
    render(<Results onOpenResult={onOpenResult} />);
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenResult).not.toHaveBeenCalled();
  });

  it("clears the text with Escape, then closes", async () => {
    const onClose = vi.fn();
    render(<Spotlight defaultValue="OS X" onClose={onClose} />);
    const field = screen.getByRole("combobox");
    field.focus();
    await userEvent.keyboard("{Escape}");
    expect(field).toHaveValue("");
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves a key to the input method while it composes", () => {
    const onClose = vi.fn();
    render(<Spotlight onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("selects a result on a click, without taking the focus from the field, and opens it on a double click", async () => {
    const onOpenResult = vi.fn();
    render(<Results onOpenResult={onOpenResult} />);
    const field = screen.getByRole("combobox");
    field.focus();
    await userEvent.click(screen.getByRole("option", { name: "OS X" }));
    expect(selected()).toHaveTextContent("OS X");
    expect(field).toHaveFocus();
    expect(onOpenResult).not.toHaveBeenCalled();
    await userEvent.dblClick(screen.getByRole("option", { name: "catalina.md" }));
    expect(onOpenResult).toHaveBeenLastCalledWith("catalina", { reveal: false });
  });

  it("takes the keyboard to the field when a result is clicked while the focus is elsewhere", async () => {
    const onOpenResult = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Results onOpenResult={onOpenResult} preview={<button type="button">In preview</button>} />
      </>,
    );
    const field = screen.getByRole("combobox");
    screen.getByRole("button", { name: "Outside" }).focus();
    await userEvent.click(screen.getByRole("option", { name: "OS X" }));
    expect(field).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onOpenResult).toHaveBeenLastCalledWith("installers", { reveal: false });
    screen.getByRole("button", { name: "In preview" }).focus();
    await userEvent.click(screen.getByRole("option", { name: "macOS" }));
    expect(field).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenResult).toHaveBeenLastCalledWith("macos", { reveal: false });
  });

  it("shows the completion only after typed text, hidden from assistive technology", async () => {
    render(<Spotlight completion="macOS" />);
    expect(screen.queryByText(/macOS/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("combobox"), "OS");
    expect(screen.getByText(/macOS/).closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("shows the preview in a named group and takes the labels it is given", () => {
    render(
      <Results
        preview={<p>Definition of macOS</p>}
        placeholder="Search"
        resultsLabel="Found"
        previewLabel="Details"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Found" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Details" })).toHaveTextContent("Definition of macOS");
  });

  it("shows a note under the results and the preview, outside both, only while there are results", () => {
    const text = "Mail: only your newest 87 messages were searched.";
    const { rerender } = render(<Results note={text} preview={<p>Preview</p>} />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(text);
    expect(note).toHaveClass("mac-spotlight-note");
    expect(screen.getByRole("listbox")).not.toContainElement(note);
    expect(screen.getByRole("group", { name: "Preview" })).not.toContainElement(note);
    // Not an option: the arrow keys and the field know nothing of it.
    expect(screen.getAllByRole("option")).toHaveLength(4);
    rerender(<Spotlight note={text} />);
    expect(screen.queryByRole("note")).toBeNull();
    rerender(<Results />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("forwards ref, className, style and attributes to the root, and inputRef to the field", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Spotlight ref={ref} inputRef={inputRef} className="extra" id="search" style={{ top: 3 }} />,
    );
    expect(ref.current).toHaveClass("mac-spotlight", "extra");
    expect(ref.current).toHaveAttribute("id", "search");
    expect(ref.current).toHaveStyle({ top: "3px" });
    expect(inputRef.current).toBe(screen.getByRole("combobox"));
  });

  it("forwards ref, className and handlers of a group and a result", async () => {
    const groupRef = createRef<HTMLDivElement>();
    const resultRef = createRef<HTMLDivElement>();
    const onClick = vi.fn();
    render(
      <Spotlight>
        <SpotlightGroup ref={groupRef} label="Folders" className="g">
          <SpotlightResult
            ref={resultRef}
            value="osx"
            className="r"
            icon={<svg aria-hidden="true" data-testid="icon" />}
            onClick={onClick}
          >
            OS X
          </SpotlightResult>
        </SpotlightGroup>
      </Spotlight>,
    );
    expect(groupRef.current).toHaveClass("mac-spotlight-group", "g");
    expect(resultRef.current).toHaveClass("mac-spotlight-result", "r");
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(screen.getByRole("option", { name: "OS X" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(selected()).toBe(resultRef.current);
  });
});
