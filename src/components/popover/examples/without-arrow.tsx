import { Checkbox } from "macalicious/checkbox";
import { Popover, PopoverClose, PopoverPopup, PopoverTrigger } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";

/** A popover without an arrow, holding controls: it sits 4 pt from its button. */
export default function WithoutArrow() {
  return (
    <Popover>
      <PopoverTrigger render={<PushButton />}>View Options</PopoverTrigger>
      <PopoverPopup arrow={false} align="start" aria-label="View options">
        <div style={{ display: "grid", gap: 6 }}>
          <Checkbox defaultChecked>Show icon preview</Checkbox>
          <Checkbox>Show item info</Checkbox>
          <PopoverClose render={<PushButton />} style={{ justifySelf: "end", marginTop: 6 }}>
            Done
          </PopoverClose>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
