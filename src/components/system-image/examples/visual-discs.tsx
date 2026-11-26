import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the two disc images where the screenshots show them alone.
 *
 * `#info`: Console's Info toolbar button, which draws the image in the accent colour. Reference
 * crop (2x pixels) x=737 y=129 w=38 h=38, i.e. 19 x 19 pt of the button's fill, the 15 pt disc
 * 2 pt from the crop's left and top edges.
 *
 * `#clear`: the clear button of Preview's toolbar search field while a search is shown.
 * Reference crop 34 x 36 px at y=130, x=2354 in the light capture and x=2812 in the dark one,
 * i.e. 17 x 18 pt of the field's fill, the 14 pt disc 1 pt from the crop's left edge and 2 pt
 * from its top.
 */
export default function VisualDiscs() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <div
        id="info"
        style={{
          position: "relative",
          width: 19,
          height: 19,
          color: "light-dark(#2e7cf6, #3e8ff7)",
          background: "light-dark(#f8f8f8, #6e6e6f)",
        }}
      >
        <SystemImage name="info" style={{ position: "absolute", left: 2, top: 2 }} />
      </div>
      <div
        id="clear"
        style={{
          position: "relative",
          width: 17,
          height: 18,
          color: "light-dark(#7c7c7c, #d0d0d0)",
          background: "light-dark(#f8f8f8, #959698)",
        }}
      >
        <SystemImage name="stop-progress" style={{ position: "absolute", left: 1, top: 2 }} />
      </div>
    </div>
  );
}
