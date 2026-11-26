import { Checkbox } from "macalicious/checkbox";

/**
 * Visual comparison target: "Close windows when quitting an app" in System Preferences >
 * General, with the start of its title, to check where the title sits beside the box.
 *
 * Reference crop (2x pixels) x=1472 y=1304 w=160 h=44, i.e. 80 x 22 pt, with the on box 3 pt
 * from the crop's left edge and 4 pt from its top; the crop ends inside the title. Off Apple
 * platforms the title is set in the fallback font, so the whole-crop score is dominated by the
 * text and a second comparison masks it.
 */
export default function VisualGeneralTitled() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: 80,
        height: 22,
        padding: "4px 0 0 3px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        background: "light-dark(#ececec, #303032)",
      }}
    >
      <Checkbox defaultChecked>Close windows when quitting an app</Checkbox>
    </div>
  );
}
