import { Checkbox } from "macalicious/checkbox";
import { MenuItem } from "macalicious/menu-item";
import { PrintPanel, type PrintPanelSettings } from "macalicious/print-panel";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

const PAGES = ["Here’s to the crazy ones.", "The misfits. The rebels.", "The troublemakers."];

const PRINTERS = [
  { value: "brother", label: "Brother HL-2270DW series" },
  { value: "office", label: "Office Colour Laser" },
];

/**
 * The application-modal presentation: the panel in a window of its own. It starts with the
 * simple form; Show Details adds Paper Size, Orientation and the option panes. The settings
 * are controlled here, and Print hands them over.
 */
export default function InWindow() {
  const [settings, setSettings] = useState<PrintPanelSettings>({
    printer: "brother",
    preset: "default",
    copies: 2,
    twoSided: true,
    pages: "all",
    from: 1,
    to: PAGES.length,
    paperSize: "a4",
    orientation: "portrait",
    pane: "app",
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("Nothing printed yet.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Window role="dialog" width={756}>
        <TitleBar title="Print" controls={<WindowControls minimizeDisabled zoomDisabled />} />
        <WindowBody style={{ padding: 20 }}>
          <PrintPanel
            settings={settings}
            onSettingsChange={setSettings}
            printers={PRINTERS}
            presets={[
              { value: "default", label: "Default Settings" },
              { value: "draft", label: "Draft", separatorBefore: true },
            ]}
            paperSizes={[
              { value: "letter", label: "US Letter", description: "8.50 by 11.00 inches" },
              { value: "a4", label: "A4", description: "210 by 297 mm", aspectRatio: 210 / 297 },
            ]}
            panes={[
              {
                value: "app",
                label: "Notes",
                content: <Checkbox defaultChecked>Print the date on every page</Checkbox>,
              },
            ]}
            pageCount={PAGES.length}
            page={page}
            onPageChange={setPage}
            preview={<p style={{ margin: "28px 29px", fontSize: 10 }}>{PAGES[page - 1]}</p>}
            pdfMenu={<MenuItem onClick={() => setResult("Saved as PDF.")}>Save as PDF…</MenuItem>}
            printDisabled={settings.pages === "range" && settings.from > settings.to}
            onCancel={() => setResult("Cancelled.")}
            onPrint={({ copies, printer }) =>
              setResult(`Sent ${copies} ${copies === 1 ? "copy" : "copies"} to “${printer}”.`)
            }
          />
        </WindowBody>
      </Window>
      <output>{result}</output>
    </div>
  );
}
