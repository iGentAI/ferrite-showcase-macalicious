import { Tv } from "../tv";

/**
 * Visual comparison target: the whole TV window of the captures, on Watch Now. Reference crop
 * (2x pixels) x=112 y=76 w=2588 h=1752, i.e. the 1294 x 876 pt frame, over the capture's
 * transparent margin (matte white). The comparisons move the pointer over the shelf whose
 * chevrons the capture shows: the hero in Aqua, What to Watch in Dark Aqua. Every picture is
 * a placeholder and is masked.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1294,
        height: 876,
        background: "#ffffff",
      }}
    >
      <Tv style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
