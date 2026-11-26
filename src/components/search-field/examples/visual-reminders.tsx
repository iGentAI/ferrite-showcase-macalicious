import { SearchField } from "macalicious/search-field";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the search field at the top of the Reminders sidebar, which is
 * 21 pt high where the sidebar field of Music is 23 pt: set with `--mac-search-field-height`.
 *
 * Reference crop (2x pixels) x=130 y=170 w=530 h=62 of Light- and Dark-Reminders, i.e. 265 x
 * 31 pt of the sidebar (#e7e7e6, #2c2d2e). The field runs from x 145 to 638 and from y 181 to
 * 222: 247 x 21 pt, 7.5 pt from the crop's left edge and 5.5 pt from its top. The placeholder
 * is masked: it is set in the fallback font off Apple platforms.
 */
export default function VisualReminders() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 265,
        height: 31,
        padding: "5.5px 0 0 7.5px",
        overflow: "hidden",
        background: "light-dark(#e7e7e6, #2c2d2e)",
      }}
    >
      <SearchField
        variant="sidebar"
        style={{ width: 247, "--mac-search-field-height": "21px" } as CSSProperties}
      />
    </div>
  );
}
