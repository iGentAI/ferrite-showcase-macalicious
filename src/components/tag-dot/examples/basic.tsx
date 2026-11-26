import { TagDot } from "macalicious/tag-dot";

const TAGS = [
  ["red", "Red"],
  ["orange", "Orange"],
  ["yellow", "Yellow"],
  ["green", "Green"],
  ["blue", "Blue"],
  ["purple", "Purple"],
  ["gray", "Gray"],
  ["none", "Work"],
  ["all", "All Tags…"],
] as const;

/** The Tags section of a Finder sidebar. The dots are decorative: each row names its tag. */
export default function Basic() {
  return (
    <ul
      style={{
        display: "grid",
        gap: 8,
        listStyle: "none",
        margin: 0,
        padding: 0,
        font: "var(--mac-font-body)",
      }}
    >
      {TAGS.map(([color, name]) => (
        <li key={color} style={{ display: "flex", alignItems: "center" }}>
          <span style={{ width: 22 }}>
            <TagDot color={color} style={{ display: "block" }} />
          </span>
          {name}
        </li>
      ))}
    </ul>
  );
}
