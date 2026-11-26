import { StoryCard } from "macalicious/story-card";

/** A lead story. The picture is a gradient drawn here: the library ships no artwork. */
export default function Basic() {
  return (
    <StoryCard
      publisher="The Daily Example"
      title="City council approves a plan to plant ten thousand trees along the river"
      time="1h ago"
      artwork={
        <span
          style={{
            background:
              "linear-gradient(160deg, var(--mac-color-system-green), var(--mac-color-system-teal))",
          }}
        />
      }
      style={{ width: 399, maxWidth: "100%" }}
    />
  );
}
