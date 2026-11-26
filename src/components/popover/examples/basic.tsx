import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "macalicious/popover";
import { PushButton } from "macalicious/push-button";

export default function Basic() {
  return (
    <Popover>
      <PopoverTrigger render={<PushButton />}>Show Event</PopoverTrigger>
      <PopoverPopup side="right" style={{ width: 260 }}>
        <PopoverTitle>Make Catalina Screenshots</PopoverTitle>
        <PopoverDescription>Oct 3, 2019 2 PM to 4:45 PM</PopoverDescription>
      </PopoverPopup>
    </Popover>
  );
}
