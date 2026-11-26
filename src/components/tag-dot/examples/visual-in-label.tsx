import { TagDot } from "macalicious/tag-dot";

/**
 * Visual comparison target: the flat green dot before “Documents” in a Finder icon view
 * (Finder Home capture). Reference crop (2x pixels) w=28 h=28, i.e. 14 x 14 pt with the 10 pt
 * dot at (2, 2) pt, on the icon view's background. The Aqua crop starts on an odd pixel
 * because the dot does.
 */
export default function VisualInLabel() {
  return (
    <div
      style={{
        position: "relative",
        width: 14,
        height: 14,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <TagDot color="green" size="small" style={{ position: "absolute", left: 2, top: 2 }} />
    </div>
  );
}
