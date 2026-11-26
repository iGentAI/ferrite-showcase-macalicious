#!/usr/bin/env node
// A window in full screen is a Space of its own: in the bar by its title, reached by the bar and the
// keys, with the rest of the desktop still there on the Space beside it, and gone when it leaves.
//
//   node e2e/spaces-fullscreen-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spaces-fullscreen");

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
  const openOverview = async () => {
    await page.keyboard.press("F3");
    await overview.waitFor({ timeout: 4_000 });
    await page.waitForTimeout(400);
  };
  const enterFullScreen = async () => {
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "View", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Enter Full Screen" }).click();
  };
  const isFull = (id) => shell(id).evaluate((each) => each.hasAttribute("data-full-screen"));

  await launch(page, "Calculator");
  await shell("calculator").waitFor({ timeout: 8_000 });
  await launch(page, "Chess");
  await shell("chess").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  await enterFullScreen();
  step("The window goes to full screen", await until(() => isFull("chess")));
  step(
    "on a Space of its own, without the other window",
    await until(
      async () =>
        (await stored())?.current === "fs:chess" && !(await shell("calculator").isVisible()),
    ),
    JSON.stringify(await stored()),
  );
  await page.waitForTimeout(400);

  await page.keyboard.press("Control+ArrowLeft");
  step(
    "Control-Left goes back to the Desktop, its window there",
    await until(
      async () => (await shell("calculator").isVisible()) && !(await shell("chess").isVisible()),
    ),
  );
  await page.waitForTimeout(400);
  await openOverview();
  step(
    "The bar names the Space by the window",
    (await bar.getByRole("button", { name: "Desktop 1", exact: true }).count()) === 1 &&
      (await bar.getByRole("button", { name: "Chess", exact: true }).count()) === 1,
  );
  step(
    "and Mission Control has no thumbnail of it",
    (await overview.locator('[data-mission-window="chess"]').count()) === 0,
  );
  step(
    "The only Desktop cannot be removed beside it",
    (await bar.getByRole("button", { name: "Remove Desktop 1" }).count()) === 0,
  );
  await shot(page, path.join(out, `spaces-fullscreen-${browserName}.png`));
  await bar.getByRole("button", { name: "Chess", exact: true }).click();
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  step(
    "Choosing it there shows it in full screen",
    await until(async () => (await shell("chess").isVisible()) && (await isFull("chess"))),
  );

  await page.waitForTimeout(400);
  await openOverview();
  await bar.getByRole("button", { name: "Chess", exact: true }).hover();
  await bar.getByRole("button", { name: "Leave Full Screen: Chess" }).click();
  await page.keyboard.press("Escape");
  step(
    "The bar's button takes it out of full screen, and the Space goes",
    await until(async () => {
      const now = await stored();
      return now?.spaces?.length === 1 && !(await isFull("chess"));
    }),
    JSON.stringify(await stored()),
  );
  step(
    "Both windows are on the Desktop",
    await until(
      async () => (await shell("chess").isVisible()) && (await shell("calculator").isVisible()),
    ),
  );

  await overview.waitFor({ state: "detached", timeout: 4_000 });
  await page.waitForTimeout(400);
  await shell("chess").locator(".mac-title-bar").first().click();
  await enterFullScreen();
  await until(async () => (await stored())?.current === "fs:chess");
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  await shell("chess").waitFor({ state: "attached", timeout: 10_000 });
  step(
    "After a reload the window is back in full screen, on its own Space",
    await until(async () => {
      const now = await stored();
      return (
        now?.current === "fs:chess" &&
        (await isFull("chess")) &&
        (await shell("chess").isVisible()) &&
        !(await shell("calculator").isVisible())
      );
    }),
    JSON.stringify(await stored()),
  );
  // The menu bar is under the full-screen window: out by the bar's button.
  await page.waitForTimeout(400);
  await openOverview();
  await bar.getByRole("button", { name: "Chess", exact: true }).hover();
  await bar.getByRole("button", { name: "Leave Full Screen: Chess" }).click();
  await page.keyboard.press("Escape");
  step(
    "and leaving it brings the Space to an end",
    await until(async () => {
      const now = await stored();
      return now?.spaces?.length === 1 && !(await isFull("chess"));
    }),
    JSON.stringify(await stored()),
  );
  // A full-screen Space holds its own window alone, whatever is on All Desktops.
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const assign = async (app) => {
    await dock.getByRole("button", { name: app, exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Options", exact: true }).hover();
    await page.getByRole("menuitemradio", { name: "All Desktops", exact: true }).click();
    await page.waitForTimeout(300);
  };
  await assign("Calculator");
  await assign("Chess");
  await shell("chess").locator(".mac-title-bar").first().click();
  await enterFullScreen();
  step(
    "On the full-screen Space a window on All Desktops does not show",
    await until(
      async () =>
        (await stored())?.current === "fs:chess" && !(await shell("calculator").isVisible()),
    ),
  );
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+ArrowLeft");
  step(
    "and the full-screen window of an application on All Desktops stays on its own Space",
    await until(
      async () => (await shell("calculator").isVisible()) && !(await shell("chess").isVisible()),
    ),
  );

  // A window opened from the full-screen Space goes on the Desktop, and the Space stays its owner's.
  await page.keyboard.press("Control+ArrowRight");
  await until(async () => (await stored())?.current === "fs:chess");
  await page.waitForTimeout(400);
  // The Dock is covered in full screen: Spotlight's key opens the application.
  await page.keyboard.press("Control+Alt+Space");
  await page.waitForTimeout(400);
  await page.keyboard.type("Stickies");
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await shell("stickies").waitFor({ state: "attached", timeout: 8_000 });
  step(
    "A window opened from the full-screen Space goes on the Desktop, and the person with it",
    await until(async () => {
      const now = await stored();
      return now?.windows?.stickies === "1" && now.current === "1";
    }),
    JSON.stringify(await stored()),
  );
  await page.waitForTimeout(400);
  // Out of Stickies' note, where Control-Right moves the caret.
  await page.mouse.click(5, 400);
  await page.keyboard.press("Control+ArrowRight");
  step(
    "and the full-screen Space shows only its owner",
    await until(
      async () =>
        (await shell("chess").isVisible()) &&
        !(await shell("stickies").isVisible()) &&
        !(await shell("calculator").isVisible()),
    ),
  );

  // This Desktop for an application in full screen leaves its window on its own Space.
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+ArrowLeft");
  await until(async () => (await stored())?.current === "1");
  await page.waitForTimeout(300);
  await dock.getByRole("button", { name: "Chess", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Options", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "This Desktop", exact: true }).click();
  step(
    "Assign To This Desktop leaves a full-screen window on its one Space",
    await until(async () => {
      const now = await stored();
      return (
        now?.assigned?.chess === "1" &&
        now.windows.chess === "fs:chess" &&
        now.spaces.filter((each) => each === "fs:chess").length === 1
      );
    }),
    JSON.stringify(await stored()),
  );

  // A further window of the application in full screen stays with it.
  await launch(page, "Finder");
  await shell("finder").waitFor({ timeout: 8_000 });
  await until(async () => (await stored())?.current === (await stored())?.windows?.finder);
  await page.waitForTimeout(400);
  await shell("finder").locator(".mac-title-bar").first().click();
  await enterFullScreen();
  await until(async () => (await stored())?.current === "fs:finder");
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+n");
  await shell("finder:2").waitFor({ state: "attached", timeout: 8_000 });
  step(
    "A further window of the application in full screen stays on its Space, and the person with it",
    await until(async () => {
      const now = await stored();
      return now?.windows?.["finder:2"] === "fs:finder" && now.current === "fs:finder";
    }),
    JSON.stringify(await stored()),
  );
  step("and shows there", await until(() => shell("finder:2").isVisible()));
});
