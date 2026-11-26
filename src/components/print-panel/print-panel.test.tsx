import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../checkbox";
import { MenuItem } from "../menu-item";
import { Sheet as RealSheet, SheetPopup } from "../sheet";
import { PrintPanel, type PrintPanelProps, type PrintPanelSettings } from "./index";

const PRINTERS = [
  { value: "brother", label: "Brother HL-2270DW series" },
  { value: "office", label: "Office Colour Laser" },
];
const PRESETS = [
  { value: "default", label: "Default Settings" },
  { value: "black-and-white", label: "Black and White", separatorBefore: true },
];
const PAPER_SIZES = [
  { value: "letter", label: "US Letter", description: "8.50 by 11.00 inches" },
  { value: "a4", label: "A4", description: "210 by 297 mm", aspectRatio: 210 / 297 },
];
const PANES = [
  { value: "app", label: "TextEdit", content: <Checkbox>Print header and footer</Checkbox> },
  { value: "layout", label: "Layout", content: <Checkbox>Reverse page orientation</Checkbox> },
];

const DEFAULTS: PrintPanelSettings = {
  printer: "brother",
  preset: "default",
  copies: 1,
  twoSided: false,
  pages: "all",
  from: 1,
  to: 1,
  paperSize: "letter",
  orientation: "portrait",
  pane: "app",
};

function Panel(props: PrintPanelProps) {
  return (
    <PrintPanel
      printers={PRINTERS}
      presets={PRESETS}
      paperSizes={PAPER_SIZES}
      panes={PANES}
      {...props}
    />
  );
}

/** The panel where it is used: in a dialog, the scope of the buttons' key equivalents. */
function Sheet(props: PrintPanelProps) {
  return (
    <div role="dialog" aria-label="Print sheet">
      <Panel {...props} />
    </div>
  );
}

const panel = () => screen.getByRole("group", { name: "Print" });
const popUp = (name: string) => screen.getByRole("combobox", { name });
const field = (name: string) => screen.getByRole("textbox", { name });
const button = (name: string) => screen.getByRole("button", { name });
const page = () => screen.getByRole("img", { name: "Preview" });

