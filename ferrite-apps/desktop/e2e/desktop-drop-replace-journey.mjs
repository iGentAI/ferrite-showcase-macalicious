#!/usr/bin/env node
// A file from Finder let go on the desktop, where the Desktop folder has one of its name: the Replace
// alert asks, Stop leaves it, Replace takes the other's place and Undo gives back both, Keep Both takes
// the next name. Read back from the server.
//
//   node e2e/desktop-drop-replace-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-drop-replace");
const tag = Date.now().toString(36);
const NAME = `Clash ${tag}.txt`;
const FOLDER = `From ${tag}`;

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];
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
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
  });
  const folderId = made.json.created?.[0];
  const moved = await uploadFile(page, {
    parent: folderId,
    name: NAME,
    type: "text/plain",
    text: "from the folder",
  });
  const there = await uploadFile(page, {
    parent: "desktop",
    name: NAME,
    type: "text/plain",
    text: "on the desktop",
  });
  await page.reload();
  await openDesktop(page, base, step);
  const entry = async (id) => (await entries(page)).find((each) => each.id === id);

  try {
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.getByRole("button", { name: "Finder" }).click();
    const win = page.locator(".mac-window.mac-finder").first();
    await win.waitFor({ timeout: 10_000 });
    await win.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    await win.getByRole("option", { name: FOLDER, exact: true }).first().dblclick();
    const file = win.getByRole("option", { name: NAME, exact: true }).first();
    await file.waitFor({ timeout: 10_000 });

    const dropOnDesktop = async () => {
      const box = await file.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 3 });
      await page.mouse.move(90, 600, { steps: 12 });
      await page.waitForTimeout(200);
      await page.mouse.up();
    };
    const ask = page.getByRole("alertdialog").first();

    await dropOnDesktop();
    step("A name the desktop has asks first", await until(() => ask.isVisible()));
    step("and says it is a move", (await ask.innerText()).includes("moving"));
    await shot(page, path.join(out, `desktop-drop-replace-ask-${browserName}.png`));
    await ask.getByRole("button", { name: "Stop" }).click();
    await page.waitForTimeout(500);
    step("Stop leaves it where it was", (await entry(moved))?.parent === folderId);

    await dropOnDesktop();
    await ask.getByRole("button", { name: "Replace" }).click();
    step(
      "Replace puts it on the desktop",
      await until(async () => (await entry(moved))?.parent === "desktop"),
    );
    step("and the other goes to the Trash", (await entry(there))?.trashed_ms !== undefined);
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "Edit", exact: true })
      .click();
    await page.getByRole("menuitem", { name: /^Undo Move/ }).click();
    step(
      "Undo gives back both",
      await until(
        async () =>
          (await entry(moved))?.parent === folderId &&
          (await entry(there))?.trashed_ms === undefined &&
          (await entry(there))?.parent === "desktop",
      ),
    );

    await file.waitFor({ timeout: 8_000 });
    await dropOnDesktop();
    await ask.getByRole("button", { name: "Keep Both" }).click();
    step(
      "Keep Both takes the next name on the desktop",
      await until(async () => {
        const now = await entry(moved);
        return now?.parent === "desktop" && now.name !== NAME;
      }),
      (await entry(moved))?.name,
    );
    step("and the other stays", (await entry(there))?.name === NAME);
    await shot(page, path.join(out, `desktop-drop-replace-kept-${browserName}.png`));
  } finally {
    await api(page, "POST", "/api/files/ops", {
      ops: [
        { op: "trash", id: moved },
        { op: "trash", id: there },
        { op: "trash", id: folderId },
      ],
    });
  }
});
