import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SavePanel, type SavePanelProps, SavePanelRow } from "./index";

const places = [
  { value: "documents", label: "Documents" },
  { value: "desktop", label: "Desktop", separatorBefore: true },
];

const browser = { children: <ul aria-label="Files" /> };

function Panel(props: Partial<SavePanelProps>) {
  return <SavePanel locations={places} defaultLocation="documents" {...props} />;
}

const button = (name: string) => screen.getByRole("button", { name });
const nameField = () => screen.getByRole("textbox", { name: "Save As:" });

describe("SavePanel", () => {
  it("is a form named Save with a name field, a Tags field, a Where button and two buttons", () => {
    render(<Panel />);
    const form = screen.getByRole("form", { name: "Save" });
    expect(form).toHaveClass("mac-save-panel");
    expect(form).not.toHaveAttribute("data-expanded");
    expect(nameField()).toHaveValue("Untitled");
    expect(screen.getByRole("textbox", { name: "Tags:" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Where:" })).toHaveTextContent("Documents");
    expect(
      within(form)
        .getAllByRole("button")
        .map((element) => element.textContent),
    ).toEqual(["Cancel", "Save"]);
  });

  it("takes another name, and passes other props to the form", () => {
    const ref = createRef<HTMLFormElement>();
    render(<Panel ref={ref} aria-label="Export" id="save" className="extra" data-kind="pdf" />);
    const form = screen.getByRole("form", { name: "Export" });
    expect(ref.current).toBe(form);
    expect(form).toHaveClass("mac-save-panel", "extra");
    expect(form).toHaveAttribute("id", "save");
    expect(form).toHaveAttribute("data-kind", "pdf");
  });

  it("labels the name field and titles the buttons as told", () => {
    render(<Panel nameLabel="Export As:" prompt="Export" cancelLabel="Dismiss" />);
    expect(screen.getByRole("textbox", { name: "Export As:" })).toBeInTheDocument();
    expect(button("Export")).toBeInTheDocument();
    expect(button("Dismiss")).toBeInTheDocument();
  });

  it("reports what it holds when Save is activated, uncontrolled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onNameChange = vi.fn();
    const onTagsChange = vi.fn();
    render(<Panel onSave={onSave} onNameChange={onNameChange} onTagsChange={onTagsChange} />);
    await user.clear(nameField());
    await user.type(nameField(), "Letter");
    expect(onNameChange).toHaveBeenLastCalledWith("Letter");
    await user.type(screen.getByRole("textbox", { name: "Tags:" }), "Work,");
    expect(onTagsChange).toHaveBeenLastCalledWith(["Work"]);
    await user.click(button("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      name: "Letter",
      tags: ["Work"],
      location: "documents",
    });
  });

  it("follows a controlled name, and its own typing only through the callback", async () => {
    const user = userEvent.setup();
    function Controlled({ follow }: { follow: boolean }) {
      const [name, setName] = useState("Draft");
      return <Panel name={name} onNameChange={follow ? setName : undefined} />;
    }
    const { rerender } = render(<Controlled follow={false} />);
    await user.type(nameField(), "s");
    expect(nameField()).toHaveValue("Draft");
    rerender(<Controlled follow />);
    await user.type(nameField(), "s");
    expect(nameField()).toHaveValue("Drafts");
  });

  it("disables Save while the name is empty, or when told", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(<Panel onSave={onSave} />);
    expect(button("Save")).toBeEnabled();
    await user.clear(nameField());
    expect(button("Save")).toBeDisabled();
    await user.type(nameField(), "  ");
    expect(button("Save")).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    rerender(<Panel onSave={onSave} name="Letter" saveDisabled />);
    expect(button("Save")).toBeDisabled();
  });

  it("saves on Return in the name field and cancels on Escape", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<Panel onSave={onSave} onCancel={onCancel} />);
    await user.click(nameField());
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(button("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("selects the name without its extension the first time the field takes the focus", async () => {
    const user = userEvent.setup();
    render(<Panel defaultName="Letter.rtf" />);
    await user.tab();
    const field = nameField() as HTMLInputElement;
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 6]);
    await user.keyboard("Note");
    expect(field).toHaveValue("Note.rtf");
    // Only the first time: coming back leaves the caret where the browser puts it.
    field.blur();
    field.setSelectionRange(2, 2);
    field.focus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
  });

  it("reports the place chosen in the Where button and keeps it when uncontrolled", async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();
    const onSave = vi.fn();
    render(<Panel onLocationChange={onLocationChange} onSave={onSave} />);
    const where = screen.getByRole("combobox", { name: "Where:" });
    await user.click(where);
    await user.click(await screen.findByRole("option", { name: "Desktop" }));
    expect(onLocationChange).toHaveBeenCalledWith("desktop");
    expect(where).toHaveTextContent("Desktop");
    await user.click(button("Save"));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ location: "desktop" });
  });

  it("shows a controlled place, and no Where button without places", () => {
    const { rerender } = render(<Panel location="desktop" />);
    expect(screen.getByRole("combobox", { name: "Where:" })).toHaveTextContent("Desktop");
    rerender(<SavePanel />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("hides the Tags field when told, and then reports no tags", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Panel showsTagField={false} defaultTags={["Work"]} onSave={onSave} />);
    expect(screen.queryByRole("textbox", { name: "Tags:" })).not.toBeInTheDocument();
    await user.click(button("Save"));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ tags: [] });
  });

  it("has no disclosure button without a browser", () => {
    render(<Panel defaultExpanded />);
    expect(screen.queryByRole("button", { name: /file browser/ })).not.toBeInTheDocument();
    expect(screen.getByRole("form")).not.toHaveAttribute("data-expanded");
  });

  it("expands to the browser from the disclosure button, and collapses again", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<Panel browser={browser} onExpandedChange={onExpandedChange} />);
    expect(screen.queryByRole("list", { name: "Files" })).not.toBeInTheDocument();
    await user.click(button("Show the file browser"));
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);
    const form = screen.getByRole("form");
    expect(form).toHaveAttribute("data-expanded");
    const files = screen.getByRole("list", { name: "Files" });
    const hide = button("Hide the file browser");
    expect(hide).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(hide.getAttribute("aria-controls") ?? "")).toContainElement(
      files,
    );
    // The place is chosen in the browser's toolbar now, not in a Where row.
    expect(screen.queryByRole("combobox", { name: "Where:" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Location" })).toHaveTextContent("Documents");
    await user.click(hide);
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("list", { name: "Files" })).not.toBeInTheDocument();
  });

  it("follows a controlled expanded state", async () => {
    const user = userEvent.setup();
    render(<Panel browser={browser} expanded />);
    await user.click(button("Hide the file browser"));
    expect(screen.getByRole("list", { name: "Files" })).toBeInTheDocument();
  });

  it("shares the place between the Where button and the browser's location button", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Panel browser={browser} defaultExpanded onSave={onSave} />);
    await user.click(screen.getByRole("combobox", { name: "Location" }));
    await user.click(await screen.findByRole("option", { name: "Desktop" }));
    await user.click(button("Hide the file browser"));
    expect(screen.getByRole("combobox", { name: "Where:" })).toHaveTextContent("Desktop");
    await user.click(button("Save"));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ location: "desktop" });
  });

  it("shows New Folder in the expanded form only, before Cancel, and reports it", async () => {
    const user = userEvent.setup();
    const onNewFolder = vi.fn();
    const { rerender } = render(<Panel browser={browser} onNewFolder={onNewFolder} />);
    expect(screen.queryByRole("button", { name: "New Folder" })).not.toBeInTheDocument();
    rerender(<Panel browser={browser} expanded onNewFolder={onNewFolder} />);
    const actions = button("Cancel").parentElement as HTMLElement;
    expect(
      within(actions)
        .getAllByRole("button")
        .map((element) => element.textContent),
    ).toEqual(["New Folder", "Cancel", "Save"]);
    await user.click(button("New Folder"));
    expect(onNewFolder).toHaveBeenCalledTimes(1);
  });

  it("labels its own rows and buttons as told", async () => {
    const user = userEvent.setup();
    render(
      <Panel
        browser={browser}
        onNewFolder={() => {}}
        labels={{
          tags: "Etiketten:",
          where: "Ort:",
          newFolder: "Neuer Ordner",
          showBrowser: "Einblenden",
          hideBrowser: "Ausblenden",
        }}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Etiketten:" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ort:" })).toBeInTheDocument();
    await user.click(button("Einblenden"));
    expect(button("Ausblenden")).toBeInTheDocument();
    expect(button("Neuer Ordner")).toBeInTheDocument();
  });

  it("keeps one place: a location smuggled into the browser cannot differ from what is saved", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // The type leaves the browser's own place out; a caller who spreads it in anyway still
    // gets the panel's place, in the browser and in what Save reports.
    const smuggled = { ...browser, location: "desktop", defaultLocation: "desktop" };
    render(<Panel browser={smuggled} defaultExpanded onSave={onSave} />);
    expect(screen.getByRole("combobox", { name: "Location" })).toHaveTextContent("Documents");
    await user.click(button("Save"));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ location: "documents" });
  });

  it("shows no place in the browser while the panel has none, whatever is smuggled in", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const smuggled = { ...browser, defaultLocation: "desktop" };
    render(<SavePanel locations={places} browser={smuggled} defaultExpanded onSave={onSave} />);
    const location = screen.getByRole("combobox", { name: "Location" });
    expect(location).not.toHaveTextContent("Desktop");
    await user.click(button("Save"));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ location: undefined });
    // Choosing one in the browser makes it the panel's.
    await user.click(location);
    await user.click(await screen.findByRole("option", { name: "Desktop" }));
    expect(location).toHaveTextContent("Desktop");
    await user.click(button("Save"));
    expect(onSave.mock.calls[1]?.[0]).toMatchObject({ location: "desktop" });
  });

  it("shows the accessory rows after its own, and under the browser when expanded", () => {
    const accessory = (
      <SavePanelRow label="File Format:" labelFor="format">
        <input id="format" defaultValue="Rich Text" />
      </SavePanelRow>
    );
    const { rerender } = render(<Panel accessory={accessory} />);
    const format = screen.getByRole("textbox", { name: "File Format:" });
    const where = screen.getByRole("combobox", { name: "Where:" });
    expect(where.compareDocumentPosition(format) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rerender(<Panel accessory={accessory} browser={browser} expanded />);
    const files = screen.getByRole("list", { name: "Files" });
    expect(
      files.compareDocumentPosition(screen.getByRole("textbox", { name: "File Format:" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("SavePanelRow", () => {
  it("labels the one control it is for", () => {
    render(
      <SavePanelRow label="Encoding:" labelFor="encoding">
        <input id="encoding" />
      </SavePanelRow>,
    );
    expect(screen.getByRole("textbox", { name: "Encoding:" })).toBeInTheDocument();
    expect(screen.getByText("Encoding:").tagName).toBe("LABEL");
  });

  it("gives its label an id to name a control that takes no label element", () => {
    render(
      <SavePanelRow label="Format:" labelId="format-label">
        <button type="button" aria-labelledby="format-label" />
      </SavePanelRow>,
    );
    expect(screen.getByRole("button", { name: "Format:" })).toBeInTheDocument();
    expect(screen.getByText("Format:").tagName).toBe("SPAN");
  });

  it("renders its controls without a label, and forwards ref, className and attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SavePanelRow ref={ref} className="extra" id="row">
        <input aria-label="Alone" />
      </SavePanelRow>,
    );
    expect(ref.current).toHaveClass("mac-save-panel-row", "extra");
    expect(ref.current).toHaveAttribute("id", "row");
    expect(ref.current?.querySelector(".mac-save-panel-label")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Alone" }).parentElement).toHaveClass(
      "mac-save-panel-control",
    );
  });
});
