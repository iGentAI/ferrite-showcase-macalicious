import { StoryCard } from "macalicious/story-card";

/**
 * Fixture for what no screenshot shows on a flat picture: a lead video story that is a button,
 * 200 pt wide, 10 pt from the top left of a 220 x 310 pt box, and 30 pt under it a secondary
 * story 200 pt wide. The pictures are one colour: the lead's is 200 x 150.4 pt with the play
 * badge at its middle (110, 85), the secondary's thumbnail spans x 122 to 210 from y 203.4.
 */
export default function VisualStates() {
  const picture = <span style={{ background: "#00ff00" }} />;
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "grid",
        alignContent: "start",
        gap: 30,
        width: 220,
        height: 310,
        padding: 10,
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <StoryCard
        id="card"
        render={<button type="button" />}
        aria-label="Open"
        video
        artwork={picture}
      />
      <StoryCard variant="secondary" title="Story" artwork={picture} />
    </div>
  );
}
