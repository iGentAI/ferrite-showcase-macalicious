import { definePane } from "../../pane";
import { ServedBluetooth } from "../../served-pages";
import { Bluetooth } from "./bluetooth";

export const pane = definePane({
  served: { component: ServedBluetooth, height: 240 },
  height: 432,
  component: Bluetooth,
  keywords: [
    "devices",
    "turn bluetooth off",
    "discoverable",
    "pair",
    "wireless",
    "mouse",
    "menu bar",
  ],
});
