#!/usr/bin/env node

// FaceTime, Contacts, Reminders and Calendar: their dimmed commands say why (round 3, R6 bundle 03). Served `ferrite dev`,
// real input, one account made at the login window. Each dimmed command is hovered and its reason read as a person sees
// it (the tooltip the page gives):
//   - FaceTime > Video > End Call, with no call (was dimmed, no reason);
//   - Contacts: the buttons under a card's name (message, call, video, mail) that the card cannot use (dimmed, no reason);
//   - Reminders > View > Show Info, with no reminder selected (dimmed, no reason);
//   - Calendar > File > Export Event… and Save Event to Drive…, with no event selected (dimmed, no reason).
// Exits 0 only when every step passed and no page logged an error.
//
//   node e2e/pim-reasons-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]

import { menuItemReason, reasonOf } from "./r6-common.mjs";
import { account, launchEngine, openApp, options, signUp } from "./r6-kit.mjs";

const END_CALL = "There is no call to end.";
const SHOW_INFO = "Select a reminder to show its info.";
const EXPORT_EVENT = "Select an event in the calendar to export it.";
const SAVE_EVENT = "Select an event in the calendar to save it to your Drive.";
const CARD_REASONS = new Set([
  "This card has no phone number or email address to send a message to.",
  "This card has no phone number to call.",
  "This card has no phone number or email address for FaceTime.",
  "This card has no email address.",
  "Messages is not set up on this desktop.",
  "Calls are not set up on this desktop.",
  "FaceTime is not set up on this desktop.",
  "Mail is not set up on this desktop.",
]);

const o = options();
const results = [];
const errors = [];
const step = (title, ok, detail = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "ok  " : "FAIL"} ${title}${detail ? ` (${detail})` : ""}`);
};
const dimmed = async (locator) =>
  (await locator.isDisabled().catch(() => false)) ||
  (await locator.getAttribute("aria-disabled").catch(() => null)) === "true" ||
  (await locator.getAttribute("data-disabled").catch(() => null)) !== null;
const menuStep = async (page, title, trail, expected) => {
  const state = await menuItemReason(page, ...trail);
  // A step counts only on the first click on its menu title: a retried click (r6-common.mjs) fails it.
  step(
    title,
    !state.missing && state.disabled && state.reason === expected && !state.retried,
    `${state.missing ? "missing" : `disabled=${state.disabled} reason=${JSON.stringify(state.reason)}`}${state.retried ? `; the first click on ${trail[0]} opened no menu, the second did` : ""}`,
  );
};

const browser = await launchEngine(o.browserName, { headed: o.headed, media: true });
console.log(`pim-reasons in ${o.browserName} ${browser.version()} against ${o.base}`);
let at = "start";
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on(
    "console",
    (message) => message.type() === "error" && errors.push(`console: ${message.text()}`),
  );
  await page.goto(`${o.base}/`, { waitUntil: "load" });
  await signUp(page, account("pim", `${o.browserName.slice(0, 2)}${Date.now().toString(36)}`));

  at = "FaceTime";
  await openApp(page, "FaceTime", "FaceTime");
  await menuStep(
    page,
    "FaceTime's Video > End Call, with no call, is dimmed and says why",
    ["Video", "End Call"],
    END_CALL,
  );

  at = "Contacts";
  await openApp(page, "Contacts", "Contacts");
  const actions = page
    .getByRole("region", { name: "Contacts", exact: true })
    .getByRole("group", { name: "Actions", exact: true })
    .first();
  await actions.waitFor({ timeout: 15_000 });
  const found = [];
  for (const name of ["message", "call", "video", "mail"]) {
    const button = actions.getByRole("button", { name, exact: true });
    if (!(await dimmed(button))) continue;
    found.push(`${name}: ${JSON.stringify(await reasonOf(page, button))}`);
  }
  step(
    "the card's dimmed buttons under the name each say why",
    found.length > 0 && found.every((line) => CARD_REASONS.has(JSON.parse(line.split(": ")[1]))),
    found.join("; ") || "no dimmed button",
  );

  at = "Reminders";
  await openApp(page, "Reminders", "Reminders");
  await menuStep(
    page,
    "Reminders' View > Show Info, with no reminder selected, is dimmed and says why",
    ["View", "Show Info"],
    SHOW_INFO,
  );

  at = "Calendar";
  await openApp(page, "Calendar", "Calendar");
  await menuStep(
    page,
    "Calendar's File > Export Event…, with no event selected, is dimmed and says why",
    ["File", "Export Event…"],
    EXPORT_EVENT,
  );
  await menuStep(
    page,
    "Calendar's File > Save Event to Drive…, with no event selected, is dimmed and says why",
    ["File", "Save Event to Drive…"],
    SAVE_EVENT,
  );
  await context.close();
} catch (error) {
  step(`run, at ${at}`, false, String(error.message).split("\n")[0]);
} finally {
  await browser.close();
}
for (const e of errors) console.log(`FAIL ${e}`);
const passed = results.filter(Boolean).length;
console.log(
  `pim-reasons ${o.browserName}: ${passed}/${results.length} steps passed, ${errors.length} page errors`,
);
process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
