import { StoryCard } from "macalicious/story-card";

/**
 * Visual comparison target, Aqua: the text under the first lead story of News, 399 x 140 pt
 * from the foot of its picture: the publisher's line, a headline of two lines and the story's
 * age.
 *
 * Reference crop (2x pixels) x=744 y=1102 w=798 h=280. The page behind is News's gradient
 * there. The headline is a stand-in of as many lines, not the capture's story, and the
 * publisher's logo is not drawn: the comparisons mask the logo's line.
 */
export default function VisualLeadText() {
  return (
    <div
      style={{
        position: "relative",
        width: 399,
        height: 140,
        overflow: "hidden",
        background: "linear-gradient(#e9f4ff, #e2f0ff)",
      }}
    >
      <StoryCard
        publisher="Publisher"
        title="Council approves a plan to plant ten thousand trees by the river"
        time="1h ago"
        artwork={<span />}
        style={{ position: "absolute", top: -300, width: 399 }}
      />
    </div>
  );
}
