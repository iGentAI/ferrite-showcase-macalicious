import { StoryCard } from "macalicious/story-card";

/**
 * Visual comparison target, Dark Aqua: the top-left corner of the first lead story's picture
 * in News, 20 x 20 pt with the corner 5 pt in and 5 pt down.
 *
 * Reference crop (2x pixels) x=775 y=492 w=40 h=40. The picture is one colour, the
 * photograph's there, on the page colour at that height. The Aqua capture's photograph is
 * too varied at every corner for one colour; its corner is compared on a thumbnail instead
 * (visual-thumbnail-corner).
 */
export default function VisualLeadCorner() {
  return (
    <div
      style={{
        position: "relative",
        width: 20,
        height: 20,
        overflow: "hidden",
        background: "#1b1d1f",
      }}
    >
      <StoryCard
        aria-label="Story"
        role="img"
        artwork={<span style={{ background: "#1b1b34" }} />}
        style={{ position: "absolute", left: 5, top: 5, width: 399 }}
      />
    </div>
  );
}
