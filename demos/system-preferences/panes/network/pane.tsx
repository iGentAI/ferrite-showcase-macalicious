import { definePane } from "../../pane";
import { ServedNetwork } from "../../served-pages";
import { Network } from "./network";

export const pane = definePane({
  served: { component: ServedNetwork, height: 300 },
  height: 563,
  component: Network,
  keywords: [
    "wi-fi",
    "wifi",
    "ethernet",
    "bluetooth pan",
    "thunderbolt bridge",
    "ip address",
    "location",
    "personal hotspot",
    "join networks",
    "services",
  ],
});
