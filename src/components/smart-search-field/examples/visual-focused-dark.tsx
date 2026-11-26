import { SmartSearchField } from "macalicious/smart-search-field";

/**
 * Visual comparison target: the empty field of the dark Favorites window while it is being
 * edited: focus ring, magnifier and placeholder at the leading edge. The comparison focuses
 * the field with a real click.
 *
 * Reference crop (2x pixels) x=846 y=82 w=1040 h=64, i.e. 520 x 32 pt, around the 507 pt fill
 * and its 3 pt ring: the fill starts 6.5 pt from the crop's left edge and 5 pt from its top.
 */
export default function VisualFocusedDark() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 520,
        height: 32,
        padding: "5px 6.5px 0",
        background: "linear-gradient(#38393b, #2e2f31)",
      }}
    >
      <SmartSearchField />
    </div>
  );
}
