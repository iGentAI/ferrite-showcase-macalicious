import { Label } from "macalicious/label";
import { TextFieldBezel } from "macalicious/text-field";
import type { CSSProperties } from "react";

const part: CSSProperties = {
  width: "3ch",
  padding: 0,
  border: 0,
  background: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "center",
  outline: "none",
};

/**
 * `TextFieldBezel` around content of its own: the four parts of an address, each a small
 * input, in one bezel with one focus ring. The second bezel takes another fill through
 * `--mac-text-field-background` and leaves the focus ring to its content.
 */
export default function BezelOnly() {
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Label id="text-field-bezel-address">Address:</Label>
      <TextFieldBezel
        role="group"
        aria-labelledby="text-field-bezel-address"
        style={{ width: "auto", padding: "0 3.5px" }}
      >
        {["192", "168", "1", "20"].map((value, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: four fixed parts
          <span key={index}>
            {index > 0 && "."}
            <input
              aria-label={`Part ${index + 1}`}
              inputMode="numeric"
              maxLength={3}
              defaultValue={value}
              style={part}
            />
          </span>
        ))}
      </TextFieldBezel>
      <TextFieldBezel
        focusRing={false}
        style={
          {
            width: 120,
            padding: "0 3.5px",
            "--mac-text-field-background": "var(--mac-color-window-background)",
          } as CSSProperties
        }
      >
        Read-only value
      </TextFieldBezel>
    </div>
  );
}
