#!/usr/bin/env node
// FaceTime's two recorded defects on Ferrite in a real browser against the running app: a placing
// that never reached the server stops saying it is looking for the call, and End on Join Here, in a
// second tab of the person in the call, ends the call for everyone. Chromium's fake camera and
// microphone stand in for real devices. Exits 0 only when every step passed; the failed requests
// this journey causes on purpose are allowed.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/facetime-ledger-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("facetime-ledger");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `flchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `flmartin-${id}`, fullName: `Martin ${id}`, password };

allow(/request failed: .*\/api\/facetime\/calls/);
allow(/console: Failed to load resource/);

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
  },
  {},
  async ({ person, base }) => {
    const martinPage = await person("martin", martin);
    const page = await person("chris", chris);
    await openFromDock(martinPage, "FaceTime");
    await openFromDock(page, "FaceTime");
    await page.waitForTimeout(1_000);

    // A placing whose every request fails.
    const placing = /\/api\/facetime\/calls(\?|$)/;
    const refuse = (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue();
    await page.route(placing, refuse);
    const field = windowOf(page).getByRole("textbox", { name: "Recipient" });
    await field.fill(martin.name);
    await windowOf(page).getByRole("button", { name: "Video", exact: true }).click();
    const text = () => windowOf(page).innerText();
    const looking = await within(90_000, async () =>
      (await text()).includes("Looking for the call"),
    );
    step("a placing that gets no answer says it is looking for the call", looking !== null);
    await page.unroute(placing, refuse);
    const said = await within(60_000, async () => !(await text()).includes("Looking for the call"));
    step("it stops looking when no call turns up", said !== null);
    await shot(page, "facetime-not-placed");
    step("the window is not left calling", (await stateOf(page)) === "idle", await stateOf(page));

    // The call, then End on Join Here in a second tab of Chris's.
    await field.fill(martin.name);
    await windowOf(page).getByRole("button", { name: "Video", exact: true }).click();
    const incoming = windowOf(martinPage).locator('[aria-label="Incoming call"]');
    await within(15_000, () => incoming.isVisible());
    await incoming.getByRole("button", { name: "Accept" }).click();
    const connected = await within(
      30_000,
      async () =>
        (await stateOf(martinPage)) !== "ringing" && (await stateOf(page)) === "connected",
    );
    step("the call connects", connected !== null);

    const second = await page.context().newPage();
    await second.goto(`${base}/`, { waitUntil: "load" });
    await second
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await openFromDock(second, "FaceTime");
    const panel = windowOf(second).locator('[aria-label="Incoming call"]');
    const offered = await within(20_000, () => panel.isVisible());
    step("a second tab offers to join the call", offered !== null);
    await shot(second, "facetime-join-here");
    await panel.getByRole("button", { name: "End" }).click();
    const ended = await within(
      20_000,
      async () => (await stateOf(page)) === "idle" && (await stateOf(martinPage)) === "idle",
    );
    step(
      "End there ends the call for both people",
      ended !== null,
      `${await stateOf(page)} / ${await stateOf(martinPage)}`,
    );
    await page.waitForTimeout(6_000);
    step("the first tab does not go back into it", (await stateOf(page)) === "idle");
    step("the panel has gone", !(await panel.isVisible()));
  },
);
