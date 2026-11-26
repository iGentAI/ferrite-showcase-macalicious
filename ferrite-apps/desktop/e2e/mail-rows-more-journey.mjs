#!/usr/bin/env node
// The rest of Mail's menu rows, split from mail-rows-journey so each finishes inside a runner's time limit:
// Message from Send Again on (priority, Move to, Move Again, Copy to, Delete, Apply Rules) and the Window menu.
//
//   node e2e/mail-rows-more-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

process.env.ONLY = "message-more,window";
await import("./mail-rows-journey.mjs");
