import { EmptyState } from "macalicious/empty-state";

/**
 * Visual comparison target: the placeholder capsule of Automator's empty workflow area.
 *
 * Reference crop (2x pixels) x=1150 y=780 w=690 h=90, that is 345 x 45 pt of the workflow pane
 * (#e7e9e9, #2c2d2f). The capsule runs x 1177 to 1810 and y 798 to 849: 317 x 26 pt, 13.5 pt
 * from the crop's left edge and 9 pt from its top.
 *
 * The capsule is as wide as its text. Off Apple platforms the fallback font sets the sentence
 * at a different width than San Francisco does, so the example adds letter spacing to bring
 * the capsule to the reference's width; an application sets none.
 */
export default function VisualAutomator() {
  return (
    <div
      style={{
        width: 345,
        height: 45,
        overflow: "hidden",
        background: "light-dark(#e7e9e9, #2c2d2f)",
      }}
    >
      <EmptyState
        variant="capsule"
        style={{
          padding: "0 0 1px 13.5px",
          justifyContent: "flex-start",
          whiteSpace: "nowrap",
          letterSpacing: "-0.15px",
        }}
      >
        Drag actions or files here to build your workflow.
      </EmptyState>
    </div>
  );
}
