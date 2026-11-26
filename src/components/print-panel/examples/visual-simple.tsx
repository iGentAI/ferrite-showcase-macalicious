import { PrintPanel } from "macalicious/print-panel";

/**
 * Visual check target: the simple form, which no screenshot shows, as the content of a sheet
 * with 20 pt margins on the window background. The example's box is as tall as the panel
 * makes it, so the check of its size is a check of the panel's height: 229 pt and the two
 * margins, the 150 pt less than the detailed sheet that the spec infers.
 */
export default function VisualSimple() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 756,
        padding: 20,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <PrintPanel
        printers={[{ value: "brother", label: "Brother HL-2270DW series" }]}
        presets={[{ value: "default", label: "Default Settings" }]}
        paperSizes={[{ value: "letter", label: "US Letter", description: "8.50 by 11.00 inches" }]}
        panes={[{ value: "app", label: "TextEdit" }]}
      />
    </div>
  );
}
