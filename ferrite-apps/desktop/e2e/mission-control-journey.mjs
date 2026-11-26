#!/usr/bin/env node
// Mission Control on the desktop: every window apart and live, choosing one, Escape; App Exposé from
// the key and from a Dock tile's Show All Windows; Show Desktop; the application switcher with Option
// held, stepping, Q and letting go; Cycle Through Windows.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/mission-control-journey.mjs [--url http://127.0.0.1:3020] [--out dir]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("mission-control");

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
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const thumb = (name) => overview.getByRole("button", { name, exact: true });
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const scaleOf = (id) =>
    shell(id).evaluate((element) => {
      const { scale } = getComputedStyle(element);
      return scale === "none" ? 1 : Number(scale);
    });

  await launch(page, "TextEdit");
  await until(async () => (await front()) === "TextEdit");
  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");
  await launch(page, "Finder");
  await page.locator(".mac-window.mac-finder").first().waitFor({ timeout: 8_000 });
  await until(async () => (await front()) === "Finder");

  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(500);
  step(
    "F3 shows a thumbnail of every window",
    (await overview.locator(".mac-mission-control-window").count()) === 3,
  );
  step(
    "Each is the live window, scaled down",
    (await scaleOf("textedit")) < 1 && (await scaleOf("chess")) < 1,
  );
  const boxes = await Promise.all(
    ["textedit", "chess", "finder"].map((id) => shell(id).boundingBox()),
  );
  const apart = boxes.every((a, i) =>
    boxes.every(
      (b, j) =>
        i === j ||
        a.x + a.width <= b.x + 1 ||
        b.x + b.width <= a.x + 1 ||
        a.y + a.height <= b.y + 1 ||
        b.y + b.height <= a.y + 1,
    ),
  );
  step("None overlaps another", apart, JSON.stringify(boxes));
  await shot(page, path.join(out, `mission-control-overview-${browserName}.png`));
  await thumb("Chess").hover();
  await shot(page, path.join(out, `mission-control-hover-${browserName}.png`));
  await thumb("Chess").click();
  step(
    "Choosing a thumbnail brings its window forward",
    await until(async () => (await front()) === "Chess" && (await overview.count()) === 0),
  );
  step(
    "and the window is its own size again",
    await until(async () => (await scaleOf("chess")) === 1),
  );

  await page.keyboard.press("Control+ArrowUp");
  await overview.waitFor({ timeout: 4_000 });
  await page.keyboard.press("Escape");
  step(
    "Control-Up opens it and Escape closes it",
    await until(async () => (await overview.count()) === 0),
  );

  await page.keyboard.press("Control+ArrowDown");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(500);
  step(
    "Control-Down shows the front application's windows alone",
    (await overview.locator(".mac-mission-control-window").count()) === 1 &&
      (await thumb("Chess").count()) === 1,
  );
  await shot(page, path.join(out, `mission-control-expose-${browserName}.png`));
  await page.keyboard.press("Escape");
  await until(async () => (await overview.count()) === 0);

  await tile("TextEdit").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show All Windows", exact: true }).click();
  await overview.waitFor({ timeout: 4_000 });
  step("A tile's Show All Windows shows that application's", (await thumb("Chess").count()) === 0);
  await page.keyboard.press("Escape");
  await until(async () => (await overview.count()) === 0);

  await page.keyboard.press("Control+Alt+KeyD");
  await page.waitForTimeout(500);
  const off = await shell("chess").boundingBox();
  const view = page.viewportSize();
  step(
    "Show Desktop slides the windows off the screen",
    off.x + off.width <= 0 ||
      off.x >= view.width ||
      off.y + off.height <= 0 ||
      off.y >= view.height,
    JSON.stringify(off),
  );
  await shot(page, path.join(out, `mission-control-show-desktop-${browserName}.png`));
  await page.keyboard.press("Control+Alt+KeyD");
  await page.waitForTimeout(500);
  const on = await shell("chess").boundingBox();
  step("and again brings them back", on.x >= 0 && on.x < view.width, JSON.stringify(on));

  // Show Desktop from Mission Control leaves no overview behind.
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+Alt+KeyD");
  step(
    "Show Desktop from Mission Control closes it",
    await until(async () => (await overview.count()) === 0),
  );
  await page.waitForTimeout(400);
  const gone = await shell("chess").boundingBox();
  step(
    "and the windows are off the screen",
    gone.x + gone.width <= 0 ||
      gone.x >= view.width ||
      gone.y + gone.height <= 0 ||
      gone.y >= view.height,
    JSON.stringify(gone),
  );
  await page.keyboard.press("Control+Alt+KeyD");
  await page.waitForTimeout(400);
  const whole = await shell("chess").boundingBox();
  step(
    "and return their own size, with no overview",
    whole.x >= 0 &&
      whole.x < view.width &&
      (await overview.count()) === 0 &&
      (await scaleOf("chess")) === 1,
    JSON.stringify(whole),
  );
  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");
  await launch(page, "Finder");
  await until(async () => (await front()) === "Finder");

  // A tap with nothing else: the application used before.
  const tapped = page.getByRole("listbox", { name: "Applications" });
  await page.keyboard.down("Alt");
  await page.keyboard.press("Tab");
  await tapped.waitFor({ timeout: 3_000 });
  await page.keyboard.up("Alt");
  step(
    "Option-Tab and letting go goes to the application used before",
    await until(async () => (await front()) === "Chess"),
    await front(),
  );

  // The switcher: most recent first.
  const switcher = page.getByRole("listbox", { name: "Applications" });
  await until(async () => (await front()) === "Chess");
  await page.keyboard.down("Alt");
  await page.keyboard.press("Tab");
  await switcher.waitFor({ timeout: 3_000 });
  const names = await switcher
    .getByRole("option")
    .evaluateAll((all) => all.map((each) => each.dataset.value));
  await shot(page, path.join(out, `mission-control-switcher-${browserName}.png`));
  step("Option-Tab lists the running applications", names.length === 3, names.join(", "));
  const selected = async () =>
    (await switcher.locator('[aria-selected="true"]').getAttribute("data-value")) ?? "";
  const first = await selected();
  await page.keyboard.press("Tab");
  const second = await selected();
  step("Tab steps along", second !== first, `${first} then ${second}`);
  await page.keyboard.press("Shift+Tab");
  step("Shift steps back", (await selected()) === first);
  await page.keyboard.up("Alt");
  step(
    "Letting go chooses",
    await until(
      async () => (await switcher.count()) === 0 && (await front()).toLowerCase() !== "chess",
    ),
    await front(),
  );
  await page.keyboard.down("Alt");
  await page.keyboard.press("Tab");
  await switcher.waitFor({ timeout: 3_000 });
  while ((await selected()) !== "chess") await page.keyboard.press("Tab");
  await page.keyboard.press("q");
  step(
    "Q quits the selected application",
    await until(async () => (await tile("Chess").getAttribute("data-running")) === null),
  );
  step(
    "and it leaves the list, so that letting go cannot open it again",
    await until(async () => (await switcher.locator('[data-value="chess"]').count()) === 0),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.up("Alt");
  step("Escape leaves without choosing", await until(async () => (await switcher.count()) === 0));

  // Next window of an application.
  await launch(page, "Finder");
  await until(async () => (await front()) === "Finder", 3_000);
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "New Finder Window", exact: true }).click();
  await until(async () => (await page.locator(".mac-window.mac-finder").count()) === 2);
  const keyOf = () =>
    page
      .locator('.mac-managed-window > [data-window-state="key"]')
      .first()
      .evaluate((element) => element.parentElement.dataset.windowId);
  await until(async () => (await keyOf()) === "finder:2");
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Window", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Cycle Through Windows" }).click();
  step(
    "Cycle Through Windows goes to the application's next window",
    await until(async () => (await keyOf()) === "finder"),
  );
});
