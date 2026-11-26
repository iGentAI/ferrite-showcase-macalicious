import { EmptyState } from "macalicious/empty-state";

/** The capsule of Automator's empty workflow area, on the pane's own grey. */
export default function Capsule() {
  return (
    <div style={{ width: 400, height: 120, background: "light-dark(#e7e9e9, #2c2d2f)" }}>
      <EmptyState variant="capsule">Drag actions or files here to build your workflow.</EmptyState>
    </div>
  );
}
