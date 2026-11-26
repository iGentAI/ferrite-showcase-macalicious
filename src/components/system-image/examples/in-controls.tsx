import { GradientButton } from "macalicious/gradient-button";
import { SystemImage } from "macalicious/system-image";
import { ToolbarButton } from "macalicious/toolbar-button";

/** In controls: the image takes the control's text colour, also when it is disabled. */
export default function InControls() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <ToolbarButton aria-label="Back">
        <SystemImage name="go-back" />
      </ToolbarButton>
      <ToolbarButton aria-label="Forward" disabled>
        <SystemImage name="go-forward" />
      </ToolbarButton>
      <ToolbarButton aria-label="Share">
        <SystemImage name="share" />
      </ToolbarButton>
      <GradientButton aria-label="Add">
        <SystemImage name="add" />
      </GradientButton>
      <SystemImage name="info" scale={2} aria-label="Information" />
    </div>
  );
}
