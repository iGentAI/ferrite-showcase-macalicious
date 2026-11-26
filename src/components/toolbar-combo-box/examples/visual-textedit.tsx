import { ComboBoxItem } from "macalicious/combo-box";
import { ToolbarComboBox } from "macalicious/toolbar-combo-box";

/**
 * Visual comparison target: the font size control of TextEdit's format bar, the small size,
 * over the bar's gradient.
 *
 * Reference crop (2x pixels) x=544 y=126 w=98 h=40 in both TextEdit screenshots, i.e. 49 x
 * 20 pt. The fill is 43 x 15 pt, 3 pt from the crop's left edge and 2.5 pt under its top: the
 * field 24 pt, the divider 1 pt, the button 18 pt with the 7 pt chevron 5 pt after the
 * divider. The bar behind it runs from #d7d7d7 to #cecece in Aqua and from #3c3f42 to #383a3d
 * in Dark Aqua.
 */
export default function VisualTextEdit() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 49,
        height: 20,
        padding: "2.5px 3px",
        lineHeight: 0,
        background: "linear-gradient(light-dark(#d8d8d8, #3c3f42), light-dark(#cdcdcd, #37393c))",
      }}
    >
      <ToolbarComboBox size="small" aria-label="Font size" defaultValue="12">
        <ComboBoxItem>9</ComboBoxItem>
        <ComboBoxItem>12</ComboBoxItem>
      </ToolbarComboBox>
    </div>
  );
}
