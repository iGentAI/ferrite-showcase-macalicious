#!/usr/bin/env node
// Spaces beyond the basics: a thumbnail let go on + makes a Space for itself, and the windows slide
// between Spaces.
//
//   node e2e/spaces-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spaces-more");

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
  const front = async () =>
    (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).innerText()).trim();
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const bar = overview.getByRole("group", { name: "Spaces" });
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.["desktop.spaces"];

  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");
  await launch(page, "Calculator");
  await until(async () => (await front()) === "Calculator");

  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(400);
  const thumb = overview.getByRole("button", { name: "Chess", exact: true });
  const from = await thumb.boundingBox();
  const add = await bar.getByRole("button", { name: "Add Desktop" }).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 - 12, { steps: 3 });
  await page.mouse.move(add.x + add.width / 2, add.y + add.height / 2, { steps: 10 });
  await page.waitForTimeout(100);
  await shot(page, path.join(out, `spaces-new-${browserName}.png`));
  await page.mouse.up();
  step(
    "A thumbnail let go on + makes Desktop 2",
    await until(
      async () => (await bar.getByRole("button", { name: "Desktop 2", exact: true }).count()) === 1,
    ),
  );
  step(
    "and goes there",
    await until(async () => {
      const now = await stored();
      return now?.spaces?.length === 2 && now.windows.chess === now.spaces[1];
    }),
    JSON.stringify(await stored()),
  );
  step(
    "and has left this Space",
    (await overview.getByRole("button", { name: "Chess", exact: true }).count()) === 0,
  );
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  await page.waitForTimeout(400);

  await page.keyboard.press("Control+ArrowRight");
  const moving = await page.evaluate(() => {
    const of = (id) =>
      document
        .querySelector(`[data-window-id="${id}"]`)
        .getAnimations()
        .filter((each) => each.effect?.getTiming().duration === 300).length;
    return { coming: of("chess"), going: of("calculator") };
  });
  step(
    "Moving to the next Space slides both windows",
    moving.coming === 1 && moving.going === 1,
    JSON.stringify(moving),
  );
  await page.waitForTimeout(120);
  await shot(page, path.join(out, `spaces-slide-${browserName}.png`));
  await page.waitForTimeout(400);
  step(
    "and then only the new Space's window shows",
    await until(
      async () => (await shell("chess").isVisible()) && !(await shell("calculator").isVisible()),
    ),
  );

  // Dock > Options > Assign To.
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const assign = async (app, row) => {
    await dock.getByRole("button", { name: app, exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Options", exact: true }).hover();
    await page.getByRole("menuitemradio", { name: row, exact: true }).click();
    await page.waitForTimeout(300);
    // Choosing a row closes the menu; Escape then has nothing to do, and the keys are the desktop's.
    await page.keyboard.press("Escape");
  };
  // On Desktop 2 with Chess; Calculator is on Desktop 1.
  await assign("Calculator", "All Desktops");
  step(
    "Assign To All Desktops shows the window on this Space too",
    await until(
      async () => (await shell("calculator").isVisible()) && (await shell("chess").isVisible()),
    ),
  );
  await page.keyboard.press("Control+ArrowLeft");
  step(
    "and on the other, where the rest of Desktop 2 is gone",
    await until(
      async () => (await shell("calculator").isVisible()) && !(await shell("chess").isVisible()),
    ),
  );
  await assign("Calculator", "None");
  step(
    "None puts it back on its own Desktop",
    await until(async () => {
      const now = await stored();
      return now?.assigned?.calculator === undefined;
    }),
  );
  await assign("Chess", "This Desktop");
  const desktop1 = (await stored()).current;
  step(
    "This Desktop brings the application's window here",
    await until(
      async () => (await shell("chess").isVisible()) && (await shell("calculator").isVisible()),
    ),
    JSON.stringify(await stored()),
  );
  step(
    "and is kept on the server",
    await until(async () => (await stored())?.assigned?.chess === desktop1),
  );
  await assign("Calculator", "All Desktops");
  await page.waitForTimeout(600);
  // Its window closed, the tile opens a new one on its Desktop, from another.
  await shell("chess").getByRole("button", { name: "Close" }).first().click();
  await shell("chess").waitFor({ state: "detached", timeout: 5_000 });
  await page.keyboard.press("Control+ArrowRight");
  await until(async () => (await stored())?.current !== desktop1);
  await page.waitForTimeout(400);
  await dock.getByRole("button", { name: "Chess", exact: true }).click();
  await shell("chess").waitFor({ state: "attached", timeout: 8_000 });
  step(
    "An assigned application opens on its Desktop, taking the person there",
    await until(
      async () =>
        (await stored())?.current === desktop1 &&
        (await stored())?.windows?.chess === desktop1 &&
        (await shell("chess").isVisible()),
    ),
    JSON.stringify(await stored()),
  );
  await page.waitForTimeout(600);
  await reloadDesktop(page);
  await shell("chess").waitFor({ state: "attached", timeout: 10_000 });
  await dock.getByRole("button", { name: "Calculator", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Options", exact: true }).hover();
  step(
    "After a reload the menu still shows the choice",
    (await page
      .getByRole("menuitemradio", { name: "All Desktops", exact: true })
      .getAttribute("aria-checked")) === "true",
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `spaces-assign-${browserName}.png`));
  await page.keyboard.press("Escape");
});
