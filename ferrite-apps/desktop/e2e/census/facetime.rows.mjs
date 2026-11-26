// FaceTime's census rows (R6, round 3): the crawl's (facetime.crawled.mjs) with the family's shared rows and journeys
// (r6-family.mjs), tuned by id where the crawl cannot say how to reach or check a control.

import { CRAWLED } from "./facetime.crawled.mjs";
import { familyRows } from "./r6-family.mjs";

const TUNE = {
  // All is the list shown at first: Missed first, so choosing All changes what the list shows.
  "facetime.all": {
    probe: { kind: "effect", reach: [{ role: "button", name: "Missed" }] },
  },
};

export const ROWS = familyRows("facetime", CRAWLED, TUNE);
