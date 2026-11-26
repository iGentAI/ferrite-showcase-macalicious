import { Checkbox } from "macalicious/checkbox";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PrintPanel } from "macalicious/print-panel";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

const PRINTERS = [
  { value: "brother", label: "Brother HL-2270DW series" },
  { value: "office", label: "Office Colour Laser" },
];

const PRESETS = [
  { value: "default", label: "Default Settings" },
  { value: "last-used", label: "Last Used Settings" },
  { value: "black-and-white", label: "Black and White", separatorBefore: true },
];

const PAPER_SIZES = [
  { value: "letter", label: "US Letter", description: "8.50 by 11.00 inches" },
  { value: "legal", label: "US Legal", description: "8.50 by 14.00 inches", aspectRatio: 8.5 / 14 },
  { value: "a4", label: "A4", description: "8.27 by 11.69 inches", aspectRatio: 210 / 297 },
];

const PANES = [
  {
    value: "app",
    label: "TextEdit",
    content: (
      <div style={{ display: "grid", gap: 6 }}>
        <Checkbox>Print header and footer</Checkbox>
        <Checkbox defaultChecked>Rewrap contents to fit page</Checkbox>
      </div>
    ),
  },
  {
    value: "layout",
    label: "Layout",
    content: <Checkbox>Reverse page orientation</Checkbox>,
  },
];

/**
 * The Print sheet of a document window. The panel is the sheet's content: it reports Print
 * and Cancel, and the application closes the sheet. Nothing is printed.
 */
export default function Basic() {
  const [open, setOpen] = useState(false);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const close = () => setOpen(false);
  return (
    <>
      {/* The window is main, not key, while its sheet is open, and its content is inert. */}
      <Window state={open ? "main" : "key"} width={460} height={220}>
        <TitleBar
          ref={setTitleBar}
          title="Untitled"
          controls={<WindowControls closeDisabled={open} />}
        />
        <WindowBody inert={open} style={{ padding: 20 }}>
          <PushButton onClick={() => setOpen(true)}>Print…</PushButton>
        </WindowBody>
      </Window>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup anchor={titleBar} width={756} aria-label="Print">
          <PrintPanel
            defaultDetailed
            printers={PRINTERS}
            presets={PRESETS}
            paperSizes={PAPER_SIZES}
            panes={PANES}
            preview={<p style={{ margin: "28px 29px", fontSize: 5 }}>Here’s to the crazy ones…</p>}
            pdfMenu={
              <>
                <MenuItem onClick={close}>Open in Preview</MenuItem>
                <MenuSeparator />
                <MenuItem onClick={close}>Save as PDF…</MenuItem>
              </>
            }
            onCancel={close}
            onPrint={close}
          />
        </SheetPopup>
      </Sheet>
    </>
  );
}
