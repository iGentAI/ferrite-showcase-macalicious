import { TokenField } from "macalicious/token-field";

/**
 * Fixture for the states no reference screenshot shows (the bezel, focus on it, a selected
 * token, a window that is not key). `token-field.visual.json` puts it into each state with
 * real input and checks the pixels it expects.
 *
 * 216 x 38 pt: 8 pt of page on every side. The field's edge is x 8 to 208 and y 8 to 30; the
 * token starts 2 pt inside it and is 19 pt high (x from 10, y 9.5 to 28.5).
 */
export default function VisualStates() {
  return (
    <div style={{ padding: 8, lineHeight: 0 }}>
      <TokenField id="field" aria-label="Tags" defaultValue={["Work"]} style={{ width: 200 }} />
    </div>
  );
}
