import { ColorWell } from "macalicious/color-well";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** The two bezel styles at their own sizes, and a standard well stretched with CSS. */
export default function Variants() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
        <ColorWell aria-label="Fill colour" defaultValue="#34c759" />
        <span style={caption}>standard, 44 x 23</span>
      </div>
      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
        <div style={{ display: "flex", gap: 3 }}>
          <ColorWell variant="toolbar" aria-label="Text colour" defaultValue="#000000" />
          <ColorWell variant="toolbar" aria-label="Highlight colour" defaultValue="#ffd60a" />
        </div>
        <span style={caption}>toolbar, 22 x 16, 3 pt apart</span>
      </div>
      <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
        <ColorWell
          aria-label="Background colour"
          defaultValue="#5e5ce6"
          style={{ width: 67, height: 30 }}
        />
        <span style={caption}>standard, 67 x 30</span>
      </div>
    </div>
  );
}
