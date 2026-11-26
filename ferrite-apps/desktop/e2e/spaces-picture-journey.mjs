#!/usr/bin/env node
// Each Space keeps its desktop picture: chosen in System Preferences on one Space, shown there and not
// on another, in the bar too, and across a reload on either.
//
//   node e2e/spaces-picture-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spaces-picture");

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const bar = overview.getByRole("group", { name: "Spaces" });
  const shown = () =>
    page.evaluate(() => document.querySelector(".mac-desktop-shell-picture img")?.src ?? "");
  const showsMountains = async () => /mountains/.test(await shown());
  const openOverview = async () => {
    await page.keyboard.press("F3");
    await overview.waitFor({ timeout: 4_000 });
    await page.waitForTimeout(400);
  };

  const first = await shown();
  await openOverview();
  await bar.getByRole("button", { name: "Add Desktop" }).click();
  await bar.getByRole("button", { name: "Desktop 2", exact: true }).click();
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  await page.waitForTimeout(300);
  step("A new Desktop goes on showing the picture", (await shown()) === first);

  await launch(page, "System Preferences");
  const prefs = page.locator(".mac-system-preferences").first();
  await prefs.waitFor({ timeout: 10_000 });
  await prefs.getByRole("button", { name: "Desktop & Screen Saver" }).first().click();
  await prefs.getByRole("button", { name: "Mountains", exact: true }).click();
  step("Choosing a picture on Desktop 2 shows it", await until(showsMountains), await shown());
  await page.waitForTimeout(600);

  await page.keyboard.press("Control+ArrowLeft");
  step(
    "Desktop 1 keeps the picture it had",
    await until(async () => (await shown()) === first),
    await shown(),
  );
  await page.waitForTimeout(400);
  await openOverview();
  const thumbs = await bar
    .locator(".mac-desktop-shell-space-picture")
    .evaluateAll((all) => all.map((each) => each.src));
  step(
    "The bar shows each Desktop's own picture",
    thumbs.length === 2 && thumbs[0] === first && /mountains/.test(thumbs[1]),
    thumbs.join(", "),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, `spaces-picture-${browserName}.png`));
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  await page.waitForTimeout(400);

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  step(
    "After a reload on Desktop 1 its picture comes back, not the one chosen last",
    await until(async () => (await shown()) === first),
    await shown(),
  );
  await page.keyboard.press("Control+ArrowRight");
  step("and Desktop 2 still has its own", await until(showsMountains), await shown());
  await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    const spaces = json.values?.["desktop.spaces"];
    return spaces?.current === spaces?.spaces?.[1];
  });
  await reloadDesktop(page);
  step("also after a reload on Desktop 2", await until(showsMountains), await shown());

  // A picture of the person's drive is kept by its file, so it too comes back after a reload.
  await launch(page, "System Preferences");
  await prefs.waitFor({ timeout: 10_000 });
  await prefs
    .getByRole("button", { name: "Desktop & Screen Saver" })
    .first()
    .click()
    .catch(() => undefined);
  await prefs
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `space-picture-${Date.now()}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  step(
    "A picture added from the drive shows on Desktop 2",
    await until(async () => (await shown()).startsWith("blob:")),
    await shown(),
  );
  const kept = await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    const spaces = json.values?.["desktop.spaces"];
    return json.values?.["desktop.spacePictures"]?.[spaces?.current]?.file;
  });
  step("It is kept with the Space by its file", Boolean(kept), String(kept));
  await reloadDesktop(page);
  const drawn = () =>
    page.evaluate(() => {
      const image = document.querySelector(".mac-desktop-shell-picture img");
      return Boolean(image?.src.startsWith("blob:") && image.complete && image.naturalWidth > 0);
    });
  step("and comes back after a reload", await until(drawn), await shown());
  await page.keyboard.press("Control+ArrowLeft");
  await until(async () => (await shown()) === first);
  await page.waitForTimeout(400);
  await openOverview();
  const inBar = await bar
    .locator(".mac-desktop-shell-space-picture")
    .evaluateAll((all) => all.map((each) => each.src));
  step("The bar draws it from the file", inBar[1]?.startsWith("blob:"), inBar.join(", "));
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  await page.keyboard.press("Control+ArrowRight");
  step("and showing Desktop 2 again draws it", await until(drawn), await shown());

  // A new Desktop entered from Desktop 1 goes on with Desktop 1's picture, not the one chosen last.
  await page.keyboard.press("Control+ArrowLeft");
  await until(async () => (await shown()) === first);
  await page.waitForTimeout(400);
  await openOverview();
  await bar.getByRole("button", { name: "Add Desktop" }).click();
  await bar.getByRole("button", { name: "Desktop 3", exact: true }).click();
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  step("A Desktop made from Desktop 1 shows its picture", (await shown()) === first, await shown());
  await page.waitForTimeout(1_000);
  await reloadDesktop(page);
  await page.waitForTimeout(1_000);
  step(
    "and keeps it after a reload, without having been left",
    await until(async () => (await shown()) === first),
    await shown(),
  );
});
