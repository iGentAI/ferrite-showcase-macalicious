import { IconView } from "macalicious/icon-view";

// Names without ascenders, so that the top of the label's highlight is free of glyphs.
const names = ["moon", "acorn", "sun"];

// Stand-in artwork: a disc that leaves the corners of the icon box empty.
const renderIcon = () => (
  <svg viewBox="0 0 64 64" width="64" height="64" style={{ color: "#8e9aa8" }}>
    <title>Disc</title>
    <circle cx="32" cy="32" r="24" fill="currentColor" />
  </svg>
);

/**
 * Visual check target for the states no screenshot shows: three items in one row of a
 * 345 x 116 pt view, so the 103 pt cells start at 9, 121 and 233 pt. The first is selected
 * and the view does not have focus; the state checks click and focus it.
 */
export default function VisualStates() {
  return (
    <IconView
      aria-label="Items"
      count={names.length}
      renderIcon={renderIcon}
      getItemLabel={(index) => names[index] ?? ""}
      defaultValue={[0]}
      style={{ width: 345, height: 116, background: "light-dark(#ffffff, #1e2022)" }}
    />
  );
}
