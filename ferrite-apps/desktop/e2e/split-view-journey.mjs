#!/usr/bin/env node
// Split View: two windows on a Space of their own, from the Window menu and from the green button held
// down, with a divider that moves, kept across a Space switch, and ended by the green button, the bar
// or a window closing, each window going back to where it stood.
//
//   node e2e/split-view-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("split-view");

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
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.["desktop.spaces"];
  const chooser = page.getByRole("dialog", { name: "Split View" });
  const divider = page.getByRole("separator", { name: "Split View divider" });
  const size = await page.evaluate(() => {
    const { clientWidth, clientHeight } = document.querySelector(".mac-window-manager");
    return { width: clientWidth, height: clientHeight };
  });
  const windowMenu = async (row) => {
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "Window", exact: true })
      .click();
    await page.getByRole("menuitem", { name: row }).click();
  };

  await launch(page, "Finder");
  await shell("finder").waitFor({ timeout: 8_000 });
  await launch(page, "Chess");
  await shell("chess").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  const finderFrom = await shell("finder").boundingBox();
  const chessFrom = await shell("chess").boundingBox();

  // From the Window menu.
  await windowMenu("Tile Window to Left of Screen");
  await chooser.waitFor({ timeout: 4_000 });
  const waiting = await shell("chess").boundingBox();
  step(
    "Tile Window to Left of Screen puts the window on the left half",
    waiting.x === 0 && Math.abs(waiting.width - (size.width - 6) / 2) < 1,
    JSON.stringify(waiting),
  );
  await shot(page, path.join(out, `split-view-chooser-${browserName}.png`));
  step(
    "and offers the windows that can share the screen on the other",
    (await chooser.getByRole("button").count()) >= 1 &&
      (await chooser.getByRole("button", { name: /Finder|Home|Recents|Desktop/ }).count()) === 1,
    await chooser.innerText(),
  );
  await page.keyboard.press("Escape");
  await chooser.waitFor({ state: "detached", timeout: 4_000 });
  const back = await shell("chess").boundingBox();
  step(
    "Escape puts it back where it stood",
    Math.abs(back.x - chessFrom.x) < 1 && Math.abs(back.width - chessFrom.width) < 1,
    JSON.stringify(back),
  );

  await windowMenu("Tile Window to Left of Screen");
  await chooser.waitFor({ timeout: 4_000 });
  await chooser.getByRole("button").first().click();
  step(
    "Choosing a window makes a Split View on a Space of its own",
    await until(async () => (await stored())?.current === "split:chess|finder"),
    JSON.stringify(await stored()),
  );
  await page.waitForTimeout(300);
  const left = await shell("chess").boundingBox();
  const right = await shell("finder").boundingBox();
  step(
    "The two windows fill the screen with the divider between them",
    left.x === 0 &&
      left.y === 0 &&
      left.height === size.height &&
      Math.abs(left.x + left.width + 6 - right.x) < 1 &&
      Math.abs(right.x + right.width - size.width) < 1 &&
      right.height === size.height &&
      (await divider.isVisible()),
    JSON.stringify({ left, right }),
  );
  step(
    "The menu bar and the Dock go",
    !(await page.getByRole("toolbar", { name: "Dock" }).isVisible()),
  );
  await shot(page, path.join(out, `split-view-${browserName}.png`));

  // The divider.
  const at = await divider.boundingBox();
  await page.mouse.move(at.x + 3, 300);
  await page.mouse.down();
  await page.mouse.move(at.x + 203, 300, { steps: 5 });
  const live = await shell("chess").boundingBox();
  await page.mouse.up();
  step(
    "Dragging the divider resizes both windows as it goes",
    Math.abs(live.width - left.width - 200) < 2,
    `${left.width} to ${live.width}`,
  );
  step(
    "and the division is kept",
    await until(async () => {
      const share = (await stored())?.tiles?.["split:chess|finder"]?.share;
      return share !== undefined && share > 0.55;
    }),
    JSON.stringify((await stored())?.tiles),
  );
  await page.waitForTimeout(200);
  await page.mouse.move(at.x + 203, 300);
  await page.mouse.down();
  await page.mouse.move(size.width - 5, 300, { steps: 5 });
  await page.mouse.up();
  const limit = await shell("finder").boundingBox();
  step(
    "It stops short of squeezing a window away",
    Math.abs(limit.width - (size.width - 6) * 0.25) < 2,
    String(limit.width),
  );
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  step(
    "The arrow keys move it too",
    (await shell("finder").boundingBox()).width > limit.width + 20,
  );

  // A window moved by its title bar goes back to its side.
  const bar1 = await shell("chess").locator(".mac-title-bar").first().boundingBox();
  const beforeMove = await shell("chess").boundingBox();
  await page.mouse.move(bar1.x + 200, bar1.y + 8);
  await page.mouse.down();
  await page.mouse.move(bar1.x + 260, bar1.y + 100, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterMove = await shell("chess").boundingBox();
  step(
    "A window dragged by its title bar goes back to its side",
    afterMove.x === beforeMove.x && afterMove.y === beforeMove.y,
    JSON.stringify(afterMove),
  );

  // Between Spaces.
  await page.mouse.click(size.width - 80, 400);
  await page.keyboard.press("Control+ArrowLeft");
  step(
    "Control-Left goes to the Desktop",
    await until(async () => (await stored())?.current === "1"),
  );
  step(
    "where the Dock is back and the tiled windows are not",
    await until(
      async () =>
        (await page.getByRole("toolbar", { name: "Dock" }).isVisible()) &&
        !(await shell("chess").isVisible()),
    ),
  );
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(400);
  const label = /&/;
  step(
    "The bar names the Split View by its two windows",
    (await bar.getByRole("button", { name: label }).count()) >= 1,
  );
  await bar.getByRole("button", { name: label }).first().click();
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  step(
    "Choosing it there shows it again",
    await until(
      async () =>
        (await shell("chess").isVisible()) &&
        (await shell("finder").isVisible()) &&
        (await stored())?.current === "split:chess|finder",
    ),
  );

  // The green button ends it, and each window goes back.
  await page.waitForTimeout(400);
  await shell("chess").getByRole("button", { name: "Enter Full Screen" }).first().click();
  step(
    "The green button ends the Split View",
    await until(async () => {
      const now = await stored();
      return now?.spaces?.length === 1 && now.current === "1";
    }),
    JSON.stringify(await stored()),
  );
  step(
    "and each window goes back to where it stood",
    await until(async () => {
      const chess = await shell("chess").boundingBox();
      const finder = await shell("finder").boundingBox();
      return (
        chess &&
        finder &&
        Math.abs(chess.width - chessFrom.width) < 1 &&
        Math.abs(chess.x - chessFrom.x) < 1 &&
        Math.abs(finder.width - finderFrom.width) < 1 &&
        Math.abs(finder.x - finderFrom.x) < 1
      );
    }),
  );
  step(
    "with no window in full screen",
    (await page.locator("[data-window-id][data-full-screen]").count()) === 0,
  );

  // Held, the green button starts it on the side it is let go on.
  await page.waitForTimeout(400);
  await shell("chess")
    .locator(".mac-title-bar")
    .first()
    .click({ position: { x: 200, y: 8 } });
  const green = await shell("chess")
    .getByRole("button", { name: "Enter Full Screen" })
    .first()
    .boundingBox();
  await page.mouse.move(green.x + 5, green.y + 5);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.move(size.width - 100, 300, { steps: 3 });
  await page.mouse.up();
  await chooser.waitFor({ timeout: 4_000 });
  const held = await shell("chess").boundingBox();
  step(
    "Held down, the green button tiles the window to the side it is let go on",
    held.x > size.width / 2 - 10,
    JSON.stringify(held),
  );
  await chooser.getByRole("button").first().click();
  step(
    "with the window chosen on the other side",
    await until(async () => (await stored())?.current === "split:finder|chess"),
    JSON.stringify(await stored()),
  );
  await page.waitForTimeout(400);
  await shell("finder").getByRole("button", { name: "Close" }).first().click();
  step(
    "Closing one window ends it",
    await until(async () => (await stored())?.spaces?.length === 1),
    JSON.stringify(await stored()),
  );
  step(
    "and the other goes back",
    await until(async () => {
      const chess = await shell("chess").boundingBox();
      return chess && Math.abs(chess.width - chessFrom.width) < 1;
    }),
  );

  // What is done to it from then on stays done.
  await page.waitForTimeout(400);
  const titled = await shell("chess").locator(".mac-title-bar").first().boundingBox();
  await page.mouse.move(titled.x + 200, titled.y + 8);
  await page.mouse.down();
  await page.mouse.move(titled.x + 150, titled.y + 48, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const moved = await shell("chess").boundingBox();
  step(
    "The window left behind stays where it is moved to",
    Math.abs(moved.x - (titled.x - 50)) < 2,
    JSON.stringify(moved),
  );

  // Asked for a side twice, and with a window already in a Split View.
  await launch(page, "Finder");
  await shell("finder").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  await launch(page, "Chess");
  await page.waitForTimeout(400);
  const stood = await shell("chess").boundingBox();
  await windowMenu("Tile Window to Left of Screen");
  await chooser.waitFor({ timeout: 4_000 });
  await windowMenu("Tile Window to Right of Screen");
  await page.waitForTimeout(200);
  step(
    "Tiling to the other side moves the window waiting",
    (await shell("chess").boundingBox()).x > size.width / 2 - 10,
  );
  await page.keyboard.press("Escape");
  await chooser.waitFor({ state: "detached", timeout: 4_000 });
  const again = await shell("chess").boundingBox();
  step(
    "and Escape still puts it back where it first stood",
    Math.abs(again.x - stood.x) < 1 && Math.abs(again.width - stood.width) < 1,
    JSON.stringify(again),
  );
  await windowMenu("Tile Window to Left of Screen");
  await chooser.waitFor({ timeout: 4_000 });
  await chooser.getByRole("button").first().click();
  await until(async () => (await stored())?.current === "split:chess|finder");
  await page.waitForTimeout(400);
  await page.mouse.move(size.width / 2, 0);
  await page.mouse.move(size.width / 2, 2);
  await page.waitForTimeout(400);
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Window", exact: true })
    .click();
  step(
    "Inside a Split View the Window menu offers no tiling",
    await page.getByRole("menuitem", { name: "Tile Window to Left of Screen" }).isDisabled(),
  );
  await page.keyboard.press("Escape");
  await page.mouse.move(400, 400);
  await page.waitForTimeout(300);
  await shell("chess").getByRole("button", { name: "Enter Full Screen" }).first().click();
  await until(async () => (await stored())?.spaces?.length === 1);

  // A short press still enters full screen.
  await page.waitForTimeout(400);
  await shell("chess").getByRole("button", { name: "Enter Full Screen" }).first().click();
  step(
    "A short press of the green button still enters full screen",
    await until(async () => (await stored())?.current === "fs:chess"),
  );
});
