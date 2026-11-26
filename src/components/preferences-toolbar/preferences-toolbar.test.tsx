import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  PreferencesToolbar,
  PreferencesToolbarItem,
  PreferencesToolbarPanel,
  PreferencesToolbarRoot,
} from "./index";

function Mail(
  props: Partial<React.ComponentProps<typeof PreferencesToolbarRoot>> & {
    activateOnFocus?: boolean;
    alignment?: "leading" | "center";
    disabledRules?: boolean;
  },
) {
  const { activateOnFocus, alignment, disabledRules, ...root } = props;
  return (
    <PreferencesToolbarRoot defaultValue="general" {...root}>
      <PreferencesToolbar
        aria-label="Mail preferences"
        activateOnFocus={activateOnFocus}
        alignment={alignment}
      >
        <PreferencesToolbarItem value="general" icon={<svg data-testid="general-icon" />}>
          General
        </PreferencesToolbarItem>
        <PreferencesToolbarItem value="accounts">Accounts</PreferencesToolbarItem>
        <PreferencesToolbarItem value="rules" disabled={disabledRules}>
          Rules
        </PreferencesToolbarItem>
      </PreferencesToolbar>
      <PreferencesToolbarPanel value="general">General pane</PreferencesToolbarPanel>
      <PreferencesToolbarPanel value="accounts">Accounts pane</PreferencesToolbarPanel>
      <PreferencesToolbarPanel value="rules">Rules pane</PreferencesToolbarPanel>
    </PreferencesToolbarRoot>
  );
}

const item = (name: string) => screen.getByRole("tab", { name });

describe("PreferencesToolbar", () => {
  it("renders a labelled tab list, its items and the selected pane only", () => {
    render(<Mail />);
    const bar = screen.getByRole("tablist", { name: "Mail preferences" });
    expect(bar).toHaveClass("mac-preferences-toolbar");
    expect(bar).toHaveAttribute("data-alignment", "leading");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(item("General")).toHaveClass("mac-preferences-toolbar-item");
    expect(item("General")).toHaveAttribute("aria-selected", "true");
    expect(item("Accounts")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("General pane");
    expect(screen.queryByText("Accounts pane")).not.toBeInTheDocument();
  });

  it("reflects the alignment", () => {
    render(<Mail alignment="center" />);
    expect(screen.getByRole("tablist")).toHaveAttribute("data-alignment", "center");
  });

  it("names an item by its label and hides its icon from assistive technology", () => {
    render(<Mail />);
    const icon = screen.getByTestId("general-icon");
    expect(item("General")).toContainElement(icon);
    expect(icon.parentElement).toHaveClass("mac-preferences-toolbar-item-icon");
    expect(icon.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("selects an item and shows its pane when it is clicked (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Mail onValueChange={onValueChange} />);
    await user.click(item("Accounts"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("accounts");
    expect(item("Accounts")).toHaveAttribute("aria-selected", "true");
    expect(item("General")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
  });

  it("stays on the given value when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Mail defaultValue={undefined} value="general" onValueChange={onValueChange} />);
    await user.click(item("Accounts"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("accounts");
    expect(item("General")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("General pane");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<string | null>("general");
      return <Mail defaultValue={undefined} value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    await user.click(item("Rules"));
    expect(item("Rules")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Rules pane");
  });

  it("is one tab stop; the arrow keys move focus without selecting and Space selects", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.tab();
    expect(item("General")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(item("Accounts")).toHaveFocus();
    expect(item("General")).toHaveAttribute("aria-selected", "true");
    await user.keyboard(" ");
    expect(item("Accounts")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(item("General")).toHaveAttribute("aria-selected", "true");
  });

  it("moves to the first and last items with Home and End", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.tab();
    await user.keyboard("{End}");
    expect(item("Rules")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("General")).toHaveFocus();
  });

  it("selects on focus when activateOnFocus is set", async () => {
    const user = userEvent.setup();
    render(<Mail activateOnFocus />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(item("Accounts")).toHaveAttribute("aria-selected", "true");
  });

  it("does not select a disabled item", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Mail disabledRules onValueChange={onValueChange} />);
    expect(item("Rules")).toHaveAttribute("data-disabled");
    await user.click(item("Rules"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(item("General")).toHaveAttribute("aria-selected", "true");
  });

  it("forwards ref, className and native attributes on every part", () => {
    const root = createRef<HTMLDivElement>();
    const bar = createRef<HTMLDivElement>();
    const tab = createRef<HTMLElement>();
    const pane = createRef<HTMLDivElement>();
    render(
      <PreferencesToolbarRoot ref={root} className="r" id="root" defaultValue="a">
        <PreferencesToolbar ref={bar} className="b" id="bar" aria-label="Preferences">
          <PreferencesToolbarItem ref={tab} className="t" id="tab" value="a">
            A
          </PreferencesToolbarItem>
        </PreferencesToolbar>
        <PreferencesToolbarPanel ref={pane} className="p" id="pane" value="a">
          Pane
        </PreferencesToolbarPanel>
      </PreferencesToolbarRoot>,
    );
    expect(root.current).toHaveClass("mac-preferences-toolbar-root", "r");
    expect(root.current).toHaveAttribute("id", "root");
    expect(bar.current).toHaveClass("mac-preferences-toolbar", "b");
    expect(bar.current).toHaveAttribute("id", "bar");
    expect(tab.current).toHaveClass("mac-preferences-toolbar-item", "t");
    expect(tab.current).toHaveAttribute("id", "tab");
    expect(pane.current).toHaveClass("mac-preferences-toolbar-panel", "p");
    expect(pane.current).toHaveAttribute("id", "pane");
  });

  it("renders the root as another element through render", () => {
    render(
      <PreferencesToolbarRoot defaultValue="a" render={<section data-testid="host" />}>
        <PreferencesToolbar aria-label="Preferences">
          <PreferencesToolbarItem value="a">A</PreferencesToolbarItem>
        </PreferencesToolbar>
      </PreferencesToolbarRoot>,
    );
    const host = screen.getByTestId("host");
    expect(host.tagName).toBe("SECTION");
    expect(host).toHaveClass("mac-preferences-toolbar-root");
    expect(host).toContainElement(screen.getByRole("tablist"));
  });
});
