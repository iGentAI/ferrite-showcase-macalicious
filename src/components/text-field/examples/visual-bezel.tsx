import { TextFieldBezel } from "macalicious/text-field";
import type { CSSProperties } from "react";

const inner: CSSProperties = {
  flex: 1,
  minWidth: 0,
  alignSelf: "stretch",
  padding: 0,
  border: 0,
  background: "none",
  outline: "none",
};

/**
 * Fixture for `TextFieldBezel`, which no reference screenshot shows by itself.
 * `text-field.visual.json` focuses the content of each bezel and checks the pixels it expects.
 *
 * 316 x 36 pt, laid out as `visual-states`: the first bezel's edge is x 8 to 148, the second's
 * x 168 to 308, both y 8 to 28. The second has `focusRing={false}` and its fill set to the
 * unemphasised selection colour, which differs from the text field's fill and from the page.
 */
export default function VisualBezel() {
  return (
    <div style={{ display: "flex", gap: 20, padding: 8, lineHeight: 0 }}>
      <TextFieldBezel style={{ width: 140 }}>
        <input id="ring" aria-label="With the bezel's ring" style={inner} />
      </TextFieldBezel>
      <TextFieldBezel
        focusRing={false}
        style={
          {
            width: 140,
            "--mac-text-field-background":
              "var(--mac-color-selected-content-background-unemphasized)",
          } as CSSProperties
        }
      >
        <input id="no-ring" aria-label="Without the bezel's ring" style={inner} />
      </TextFieldBezel>
    </div>
  );
}
