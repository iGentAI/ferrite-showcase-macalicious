#!/usr/bin/env node
// TV on Ferrite: the View menu and its keys choose a section, which is kept across a reload; Edit >
// Find gives the search field the keyboard; the rows that cannot act here are dimmed, saying why. It
// runs in a fresh browser signed in as a new Guest User.
//
//   node e2e/tv-sections-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-sections", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  const chosen = (name) =>
    window
      .locator(".mac-tv-sections")
      .getByRole("button", { name, exact: true })
      .getAttribute("aria-pressed");

  await chooseMenu(page, "View", "Library");
  await page.waitForTimeout(200);
  step("View > Library shows the Library", (await chosen("Library")) === "true");
  await window.click({ position: { x: 600, y: 500 } });
  await page.keyboard.press("ControlOrMeta+2");
  await page.waitForTimeout(200);
  step("its key shows Movies", (await chosen("Movies")) === "true");
  await shot(page, path.join(out, "tv-sections.png"));
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  await launch(page, "TV");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);
  step("after a reload the window opens on that section", (await chosen("Movies")) === "true");

  await chooseMenu(page, "Edit", "Find");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("type") === "search",
    undefined,
    { timeout: 3_000 },
  );
  step("Edit > Find gives the search field the keyboard", true);

  for (const [title, row, words] of [
    ["View", "Show View Options", "List Size"],
    ["Edit", "Undo", "nothing here to undo"],
    ["Edit", "Copy", "search field"],
    ["Account", "Sign In…", "no Apple ID"],
  ]) {
    const state = await menuItemState(page, title, row);
    step(
      `${title} > ${row} is dimmed, saying why`,
      state.disabled === true && (state.title ?? "").includes(words),
      state.title ?? "",
    );
  }
  await page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Show View Options" }).waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "tv-view-menu.png"));
  await page.keyboard.press("Escape");
});

process.exit(0);
