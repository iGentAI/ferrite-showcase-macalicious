import { TextField } from "macalicious/text-field";

/**
 * A name edited in place at title size, as on a Contacts card that is being edited: the field
 * without a bezel in a larger font, over a placeholder-only field at the control size. The
 * field takes the font it is given; without a bezel it is as high as its line of text.
 */
export default function LargeText() {
  return (
    <div style={{ display: "grid", gap: 2, width: 260 }}>
      <TextField
        aria-label="Name"
        bezel="none"
        defaultValue="Stephen Hackett"
        style={{ width: "100%", font: "400 18px / 22px var(--mac-font-family-system)" }}
      />
      <TextField
        aria-label="Company"
        bezel="none"
        placeholder="Company"
        style={{ width: "100%" }}
      />
    </div>
  );
}
