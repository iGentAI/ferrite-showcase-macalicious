import { ScrollView, type ScrollViewProps } from "macalicious/scroll-view";

const lines = Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`);

function Sample({ title, ...props }: ScrollViewProps & { title: string }) {
  return (
    <figure
      style={{ margin: 0, font: "var(--mac-font-control-small)", color: "var(--mac-color-label)" }}
    >
      <ScrollView
        role="region"
        aria-label={title}
        style={{
          width: 150,
          height: 120,
          background: "var(--mac-color-control-background)",
          font: "var(--mac-font-body)",
          color: "var(--mac-color-text)",
        }}
        {...props}
      >
        <div style={{ width: props.axis === "both" ? 300 : undefined }}>
          {lines.map((line) => (
            <div key={line} style={{ padding: "2px 8px" }}>
              {line}
            </div>
          ))}
        </div>
      </ScrollView>
      <figcaption style={{ marginTop: 4 }}>{title}</figcaption>
    </figure>
  );
}

/** The scroller styles side by side. `data-force` pins the transient overlay states. */
export default function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
      <Sample title="Overlay, scrolling" data-force="scrolling" />
      <Sample title="Overlay, pointer over it" data-force="hover" />
      <Sample title="Legacy" scrollerStyle="legacy" />
      <Sample title="Legacy, small, both axes" scrollerStyle="legacy" size="small" axis="both" />
    </div>
  );
}
