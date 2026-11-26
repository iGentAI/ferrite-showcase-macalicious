import { SearchField } from "macalicious/search-field";

/**
 * Visual comparison target: the search field at the top of Music's sidebar, not focused.
 *
 * Reference crop (2x pixels) x=128 y=198 w=408 h=56, that is 204 x 28 pt of sidebar (#e8e9e9,
 * #2c2d30): the field's edge runs x 133 to 530 and y 203 to 248 (199 x 23 pt), 2.5 pt from
 * the crop's left and top.
 */
export default function VisualMusic() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 204,
        height: 28,
        padding: "2.5px 0 0 2.5px",
        lineHeight: 0,
        background: "light-dark(#e8e9e9, #2c2d30)",
      }}
    >
      <SearchField variant="sidebar" style={{ width: 199 }} />
    </div>
  );
}
