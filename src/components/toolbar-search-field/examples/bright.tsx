import { ToolbarSearchField } from "macalicious/toolbar-search-field";

/**
 * The bright variant, as in Console's toolbar. It differs from the standard field in Dark
 * Aqua only, where its fill and its placeholder are lighter.
 */
export default function Bright() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        background: "var(--mac-material-titlebar)",
      }}
    >
      <ToolbarSearchField aria-label="Search, standard" style={{ width: 180 }} />
      <ToolbarSearchField aria-label="Search, bright" variant="bright" style={{ width: 180 }} />
    </div>
  );
}
