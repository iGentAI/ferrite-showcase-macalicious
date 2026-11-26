import { ProgressSpinner } from "macalicious/progress-spinner";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** The three control sizes, a stopped spinner and the determinate form. */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, max-content)",
        gap: "16px 28px",
        alignItems: "end",
      }}
    >
      <div style={cell}>
        <span style={caption}>Regular</span>
        <ProgressSpinner aria-label="Regular spinner" />
      </div>
      <div style={cell}>
        <span style={caption}>Small</span>
        <ProgressSpinner size="small" aria-label="Small spinner" />
      </div>
      <div style={cell}>
        <span style={caption}>Mini</span>
        <ProgressSpinner size="mini" aria-label="Mini spinner" />
      </div>
      <div style={cell}>
        <span style={caption}>Stopped, displayed</span>
        <ProgressSpinner
          size="small"
          animating={false}
          displayedWhenStopped
          aria-label="Stopped spinner"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Determinate, 30%</span>
        <ProgressSpinner size="small" value={30} aria-label="30 percent" />
      </div>
      <div style={cell}>
        <span style={caption}>Determinate, 75%</span>
        <ProgressSpinner value={75} aria-label="75 percent" />
      </div>
    </div>
  );
}
