#!/usr/bin/env node
// FaceTime's window commands, in a real browser against the running app: Video > Use Portrait and its key turn
// the frame and are kept across a reload; Window > Always on Top holds the window over another application's;
// Video > Enter Picture in Picture floats the other person's picture in a call, and is dimmed with no call.
// Fake cameras and microphones stand in for real devices. Exits 0 only when every step passed and no
// page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/facetime-window-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output] [--browser ...]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-window");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fwchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fwmartin-${id}`, fullName: `Martin ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");
const seen = (check) => within(8_000, check).then((took) => took !== null);
const box = (page) => windowOf(page).boundingBox();
const openMenu = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).first().click();
const row = (page, name) => page.getByRole("menu").last().getByRole("menuitem", { name });
const tall = async (page) => {
  const frame = await box(page);
  return frame.height > frame.width;
};
const open = async (page) => {
  await openFromDock(page, "FaceTime").catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(1_000);
};
const frameZ = (page, locator) =>
  locator.evaluate((el) => Number(getComputedStyle(el.closest(".mac-managed-window")).zIndex) || 0);

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
    firefox: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
        "media.peerconnection.ice.obfuscate_host_addresses": false,
        "media.peerconnection.ice.link_local": true,
      },
    },
  },
  { webkit: { permissions: ["camera", "microphone"] } },
  async ({ person }) => {
    const martinPage = await person("martin", martin);
    const page = await person("chris", chris);
    await open(martinPage);
    await open(page);

    await openMenu(page, "Video");
    step(
      "Picture in Picture is dimmed with no call",
      await row(page, "Enter Picture in Picture").isDisabled(),
    );
    await page.keyboard.press("Escape");

    step("the window opens wider than tall", !(await tall(page)));
    await openMenu(page, "Video");
    await row(page, "Use Portrait").click();
    step("Video > Use Portrait stands the window upright", await seen(() => tall(page)));
    await shot(page, "facetime-portrait");
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: "load" });
    await open(page);
    step("after a reload it is still upright", await seen(() => tall(page)));
    await page.keyboard.press("Control+r");
    step("its key lays the window down again", await seen(async () => !(await tall(page))));
    await page.waitForTimeout(500);

    await openMenu(page, "Window");
    await page
      .getByRole("menu")
      .last()
      .getByRole("menuitemcheckbox", { name: "Always on Top" })
      .click();
    await openFromDock(page, "Calculator").catch(() => {});
    const calculator = page.getByRole("region", { name: "Calculator" }).first();
    await within(10_000, () => calculator.isVisible());
    step(
      "Window > Always on Top holds it over another application in front",
      await seen(
        async () => (await frameZ(page, windowOf(page))) > (await frameZ(page, calculator)),
      ),
    );
    await shot(page, "facetime-on-top");
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: "load" });
    await open(page);
    await windowOf(page).getByRole("textbox", { name: "Recipient" }).click();
    await openMenu(page, "Window");
    step(
      "after a reload the menu shows it checked",
      (await page
        .getByRole("menu")
        .last()
        .getByRole("menuitemcheckbox", { name: "Always on Top" })
        .getAttribute("aria-checked")) === "true",
    );
    await page.keyboard.press("Escape");

    await windowOf(page).getByRole("textbox", { name: "Recipient" }).fill(martin.name);
    await windowOf(page).getByRole("button", { name: "Video", exact: true }).click();
    const incoming = windowOf(martinPage).locator('[aria-label="Incoming call"]');
    await within(15_000, () => incoming.isVisible());
    await incoming.getByRole("button", { name: "Accept" }).click();
    step(
      "the call connects",
      (await within(30_000, async () => (await stateOf(page)) === "connected")) !== null,
    );
    await page.waitForTimeout(500);
    const offered = await page.evaluate(() => document.pictureInPictureEnabled);
    await openMenu(page, "Video");
    if (offered) {
      await row(page, "Enter Picture in Picture").click();
      step(
        "Enter Picture in Picture floats the other person's picture",
        await seen(() =>
          page.evaluate(
            () => document.pictureInPictureElement?.hasAttribute("data-remote") === true,
          ),
        ),
      );
      await openMenu(page, "Video");
      await row(page, "Exit Picture in Picture").click();
      step(
        "Exit brings it back",
        await seen(() => page.evaluate(() => document.pictureInPictureElement === null)),
      );
      await openMenu(page, "Video");
      await row(page, "Enter Picture in Picture").click();
      await seen(() => page.evaluate(() => document.pictureInPictureElement !== null));
    } else {
      step(
        "where the browser offers none it stays dimmed and says why",
        (await row(page, "Enter Picture in Picture").getAttribute("title"))?.includes("browser") ===
          true,
      );
      await page.keyboard.press("Escape");
    }
    console.log(`picture in picture offered: ${offered}`);
    await windowOf(page)
      .locator('[aria-label="Call"]')
      .getByRole("button", { name: /End/ })
      .click();
    step(
      "ending the call takes the floating picture with it",
      await seen(() => page.evaluate(() => !document.pictureInPictureElement)),
    );
    await openMenu(page, "Video");
    step(
      "and the item reads Enter again",
      await seen(() => row(page, "Enter Picture in Picture").isVisible()),
    );
    await page.keyboard.press("Escape");
  },
);
