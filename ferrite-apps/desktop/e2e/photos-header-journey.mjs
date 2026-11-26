#!/usr/bin/env node
// Photos' header and headings on the desktop served by `ferrite dev`: the count says how many photos are
// selected, and a day's title goes on to All Photos. Exits 0 only with every step passed and no console or HTTP
// error.
//
//   node e2e/photos-header-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-header");
const tag = Date.now().toString(36);

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  const NAMES = ["One", "Two"].map((word) => `${word} ${tag}`);
  const transfer = await page.evaluateHandle(async (names) => {
    const list = new DataTransfer();
    for (const [at, name] of names.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.fillStyle = `hsl(${at * 80} 70% 50%)`;
      context.fillRect(0, 0, 480, 360);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return list;
  }, NAMES);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = (name) =>
    win
      .getByRole("option", { name, exact: true })
      .or(win.getByRole("button", { name, exact: true }))
      .first();
  await tile(NAMES[1]).waitFor({ timeout: 30_000 });

  const bar = page.getByRole("menubar").first();
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await page
    .getByRole("menuitem", { name: /^(Show )?Days$/ })
    .or(page.getByRole("menuitemradio", { name: /Days$/ }))
    .first()
    .click();
  const heading = win.locator('.mac-photos-group[data-unit="day"] .mac-photos-group-link').first();
  await heading.waitFor({ timeout: 8_000 });
  await tile(NAMES[0]).click();
  await tile(NAMES[1]).click({ modifiers: ["Meta"] });
  const count = win.locator(".mac-photos-count");
  const said = await until(async () => /^2 Photos Selected$/.test(await count.innerText()));
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photos-selected-count.png"));
  step("the header says how many photos are selected", said === true, await count.innerText());

  await heading.click();
  const all = await until(async () => (await win.locator(".mac-photos-group").count()) === 0);
  const views = win.locator(".mac-photos-views");
  const active = await views
    .getByRole("button", { name: "All Photos", pressed: true })
    .or(views.getByRole("radio", { name: "All Photos", checked: true }))
    .count();
  const both = (await tile(NAMES[0]).isVisible()) && (await tile(NAMES[1]).isVisible());
  step(
    "a day's title goes on to All Photos, with both photos in it",
    all === true && active === 1 && both,
    JSON.stringify({ active, both }),
  );
});
