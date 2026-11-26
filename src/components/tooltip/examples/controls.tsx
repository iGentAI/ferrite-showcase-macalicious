import { PushButton } from "macalicious/push-button";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "macalicious/tooltip";

/**
 * Help tags on real controls: `render` makes the control the trigger. Inside a provider, once
 * one tag has shown, moving to the next control shows its tag at once.
 */
export default function Controls() {
  return (
    <TooltipProvider>
      <div style={{ display: "flex", gap: "var(--mac-space-control-gap)" }}>
        <Tooltip>
          <TooltipTrigger render={<PushButton>Revert</PushButton>} />
          <TooltipPopup>Discard changes and go back to the last saved version</TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<PushButton variant="primary">Save</PushButton>} />
          <TooltipPopup>Save the document</TooltipPopup>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
