import { SearchField } from "macalicious/search-field";

/**
 * Visual comparison target: the search field at the top of the App Store's sidebar
 * (`variant="store"`), empty and without the keyboard, so its glass and placeholder are
 * centred. Reference crop (2x pixels) x=140 y=162 w=384 h=76, i.e. 192 x 38 pt on the
 * sidebar's colour, with the 180 x 26 pt field 6 pt from the left and from the top (its edge
 * is x=152..511, y=174..225).
 */
export default function VisualStore() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 192,
        height: 38,
        padding: "6px 0 0 6px",
        lineHeight: 0,
        background: "light-dark(#e7e8e9, #2c2d2f)",
      }}
    >
      <SearchField variant="store" aria-label="Search" style={{ width: 180 }} />
    </div>
  );
}
