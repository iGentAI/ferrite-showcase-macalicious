#!/usr/bin/env node
// Photos' View > Customize Toolbar on the desktop served by `ferrite dev`: the toolbar's own menu opens the sheet too; an
// item added shows at once and works; a removed one goes; the choice survives a reload; Use Default Set restores it.
// Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-toolbar-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-toolbar");

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  page.on("console", (message) => {
    if (message.text().startsWith("Photos could not")) console.log(`note ${message.text()}`);
  });
  const library = async () => (await api(page, "GET", "/api/photos/library")).json;
  const photosWindow = () => page.locator(".mac-window:has(.mac-photos-body)").first();
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  await photosWindow().waitFor({ timeout: 30_000 });
  const win = photosWindow();
  const tool = (name) => win.getByRole("toolbar").getByRole("button", { name, exact: true });
  await tool("Rotate").waitFor({ timeout: 15_000 });
  step("Slideshow is not in the toolbar at first", (await tool("Slideshow").count()) === 0);

  // The row dims until the library has answered, as its answer brings the choice kept before.
  const customize = page.getByRole("menuitem", { name: "Customize Toolbar…" });
  const readied = await until(async () => {
    await page.getByRole("menuitem", { name: "View", exact: true }).click();
    const enabled = (await customize.getAttribute("aria-disabled")) !== "true";
    if (!enabled) await page.keyboard.press("Escape");
    return enabled;
  }, 30_000);
  step("Customize Toolbar… is ready once the library has answered", readied);
  await customize.click();
  const add = page.getByRole("group", { name: "Items" });
  await add.waitFor({ timeout: 5_000 });
  step("View > Customize Toolbar… opens the sheet", true);
  step(
    "an item in the toolbar is dimmed in the palette",
    await add.getByRole("button", { name: "Rotate" }).isDisabled(),
  );
  await add.getByRole("button", { name: "Slideshow" }).click();
  step("clicking an item adds it at once", (await tool("Slideshow").count()) === 1);
  await page.getByRole("button", { name: "Remove Rotate" }).click();
  step("Remove takes one out at once", (await tool("Rotate").count()) === 0);

  const now = page.getByRole("list", { name: "In the toolbar" });
  const order = () =>
    now
      .getByRole("button", { name: /^Move / })
      .evaluateAll((all) => all.map((each) => each.textContent));
  await now.getByRole("button", { name: "Move Slideshow", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  const moved = await order();
  step(
    "the left arrow moves it ahead of the item before it",
    moved.indexOf("Slideshow") === moved.indexOf("Favorite") - 1,
    moved.join(),
  );
  await now
    .locator("li", { hasText: "Slideshow" })
    .dragTo(now.locator("li", { hasText: "Import" }));
  const dragged = await order();
  step(
    "dragging it puts it where it was dropped",
    dragged.indexOf("Slideshow") < dragged.indexOf("Import"),
    dragged.join(),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-toolbar-customize.png"));
  await page.getByRole("button", { name: "Done", exact: true }).click();

  step(
    "the choice is kept on the server",
    await until(async () => {
      const kept = (await library()).settings?.tools;
      return kept?.includes("slideshow") && !kept.includes("rotate");
    }),
  );
  await reloadDesktop(page);
  const again = photosWindow();
  await again.waitFor({ timeout: 30_000 });
  const after = (name) => again.getByRole("toolbar").getByRole("button", { name, exact: true });
  await after("Slideshow").waitFor({ timeout: 15_000 });
  step(
    "after a reload Slideshow is there and Rotate is not",
    (await after("Rotate").count()) === 0,
  );

  await again
    .getByRole("toolbar")
    .first()
    .click({ button: "right", position: { x: 400, y: 12 } });
  await page.getByRole("menuitem", { name: "Customize Toolbar…" }).click();
  await page.getByRole("button", { name: "Use Default Set" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  step(
    "the toolbar's own menu opens it, and Use Default Set brings Rotate back",
    (await after("Rotate").count()) === 1 && (await after("Slideshow").count()) === 0,
  );
});
