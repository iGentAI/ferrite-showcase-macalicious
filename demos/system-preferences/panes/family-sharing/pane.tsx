import { definePane } from "../../pane";
import { ServedFamilySharing } from "../../served-pages";
import { FamilySharing } from "./family-sharing";

export const pane = definePane({
  served: { component: ServedFamilySharing, height: 200 },
  height: 328,
  component: FamilySharing,
  keywords: [
    "set up family sharing",
    "share purchases",
    "apple music family subscription",
    "icloud storage plan",
    "location",
    "photo album",
    "accounts for children",
  ],
});
