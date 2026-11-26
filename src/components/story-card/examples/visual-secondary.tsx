import { StoryCard } from "macalicious/story-card";

/**
 * Visual comparison target: the first secondary story of News, 279 x 112 pt with the 21 pt beside it and the 20 pt under it: the publisher's
 * line, a headline of three lines, the story's age and the 88 pt thumbnail.
 *
 * Reference crops (2x pixels): Aqua x=744 y=1415 w=558 h=224, Dark Aqua x=785 y=1410 w=558
 * h=224. The page behind is News's gradient there. The headline is a stand-in of as many
 * lines; the publisher's logo and the photograph are not drawn and are masked.
 */
export default function VisualSecondary() {
  return (
    <div
      style={{
        width: 279,
        height: 112,
        overflow: "hidden",
        background: "linear-gradient(light-dark(#e2f0ff, #061624), light-dark(#dcecff, #021426))",
      }}
    >
      <StoryCard
        variant="secondary"
        publisher="Publisher"
        title="Ferry service is back at the old pier this spring"
        time="1h ago"
        artwork={<span />}
        style={{ width: 258 }}
      />
    </div>
  );
}
