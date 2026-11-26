import { definePane } from "../../pane";
import { General } from "./general";

export const pane = definePane({
  height: 678,
  component: General,
  keywords: [
    "appearance",
    "dark mode",
    "light mode",
    "accent color",
    "highlight color",
    "sidebar icon size",
    "menu bar",
    "scroll bars",
    "default web browser",
    "recent items",
    "handoff",
    "font smoothing",
  ],
});
