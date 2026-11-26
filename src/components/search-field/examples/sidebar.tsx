import { SearchField } from "macalicious/search-field";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * The sidebar field on a sidebar-coloured surface, in the two sizes the screenshots show:
 * regular (Music) and small (Automator's library).
 */
export default function Sidebar() {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        width: 220,
        padding: "10px 10.5px",
        background: "light-dark(#e8e9e9, #2c2d30)",
      }}
    >
      <span style={caption}>Regular</span>
      <SearchField variant="sidebar" style={{ width: "100%" }} />
      <span style={caption}>Small</span>
      <SearchField variant="sidebar" size="small" placeholder="Name" style={{ width: "100%" }} />
    </div>
  );
}
