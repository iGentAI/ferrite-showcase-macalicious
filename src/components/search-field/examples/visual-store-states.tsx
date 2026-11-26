import { SearchField } from "macalicious/search-field";

/**
 * Fixture for two states of the store field that no screenshot shows: a forced focus preview
 * (`data-force` on the input), which must be laid out as real focus is, and a placeholder too
 * long for the field, which must stay on one line inside it.
 *
 * 192 x 76 pt on the sidebar's colour. The first field is 180 x 26 pt at (6, 6); the second
 * is 80 pt wide at (6, 44), so its edge is x 6 to 86 and y 44 to 70.
 */
export default function VisualStoreStates() {
  return (
    <div
      style={{
        display: "grid",
        alignContent: "start",
        justifyItems: "start",
        gap: 12,
        boxSizing: "border-box",
        width: 192,
        height: 76,
        padding: "6px 0 0 6px",
        background: "light-dark(#e7e8e9, #2c2d2f)",
      }}
    >
      <SearchField
        variant="store"
        aria-label="Forced focus"
        data-force="focus"
        style={{ width: 180 }}
      />
      <SearchField
        variant="store"
        aria-label="Long placeholder"
        placeholder="Search the whole store for apps and stories"
        style={{ width: 80 }}
      />
    </div>
  );
}
