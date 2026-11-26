import { definePane } from "../../pane";
import { ServedDisplays } from "../../served-pages";
import { Displays } from "./displays";

export const pane = definePane({
  served: { component: ServedDisplays, height: 400, title: "This Screen" },
  height: 511,
  component: Displays,
  // The window is titled after the display the pane configures, as in the captures.
  title: "Built-in Retina Display",
  keywords: [
    "resolution",
    "scaled",
    "brightness",
    "true tone",
    "color profile",
    "night shift",
    "airplay",
    "mirroring",
    "retina",
    "monitor",
  ],
});
