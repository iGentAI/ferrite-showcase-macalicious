import { TagDot, TagDotGroup } from "macalicious/tag-dot";

const row = { display: "flex", alignItems: "center", gap: 6 } as const;

/**
 * The small flat dot before a file name, an item with several tags, and a dot on an
 * emphasised selection (white ring).
 */
export default function InLabels() {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start", font: "var(--mac-font-body)" }}>
      <span style={row}>
        <TagDot color="green" size="small" aria-label="Green tag" />
        Documents
      </span>
      <span style={row}>
        <TagDotGroup role="img" aria-label="Tags: red, orange and blue">
          <TagDot color="red" size="small" />
          <TagDot color="orange" size="small" />
          <TagDot color="blue" size="small" />
        </TagDotGroup>
        Quarterly Report.pages
      </span>
      <span
        style={{
          ...row,
          padding: "2px 6px",
          borderRadius: 3,
          background: "var(--mac-color-selected-content-background)",
          color: "var(--mac-color-selected-content-text)",
        }}
      >
        <TagDot color="blue" emphasized aria-label="Blue tag" />
        Selected.txt
      </span>
    </div>
  );
}
