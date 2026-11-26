import { IconView } from "macalicious/icon-view";

const names = [
  "Budget",
  "Holiday photos",
  "Invoices",
  "Letter to the council",
  "Minutes",
  "Notes",
  "Plans",
  "Recipes",
  "Report",
  "Sketches",
];

// Stand-in artwork: a plain sheet of paper with a folded corner.
const renderIcon = () => (
  <svg viewBox="0 0 64 64" width="64" height="64" style={{ color: "#8e9aa8" }}>
    <title>Document</title>
    <path d="M14 5h26l12 12v42H14z" fill="currentColor" opacity="0.25" />
    <path d="M14 5h26l12 12v42H14zM40 5v12h12" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/** Click an icon, Shift- or Command-click more, or focus the view and use the arrow keys. */
export default function Basic() {
  return (
    <IconView
      aria-label="Documents"
      count={names.length}
      renderIcon={renderIcon}
      getItemLabel={(index) => names[index] ?? ""}
      defaultValue={[1]}
      style={{ width: 480, height: 248 }}
    />
  );
}
