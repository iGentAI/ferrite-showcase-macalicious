import { definePane } from "../../pane";
import { ServedSoftwareUpdate } from "../../served-pages";
import { SoftwareUpdate } from "./software-update";

export const pane = definePane({
  served: { component: ServedSoftwareUpdate, height: 300 },
  height: 285,
  component: SoftwareUpdate,
  keywords: [
    "up to date",
    "last checked",
    "automatically keep my mac up to date",
    "automatic updates",
    "beta",
    "seed program",
    "macos",
  ],
});
