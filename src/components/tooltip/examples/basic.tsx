import { Tooltip, TooltipPopup, TooltipTrigger } from "macalicious/tooltip";

export default function Basic() {
  return (
    <Tooltip>
      <TooltipTrigger
        style={{
          font: "var(--mac-font-body)",
          color: "var(--mac-color-link)",
          background: "none",
          border: 0,
          padding: 0,
        }}
      >
        Rest the pointer here
      </TooltipTrigger>
      <TooltipPopup>Shows a help tag after a moment</TooltipPopup>
    </Tooltip>
  );
}
