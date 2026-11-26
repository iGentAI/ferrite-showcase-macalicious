import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpenPanel, OpenPanelBrowser, type OpenPanelProps, type OpenPanelView } from "./index";

const places = [
  { value: "documents", label: "Documents" },
  { value: "desktop", label: "Desktop", separatorBefore: true },
  { value: "server", label: "Server", disabled: true },
];

function Panel(props: Partial<OpenPanelProps>) {
  return (
    <OpenPanel locations={places} defaultLocation="documents" {...props}>
      <ul aria-label="Files">
        <li>Notes.rtf</li>
      </ul>
    </OpenPanel>
  );
}

const button = (name: string) => screen.getByRole("button", { name });

describe("OpenPanel", () => {
  it("is a key dialog named Open that holds the browser and the two buttons", () => {
    render(<Panel />);
    const panel = screen.getByRole("dialog", { name: "Open" });
    expect(panel).toHaveClass("mac-open-panel", "mac-window");
    expect(panel).toHaveAttribute("data-window-state", "key");
    expect(within(panel).getByRole("toolbar", { name: "Navigation" })).toBeInTheDocument();
    expect(within(panel).getByRole("list", { name: "Files" })).toBeInTheDocument();
    expect(button("Cancel")).toBeEnabled();
    expect(button("Open")).toBeEnabled();
  });

  it("takes its name, state and size, and passes other props to the window", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Panel
        ref={ref}
        aria-label="Choose a picture"
        state="main"
        width={600}
        height={400}
        id="open"
        data-kind="picture"
        className="extra"
        style={{ top: 10 }}
      />,
    );
    const panel = screen.getByRole("dialog", { name: "Choose a picture" });
    expect(ref.current).toBe(panel);
    expect(panel).toHaveClass("mac-open-panel", "extra");
    expect(panel).toHaveAttribute("data-window-state", "main");
    expect(panel).toHaveAttribute("id", "open");
    expect(panel).toHaveAttribute("data-kind", "picture");
    expect(panel).toHaveStyle({ width: "600px", height: "400px", top: "10px" });
  });

  it("is named by aria-labelledby when given, instead of its own label", () => {
    render(
      <>
        <h2 id="heading">Import</h2>
        <Panel aria-labelledby="heading" />
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Import" })).not.toHaveAttribute("aria-label");
  });

  it("reports Open and Cancel from its buttons, with the titles it is given", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    render(<Panel prompt="Choose" cancelLabel="Dismiss" onOpen={onOpen} onCancel={onCancel} />);
    await user.click(button("Choose"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.click(button("Dismiss"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("activates the default button with Return and Cancel with Escape, from inside the panel", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    render(<Panel onOpen={onOpen} onCancel={onCancel} />);
    await user.click(screen.getByRole("searchbox", { name: "Search" }));
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not open while the default button is disabled", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Panel openDisabled onOpen={onOpen} />);
    expect(button("Open")).toBeDisabled();
    await user.click(button("Open"));
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Enter}");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("answers no key while it is not the key window", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    render(<Panel state="main" onOpen={onOpen} onCancel={onCancel} />);
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Enter}{Escape}");
    expect(onOpen).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("moves to the search field on Command-F, unless a handler prevented it", () => {
    const { rerender } = render(<Panel />);
    const field = screen.getByRole("searchbox");
    // fireEvent returns false when the event's default action was prevented.
    expect(fireEvent.keyDown(button("Open"), { key: "f", metaKey: true })).toBe(false);
    expect(field).toHaveFocus();
    field.blur();
    expect(fireEvent.keyDown(button("Open"), { key: "f" })).toBe(true);
    expect(field).not.toHaveFocus();
    rerender(<Panel onKeyDown={(event) => event.preventDefault()} />);
    fireEvent.keyDown(button("Open"), { key: "f", metaKey: true });
    expect(field).not.toHaveFocus();
  });

  it("leaves Command-F alone while it is not the key window", () => {
    const { rerender } = render(<Panel state="main" />);
    expect(fireEvent.keyDown(button("Open"), { key: "f", metaKey: true })).toBe(true);
    expect(screen.getByRole("searchbox")).not.toHaveFocus();
    // The whole page in the background: the state is on an ancestor.
    rerender(
      <div data-window-state="inactive">
        <Panel />
      </div>,
    );
    expect(fireEvent.keyDown(button("Open"), { key: "f", metaKey: true })).toBe(true);
    expect(screen.getByRole("searchbox")).not.toHaveFocus();
  });

  it("shows the application's buttons before Cancel, and its accessory above the bar", () => {
    render(
      <Panel
        data-testid="panel"
        leading={<button type="button">Options</button>}
        accessory={<label htmlFor="encoding">Plain Text Encoding</label>}
      />,
    );
    const bar = button("Cancel").parentElement as HTMLElement;
    expect(bar).toHaveClass("mac-open-panel-bar");
    expect(
      within(bar)
        .getAllByRole("button")
        .map((element) => element.textContent),
    ).toEqual(["Options", "Cancel", "Open"]);
    const accessory = screen.getByText("Plain Text Encoding").parentElement as HTMLElement;
    expect(accessory).toHaveClass("mac-open-panel-accessory");
    expect(accessory.nextElementSibling).toBe(bar);
  });

  it("has no accessory area without an accessory", () => {
    render(<Panel data-testid="panel" />);
    expect(screen.getByTestId("panel").querySelector(".mac-open-panel-accessory")).toBeNull();
  });
});

describe("OpenPanelBrowser", () => {
  it("disables Back and Forward until there is somewhere to go, then reports them", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onForward = vi.fn();
    const { rerender } = render(<OpenPanelBrowser onBack={onBack} onForward={onForward} />);
    // A disabled toolbar item stays reachable with the arrow keys, so it is aria-disabled.
    expect(button("Back")).toHaveAttribute("aria-disabled", "true");
    expect(button("Forward")).toHaveAttribute("aria-disabled", "true");
    await user.click(button("Back"));
    expect(onBack).not.toHaveBeenCalled();
    rerender(<OpenPanelBrowser canGoBack canGoForward onBack={onBack} onForward={onForward} />);
    await user.click(button("Back"));
    await user.click(button("Forward"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onForward).toHaveBeenCalledTimes(1);
  });

  it("shows New Folder only when it can report it", async () => {
    const user = userEvent.setup();
    const onNewFolder = vi.fn();
    const { rerender } = render(<OpenPanelBrowser />);
    expect(screen.queryByRole("button", { name: "New Folder" })).not.toBeInTheDocument();
    rerender(<OpenPanelBrowser onNewFolder={onNewFolder} />);
    await user.click(button("New Folder"));
    expect(onNewFolder).toHaveBeenCalledTimes(1);
  });

  it("shows the current place in the location button and reports another one chosen", async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();
    render(
      <OpenPanelBrowser
        locations={places}
        location="documents"
        onLocationChange={onLocationChange}
      />,
    );
    const location = screen.getByRole("combobox", { name: "Location" });
    expect(location).toHaveTextContent("Documents");
    expect(location).toHaveClass("mac-open-panel-location", "mac-toolbar-button");
    await user.click(location);
    expect(await screen.findByRole("option", { name: "Server" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "Desktop" }));
    expect(onLocationChange).toHaveBeenCalledTimes(1);
    expect(onLocationChange).toHaveBeenCalledWith("desktop");
    // Controlled: the button follows the prop, not the choice.
    expect(location).toHaveTextContent("Documents");
  });

  it("keeps its own place when uncontrolled, and has no location button without places", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <OpenPanelBrowser locations={places} defaultLocation="documents" />,
    );
    const location = screen.getByRole("combobox", { name: "Location" });
    await user.click(location);
    await user.click(await screen.findByRole("option", { name: "Desktop" }));
    expect(location).toHaveTextContent("Desktop");
    rerender(<OpenPanelBrowser />);
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument();
  });

  it("starts in column view and reports the view chosen from the view button", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(<OpenPanelBrowser onViewChange={onViewChange} />);
    const view = screen.getByRole("combobox", { name: "View" });
    expect(view).toHaveTextContent("as Columns");
    await user.click(view);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "as Icons",
      "as List",
      "as Columns",
      "as Gallery",
    ]);
    await user.click(screen.getByRole("option", { name: "as List" }));
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(view).toHaveTextContent("as List");
  });

  it("follows a controlled view", async () => {
    const user = userEvent.setup();
    function Controlled({ follow }: { follow: boolean }) {
      const [view, setView] = useState<OpenPanelView>("icon");
      return <OpenPanelBrowser view={view} onViewChange={follow ? setView : undefined} />;
    }
    const { rerender } = render(<Controlled follow={false} />);
    const view = screen.getByRole("combobox", { name: "View" });
    expect(view).toHaveTextContent("as Icons");
    await user.click(view);
    await user.click(await screen.findByRole("option", { name: "as Gallery" }));
    expect(view).toHaveTextContent("as Icons");
    rerender(<Controlled follow />);
    await user.click(view);
    await user.click(await screen.findByRole("option", { name: "as Gallery" }));
    expect(view).toHaveTextContent("as Gallery");
  });

  it("reports the text typed in the search field, which its placeholder names", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<OpenPanelBrowser searchPlaceholder="Find" onSearchChange={onSearchChange} />);
    await user.type(screen.getByRole("searchbox", { name: "Find" }), "ab");
    expect(onSearchChange).toHaveBeenLastCalledWith("ab");
  });

  it("shows a controlled search text", () => {
    render(<OpenPanelBrowser search="notes" onSearchChange={() => {}} />);
    expect(screen.getByRole("searchbox")).toHaveValue("notes");
  });

  it("puts the sidebar before a divider that resizes it, and the header over the browser", () => {
    render(
      <OpenPanelBrowser
        sidebar={<nav aria-label="Places" />}
        sidebarWidth={180}
        header="Shared Folder"
      >
        <ul aria-label="Files" />
      </OpenPanelBrowser>,
    );
    const divider = screen.getByRole("separator", { name: "Resize sidebar" });
    const sidebar = screen.getByRole("navigation", { name: "Places" });
    expect(sidebar.parentElement?.nextElementSibling).toBe(divider);
    expect(sidebar.parentElement).toHaveStyle("--_size: 180px");
    const header = screen.getByText("Shared Folder");
    expect(header).toHaveClass("mac-open-panel-header");
    expect(header.nextElementSibling).toContainElement(screen.getByRole("list", { name: "Files" }));
  });

  it("has no divider without a sidebar and no band without a header", () => {
    render(
      <OpenPanelBrowser data-testid="browser">
        <ul aria-label="Files" />
      </OpenPanelBrowser>,
    );
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByTestId("browser").querySelector(".mac-open-panel-header")).toBeNull();
    expect(screen.getByRole("list", { name: "Files" })).toBeInTheDocument();
  });

  it("is one tab stop: the arrow keys move between the toolbar's controls", async () => {
    const user = userEvent.setup();
    render(<OpenPanelBrowser canGoBack canGoForward onNewFolder={() => {}} locations={places} />);
    await user.tab();
    expect(button("Back")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("Forward")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("combobox", { name: "View" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("New Folder")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("combobox", { name: "Location" })).toHaveFocus();
  });

  it("names its controls as told, for another language", () => {
    render(
      <OpenPanelBrowser
        locations={places}
        onNewFolder={() => {}}
        sidebar={<nav />}
        labels={{
          toolbar: "Navigation (de)",
          back: "Zurück",
          forward: "Vorwärts",
          view: "Darstellung",
          column: "als Spalten",
          newFolder: "Neuer Ordner",
          location: "Ort",
          resizeSidebar: "Seitenleiste",
        }}
      />,
    );
    expect(screen.getByRole("toolbar", { name: "Navigation (de)" })).toBeInTheDocument();
    expect(button("Zurück")).toBeInTheDocument();
    expect(button("Vorwärts")).toBeInTheDocument();
    expect(button("Neuer Ordner")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Darstellung" })).toHaveTextContent("als Spalten");
    expect(screen.getByRole("combobox", { name: "Ort" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Seitenleiste" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<OpenPanelBrowser ref={ref} className="extra" id="browser" />);
    expect(ref.current).toHaveClass("mac-open-panel-browser", "extra");
    expect(ref.current).toHaveAttribute("id", "browser");
  });
});

describe("OpenPanel dimmed controls", () => {
  it("says why Back and Forward are dimmed, and why Open is", () => {
    render(
      <>
        <OpenPanelBrowser />
        <Panel openDisabled />
      </>,
    );
    expect(screen.getAllByRole("button", { name: "Back" })[0]).toHaveAttribute(
      "title",
      "There is no folder to go back to.",
    );
    expect(screen.getAllByRole("button", { name: "Forward" })[0]).toHaveAttribute(
      "title",
      "There is no folder to go forward to.",
    );
    expect(button("Open")).toHaveAttribute("title", "Select an item to open.");
  });

  it("has no tooltip on Back, Forward or Open while each can act", () => {
    render(<OpenPanelBrowser canGoBack canGoForward />);
    expect(screen.getByRole("button", { name: "Back" })).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: "Forward" })).not.toHaveAttribute("title");
  });
});
