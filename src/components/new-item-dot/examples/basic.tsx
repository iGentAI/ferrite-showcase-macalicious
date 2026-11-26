import { NewItemDot } from "macalicious/new-item-dot";

const row = { display: "flex", alignItems: "center", gap: 8 } as const;
const hidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const;

/**
 * A list in which one item is new. The dot is decorative; the row says "new" in text that
 * only assistive technology reads. A row that is not new keeps the dot's space with
 * `visible={false}`, so the names stay aligned.
 */
export default function Basic() {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, font: "var(--mac-font-body)" }}>
      <li style={row}>
        <NewItemDot />
        Quick Look Preview
        <span style={hidden}>, new</span>
      </li>
      <li style={row}>
        <NewItemDot visible={false} />
        Share Menu
      </li>
      <li style={row}>
        <NewItemDot visible={false} />
        Finder Extensions
      </li>
    </ul>
  );
}
