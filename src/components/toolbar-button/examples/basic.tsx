import { SystemImage } from "macalicious/system-image";
import { ToolbarButton } from "macalicious/toolbar-button";

export default function Basic() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <ToolbarButton aria-label="Back">
        <SystemImage name="go-back" />
      </ToolbarButton>
      <ToolbarButton aria-label="Forward" disabled>
        <SystemImage name="go-forward" />
      </ToolbarButton>
      <ToolbarButton>Done</ToolbarButton>
    </div>
  );
}
