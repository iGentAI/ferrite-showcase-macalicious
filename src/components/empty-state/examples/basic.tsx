import { EmptyState } from "macalicious/empty-state";

export default function Basic() {
  return (
    <div style={{ width: 320, height: 120, background: "var(--mac-color-control-background)" }}>
      <EmptyState>No Selection</EmptyState>
    </div>
  );
}
