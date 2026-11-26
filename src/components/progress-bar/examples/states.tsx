import { ProgressBar } from "macalicious/progress-bar";

const cell = { display: "grid", gap: 6 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Determinate values, the indeterminate sweep, a stopped indeterminate bar, the small size and
 * the look in a window that is not key.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 200px)", gap: "16px 28px" }}>
      <div style={cell}>
        <span style={caption}>Determinate, 8%</span>
        <ProgressBar value={8} aria-label="8 percent" />
      </div>
      <div style={cell}>
        <span style={caption}>Determinate, complete</span>
        <ProgressBar value={100} aria-label="Complete" />
      </div>
      <div style={cell}>
        <span style={caption}>Indeterminate</span>
        <ProgressBar aria-label="Working" />
      </div>
      <div style={cell}>
        <span style={caption}>Indeterminate, stopped</span>
        <ProgressBar animating={false} aria-label="Stopped" />
      </div>
      <div style={cell}>
        <span style={caption}>Small</span>
        <ProgressBar size="small" value={40} aria-label="Small, 40 percent" />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <ProgressBar value={64} aria-label="Inactive, 64 percent" />
      </div>
    </div>
  );
}
