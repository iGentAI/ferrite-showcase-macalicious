import { definePane } from "../../pane";
import { ServedStartupDisk } from "../../served-pages";
import { StartupDisk } from "./startup-disk";

export const pane = definePane({
  served: { component: ServedStartupDisk, height: 300 },
  height: 403,
  component: StartupDisk,
  keywords: ["start up", "boot", "restart", "target disk mode", "volume", "macintosh hd"],
});
