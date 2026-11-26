import { EditorialCard } from "macalicious/editorial-card";

/**
 * Visual comparison target: the bottom-left corner of TV's hero, with the shadow under it.
 * Reference crop x=180 y=1596 w=48 h=48, i.e. 24 x 24 pt, with the hero's corner 6 pt in from
 * the crop's left and 14 pt down. The artwork there is near black in both captures.
 */
export default function VisualRaisedCorner() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 24,
        height: 24,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <EditorialCard
        variant="hero"
        raised
        render={<a href="#the-morning-show" />}
        aria-label="The Morning Show"
        artwork={<span style={{ background: "#0f111a" }} />}
        style={{ position: "absolute", left: 6, top: 14 - 455, width: 1214 }}
      />
    </div>
  );
}
