#!/usr/bin/env node
// The Dock's life: a tile bounces when its application opens and when a notification asks for attention, shows a
// count of notifications, recent applications have a section, and windows can minimize into their application's icon.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/dock-life-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("dock-life");

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const bouncing = (name) => tile(name).evaluate((button) => button.hasAttribute("data-bouncing"));
  const setting = async (key, value) => {
    // The page's own saves first: a window closed or moved a moment ago is on its way.
    await page.waitForTimeout(1_500);
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    await api(page, "PUT", "/api/system-preferences/settings", {
      values: { ...(json.values ?? {}), [key]: value },
      rev: json.rev,
    });
    await page.reload();
    await dock.waitFor({ timeout: 30_000 });
    await tile("Finder").waitFor({ timeout: 15_000 });
  };

  // Opening bounces, and it ends.
  await tile("Calculator").click();
  step("A tile bounces as its application opens", await bouncing("Calculator"));
  await page.waitForTimeout(200);
  await shot(page, path.join(out, `dock-life-bounce-${browserName}.png`));
  step("and stops", await until(async () => !(await bouncing("Calculator")), 3_000));

  // A notification for an application not in front: its count, and a bounce.
  const raised = await api(page, "POST", "/api/notification-center/notify", {
    app: "reminders",
    title: "Water the plants",
  });
  step("A notification is raised", raised.status < 300, String(raised.status));
  const badge = tile("Reminders").locator("[data-dock-badge]");
  await badge.waitFor({ timeout: 20_000 });
  step("The tile shows the count", (await badge.innerText()) === "1");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `dock-life-badge-${browserName}.png`));

  // Animate opening applications off.
  await setting("dock.animate", false);
  await tile("Chess").click();
  await page.locator('[data-window-id="chess"]').waitFor({ timeout: 10_000 });
  step("With Animate opening applications off a tile stays still", !(await bouncing("Chess")));

  // Minimize windows into application icon.
  await setting("dock.minimizeIntoIcon", true);
  const chess = page.locator('[data-window-id="chess"]');
  await chess.waitFor({ timeout: 15_000 });
  await chess.getByRole("button", { name: "Minimize" }).first().click();
  step(
    "The yellow button minimizes the window",
    await until(() => chess.evaluate((element) => element.hasAttribute("data-minimized"))),
  );
  step(
    "Minimized into the icon, a window has no tile of its own",
    (await dock.getByRole("button", { name: /minimized window/ }).count()) === 0,
  );
  await tile("Chess").click();
  step(
    "and the application's tile brings it back",
    await until(() => chess.evaluate((element) => !element.hasAttribute("data-minimized"))),
  );

  // Recent applications: one taken out of the Dock has a tile in the section, running or closed.
  await setting("dock.removed", ["calculator"]);
  const afterSeparator = () =>
    tile("Calculator").evaluate((button) => {
      const shelf = button.closest('[role="toolbar"]');
      const lines = [...shelf.querySelectorAll('[role="separator"]')];
      return lines.some(
        (line) => line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  step("A running application out of the Dock is in the recent section", await afterSeparator());
  await tile("Calculator").click();
  await page
    .locator('[data-window-id="calculator"]')
    .getByRole("button", { name: "Close" })
    .first()
    .click();
  const recent = tile("Calculator");
  await until(() =>
    page
      .locator('[data-window-id="calculator"]')
      .count()
      .then((n) => n === 0),
  );
  step("and stays there when it closes", (await recent.count()) === 1 && (await afterSeparator()));
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `dock-life-recent-${browserName}.png`));
  await setting("dock.recents", false);
  step("and goes when Show recent applications is off", (await recent.count()) === 0);
});
