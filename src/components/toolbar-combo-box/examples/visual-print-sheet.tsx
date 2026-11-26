import { ComboBoxItem } from "macalicious/combo-box";
import { ToolbarComboBox } from "macalicious/toolbar-combo-box";

/**
 * Visual comparison target: the font size control of TextEdit's format bar while the window
 * shows its Print sheet, so that the window is main and not key. The control is drawn as in
 * the key window.
 *
 * Reference crops (2x pixels): x=869 y=158 w=98 h=40 in Light-Print and x=783 y=128 w=98
 * h=40 in Dark-Print, i.e. 49 x 20 pt with the 43 x 15 pt fill 3 pt from the left edge and
 * 2.5 pt under the top. The bar behind it runs from #d8d8d8 to #cecece in Aqua and from
 * #3d3d3f to #373739 in Dark Aqua, where it is a neutral grey: these are captures of a region
 * of the screen, over another part of the desktop picture than the window captures.
 */
export default function VisualPrintSheet() {
  return (
    <div
      data-window-state="main"
      style={{
        boxSizing: "border-box",
        width: 49,
        height: 20,
        padding: "2.5px 3px",
        lineHeight: 0,
        background: "linear-gradient(light-dark(#d8d8d8, #3d3d3f), light-dark(#cdcdcd, #363638))",
      }}
    >
      <ToolbarComboBox size="small" aria-label="Font size" defaultValue="12">
        <ComboBoxItem>9</ComboBoxItem>
        <ComboBoxItem>12</ComboBoxItem>
      </ToolbarComboBox>
    </div>
  );
}
