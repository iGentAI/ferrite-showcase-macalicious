#!/usr/bin/env node
// Calendar census (R6, round 3): one ok/FAIL line per census id (census/calendar.rows.mjs), real input, served.
//   node e2e/calendar-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url ...] [--phase all|write|restart-check]

import { ROWS } from "./census/calendar.rows.mjs";
import { familyCensus } from "./census/r6-family.mjs";

await familyCensus("calendar", ROWS);
