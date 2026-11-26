import { EditorialCard } from "macalicious/editorial-card";

/**
 * Visual comparison target: the bottom-left corner of the App Store's hero. Reference crop
 * x=622 y=732 w=40 h=36, i.e. 20 x 18 pt, with the hero's corner 6 pt in from the crop's left
 * and 12 pt down. The photograph there is water, so the fixture's artwork is its average
 * colour in each capture.
 */
export default function VisualHeroCorner() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 20,
        height: 18,
        background: "light-dark(#ffffff, #1e1f22)",
      }}
    >
      <EditorialCard
        variant="hero"
        render={<a href="#extensions" />}
        aria-label="Extensions for Fast Photo Edits"
        artwork={<span style={{ background: "light-dark(#64827f, #5f7c7a)" }} />}
        style={{ position: "absolute", left: 6, top: 12 - 340, width: 945 }}
      />
    </div>
  );
}
