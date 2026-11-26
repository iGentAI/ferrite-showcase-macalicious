import { StoryCard } from "macalicious/story-card";

/**
 * Visual comparison target, Aqua: the top-left corner of the first secondary story's
 * thumbnail in News, 20 x 20 pt with the corner 5 pt in and 5 pt down.
 *
 * Reference crop (2x pixels) x=1075 y=1406 w=40 h=40: the thumbnail's edges lie on fractions
 * of a pixel in the capture, within half a pixel of these. The photograph is black there, and
 * so is the picture here, on the page colour at that height.
 */
export default function VisualThumbnailCorner() {
  return (
    <div
      style={{
        position: "relative",
        width: 20,
        height: 20,
        overflow: "hidden",
        background: "#e1f0fe",
      }}
    >
      <StoryCard
        variant="secondary"
        aria-label="Story"
        role="img"
        artwork={<span style={{ background: "#000102" }} />}
        style={{ position: "absolute", left: 5 - 170, top: 5, width: 258 }}
      />
    </div>
  );
}
