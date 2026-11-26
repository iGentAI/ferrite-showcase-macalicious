#!/usr/bin/env node
// Screen Time on a served desktop: an app in front is counted, for the signed-in account only, and the page lists it.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/screen-time-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("screen-time");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const usageOf = (page) =>
  page.evaluate(async () => {
    const reply = await fetch("/api/system-preferences/settings");
    return (await reply.json()).values?.["screen-time.usage"] ?? null;
  });

await run({}, {}, async ({ person }) => {
  const a = await person("ana", { name: `stana-${id}`, fullName: `Ana ${id}`, password });
  const b = await person("other", { name: `stother-${id}`, fullName: `Other ${id}`, password });
  const dock = a.getByRole("toolbar", { name: "Dock" });
  await a.bringToFront();
  await dock.getByRole("button", { name: "Calculator" }).click();
  await a.locator('[data-window-id="calculator"]').waitFor();
  await a.mouse.move(400, 300);
  await a.waitForTimeout(3_500);

  await dock.getByRole("button", { name: "System Preferences" }).click();
  const prefs = a.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor();
  const counted = await within(8_000, async () => {
    const usage = await usageOf(a);
    return usage ? Object.values(usage).some((apps) => (apps.calculator ?? 0) >= 2) : false;
  });
  step(
    "Calculator's time in front is counted and saved",
    counted !== null,
    JSON.stringify(await usageOf(a)),
  );

  await prefs
    .getByRole("group", { name: "All preferences" })
    .getByRole("button", { name: "Screen Time", exact: true })
    .click();
  await prefs.getByText("Calculator:").waitFor({ timeout: 8_000 });
  const within_ = async (text) => {
    const box = await prefs.getByText(text).boundingBox();
    const frame = await prefs.boundingBox();
    return box.y + box.height <= frame.y + frame.height;
  };
  step(
    "the page lists it for today, whole in the window",
    (await within_("Calculator:")) && (await within_("Today:")),
  );
  step("and says what is counted", await prefs.getByText(/cannot see your other apps/).isVisible());
  await shot(a, "screen-time");

  step(
    "another account has none of it",
    (await usageOf(b)) === null || !JSON.stringify(await usageOf(b)).includes("calculator"),
  );
});
