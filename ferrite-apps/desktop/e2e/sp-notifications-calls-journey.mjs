#!/usr/bin/env node
// Do Not Disturb's two call settings against real FaceTime calls, three people in browsers of their own: Ann and Chris call
// Martin from their FaceTime windows, and what Martin's desktop shows is read from its banners. A call with Do Not Disturb off
// is remembered, so that the caller's second with it on rings through under Allow repeated calls; a caller's first with it on
// stays silent and the second rings; Allow calls from everyone lets it ring; with both off it is silent again. Exits 0 only
// when every step passed with no console error, page error, failed request or HTTP error.
//
// Stand-in: the engine's fake camera and microphone, as in facetime-journey.mjs. No call is answered: the rule is whether it rings.
//
//   node e2e/sp-notifications-calls-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { nextSave } from "./journey-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
// The live stream can take many seconds to bring a notification to a busy server's page, so a call stays up long enough to be heard.
const SILENT_MS = 20_000;
const RINGS_WITHIN_MS = 30_000;
const INBOX = "/api/notification-center/inbox";

const { step, run, shot } = twoPeople("sp-notifications-calls");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const ann = { name: `dnd-ann-${id}`, fullName: `Ann ${id}`, password };
const chris = { name: `dnd-chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `dnd-martin-${id}`, fullName: `Martin ${id}`, password };

const faceTime = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => faceTime(page).getAttribute("data-call-state");

await run(
  { chromium: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  {},
  async ({ person }) => {
    const a = await person("ann", ann);
    const c = await person("chris", chris);
    const m = await person("martin", martin);
    await openFromDock(a, "FaceTime");
    await openFromDock(c, "FaceTime");

    const prefs = m.locator('[data-window-id="system-preferences"]');
    await m
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs.getByRole("button", { name: "Notifications", exact: true }).first().click();
    await prefs.getByRole("option", { name: /^Do Not Disturb/ }).click();
    const flip = async (name) => {
      const saved = nextSave(m, SETTINGS);
      await prefs.getByRole("checkbox", { name }).click();
      await saved;
      await m.waitForTimeout(200);
    };
    const banner = (caller) =>
      m.locator(".mac-desktop-shell-banners").getByText(caller.fullName, { exact: true });

    /** One call to Martin, ended by the caller: whether it rang on his desktop, once his server has it. */
    const rang = async (page, caller, expected) => {
      const field = faceTime(page).getByRole("textbox", { name: "Recipient" });
      await field.fill(martin.name);
      await faceTime(page).getByRole("button", { name: "Audio", exact: true }).click();
      const calling = await within(10_000, async () => (await stateOf(page)) === "calling");
      if (calling === null) throw new Error(`${caller.fullName}'s call did not start`);
      const delivered = await within(20_000, async () => {
        const reply = await m.request.get(new URL(INBOX, m.url()).href);
        const items = (await reply.json()).items ?? [];
        return items.some((item) => item.app === "facetime" && item.title === caller.fullName);
      });
      if (delivered === null) throw new Error(`${caller.fullName}'s call never reached the inbox`);
      const came = await within(expected ? RINGS_WITHIN_MS : SILENT_MS, async () => {
        return (await banner(caller).count()) > 0;
      });
      await faceTime(page)
        .locator('[aria-label="Call"]')
        .getByRole("button", { name: "End" })
        .click();
      await within(15_000, async () => (await stateOf(page)) === "idle");
      await within(15_000, async () => (await banner(caller).count()) === 0);
      await m.waitForTimeout(400);
      return came !== null;
    };

    step("Do Not Disturb off: Ann's call rings", await rang(a, ann, true));

    await m.getByRole("menuitem", { name: "Notification Center" }).click();
    const center = m.locator(".mac-desktop-shell-notification-center");
    await center.waitFor({ timeout: 5_000 });
    await m.getByRole("tab", { name: "Today" }).click();
    const quiet = center.getByRole("switch", { name: "Do Not Disturb" });
    await quiet.click();
    step("Martin turns Do Not Disturb on", (await quiet.getAttribute("aria-checked")) === "true");
    await m.keyboard.press("Escape");
    await m.waitForTimeout(400);
    await flip("Allow repeated calls");

    step(
      "Allow repeated calls: Ann's second call rings, her first having come before Do Not Disturb",
      await rang(a, ann, true),
    );
    step("Chris's first call stays silent", !(await rang(c, chris, false)));
    step("Chris's second call within three minutes rings", await rang(c, chris, true));
    await shot(m, "sp-notifications-calls");

    await flip("Allow repeated calls");
    await flip("Allow calls from everyone");
    step("Allow calls from everyone: Chris's call rings", await rang(c, chris, true));

    await flip("Allow calls from everyone");
    step("with both off, Chris's call stays silent", !(await rang(c, chris, false)));
  },
);
