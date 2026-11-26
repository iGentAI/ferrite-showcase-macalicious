#!/usr/bin/env node
// Mission Control's rows nothing drove: its Dock tile and Launchpad's, a click on the desktop, App Exposé's shelf of
// recent documents, and H in the application switcher.
//
//   node e2e/overview-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("overview-more");
const tag = Date.now().toString(36);
const NOTE = `Shelved ${tag}.txt`;
const OTHER = `Shown ${tag}.txt`;
const NOTE_WORDS = `words of the shelved ${tag}`;
const OTHER_WORDS = `words of the shown ${tag}`;

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
  const id = await uploadFile(page, {
    parent: "desktop",
    name: NOTE,
    type: "text/plain",
    text: NOTE_WORDS,
  });
  const otherId = await uploadFile(page, {
    parent: "desktop",
    name: OTHER,
    type: "text/plain",
    text: OTHER_WORDS,
  });
  await page.reload();
  await openDesktop(page, base, step);
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const closed = () => until(async () => (await overview.count()) === 0);

  try {
    // Its tile.
    await tile("Mission Control").click();
    await overview.waitFor({ timeout: 5_000 });
    step("The Dock's tile opens Mission Control", true);
    await shot(page, path.join(out, `overview-from-tile-${browserName}.png`));
    await page.keyboard.press("Escape");
    step("Escape closes it", await closed());

    await tile("Mission Control").click();
    await overview.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(400);
    const { width } = page.viewportSize();
    await page.mouse.click(width / 2, 600);
    step("A click on the desktop closes it", await closed());

    // Launchpad's.
    await page.keyboard.press("F4");
    const inLaunchpad = page.locator(".mac-launchpad-item[data-app]").filter({
      hasText: "Mission Control",
    });
    step("Launchpad lists Mission Control", await until(() => inLaunchpad.first().isVisible()));
    await shot(page, path.join(out, `overview-launchpad-${browserName}.png`));
    await inLaunchpad.first().click();
    await overview.waitFor({ timeout: 5_000 });
    step("and opens it", true);
    await page.keyboard.press("Escape");
    await closed();

    // The shelf: one document opened, then another in its place, so the row has something to bring back.
    const icon = (name) =>
      page
        .getByRole("group", { name: "Desktop", exact: true })
        .locator(".mac-desktop-icon", { hasText: name })
        .first();
    const textOf = () =>
      page
        .getByRole("textbox", { name: "Document" })
        .evaluateAll((all) => all.map((each) => each.value ?? each.textContent).join("\n"))
        .catch(() => "");
    await icon(NOTE).dblclick();
    step(
      "The first document opens",
      await until(async () => (await textOf()).includes(NOTE_WORDS)),
    );
    await until(async () => {
      const { entries } = (await api(page, "GET", "/api/files/")).json;
      return entries.find((each) => each.id === id)?.opened_ms;
    });
    await icon(OTHER).dblclick();
    step(
      "and the second in front of it",
      await until(async () => (await textOf()).includes(OTHER_WORDS)),
    );
    step(
      "The first document no longer shows when the shelf is asked for it",
      await until(async () => !(await textOf()).includes(NOTE_WORDS)),
    );
    await page.waitForTimeout(600);
    await tile("TextEdit").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Show All Windows", exact: true }).click();
    await overview.waitFor({ timeout: 5_000 });
    const shelf = overview.getByRole("group", { name: "Recent Documents" });
    const shelved = shelf.getByRole("button", { name: new RegExp(NOTE) });
    step(
      "App Exposé shelves what the application opened lately",
      await until(() => shelved.isVisible()),
    );
    await page.waitForTimeout(400);
    await shot(page, path.join(out, `overview-shelf-${browserName}.png`));
    const shelfBox = await shelf.boundingBox();
    const dockTop = (await page.locator(".mac-desktop-shell-dock").boundingBox()).y;
    const nameBox = await shelved.getByText(NOTE).boundingBox();
    step(
      "under the windows, its name clear of the Dock",
      shelfBox.y > page.viewportSize().height / 2 && nameBox.y + nameBox.height <= dockTop,
      `shelf ${shelfBox.y}, name to ${nameBox.y + nameBox.height}, Dock from ${dockTop}`,
    );
    await shelved.click();
    await closed();
    step(
      "Its row brings that document back",
      await until(async () => (await textOf()).includes(NOTE_WORDS)),
    );

    // Calculator with nothing opened lately has no shelf.
    await launch(page, "Calculator");
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+ArrowDown");
    await overview.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(400);
    step(
      "An application with nothing to shelve shows no shelf",
      !(await overview.getByRole("group", { name: "Recent Documents" }).isVisible()),
    );
    await page.keyboard.press("Escape");
    await closed();

    // From Mission Control to App Exposé with the same windows: the live window follows its thumbnail.
    await page.keyboard.press("F3");
    await overview.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+ArrowDown");
    await overview
      .getByRole("group", { name: "Windows of Calculator" })
      .waitFor({ timeout: 5_000 });
    step("Control-Down goes from Mission Control to App Exposé", true);
    await page.waitForTimeout(600);
    const onItsButton = () =>
      page.evaluate(() => {
        const button = document.querySelector('[data-mission-window^="calculator"]');
        const shell = document.querySelector('[data-window-id^="calculator"]');
        if (!button || !shell) return false;
        const a = button.getBoundingClientRect();
        const b = shell.getBoundingClientRect();
        return Math.abs(a.left - b.left) < 3 && Math.abs(a.top - b.top) < 3;
      });
    step(
      "Switching to App Exposé keeps the live window on its thumbnail",
      await until(onItsButton),
    );
    await page.keyboard.press("Escape");
    await closed();

    // Option-Shift-Tab goes backwards from the first press.
    await launch(page, "Chess");
    await page.waitForTimeout(400);
    const switcherNow = page.getByRole("listbox", { name: "Applications" });
    await page.keyboard.down("Alt");
    await page.keyboard.press("Shift+Tab");
    await switcherNow.waitFor({ timeout: 3_000 });
    const listed = await switcherNow
      .getByRole("option")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-selected")));
    step(
      "The first Option-Shift-Tab selects the last application",
      listed.length >= 3 && listed.at(-1) === "true",
      JSON.stringify(listed),
    );
    await page.keyboard.press("Escape");
    await page.keyboard.up("Alt");

    // H in the switcher.
    const switcher = page.getByRole("listbox", { name: "Applications" });
    const selected = async () =>
      (await switcher.locator('[aria-selected="true"]').getAttribute("data-value")) ?? "";
    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    await switcher.waitFor({ timeout: 3_000 });
    for (let n = 0; n < 8 && (await selected()) !== "textedit"; n += 1) {
      await page.keyboard.press("Tab");
    }
    const chosen = await selected();
    await page.keyboard.press("h");
    const minimized = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-window-id][data-minimized]")].map(
          (each) => each.dataset.windowId,
        ),
      );
    step(
      "H hides the selected application",
      await until(async () => (await minimized()).some((each) => each.startsWith("textedit"))),
      `${chosen}; minimized: ${(await minimized()).join(", ")}`,
    );
    await shot(page, path.join(out, `overview-switcher-hide-${browserName}.png`));
    await page.keyboard.press("Escape");
    await page.keyboard.up("Alt");
  } finally {
    await api(page, "POST", "/api/files/ops", {
      ops: [
        { op: "trash", id },
        { op: "trash", id: otherId },
      ],
    });
  }
});
