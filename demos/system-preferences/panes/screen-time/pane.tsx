import { definePane } from "../../pane";
import { ScreenTime } from "./screen-time";
import { ServedScreenTime } from "./served-screen-time";

export const pane = definePane({
  served: { component: ServedScreenTime, height: 613 },
  height: 613,
  component: ScreenTime,
  keywords: [
    "app usage",
    "notifications",
    "pickups",
    "downtime",
    "app limits",
    "always allowed",
    "content and privacy",
    "parental controls",
  ],
});
