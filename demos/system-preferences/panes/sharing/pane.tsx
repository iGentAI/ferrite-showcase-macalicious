import { definePane } from "../../pane";
import { ServedSharing } from "../../served-pages";
import { Sharing } from "./sharing";

export const pane = definePane({
  served: { component: ServedSharing, height: 240 },
  height: 530,
  component: Sharing,
  keywords: [
    "computer name",
    "file sharing",
    "screen sharing",
    "printer sharing",
    "remote login",
    "remote management",
    "shared folders",
    "internet sharing",
    "bluetooth sharing",
    "content caching",
  ],
});
