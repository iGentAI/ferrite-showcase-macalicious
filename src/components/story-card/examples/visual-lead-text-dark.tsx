import { StoryCard } from "macalicious/story-card";
import type { CSSProperties } from "react";

/* The logo of this capture's first story is 14 pt tall, and the text follows it. */
const LOGO = { "--mac-story-card-publisher-height": "14px" } as CSSProperties;

/**
 * Visual comparison target, Dark Aqua: the text under the first lead story of News, 399 x 140
 * pt from the foot of its picture: the publisher's line, a headline of three lines and the
 * story's age.
 *
 * Reference crop (2x pixels) x=785 y=1102 w=798 h=280. The page behind is News's gradient
 * there. The headline is a stand-in of as many lines, not the capture's story, and the
 * publisher's logo is not drawn: the comparisons mask the logo's line.
 */
export default function VisualLeadTextDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 399,
        height: 140,
        overflow: "hidden",
        background: "linear-gradient(#0e1823, #071624)",
      }}
    >
      <StoryCard
        publisher="Publisher"
        title="Council approves a plan to plant ten thousand trees by the river and names the first three streets for it"
        time="5m ago"
        artwork={<span />}
        style={{ ...LOGO, position: "absolute", top: -300, width: 399 }}
      />
    </div>
  );
}
