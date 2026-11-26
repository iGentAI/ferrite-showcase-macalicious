#!/usr/bin/env node
// FaceTime's call controls on Ferrite in a real browser against the running app: Mute and Pause Video
// in the call and in the Video menu, with Shift-Command-M. Chromium's fake camera and microphone stand
// in for real devices; what is checked is whether the tracks this browser sends carry anything. Exits
// 0 only when every step passed and no page logged a console error, a page error, a failed request
// or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/facetime-controls-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-controls");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fcchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fcmartin-${id}`, fullName: `Martin ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");
const tracks = (page, kind) =>
  page.evaluate((wanted) => {
    const stream = document.querySelector("video[data-self]")?.srcObject;
    const list = wanted === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();
    return (list ?? []).map((track) => track.enabled);
  }, kind);

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
  async ({ person }) => {
    const martinPage = await person("martin", martin);
    const page = await person("chris", chris);
    await openFromDock(martinPage, "FaceTime");
    await openFromDock(page, "FaceTime");
    await page.waitForTimeout(1_000);

    await windowOf(page).getByRole("textbox", { name: "Recipient" }).fill(martin.name);
    await windowOf(page).getByRole("button", { name: "Video", exact: true }).click();
    const incoming = windowOf(martinPage).locator('[aria-label="Incoming call"]');
    await within(15_000, () => incoming.isVisible());
    await incoming.getByRole("button", { name: "Accept" }).click();
    const on = await within(30_000, async () => (await stateOf(page)) === "connected");
    step("the call connects", on !== null);

    const hud = windowOf(page).locator('[aria-label="Call"]');
    // At least one track of the kind, and every one of them as wanted.
    const all = async (kind, wanted) => {
      const list = await tracks(page, kind);
      return list.length > 0 && list.every((on) => on === wanted);
    };
    const timed = await within(5_000, async () => /\d:\d\d/.test(await hud.innerText()));
    step("the call shows its running time", timed !== null, await hud.innerText());
    const clipped = await hud
      .locator(".mac-facetime-hud-line")
      .evaluateAll((lines) => lines.some((line) => line.scrollWidth > line.clientWidth));
    step("the name and the time are not cut off beside the controls", !clipped);

    await hud.getByRole("button", { name: "Mute" }).click();
    const silent = await within(3_000, () => all("audio", false));
    step("Mute silences the microphone's track", silent !== null);
    await shot(page, "facetime-controls");
    await page.keyboard.press("Control+Shift+M");
    const heard = await within(3_000, () => all("audio", true));
    step("Shift-Command-M turns it back on", heard !== null);

    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Video", exact: true })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Pause Video" }).click();
    const dark = await within(3_000, () => all("video", false));
    step("Video > Pause Video stops the camera's track", dark !== null);
    await hud.getByRole("button", { name: "Resume" }).click();

    await hud.getByRole("button", { name: "Mute" }).click();
    await hud.getByRole("button", { name: "End" }).click();
    const over = await within(10_000, async () => (await stateOf(page)) === "idle");
    step("End ends the call", over !== null);
    const reset = await within(3_000, () => all("audio", true));
    step("the next call starts unmuted", reset !== null);
  },
);
