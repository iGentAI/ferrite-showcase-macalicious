import { definePane } from "../../pane";
import { Keyboard } from "./keyboard";

export const pane = definePane({
  height: 581,
  component: Keyboard,
  keywords: [
    "key repeat",
    "delay until repeat",
    "keyboard brightness",
    "backlight",
    "touch bar",
    "control strip",
    "fn key",
    "modifier keys",
    "shortcuts",
    "input sources",
    "dictation",
    "bluetooth keyboard",
  ],
});
