import { Separator } from "macalicious/separator";

/**
 * Visual comparison target: the separator in the General tab of System Preferences › Security
 * & Privacy, which lies on a box. Reference crop (2x pixels) x=188 y=684 w=240 h=22, i.e.
 * 120 x 11 pt: the line starts 5 pt from the crop's left edge and 5 pt from its top. The
 * background is the box fill over the window: #e3e3e3 in Aqua, #363637 in Dark Aqua.
 */
export default function VisualOnBox() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 120,
        height: 11,
        padding: "5px 0 0 5px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Separator />
    </div>
  );
}
