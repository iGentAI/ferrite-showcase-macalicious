import { definePane } from "../../pane";
import { ServedEnergySaver } from "../../served-pages";
import { EnergySaver } from "./energy-saver";

export const pane = definePane({
  served: { component: ServedEnergySaver, height: 260 },
  height: 505,
  component: EnergySaver,
  keywords: [
    "battery",
    "power adapter",
    "sleep",
    "turn display off",
    "graphics switching",
    "power nap",
    "wake for wi-fi",
    "hard disks",
    "schedule",
  ],
});
