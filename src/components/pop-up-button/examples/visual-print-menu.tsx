import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "macalicious/pop-up-button";

/**
 * Visual comparison target: the open Presets pop-up menu of the Print sheet (Print
 * screenshots), 244 x 122 pt: the menu lies over its button with the selected item's title over
 * the button's title, and that item carries the checkmark. The stage is the menu's rectangle
 * over the sheet's fill; the 239.5 pt button sits where the menu puts itself exactly on the
 * stage, and the page around the stage gives the menu room, so the comparison captures the
 * stage (`selector`). The comparison hovers "Black and White".
 */
export default function VisualPrintMenu() {
  return (
    <div style={{ padding: 40 }}>
      {/* The fallback font sets the longest title wider than San Francisco does; the menu keeps
          the 244 pt it has in the screenshot. */}
      <style>{".mac-pop-up-button-menu { width: 244px; }"}</style>
      <div
        data-testid="stage"
        style={{
          boxSizing: "border-box",
          width: 244,
          height: 122,
          padding: "2.75px 0 0 11.5px",
          background: "light-dark(#ececec, #2a2b2d)",
        }}
      >
        <PopUpButton
          defaultOpen
          defaultValue="default"
          aria-label="Presets"
          style={{ width: 239.5 }}
        >
          <PopUpButtonItem value="default">Default Settings</PopUpButtonItem>
          <PopUpButtonItem value="last">Last Used Settings</PopUpButtonItem>
          <PopUpButtonSeparator />
          <PopUpButtonItem value="mono" data-testid="mono">
            Black and White
          </PopUpButtonItem>
          <PopUpButtonSeparator />
          <PopUpButtonItem value="save">Save Current Settings as Preset…</PopUpButtonItem>
          <PopUpButtonItem value="show">Show Presets…</PopUpButtonItem>
        </PopUpButton>
      </div>
    </div>
  );
}