async function choose(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
  await user.click(popUp(name));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe("PrintPanel", () => {
  it("is a group named Print that shows the simple form, every control named", () => {
    render(<Panel />);
    expect(panel()).toHaveClass("mac-print-panel");
    expect(panel()).not.toHaveAttribute("data-detailed");
    expect(popUp("Printer:")).toHaveTextContent("Brother HL-2270DW series");
    expect(popUp("Presets:")).toHaveTextContent("Default Settings");
    expect(field("Copies:")).toHaveValue("1");
    expect(screen.getByRole("checkbox", { name: "Two-Sided" })).not.toBeChecked();
    const pages = screen.getByRole("radiogroup", { name: "Pages:" });
    expect(within(pages).getByRole("radio", { name: "All" })).toBeChecked();
    expect(within(pages).getByRole("radio", { name: "From:" })).not.toBeChecked();
    expect(field("From:")).toHaveValue("1");
    expect(field("to:")).toHaveValue("1");
    expect(page()).toHaveClass("mac-print-panel-page");
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    for (const name of ["Help", "Show Details", "Cancel", "Print"]) {
      expect(button(name)).toBeEnabled();
    }
    expect(button("Print")).toHaveClass("mac-default-button");
    // The detailed form's rows, and the PDF button without a menu, are not rendered.
    expect(screen.queryByRole("combobox", { name: "Paper Size:" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Orientation:" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Options" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PDF" })).not.toBeInTheDocument();
  });

  it("shows Paper Size, Orientation and the chosen pane in the detailed form", () => {
    render(<Panel defaultDetailed />);
    expect(panel()).toHaveAttribute("data-detailed");
    expect(popUp("Paper Size:")).toHaveTextContent("US Letter");
    expect(screen.getByText("8.50 by 11.00 inches")).toBeInTheDocument();
    const orientation = screen.getByRole("group", { name: "Orientation:" });
    expect(within(orientation).getByRole("button", { name: "Portrait" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(orientation).getByRole("button", { name: "Landscape" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(popUp("Options")).toHaveTextContent("TextEdit");
    expect(screen.getByRole("checkbox", { name: "Print header and footer" })).toBeInTheDocument();
    expect(button("Hide Details")).toBeInTheDocument();
  });

  it("leaves the pane pop-up button out when there are no panes", () => {
    render(<PrintPanel defaultDetailed paperSizes={PAPER_SIZES} />);
    expect(popUp("Paper Size:")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Options" })).not.toBeInTheDocument();
  });

  it("switches between the forms with its details button, and reports it", async () => {
    const user = userEvent.setup();
    const onDetailedChange = vi.fn();
    render(<Panel onDetailedChange={onDetailedChange} />);
    await user.click(button("Show Details"));
    expect(onDetailedChange).toHaveBeenLastCalledWith(true);
    expect(popUp("Paper Size:")).toBeInTheDocument();
    await user.click(button("Hide Details"));
    expect(onDetailedChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("combobox", { name: "Paper Size:" })).not.toBeInTheDocument();
    expect(button("Show Details")).toBeInTheDocument();
  });

  it("keeps the form it is given while `detailed` is controlled", async () => {
    const user = userEvent.setup();
    const onDetailedChange = vi.fn();
    const { rerender } = render(<Panel detailed={false} onDetailedChange={onDetailedChange} />);
    await user.click(button("Show Details"));
    expect(onDetailedChange).toHaveBeenCalledWith(true);
    expect(button("Show Details")).toBeInTheDocument();
    rerender(<Panel detailed onDetailedChange={onDetailedChange} />);
    expect(button("Hide Details")).toBeInTheDocument();
  });

  it("reports the complete settings when a pop-up button changes one", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel defaultDetailed onSettingsChange={onSettingsChange} />);

    await choose(user, "Printer:", "Office Colour Laser");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, printer: "office" });
    expect(popUp("Printer:")).toHaveTextContent("Office Colour Laser");

    await choose(user, "Presets:", "Black and White");
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULTS,
      printer: "office",
      preset: "black-and-white",
    });

    await choose(user, "Options", "Layout");
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULTS,
      printer: "office",
      preset: "black-and-white",
      pane: "layout",
    });
    expect(screen.getByRole("checkbox", { name: "Reverse page orientation" })).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Print header and footer" }),
    ).not.toBeInTheDocument();
    expect(onSettingsChange).toHaveBeenCalledTimes(3);
  });

  it("keeps each pane's own state while another pane or the simple form is shown", async () => {
    const user = userEvent.setup();
    render(<Panel defaultDetailed />);
    const header = () => screen.getByRole("checkbox", { name: "Print header and footer" });
    await user.click(header());
    expect(header()).toBeChecked();

    await choose(user, "Options", "Layout");
    // The other pane's checkbox is its own: it does not take over the first one's state.
    expect(screen.getByRole("checkbox", { name: "Reverse page orientation" })).not.toBeChecked();
    await choose(user, "Options", "TextEdit");
    expect(header()).toBeChecked();

    await user.click(button("Hide Details"));
    expect(screen.queryByRole("checkbox", { name: "Print header and footer" })).toBeNull();
    await user.click(button("Show Details"));
    expect(header()).toBeChecked();
  });

  it("chooses an item whose value is the empty string", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(
      <Panel
        presets={[
          { value: "default", label: "Default Settings" },
          { value: "", label: "No Preset" },
        ]}
        onSettingsChange={onSettingsChange}
      />,
    );
    await choose(user, "Presets:", "No Preset");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, preset: "" });
    expect(popUp("Presets:")).toHaveTextContent("No Preset");
  });

  it("draws a separator before an item that asks for one", async () => {
    const user = userEvent.setup();
    render(<Panel />);
    await user.click(popUp("Presets:"));
    const menu = await screen.findByRole("listbox");
    expect(within(menu).getAllByRole("option")).toHaveLength(2);
    expect(menu.querySelectorAll(".mac-menu-item-separator")).toHaveLength(1);
  });

  it("shapes the page by the paper size and shows the size's description", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel defaultDetailed onSettingsChange={onSettingsChange} />);
    expect(page()).toHaveStyle({ width: "233px", height: "301px" });
    await choose(user, "Paper Size:", "A4");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, paperSize: "a4" });
    expect(screen.getByText("210 by 297 mm")).toBeInTheDocument();
    expect(screen.queryByText("8.50 by 11.00 inches")).not.toBeInTheDocument();
    expect(page()).toHaveStyle({ width: "213px", height: "301px" });
  });

  it("turns the page with the orientation, and keeps one orientation on", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel defaultDetailed onSettingsChange={onSettingsChange} />);
    expect(page()).toHaveStyle({ width: "233px", height: "301px" });
    await user.click(button("Landscape"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, orientation: "landscape" });
    expect(button("Landscape")).toHaveAttribute("aria-pressed", "true");
    expect(button("Portrait")).toHaveAttribute("aria-pressed", "false");
    expect(page()).toHaveStyle({ width: "301px", height: "233px" });
    // The button that is on does not switch off.
    await user.click(button("Landscape"));
    expect(onSettingsChange).toHaveBeenCalledTimes(1);
    expect(button("Landscape")).toHaveAttribute("aria-pressed", "true");
  });

  it("reports Copies and Two-Sided", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel onSettingsChange={onSettingsChange} />);
    await user.clear(field("Copies:"));
    // An empty field is not a number of copies: nothing is reported.
    expect(onSettingsChange).not.toHaveBeenCalled();
    await user.type(field("Copies:"), "12");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, copies: 12 });
    await user.click(screen.getByRole("checkbox", { name: "Two-Sided" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, copies: 12, twoSided: true });
    expect(screen.getByRole("checkbox", { name: "Two-Sided" })).toBeChecked();
  });

  it("drops an entry that is not a whole number of at least 1 when the focus leaves", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel defaultSettings={{ copies: 3 }} onSettingsChange={onSettingsChange} />);
    await user.clear(field("Copies:"));
    await user.type(field("Copies:"), "0");
    await user.type(field("Copies:"), "x");
    expect(field("Copies:")).toHaveValue("0x");
    await user.tab();
    expect(field("Copies:")).toHaveValue("3");
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it("does not report a number too large to be a whole number", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel defaultSettings={{ copies: 3 }} onSettingsChange={onSettingsChange} />);
    await user.clear(field("Copies:"));
    await user.click(field("Copies:"));
    await user.paste("9".repeat(400));
    await user.clear(field("Copies:"));
    await user.paste("9007199254740993");
    expect(onSettingsChange).not.toHaveBeenCalled();
    await user.tab();
    expect(field("Copies:")).toHaveValue("3");
    // Leading zeros are still a number.
    await user.clear(field("Copies:"));
    await user.paste("007");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, copies: 7 });
  });

  it("reports the page range, and chooses it when a page is typed", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<Panel pageCount={8} onSettingsChange={onSettingsChange} />);
    expect(field("to:")).toHaveValue("8");
    await user.click(screen.getByRole("radio", { name: "From:" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, to: 8, pages: "range" });
    await user.click(screen.getByRole("radio", { name: "All" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULTS, to: 8 });

    await user.clear(field("From:"));
    await user.type(field("From:"), "2");
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULTS,
      pages: "range",
      from: 2,
      to: 8,
    });
    expect(screen.getByRole("radio", { name: "From:" })).toBeChecked();
    await user.clear(field("to:"));
    await user.type(field("to:"), "5");
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULTS,
      pages: "range",
      from: 2,
      to: 5,
    });
  });

  it("starts from `defaultSettings` and fills in what is left out", () => {
    render(
      <Panel
        defaultDetailed
        defaultSettings={{ printer: "office", copies: 4, twoSided: true, pages: "range", to: 6 }}
      />,
    );
    expect(popUp("Printer:")).toHaveTextContent("Office Colour Laser");
    expect(popUp("Presets:")).toHaveTextContent("Default Settings");
    expect(field("Copies:")).toHaveValue("4");
    expect(screen.getByRole("checkbox", { name: "Two-Sided" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "From:" })).toBeChecked();
    expect(field("to:")).toHaveValue("6");
    expect(popUp("Paper Size:")).toHaveTextContent("US Letter");
  });

  it("shows the settings it is given while `settings` is controlled", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const settings: PrintPanelSettings = { ...DEFAULTS, printer: "office", copies: 2 };
    const { rerender } = render(
      <Panel defaultDetailed settings={settings} onSettingsChange={onSettingsChange} />,
    );
    expect(popUp("Printer:")).toHaveTextContent("Office Colour Laser");
    expect(field("Copies:")).toHaveValue("2");
    await user.click(screen.getByRole("checkbox", { name: "Two-Sided" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...settings, twoSided: true });
    expect(screen.getByRole("checkbox", { name: "Two-Sided" })).not.toBeChecked();
    await user.click(button("Landscape"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...settings, orientation: "landscape" });
    expect(page()).toHaveStyle({ width: "233px", height: "301px" });

    rerender(
      <Panel
        defaultDetailed
        settings={{ ...settings, twoSided: true, orientation: "landscape", paperSize: "a4" }}
        onSettingsChange={onSettingsChange}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Two-Sided" })).toBeChecked();
    expect(page()).toHaveStyle({ width: "301px", height: "213px" });
    expect(popUp("Paper Size:")).toHaveTextContent("A4");
  });

  it("draws the preview on the page", () => {
    render(<Panel preview={<p>Here’s to the crazy ones.</p>} />);
    expect(page()).toHaveTextContent("Here’s to the crazy ones.");
    // The paper is white in both appearances: what is on it is drawn in Aqua.
    expect(page()).toHaveAttribute("data-appearance", "light");
  });

  it("moves through the pages with the four buttons, which stop at the ends", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Panel pageCount={3} onPageChange={onPageChange} />);
    const navigation = button("Next page").closest(".mac-print-panel-navigation");
    expect(navigation).toHaveTextContent("1 of 3");
    expect(button("First page")).toBeDisabled();
    expect(button("Previous page")).toBeDisabled();
    expect(button("Next page")).not.toHaveAttribute("aria-pressed");

    await user.click(button("Next page"));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(navigation).toHaveTextContent("2 of 3");
    for (const name of ["First page", "Previous page", "Next page", "Last page"]) {
      expect(button(name)).toBeEnabled();
    }

    await user.click(button("Last page"));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    expect(navigation).toHaveTextContent("3 of 3");
    expect(button("Next page")).toBeDisabled();
    expect(button("Last page")).toBeDisabled();

    await user.click(button("Previous page"));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    await user.click(button("First page"));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    expect(navigation).toHaveTextContent("1 of 3");
    expect(onPageChange).toHaveBeenCalledTimes(4);
  });

  it("starts at `defaultPage`, and shows the page it is given while `page` is controlled", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { unmount } = render(<Panel pageCount={5} defaultPage={4} />);
    expect(screen.getByText("4 of 5")).toBeInTheDocument();
    unmount();

    const { rerender } = render(<Panel pageCount={5} page={2} onPageChange={onPageChange} />);
    await user.click(button("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByText("2 of 5")).toBeInTheDocument();
    rerender(<Panel pageCount={5} page={5} onPageChange={onPageChange} />);
    expect(screen.getByText("5 of 5")).toBeInTheDocument();
    expect(button("Last page")).toBeDisabled();
  });

  it("shows and reports the last page when the document gets shorter than the page shown", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Panel pageCount={5} defaultPage={5} onPageChange={onPageChange} />,
    );
    expect(screen.getByText("5 of 5")).toBeInTheDocument();
    rerender(<Panel pageCount={2} defaultPage={5} onPageChange={onPageChange} />);
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(button("Next page")).toBeDisabled();
    await user.click(button("Previous page"));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    // A longer document changes nothing.
    rerender(<Panel pageCount={9} defaultPage={5} onPageChange={onPageChange} />);
    expect(screen.getByText("1 of 9")).toBeInTheDocument();
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it("shows the last page of a shorter document while `page` is controlled, and says so once", () => {
    const onPageChange = vi.fn();
    // A consumer that does not follow: the panel still shows a page that exists.
    const { rerender } = render(<Panel pageCount={5} page={5} onPageChange={onPageChange} />);
    rerender(<Panel pageCount={2} page={5} onPageChange={onPageChange} />);
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(button("Previous page")).toBeEnabled();
    expect(button("Next page")).toBeDisabled();
    // More renders, with a new callback each time, report nothing more.
    rerender(<Panel pageCount={2} page={5} onPageChange={(page) => onPageChange(page)} />);
    rerender(<Panel pageCount={2} page={5} onPageChange={(page) => onPageChange(page)} />);
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it("shows the PDF pull-down button for a menu that is the number zero", () => {
    render(<Panel pdfMenu={0} />);
    expect(button("PDF")).toBeInTheDocument();
  });

  it("shows the PDF pull-down button with the menu it is given", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Panel pdfMenu={<MenuItem onClick={onSave}>Save as PDF…</MenuItem>} />);
    await user.click(button("PDF"));
    await user.click(await screen.findByRole("menuitem", { name: "Save as PDF…" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("reports Help, Cancel and Print, with the settings", async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();
    const onCancel = vi.fn();
    const onPrint = vi.fn();
    render(<Panel onHelp={onHelp} onCancel={onCancel} onPrint={onPrint} />);
    await user.click(button("Help"));
    expect(onHelp).toHaveBeenCalledTimes(1);
    await user.click(button("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("checkbox", { name: "Two-Sided" }));
    await user.click(button("Print"));
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledWith({ ...DEFAULTS, twoSided: true });
  });

  it("prints on Return pressed in a field, and marks the key as handled", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    render(<Sheet onPrint={onPrint} defaultSettings={{ copies: 2 }} />);
    await user.click(field("Copies:"));
    await user.keyboard("{Enter}");
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledWith({ ...DEFAULTS, copies: 2 });
    // dispatchEvent answers false when a handler prevented the default.
    expect(fireEvent.keyDown(field("Copies:"), { key: "Enter" })).toBe(false);
    expect(onPrint).toHaveBeenCalledTimes(2);
  });

  it("prints on Return in a sheet that gave the focus to Copies", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    function Document() {
      const [open, setOpen] = useState(false);
      const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setAnchor} />
          <button type="button" onClick={() => setOpen(true)}>
            Print…
          </button>
          <RealSheet open={open} onOpenChange={setOpen}>
            <SheetPopup
              anchor={anchor}
              aria-label="Print sheet"
              initialFocus={() => screen.getByRole("textbox", { name: "Copies:" })}
            >
              <Panel onPrint={onPrint} />
            </SheetPopup>
          </RealSheet>
        </>
      );
    }
    render(<Document />);
    await user.click(button("Print…"));
    await waitFor(() => expect(field("Copies:")).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("leaves Return to a focused button, and to a handler that prevents the default", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<Sheet onPrint={onPrint} onCancel={onCancel} />);
    button("Cancel").focus();
    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPrint).not.toHaveBeenCalled();

    rerender(
      <Sheet onPrint={onPrint} onCancel={onCancel} onKeyDown={(event) => event.preventDefault()} />,
    );
    await user.click(field("Copies:"));
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(onPrint).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels on Escape, and marks the key as handled only when it has someone to tell", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(<Sheet onCancel={onCancel} />);
    await user.click(field("Copies:"));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(fireEvent.keyDown(field("Copies:"), { key: "Escape" })).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(2);

    rerender(<Sheet />);
    expect(fireEvent.keyDown(field("Copies:"), { key: "Escape" })).toBe(true);
  });

  it("does not print while Print is disabled, with the pointer or with Return", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    render(<Sheet printDisabled onPrint={onPrint} />);
    expect(button("Print")).toBeDisabled();
    await user.click(button("Print"));
    await user.click(field("Copies:"));
    await user.keyboard("{Enter}");
    expect(onPrint).not.toHaveBeenCalled();
  });

  it("is tabbed through in the order it is read", async () => {
    const user = userEvent.setup();
    render(<Panel defaultDetailed pageCount={2} pdfMenu={<MenuItem>Save as PDF…</MenuItem>} />);
    const order: (string | null)[] = [];
    for (let stop = 0; stop < 16; stop++) {
      await user.tab();
      const element = document.activeElement as HTMLElement;
      const labelledBy = element.getAttribute("aria-labelledby");
      order.push(
        element.getAttribute("aria-label") ??
          (labelledBy ? document.getElementById(labelledBy)?.textContent : element.textContent) ??
          null,
      );
    }
    expect(order).toEqual([
      "Next page",
      "Printer:",
      "Presets:",
      "Copies:",
      "Two-Sided",
      "All",
      "From:",
      "to:",
      "Paper Size:",
      "Portrait",
      "Options",
      "Print header and footer",
      "Help",
      "PDF",
      "Hide Details",
      "Cancel",
    ]);
  });

  it("takes translations for its texts", () => {
    render(
      <Panel
        pageCount={4}
        labels={{
          Print: "Drucken",
          "Printer:": "Drucker:",
          Cancel: "Abbrechen",
          Help: "Hilfe",
          of: "von",
        }}
      />,
    );
    expect(screen.getByRole("group", { name: "Drucken" })).toBeInTheDocument();
    expect(popUp("Drucker:")).toBeInTheDocument();
    expect(button("Drucken")).toBeInTheDocument();
    expect(button("Abbrechen")).toBeInTheDocument();
    expect(button("Hilfe")).toBeInTheDocument();
    expect(screen.getByText("1 von 4")).toBeInTheDocument();
    // What is left out stays English.
    expect(popUp("Presets:")).toBeInTheDocument();
  });

  it("forwards ref, className, style and other props to its root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Panel
        ref={ref}
        className="custom"
        style={{ width: 800 }}
        id="print"
        data-testid="panel"
        aria-describedby="hint"
      />,
    );
    const root = screen.getByTestId("panel");
    expect(ref.current).toBe(root);
    expect(root).toBe(panel());
    expect(root).toHaveClass("mac-print-panel", "custom");
    expect(root).toHaveStyle({ width: "800px" });
    expect(root).toHaveAttribute("id", "print");
    expect(root).toHaveAttribute("aria-describedby", "hint");
  });

  it("takes its name from `aria-label` or `aria-labelledby` when given one", () => {
    const { rerender } = render(<Panel aria-label="Print Untitled" />);
    expect(screen.getByRole("group", { name: "Print Untitled" })).toHaveClass("mac-print-panel");
    rerender(
      <>
        <h2 id="heading">Print the document</h2>
        <Panel aria-labelledby="heading" />
      </>,
    );
    const named = screen.getByRole("group", { name: "Print the document" });
    expect(named).toHaveClass("mac-print-panel");
  });
});
