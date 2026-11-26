#!/usr/bin/env node

// Reminders census (R6, round 3): one ok/FAIL line per census id (census/reminders.rows.mjs), real input, served.
//   node e2e/reminders-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url ...] [--phase all|write|restart-check]

import { familyCensus } from "./census/r6-family.mjs";
import { ROWS } from "./census/reminders.rows.mjs";

await familyCensus("reminders", ROWS);
