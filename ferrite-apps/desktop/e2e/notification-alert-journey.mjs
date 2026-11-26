#!/usr/bin/env node
// An alert in Notification Center's way: a FaceTime call, the one sender with an alert of two actions. It stays,
// offers them from Options, keeps them in the list, says when one failed, and goes when one works.
//
//   node e2e/notification-alert-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("notification-alert");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `nachris-${id}`, fullName: `Chris ${id}`, password };
const ada = { name: `naada-${id}`, fullName: `Ada ${id}`, password };
const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);

await run({}, {}, async ({ person }) => {
  const adaPage = await person("ada", ada);
  const chrisPage = await person("chris", chris);
  await adaPage.waitForTimeout(1_500);
  const placed = await chrisPage.evaluate(async (to) => {
    const reply = await fetch("/api/facetime/calls", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, kind: "audio", page: "journeypage0000000000" }),
    });
    return reply.status;
  }, ada.name);
  step("Chris calls Ada", placed === 201 || placed === 200, `HTTP ${placed}`);
  const alert = adaPage.locator('.mac-desktop-shell-banners [role="alert"]').filter({
    hasText: chris.fullName,
  });
  await alert.waitFor({ timeout: 15_000 });
  await adaPage.waitForTimeout(6_500);
  step("An alert stays past a banner's time", await alert.isVisible());
  await alert.getByRole("button", { name: "Options" }).click();
  const menu = adaPage.locator(".mac-menu").last();
  step(
    "With two actions it offers them from Options",
    await seen(
      async () =>
        (await menu.getByText("Decline", { exact: true }).isVisible()) &&
        (await menu.getByText("Answer", { exact: true }).isVisible()),
    ),
  );
  await shot(adaPage, "notification-alert-options");
  await adaPage.keyboard.press("Escape");

  const panel = adaPage.getByRole("complementary", { name: "Notification Center" });
  await adaPage.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  await panel.getByRole("tab", { name: "Notifications" }).click();
  const decline = panel.getByRole("button", { name: "Decline", exact: true });
  step("The list keeps the alert's action", await seen(() => decline.isVisible()));

  const declining = /\/api\/facetime\/calls\/[^/]+\/decline/;
  await adaPage.route(declining, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  allow(/500/);
  await decline.click();
  const failed = panel.locator(".mac-desktop-shell-center-failed");
  step("It says when the action failed, and stays", await seen(() => failed.isVisible()));
  await shot(adaPage, "notification-alert-failed");
  await adaPage.unroute(declining);
  const answered = adaPage.waitForResponse(declining, { timeout: 8_000 }).catch(() => null);
  await decline.click();
  const reply = await answered;
  step("Tried again, the server takes it", reply?.ok() === true, `HTTP ${reply?.status()}`);
  step("and it leaves the list", await seen(async () => (await decline.count()) === 0));
  const state = await chrisPage.evaluate(async () => {
    const reply = await fetch("/api/facetime/calls", { credentials: "same-origin" });
    return (await reply.json()).active;
  });
  step("and the caller's call has ended", state === null, JSON.stringify(state));
});
