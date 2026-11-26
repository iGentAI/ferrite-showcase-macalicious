#!/usr/bin/env node
// A reload right after changing Space comes back on that Space, however many saves were still under way.
//
//   node e2e/spaces-reload-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { api, journey, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("spaces-reload");
const SETTINGS = "/api/system-preferences/settings";

await run(async (page) => {
  await openDesktop(page, base, step);
  const stored = async () => (await api(page, "GET", SETTINGS)).json?.values?.["desktop.spaces"];
  const until = async (check, ms = 10_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await page.waitForTimeout(150);
    }
  };
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  const add = overview.getByRole("button", { name: "Add Desktop" });
  await add.click();
  await add.click();
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  const made = await until(async () => {
    const now = await stored();
    return now?.spaces?.length === 3 ? now : null;
  });
  step("There are three Desktops", made?.spaces?.length === 3, JSON.stringify(made?.spaces));
  const [first, second, third] = made.spaces;
  // The Space the desktop shows, from Mission Control's bar.
  const showing = async () => {
    await page.keyboard.press("F3");
    await overview.waitFor({ timeout: 4_000 });
    const name = await overview
      .getByRole("group", { name: "Spaces" })
      .locator('[aria-current="true"]')
      .innerText();
    await page.keyboard.press("Escape");
    await overview.waitFor({ state: "detached", timeout: 4_000 });
    return name.trim();
  };

  await page.keyboard.press("Control+Alt+Digit1");
  await until(async () => (await stored())?.current === first);

  for (let round = 1; round <= 3; round += 1) {
    await page.keyboard.press("Control+ArrowRight");
    await page.keyboard.press("Control+ArrowRight");
    await reloadDesktop(page);
    const there = await stored();
    step(
      `Round ${round}: two steps along and a reload at once come back on the third`,
      there?.current === third && (await showing()) === "Desktop 3",
      JSON.stringify(there?.current),
    );
    await page.keyboard.press("Control+ArrowLeft");
    await reloadDesktop(page);
    const back = await stored();
    step(
      `Round ${round}: one step back and a reload at once come back on the second`,
      back?.current === second && (await showing()) === "Desktop 2",
      JSON.stringify(back?.current),
    );
    await page.keyboard.press("Control+ArrowLeft");
    await until(async () => (await stored())?.current === first);
    step(`Round ${round}: back at the first`, (await stored())?.current === first);
  }

  // Leaving the page altogether and coming back in the same tab.
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Control+ArrowRight");
  await page.goto("about:blank");
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 20_000 });
  step(
    "Leaving the desktop at once and coming back keeps the Space too",
    (await until(async () => (await stored())?.current === third)) &&
      (await showing()) === "Desktop 3",
  );
});
