import { ImageButton } from "macalicious/image-button";

const panes = [
  { name: "General", color: "#6aa6d8" },
  { name: "Desktop & Screen Saver", color: "#8d7fd6" },
  { name: "Dock", color: "#5f6b7a" },
  { name: "Mission Control", color: "#4f8f6b" },
];

/**
 * A row of the System Preferences grid: 82 pt from one icon to the next, labels on up to two
 * lines. The icons are stand-ins drawn for this example.
 */
export default function PaneGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 82px)", alignItems: "start" }}>
      {panes.map((pane) => (
        <ImageButton key={pane.name} label={pane.name}>
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
            <rect x="1" y="1" width="30" height="30" rx="5" fill={pane.color} />
          </svg>
        </ImageButton>
      ))}
    </div>
  );
}
