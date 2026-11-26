import { definePane } from "../../pane";
import { ServedAppleId } from "../../served-pages";
import { AppleId } from "./apple-id";

export const pane = definePane({
  served: { component: ServedAppleId, height: 300 },
  height: 598,
  component: AppleId,
  keywords: [
    "icloud",
    "icloud drive",
    "icloud storage",
    "optimize mac storage",
    "password & security",
    "payment & shipping",
    "media & purchases",
  ],
});
