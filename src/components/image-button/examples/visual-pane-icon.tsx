import { ImageButton } from "macalicious/image-button";

/**
 * Visual comparison target: the General icon and its label in the System Preferences grid
 * (#e5e5e5 band in Aqua, #353637 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=148 y=406 w=116 h=154, i.e. 58 x 77 pt. The icon's artwork spans
 * x 168 to 242 and y 415 to 489 (37 x 37.5 pt), 10 pt from the crop's left edge and 4.5 pt from
 * its top; the label's first ink row is y=508. The label is wider than the icon, so the button's
 * box, with 5 pt of clear space, starts 1.5 pt from the crop's left edge and the icon is centred
 * in it. The icon here is a stand-in square of the same size, which the comparison masks: only
 * the label's position, size and colour are scored.
 */
export default function VisualPaneIcon() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 58,
        height: 77,
        padding: "4.5px 0 0 1.5px",
        background: "light-dark(#e5e5e5, #353637)",
      }}
    >
      <ImageButton label="General" style={{ padding: "0 5px", verticalAlign: "top" }}>
        <svg viewBox="0 0 37 37.5" width="37" height="37.5" aria-hidden="true" focusable="false">
          <rect x="0.5" y="0.5" width="36" height="36.5" rx="5" fill="#6aa6d8" />
        </svg>
      </ImageButton>
    </div>
  );
}
