#!/usr/bin/env node
// Spotlight's window moves by its field and grows by its bottom edge; both are kept per account, across
// closing it and across a reload.
//
//   node e2e/spotlight-place-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { api, journey, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("spotlight-place");

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
  const panel = page.locator(".mac-spotlight");
  const open = async () => {
    await page.keyboard.press("Control+Alt+Space");
    await panel.waitFor({ timeout: 4_000 });
    await page.waitForTimeout(200);
  };
  const close = async () => {
    // The first clears the text, when there is any.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    if (await panel.count()) await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached", timeout: 4_000 });
    await page.waitForTimeout(200);
  };
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.["spotlight.place"];
  const drag = async (fromX, fromY, byX, byY) => {
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + byX, fromY + byY, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  };

  await open();
  const home = await panel.boundingBox();
  await drag(home.x + 20, home.y + 20, 90, 60);
  const moved = await panel.boundingBox();
  step(
    "Dragging the field moves the window",
    Math.abs(moved.x - home.x - 90) < 2 && Math.abs(moved.y - home.y - 60) < 2,
    JSON.stringify(moved),
  );
  step(
    "and it keeps the keyboard",
    await page.evaluate(() => document.activeElement?.tagName === "INPUT"),
  );
  step(
    "The place is kept on the server",
    await until(async () => (await stored())?.x === 90),
    JSON.stringify(await stored()),
  );

  await page.keyboard.type("calc");
  await page.locator(".mac-spotlight-body").waitFor({ timeout: 4_000 });
  const typedText = await page.locator(".mac-spotlight-input").inputValue();
  const expanded = await panel.boundingBox();
  const bodyBefore = await page.locator(".mac-spotlight-body").boundingBox();
  await drag(expanded.x + 40, expanded.y + expanded.height, 0, 80);
  const bodyAfter = await page.locator(".mac-spotlight-body").boundingBox();
  step(
    "Dragging the bottom edge shows more results",
    Math.abs(bodyAfter.height - bodyBefore.height - 80) < 2,
    `${bodyBefore.height} to ${bodyAfter.height}`,
  );
  step(
    "Dragging in the text does not move it",
    typedText === "calc" &&
      (await (async () => {
        const at = await panel.boundingBox();
        await drag(at.x + 120, at.y + 20, 40, 40);
        const after = await panel.boundingBox();
        return after.x === at.x && after.y === at.y;
      })()),
  );

  // To the screen's last row: the farthest a pointer goes while it stays on the page. Firefox reports a
  // synthetic pointer far past the window as clientY -86, so this cannot test further than the window.
  const lastRow = page.viewportSize().height - 1;
  const edgeY = expanded.y + expanded.height + 80;
  await drag(expanded.x + 20, edgeY, 0, lastRow - edgeY);
  const most = await page.locator(".mac-spotlight-body").boundingBox();
  const screenBottom = page.viewportSize().height;
  step(
    "It stops short of the bottom of the screen, its edge still in reach",
    most.height <= 720 && most.y + most.height < screenBottom,
    String(most.height),
  );
  const tall = await panel.boundingBox();
  await drag(tall.x + 20, tall.y + tall.height, 0, -160);
  const given = (await page.locator(".mac-spotlight-body").boundingBox()).height;
  step("and it can be made shorter again", Math.abs(given - most.height + 160) < 2, String(given));
  step(
    "and a press on the results leaves the keyboard with the field",
    await (async () => {
      await page.locator(".mac-spotlight-preview").click();
      return page.evaluate(() => document.activeElement?.tagName === "INPUT");
    })(),
  );
  await close();
  await open();
  const again = await panel.boundingBox();
  step(
    "Closed and opened, it stands where it was",
    Math.abs(again.x - moved.x) < 2 && Math.abs(again.y - moved.y) < 2,
    JSON.stringify(again),
  );
  await close();
  await until(async () => Math.abs((await stored())?.height - given) < 2);
  await reloadDesktop(page);
  await open();
  const reloaded = await panel.boundingBox();
  step(
    "and after a reload",
    Math.abs(reloaded.x - moved.x) < 2 && Math.abs(reloaded.y - moved.y) < 2,
    JSON.stringify(reloaded),
  );
  await page.keyboard.type("calc");
  await page.locator(".mac-spotlight-body").waitFor({ timeout: 4_000 });
  step(
    "with the height it was given",
    Math.abs((await page.locator(".mac-spotlight-body").boundingBox()).height - given) < 2,
  );

  // Left at the far edge of a larger screen, it stays within reach of a smaller one.
  await close();
  await open();
  const before = await panel.boundingBox();
  await drag(before.x + 20, before.y + 20, 2000, 0);
  await until(async () => (await stored())?.x > 200);
  const wide = await stored();
  await close();
  await page.setViewportSize({ width: 900, height: 600 });
  await open();
  const small = await panel.boundingBox();
  step(
    "On a smaller screen a window left at the edge of a larger one stays in reach",
    small.x + 40 < 900 && small.y + 40 < 600,
    JSON.stringify(small),
  );
  await close();
  await reloadDesktop(page);
  await open();
  const smallAgain = await panel.boundingBox();
  step(
    "also after a reload",
    smallAgain.x + 40 < 900 && smallAgain.y + 40 < 600,
    JSON.stringify(smallAgain),
  );
  step(
    "and the place kept for the larger screen stays",
    (await stored())?.x === wide.x,
    JSON.stringify(await stored()),
  );
  await page.keyboard.type("calc");
  await page.locator(".mac-spotlight-body").waitFor({ timeout: 4_000 });
  const narrowBody = await page.locator(".mac-spotlight-body").boundingBox();
  const narrowPanel = await panel.boundingBox();
  step(
    "Results kept taller than this screen stay on it, their edge in reach",
    narrowPanel.y + narrowPanel.height < 600,
    JSON.stringify(narrowPanel),
  );
  await drag(narrowPanel.x + 20, narrowPanel.y + narrowPanel.height, 0, -40);
  const resized = (await page.locator(".mac-spotlight-body").boundingBox()).height;
  step(
    "Its results can be resized there",
    Math.abs(resized - narrowBody.height + 40) < 2,
    `${narrowBody.height} to ${resized}`,
  );
  step(
    "which keeps the new height and leaves the place kept for the larger screen",
    await until(async () => {
      const kept = await stored();
      return kept?.x === wide.x && Math.abs(kept?.height - resized) < 2;
    }),
    JSON.stringify(await stored()),
  );
  await drag(smallAgain.x + 20, smallAgain.y + 20, -100, 0);
  step(
    "It can be taken hold of there",
    Math.abs((await panel.boundingBox()).x - smallAgain.x + 100) < 2,
  );

  // Held down, the menu bar's item puts it back where it started.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  if (await panel.count()) await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached", timeout: 4_000 });
  await open();
  const off = await panel.boundingBox();
  const extra = await page
    .getByRole("menuitem", { name: "Spotlight", exact: true })
    .first()
    .boundingBox();
  await page.mouse.move(extra.x + extra.width / 2, extra.y + extra.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_200);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const put = await panel.boundingBox();
  step(
    "Holding down its menu bar item puts the window back",
    Math.abs(put.x - home.x) < 2 && Math.abs(put.y - home.y) < 2 && off.x !== put.x,
    JSON.stringify(put),
  );
  step(
    "and the window stays open, on the server too",
    (await panel.count()) === 1 && (await until(async () => (await stored())?.x === 0)),
    JSON.stringify(await stored()),
  );
  await page.mouse.move(700, 500);
  await close();
  await page.mouse.move(extra.x + extra.width / 2, extra.y + extra.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  step("A plain click still opens it", await until(async () => (await panel.count()) === 1));
});
