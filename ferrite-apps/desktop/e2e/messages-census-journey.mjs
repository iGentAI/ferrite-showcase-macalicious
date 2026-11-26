#!/usr/bin/env node
// Messages census (R6, round 3): one ok/FAIL line per census id (census/messages.rows.mjs), real input, served.
//   node e2e/messages-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url ...] [--phase all|write|restart-check]

import { ROWS } from "./census/messages.rows.mjs";
import { familyCensus } from "./census/r6-family.mjs";

await familyCensus("messages", ROWS);
