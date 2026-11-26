import { PageControl } from "macalicious/page-control";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * The pager's states. On its first page the previous arrow is disabled, on its last the next
 * one. In a window that is not key the current dot loses its colour.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 32px" }}
    >
      <div style={cell}>
        <span style={caption}>First page</span>
        <PageControl count={3} page={0} aria-label="First page example" />
      </div>
      <div style={cell}>
        <span style={caption}>Last page</span>
        <PageControl count={3} page={2} aria-label="Last page example" />
      </div>
      <div style={cell}>
        <span style={caption}>Without arrows</span>
        <PageControl count={5} page={2} arrows={false} aria-label="Example without arrows" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <PageControl count={3} page={1} disabled aria-label="Disabled example" />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <PageControl count={3} page={1} aria-label="Main window example" />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <PageControl count={3} page={1} aria-label="Inactive window example" />
      </div>
    </div>
  );
}
