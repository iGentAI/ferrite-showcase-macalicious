#!/usr/bin/env node
// Force Quit's window, list, keys and sheet on a served desktop, the rows the depth journey leaves out: the Apple menu and
// Command-Option-Escape opening it, its fixed size and dimmed Minimize, the list following apps with Finder last, arrow
// keys, typing a name, Return and a double click asking, Relaunch for Finder, the selection falling back to the first row,
// Close, and the Dock's Option-held Force Quit. Exits 0 only when every step passed with no console error, page error,
// failed request or HTTP error.
//
//   node e2e/force-quit-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();

await journey("force-quit-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  for (const [name, id] of [
    ["Calculator", "calculator"],
    ["Maps", "maps"],
  ]) {
    await dock(page, name).click();
    await page.locator(`[data-window-id^="${id}"]`).first().waitFor({ timeout: 10_000 });
  }

  await page.getByRole("menubar").getByRole("menuitem", { name: "Apple" }).click();
  await page.getByRole("menuitem", { name: /^Force Quit/ }).hover();
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, "force-quit-apple-menu.png") });
  await page.getByRole("menuitem", { name: /^Force Quit/ }).click();
  const window = page.locator('[data-window-id="force-quit"]');
  await window.waitFor({ timeout: 5_000 });
  step("Apple menu > Force Quit… opens it", true);

  const list = window.getByRole("listbox", { name: "Applications" });
  const names = async () =>
    (await list.getByRole("option").allInnerTexts()).map((text) => text.trim());
  const selected = async () => {
    const row = list.locator('[role="option"][aria-selected="true"]');
    return (await row.allInnerTexts()).map((text) => text.trim());
  };
  const row = (name) => list.getByRole("option", { name, exact: true });
  const button = (name) => window.getByRole("button", { name, exact: true });
  const sheet = page.getByRole("dialog");
  const cancel = async () => {
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await sheet.waitFor({ state: "hidden" });
  };

  await window.getByText("Force Quit Applications").waitFor();
  await window.getByText("You can open this window by pressing Command-Option-Escape.").waitFor();
  await page.screenshot({ path: path.join(out, "force-quit-window.png") });
  step("the title, the instruction and the hint are shown", true);

  const before = await window.boundingBox();
  await page.mouse.move(before.x + before.width - 1, before.y + before.height - 1);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 80, before.y + before.height + 80);
  await page.mouse.up();
  const after = await window.boundingBox();
  step(
    "the window keeps one size",
    after.width === before.width && after.height === before.height,
    `${before.width}x${before.height} then ${after.width}x${after.height}`,
  );
  step(
    "Minimize is dimmed",
    await window
      .getByRole("button", { name: /minimize/i })
      .first()
      .isDisabled(),
  );
  await page.keyboard.press("Control+m");
  await page.waitForTimeout(600);
  step("Command-M leaves it open", await window.getByText("Force Quit Applications").isVisible());

  const first = await names();
  step(
    "the apps with a window are listed, Finder last",
    first.includes("Calculator") && first.includes("Maps") && first.at(-1) === "Finder",
    first.join(", "),
  );
  step(
    "the first row is selected",
    (await selected()).join() === first[0],
    (await selected()).join(),
  );

  await dock(page, "Notes").click();
  await row("Notes").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "force-quit-list-follows.png") });
  step("an app that opens joins the list", true, (await names()).join(", "));
  await window.click({ position: { x: 150, y: 10 } });

  await row("Calculator").click();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, "force-quit-arrow.png") });
  const next = await names();
  step(
    "the arrow keys move the selection",
    (await selected()).join() === next[next.indexOf("Calculator") + 1],
    (await selected()).join(),
  );
  await page.keyboard.type("fin", { delay: 40 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, "force-quit-type-to-select.png") });
  step(
    "typing a name selects it",
    (await selected()).join() === "Finder",
    (await selected()).join(),
  );
  await page.waitForTimeout(1_200);

  await button("Relaunch").waitFor();
  step("Finder's button reads Relaunch", true);
  await button("Relaunch").click();
  await sheet.getByRole("button", { name: "Relaunch" }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, "force-quit-relaunch.png") });
  await sheet.getByRole("button", { name: "Relaunch" }).click();
  await sheet.waitFor({ state: "hidden" });
  step("Relaunch keeps Finder in the list", await row("Finder").isVisible());

  await row("Maps").click();
  await page.keyboard.press("Enter");
  await sheet.getByText(/force .*Maps.* to quit/i).waitFor();
  step("Return asks in a sheet", true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, "force-quit-sheet.png") });
  await cancel();
  step("Cancel keeps the app", await row("Maps").isVisible());

  await row("Maps").dblclick();
  await sheet.getByText(/force .*Maps.* to quit/i).waitFor();
  step("a double click asks too", true);
  await sheet.getByRole("button", { name: "Force Quit" }).click();
  await page.locator('[data-window-id="maps"]').waitFor({ state: "detached", timeout: 5_000 });
  await row("Maps").waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "force-quit-app-gone.png") });
  const left = await names();
  step(
    "the app goes, its windows with it, and a row stays selected",
    (await selected()).length === 1 && left.includes((await selected())[0]),
    `${left.join(", ")}; ${(await selected()).join()}`,
  );

  await button("Close")
    .or(window.getByRole("button", { name: /^close/i }))
    .first()
    .click();
  await window.waitFor({ state: "detached", timeout: 5_000 });
  step("Close closes the window", true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "force-quit-closed.png") });

  await page.keyboard.press("Control+Alt+Escape");
  await window.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "force-quit-key-opens.png") });
  step("Command-Option-Escape opens it", true);
  await page.keyboard.press("Control+w");
  await window.waitFor({ state: "detached", timeout: 5_000 });
  step("Command-W closes it", true);

  await page.keyboard.down("Alt");
  await dock(page, "Notes").click({ button: "right" });
  const forced = page.getByRole("menuitem", { name: "Force Quit", exact: true });
  await forced.waitFor({ timeout: 3_000 });
  await page.screenshot({ path: path.join(out, "force-quit-dock-menu.png") });
  await forced.click();
  await page.keyboard.up("Alt");
  await page
    .locator('[data-window-id^="notes"]')
    .first()
    .waitFor({ state: "detached", timeout: 5_000 });
  step("the Dock menu with Option held offers Force Quit, and it ends the app", true);
});
