import { SearchField } from "macalicious/search-field";

/**
 * The store field on a sidebar-coloured surface: empty, where its glass and placeholder are
 * centred, and holding text.
 */
export default function Store() {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        width: 220,
        padding: 20,
        background: "light-dark(#e7e8e9, #2c2d2f)",
      }}
    >
      <SearchField variant="store" style={{ width: "100%" }} />
      <SearchField
        variant="store"
        aria-label="Search with text"
        defaultValue="Pixelmator"
        style={{ width: "100%" }}
      />
    </div>
  );
}
