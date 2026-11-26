import { ScrollView } from "macalicious/scroll-view";

const lines = Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`);

/** Scroll the list: the overlay scroll bar appears while it moves and fades out afterwards. */
export default function Basic() {
  return (
    <ScrollView
      role="region"
      aria-label="Lines"
      style={{
        width: 240,
        height: 160,
        background: "var(--mac-color-control-background)",
        font: "var(--mac-font-body)",
        color: "var(--mac-color-text)",
      }}
    >
      {lines.map((line) => (
        <div key={line} style={{ padding: "2px 8px" }}>
          {line}
        </div>
      ))}
    </ScrollView>
  );
}
