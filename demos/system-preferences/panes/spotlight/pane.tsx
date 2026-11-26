import { definePane } from "../../pane";
import { Spotlight } from "./spotlight";

export const pane = definePane({
  height: 597,
  component: Spotlight,
  keywords: [
    "search results",
    "categories",
    "privacy",
    "spotlight suggestions",
    "look up",
    "keyboard shortcuts",
  ],
});
