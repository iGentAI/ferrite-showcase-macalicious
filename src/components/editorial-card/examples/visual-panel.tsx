import { EditorialCard } from "macalicious/editorial-card";

/**
 * Visual comparison target: the first editorial card of the App Store's Discover page,
 * "Act Fast!". Reference crop x=634 y=796 w=924 h=460, i.e. 462 x 230 pt: the whole card. Its
 * round illustration is Apple's artwork, so the fixture draws a flat disc and the comparison
 * masks the disc's square. The line break is the screenshot's: in San Francisco the first
 * line fills the 224 pt column, and the fallback font, which is narrower, would fit "time".
 */
export default function VisualPanel() {
  return (
    <div style={{ width: 462, height: 230, background: "light-dark(#ffffff, #1e1f22)" }}>
      <EditorialCard
        eyebrow="Collection"
        title="Act Fast!"
        artwork={<span style={{ background: "#33febf" }} />}
      >
        These games push your reaction
        <br />
        time to the limit.
      </EditorialCard>
    </div>
  );
}
