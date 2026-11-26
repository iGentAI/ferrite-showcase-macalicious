import { definePane } from "../../pane";
import { Notifications } from "./notifications";

export const pane = definePane({
  height: 528,
  component: Notifications,
  keywords: [
    "do not disturb",
    "notification center",
    "alerts",
    "banners",
    "badges",
    "sounds",
    "mirroring",
    "repeated calls",
    "sort order",
  ],
});
