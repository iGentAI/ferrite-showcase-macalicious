import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";

const SIDES = ["top", "right", "bottom", "left"] as const;

/** The four preferred edges. A popover moves to the opposite side when it has no room. */
export default function Sides() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {SIDES.map((side) => (
        <Popover key={side}>
          <PopoverTrigger render={<PushButton />}>{side}</PopoverTrigger>
          <PopoverPopup side={side}>
            <PopoverTitle>On the {side}</PopoverTitle>
          </PopoverPopup>
        </Popover>
      ))}
    </div>
  );
}
