import { definePane } from "../../pane";
import { Dock } from "./dock";

export const pane = definePane({
  height: 401,
  component: Dock,
  keywords: [
    "size",
    "magnification",
    "position on screen",
    "minimize windows",
    "genie",
    "tabs",
    "animate opening applications",
    "hide the dock",
    "indicators",
    "recent applications",
  ],
});
