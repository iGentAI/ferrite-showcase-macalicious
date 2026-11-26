import { definePane } from "../../pane";
import { DateAndTime } from "./date-and-time";
import { ServedDateAndTime } from "./served-date-and-time";

export const pane = definePane({
  served: { component: ServedDateAndTime, height: 564 },
  height: 528,
  component: DateAndTime,
  keywords: [
    "date",
    "time",
    "clock",
    "calendar",
    "time zone",
    "time server",
    "set automatically",
    "24-hour",
    "menu bar clock",
  ],
});
