import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Visual comparison target: the small "Open with" pop-up button of Finder's Get Info window.
 * The screenshot's title has the application's icon, which is not reproduced; the comparison
 * masks the title.
 *
 * Reference crop (2x pixels) x=134 y=1168 w=486 h=52, i.e. 243 x 26 pt. The bezel's edges are at
 * x 143 to 610 and y 1177 to 1210 (17 pt), so its alignment box is 235 x 18 pt and starts 4 pt
 * from the crop's left edge and 4 pt from its top. The window is #ececec in Aqua and #323437 in
 * Dark Aqua, where its material takes some colour from the desktop behind it.
 */
export default function VisualSmall() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 243,
        height: 26,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #323437)",
      }}
    >
      <PopUpButton
        size="small"
        defaultValue="preview"
        aria-label="Open with"
        style={{ width: 235 }}
      >
        <PopUpButtonItem value="preview">Preview (default)</PopUpButtonItem>
        <PopUpButtonItem value="other">Other…</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
