#!/usr/bin/env node
// A Finder window's Quick Actions and Services for what is selected: only what it can do, and each
// doing it, read back from the server where it keeps something.
//
//   node e2e/finder-services-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base } = options();
const { step, run } = journey("finder-services");
const tag = Date.now().toString(36);
const PICTURE = `Dot ${tag}.png`;
const TEXT = `Words ${tag}.txt`;
const FOLDER = `Folder ${tag}`;
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

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
  await uploadFile(page, {
    parent: "documents",
    name: PICTURE,
    type: "image/png",
    bytes: Buffer.from(PNG, "base64"),
  });
  await uploadFile(page, { parent: "documents", name: TEXT, type: "text/plain", text: "words" });
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
  });
  await reloadDesktop(page);
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 8_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  const item = (name) => finder.getByRole("option", { name: new RegExp(name) }).first();
  await item(PICTURE).waitFor({ timeout: 8_000 });
  const rows = () => page.getByRole("menuitem");
  const rowNames = async () =>
    (await rows().allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim());
  const closeMenus = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  };
  const choose = async (name, submenu, row) => {
    await item(name).click({ button: "right" });
    await page.getByRole("menuitem", { name: submenu, exact: true }).hover();
    await page.getByRole("menuitem", { name: row, exact: true }).click();
  };

  await item(FOLDER).click({ button: "right" });
  await page.waitForTimeout(200);
  const onFolder = await rowNames();
  step(
    "A folder has no Quick Actions for pictures",
    !onFolder.includes("Quick Actions") && onFolder.includes("Services"),
    onFolder.join(", "),
  );
  await closeMenus();

  const shapeOf = () =>
    item(PICTURE).evaluate((each) => each.querySelector('[style*="rotate"]')?.style.rotate ?? "");
  const before = await shapeOf();
  await choose(PICTURE, "Quick Actions", "Rotate Left");
  step(
    "Quick Actions > Rotate Left turns the picture",
    await until(async () => (await shapeOf()) !== before),
    `${before} to ${await shapeOf()}`,
  );

  await choose(PICTURE, "Services", "Set Desktop Picture");
  step(
    "Services > Set Desktop Picture makes it the desktop's picture",
    await until(() =>
      page.evaluate(
        () =>
          document.querySelector(".mac-desktop-shell-picture img")?.src?.startsWith("blob:") ??
          false,
      ),
    ),
  );
  const { json: drive } = await api(page, "GET", "/api/files/");
  let keptPicture;
  step(
    "and it is kept on the server by its file",
    await until(async () => {
      const { json } = await api(page, "GET", "/api/system-preferences/settings");
      keptPicture = json.values?.["desktop-and-screen-saver.picture"];
      return drive.entries.some(
        (entry) => entry.name === PICTURE && keptPicture === `drive:${entry.id}`,
      );
    }),
    String(keptPicture),
  );

  await item(TEXT).click({ button: "right" });
  await page.waitForTimeout(200);
  const onText = await rowNames();
  step(
    "A text file has no Quick Actions for pictures",
    !onText.includes("Quick Actions") && onText.includes("Services"),
    onText.join(", "),
  );
  await closeMenus();
  await choose(TEXT, "Services", "Open Selected File in TextEdit");
  const textedit = page.locator('[data-window-id^="textedit"]').first();
  await textedit.waitFor({ timeout: 8_000 });
  step(
    "Services > Open Selected File in TextEdit opens it there",
    await until(async () => (await textedit.innerText()).includes(TEXT)),
    await textedit.innerText(),
  );

  await launch(page, "Finder");
  await page.waitForTimeout(400);
  await item(FOLDER).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Services", exact: true }).hover();
  await page.getByRole("menuitem", { name: "New Terminal at Folder", exact: true }).waitFor();
  step(
    "On a folder, Services offers New Terminal at Folder and New Terminal Tab at Folder",
    (await page.getByRole("menuitem", { name: "New Terminal Tab at Folder" }).count()) === 1,
  );
  await page.getByRole("menuitem", { name: "New Terminal at Folder", exact: true }).click();
  const terminal = page.locator('[data-window-id^="terminal"]').last();
  await terminal.waitFor({ timeout: 8_000 });
  await page.waitForTimeout(1_500);
  await terminal.getByLabel("Terminal input").focus();
  await page.keyboard.type("pwd\n");
  step(
    "Services > New Terminal at Folder opens a Terminal window at that folder",
    await until(async () => (await terminal.innerText()).includes(FOLDER)),
    await terminal.innerText(),
  );
});
