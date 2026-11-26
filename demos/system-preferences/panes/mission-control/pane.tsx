import { definePane } from "../../pane";
import { MissionControl } from "./mission-control";

export const pane = definePane({
  height: 480,
  component: MissionControl,
  keywords: [
    "spaces",
    "rearrange spaces",
    "group windows by application",
    "separate spaces",
    "keyboard and mouse shortcuts",
    "application windows",
    "show desktop",
    "hot corners",
  ],
});
