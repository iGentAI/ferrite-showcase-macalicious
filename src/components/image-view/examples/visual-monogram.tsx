import { ImageView } from "macalicious/image-view";

/**
 * Visual comparison target: the monogram avatar in System Preferences › Screen Time.
 * Reference crop (2x pixels) x=177 y=196 w=216 h=216, i.e. 108 x 108 pt, with the 98 pt disc
 * 5 pt from the left and from the top, on the window background. In the Dark Aqua capture the
 * initials are drawn in the disc's own colour and cannot be seen; the component draws them in
 * white, so the dark comparison masks them.
 */
export default function VisualMonogram() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 108,
        height: 108,
        padding: 5,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <ImageView alt="Stephen Hackett" mask="circle" width={98} height={98}>
        SH
      </ImageView>
    </div>
  );
}
