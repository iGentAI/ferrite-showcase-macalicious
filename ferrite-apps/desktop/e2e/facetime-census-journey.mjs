#!/usr/bin/env node
// FaceTime census (R6, round 3): one ok/FAIL line per census id (census/facetime.rows.mjs), real input, served.
//   node e2e/facetime-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url ...] [--phase all|write|restart-check]

import { ROWS } from "./census/facetime.rows.mjs";
import { familyCensus } from "./census/r6-family.mjs";

await familyCensus("facetime", ROWS);
