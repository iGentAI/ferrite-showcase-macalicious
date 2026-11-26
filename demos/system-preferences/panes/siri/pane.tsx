import { definePane } from "../../pane";
import { Siri } from "./siri";

export const pane = definePane({
  height: 332,
  component: Siri,
  keywords: [
    "ask siri",
    "hey siri",
    "keyboard shortcut",
    "language",
    "siri voice",
    "voice feedback",
    "suggestions",
    "menu bar",
  ],
});
