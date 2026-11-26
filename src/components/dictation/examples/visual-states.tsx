import { Dictation } from "macalicious/dictation";

/**
 * Visual check target for what no screenshot shows: the panel at half level on a flat grey,
 * #808080, where the colours of the tokens can be computed (a neutral backdrop passes the
 * material's filter unchanged). The panel is at 12, 12; Done is pressed and focused with real
 * input by the comparisons.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 120,
        height: 119,
        padding: 12,
        overflow: "hidden",
        background: "#808080",
      }}
    >
      <Dictation level={0.5} />
    </div>
  );
}
