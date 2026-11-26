import { definePane } from "../../pane";
import { Mouse } from "./mouse";

export const pane = definePane({
  height: 512,
  component: Mouse,
  keywords: [
    "scroll direction",
    "natural",
    "secondary click",
    "right click",
    "smart zoom",
    "tracking speed",
    "battery",
    "bluetooth mouse",
    "gestures",
  ],
});
