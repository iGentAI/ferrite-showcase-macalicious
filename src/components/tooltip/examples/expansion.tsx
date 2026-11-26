import { TextField } from "macalicious/text-field";
import { Tooltip, TooltipPopup, TooltipTrigger } from "macalicious/tooltip";

const PATH = "/Users/stephen/Library/Application Support/Macalicious/Reference/Screenshots";

/**
 * An expansion tooltip: the full text of a field too narrow to show it, laid over the field
 * while the pointer rests on it.
 */
export default function Expansion() {
  return (
    <Tooltip kind="expansion">
      <TooltipTrigger
        render={
          <TextField aria-label="Folder" readOnly defaultValue={PATH} style={{ width: 180 }} />
        }
      />
      <TooltipPopup>{PATH}</TooltipPopup>
    </Tooltip>
  );
}
