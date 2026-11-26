import { definePane } from "../../pane";
import { LanguageAndRegion } from "./language-and-region";

export const pane = definePane({
  height: 517,
  component: LanguageAndRegion,
  keywords: [
    "preferred languages",
    "region",
    "first day of week",
    "calendar",
    "24-hour time",
    "temperature",
    "date format",
    "currency",
  ],
});
