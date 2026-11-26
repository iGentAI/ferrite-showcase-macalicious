import { EditorialCard } from "macalicious/editorial-card";

const sky = (
  <span
    style={{
      background: "linear-gradient(#d9e8f2 30%, #6f8f8a 70%, #5d7b7a)",
    }}
  />
);

const stage = (
  <span
    style={{
      background: "linear-gradient(160deg, #1b2a55, #0f111a 60%, #3b4a7a)",
    }}
  />
);

/**
 * The two heroes: the App Store's flat banner with its text over the picture, and TV's, which
 * is raised and whose artwork carries its own title. The artwork is drawn here.
 */
export default function Hero() {
  return (
    <div style={{ display: "grid", gap: 20, width: 560, maxWidth: "100%" }}>
      <EditorialCard
        variant="hero"
        eyebrow="Get Started"
        title="Extensions for Fast Photo Edits"
        artwork={sky}
        render={<a href="#extensions" />}
      />
      <EditorialCard
        variant="hero"
        raised
        artwork={stage}
        render={<a href="#the-show" />}
        aria-label="The show"
      />
    </div>
  );
}
