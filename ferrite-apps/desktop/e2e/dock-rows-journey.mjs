#!/usr/bin/env node
// The Dock's rows a person uses most that no other journey asserts: a tile's name over it on hover, Keep in Dock
// across a quit and a reload, and the Dock pane's Size, Magnification and Automatically hide, each kept across a reload.

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

await journey("dock-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const until = async (check, ms = 6_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await page.waitForTimeout(80);
    }
  };
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const menus = page.getByRole("menu");

  await tile("Chess").hover();
  const label = tile("Chess").locator("..").getByText("Chess", { exact: true });
  step(
    "A tile's name stands over it on hover",
    await until(async () => {
      const over = await label
        .first()
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return style.visibility !== "hidden" && Number(style.opacity) > 0.5;
        })
        .catch(() => false);
      const [word, icon] = await Promise.all([
        label.first().boundingBox(),
        tile("Chess").boundingBox(),
      ]);
      return over && word && icon && word.y + word.height <= icon.y + 4;
    }),
  );
  await page.screenshot({ path: path.join(out, "tile-label.png") });
  await page.mouse.move(400, 300);

  await tile("Chess").click({ button: "right" });
  await menus.last().getByRole("menuitem", { name: "Options" }).click();
  await page.getByRole("menuitem", { name: "Remove from Dock", exact: true }).click();
  await until(async () => (await tile("Chess").count()) === 0);
  await page.keyboard.press("Control+Alt+Space");
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill("Chess");
  await page.waitForTimeout(400);
  await field.press("Enter");
  await page.locator('[data-window-id="chess"]').waitFor({ timeout: 10_000 });
  step(
    "An application the Dock does not keep has a tile while it runs",
    (await tile("Chess").count()) === 1,
  );
  await tile("Chess").click({ button: "right" });
  await menus.last().getByRole("menuitem", { name: "Options" }).click();
  await page.getByRole("menuitem", { name: "Keep in Dock", exact: true }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press("Control+q");
  await page.waitForTimeout(600);
  step("Keep in Dock: the tile stays when it quits", (await tile("Chess").count()) === 1);
  await reloadDesktop(page);
  step("and after a reload", (await tile("Chess").count()) === 1);

  await dock.getByRole("separator").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /Dock Preferences/ }).click();
  const pane = page.locator('[data-window-id="system-preferences"]');
  await pane.waitFor({ timeout: 10_000 });
  const wide = async () => (await tile("Finder").boundingBox()).width;
  const before = await wide();
  const size = pane.getByRole("slider").first();
  await size.focus();
  // A full Dock has already shrunk its tiles below the chosen size, so the slider goes all the way down.
  for (let press = 0; press < 60; press += 1) await page.keyboard.press("ArrowLeft");
  step(
    "The pane's Size makes the tiles smaller",
    await until(async () => (await wide()) < before - 2),
    `${before} to ${await wide()}`,
  );
  const sized = await wide();

  const magnify = pane.getByRole("checkbox", { name: "Magnification:" });
  await magnify.click();
  await page.waitForTimeout(300);
  const shownWide = () =>
    tile("Finder").evaluate((button) =>
      Math.max(
        ...[button, ...button.querySelectorAll("*")].map(
          (one) => one.getBoundingClientRect().width,
        ),
      ),
    );
  const resting = await shownWide();
  const box = await tile("Finder").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  step(
    "Magnification swells the tile under the pointer",
    await until(async () => (await shownWide()) > resting + 2),
    `${resting} to ${await shownWide()}`,
  );
  await page.mouse.move(600, 200);

  await pane.getByRole("checkbox", { name: /Automatically hide and show the Dock/ }).click();
  const off = async () => {
    const box = await dock.boundingBox();
    return box.y >= page.viewportSize().height - 8;
  };
  step("Automatically hide takes the Dock off the screen", await until(off));
  await page.screenshot({ path: path.join(out, "dock-hidden.png") });

  await reloadDesktop(page);
  step("Hidden still after a reload", await until(off, 8_000));
  await page.mouse.move(600, page.viewportSize().height - 1);
  await until(async () => !(await off()));
  const kept = await wide();
  step("and the size is kept", Math.abs(kept - sized) < 2, `${sized} and ${kept}`);
  await pane
    .getByRole("checkbox", { name: /Automatically hide and show the Dock/ })
    .click()
    .catch(() => {});
  await page.mouse.move(600, 200);

  // The keys, where Command is Control.
  const windowOf = (id) => page.locator(`[data-window-id="${id}"]`);
  const open = async (name, id) => {
    await tile(name).click();
    await windowOf(id).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
  };
  const minimized = (id) => windowOf(id).evaluate((shell) => shell.hasAttribute("data-minimized"));
  const bar = page.getByRole("menubar").first();
  const fronted = (name) =>
    until(async () => (await bar.getByRole("menuitem", { name, exact: true }).count()) === 1);
  await open("Maps", "maps");
  await open("Console", "console");
  await fronted("Console");
  await page.keyboard.press("Control+m");
  step("Command-M minimizes the window in front", await until(() => minimized("console")));
  await tile("Console")
    .click()
    .catch(() => {});
  const console2 = dock.getByRole("button", { name: /minimized window/ }).first();
  if ((await console2.count()) > 0) await console2.click();
  await until(async () => !(await minimized("console")));
  await fronted("Console");
  await page.keyboard.press("Control+h");
  step("Command-H hides the application in front", await until(() => minimized("console")));
  await tile("Console").click();
  await until(async () => !(await minimized("console")));
  await fronted("Console");
  await page.keyboard.press("Control+Alt+h");
  step(
    "Command-Option-H hides the others",
    await until(async () => (await minimized("maps")) && !(await minimized("console"))),
  );
  await page.keyboard.press("Control+w");
  step(
    "Command-W closes the window in front",
    await until(async () => (await windowOf("console").count()) === 0),
  );
  await tile("Maps").click();
  await until(async () => !(await minimized("maps")));
  await fronted("Maps");
  await page.keyboard.press("Control+q");
  step(
    "Command-Q quits the application in front",
    await until(async () => (await windowOf("maps").count()) === 0),
  );
});
