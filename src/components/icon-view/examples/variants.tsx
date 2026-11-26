import { IconView, type IconViewProps } from "macalicious/icon-view";

const names = ["Budget", "Holiday photos", "Letter to the council", "Minutes", "Plans", "Report"];

const label = (index: number) => names[index] ?? "";

// Stand-in artwork: a plain sheet of paper, drawn at the size of the icon box.
const sheet = (size: number) => () => (
  <svg viewBox="0 0 64 64" width={size} height={size} style={{ color: "#8e9aa8" }}>
    <title>Document</title>
    <path d="M14 5h26l12 12v42H14z" fill="currentColor" opacity="0.25" />
    <path d="M14 5h26l12 12v42H14zM40 5v12h12" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const regular = sheet(64);
const small = sheet(32);

function View(props: Partial<IconViewProps>) {
  return (
    <IconView
      count={names.length}
      renderIcon={regular}
      getItemLabel={label}
      defaultValue={[1, 2]}
      style={{ width: 240, height: 240 }}
      {...props}
    />
  );
}

/**
 * From the left: two items selected in a view without focus (grey label highlight); the same
 * with the accent highlight the view has while focused (pinned here with `data-force`); in
 * an inactive window, where the highlight stays grey; and 32 pt icons in 84 pt rows.
 */
export default function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <View aria-label="Documents" />
      <View aria-label="Documents, focused" data-force="focus" />
      <div data-window-state="inactive">
        <View aria-label="Documents, inactive window" data-force="focus" />
      </div>
      <View aria-label="Documents, small icons" iconSize={32} renderIcon={small} />
    </div>
  );
}
