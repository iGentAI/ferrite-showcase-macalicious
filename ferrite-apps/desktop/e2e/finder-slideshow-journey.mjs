#!/usr/bin/env node
// Finder's slideshow: from the File menu, stepping by itself and by the keys, with an index sheet, and from
// Quick Look's full-screen button.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-slideshow-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-slideshow");
const tag = Date.now().toString(36);
const NAMES = ["A", "B", "C"].map((each) => `Slide ${each} ${tag}.txt`);
const PICTURE = `Picture ${tag}.svg`;

await run(async (page) => {
  await openDesktop(page, base, step);
  for (const name of NAMES) {
    await uploadFile(page, { parent: "documents", name, type: "text/plain", text: "words" });
  }
  await uploadFile(page, {
    parent: "documents",
    name: PICTURE,
    type: "image/svg+xml",
    text: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="teal"/></svg>',
  });
  await launch(page, "Finder");
  const finder = page.locator('[data-window-id^="finder"]').first();
  await finder.waitFor({ timeout: 10_000 });
  await page.keyboard.press("Shift+Control+O");
  await finder.getByRole("option", { name: NAMES[0] }).click();
  await finder.getByRole("option", { name: NAMES[2] }).click({ modifiers: ["Shift"] });

  await page.getByRole("menuitem", { name: "File", exact: true }).first().click();
  await page.getByRole("menuitem", { name: /^Slideshow 3 Items/ }).click();
  const show = page.getByRole("dialog", { name: "Slideshow" });
  await show.waitFor({ timeout: 4_000 });
  const count = show.getByRole("status");
  step("The File menu's row shows the three items", (await count.innerText()) === "1 of 3");
  const box = await show.boundingBox();
  const desk = await page.locator(".mac-desktop-shell").boundingBox();
  step("over the whole desktop", box?.width === desk?.width && box?.height === desk?.height);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `finder-slideshow-${browserName}.png`));

  await show
    .getByText("2 of 3")
    .waitFor({ timeout: 5_000 })
    .then(
      () => step("It steps by itself", true),
      () => step("It steps by itself", false, "still on the first"),
    );
  await show.getByRole("button", { name: "Pause" }).click();
  const paused = await count.innerText();
  await page.waitForTimeout(3_400);
  step("Pause stops it", (await count.innerText()) === paused, paused);
  await show.focus();
  await page.keyboard.press("ArrowLeft");
  step("The Left Arrow goes back", (await count.innerText()) === "1 of 3");

  await show.getByRole("button", { name: "Index Sheet" }).click();
  const sheet = show.getByRole("list", { name: "Index Sheet" });
  await sheet.waitFor({ timeout: 4_000 });
  step("The index sheet lists them all", (await sheet.getByRole("listitem").count()) === 3);
  await page.waitForTimeout(200);
  await shot(page, path.join(out, `finder-slideshow-sheet-${browserName}.png`));
  await sheet.getByRole("button", { name: new RegExp(NAMES[2].replace(/\.txt$/, "")) }).click();
  step("and takes you to the one chosen", (await count.innerText()) === "3 of 3");
  // The keyboard is still the slideshow's.
  await page.keyboard.press("ArrowLeft");
  step("where the keys still work", (await count.innerText()) === "2 of 3");
  await page.keyboard.press("Space");
  step("Space plays", await show.getByRole("button", { name: "Pause" }).isVisible());
  await page.keyboard.press("Space");

  // The keyboard stays inside while it shows.
  for (let press = 0; press < 12; press += 1) await page.keyboard.press("Tab");
  step(
    "Tab stays inside",
    await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-label="Slideshow"]'))),
  );
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Escape");
  step("Escape ends it", (await show.count()) === 0);
  step(
    "and the selection is as it was",
    (await finder.locator('[role="option"][aria-selected="true"]').count()) === 3,
  );

  // From Quick Look: its full-screen button.
  await finder.getByRole("option", { name: NAMES[0] }).click();
  await page.keyboard.press("Control+Y");
  const look = page.getByRole("button", { name: "Full Screen", exact: true });
  await look.waitFor({ timeout: 5_000 });
  await page.getByText("words", { exact: true }).waitFor({ timeout: 5_000 });
  await look.click();
  await show.waitFor({ timeout: 4_000 });
  step("Quick Look's button goes full screen too", (await count.innerText()) === "1 of 1");
  await show.getByRole("button", { name: "Exit" }).click();
  step("and Exit ends it", (await show.count()) === 0);

  // A picture shows its own bytes, as large as the screen allows.
  await finder.getByRole("option", { name: PICTURE }).click();
  await page.keyboard.press("Control+Alt+Y");
  await show.waitFor({ timeout: 4_000 });
  const picture = show.getByRole("img", { name: PICTURE });
  await picture.waitFor({ timeout: 8_000 }).catch(() => {});
  const drawn = await picture
    .evaluate((image) => {
      const room = image.getBoundingClientRect();
      return image.complete && image.naturalWidth > 0 && room.width > 1000 && room.height > 500;
    })
    .catch(() => false);
  step("A picture shows its own bytes, as large as the screen allows", drawn);
  await page.keyboard.press("Escape");
});
