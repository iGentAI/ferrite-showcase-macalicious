#!/usr/bin/env node
// Spotlight's Privacy on a served desktop: a folder dragged from Finder into the list keeps its files out of Spotlight's
// results, across a reload, and taking it off the list brings them back; a file dragged there is refused with a reason.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/spotlight-privacy-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { driveOps, uploadFile } from "./system-kit.mjs";

const RUN = Date.now().toString(36);
const FOLDER = `Private-${RUN}`;
const WORD = `hiddenword${RUN}`;
const LOOSE = `loose-${RUN}.txt`;

await journey("spotlight-privacy", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `spotlight-privacy-${name}.png`) });
  };
  await openDesktop(page, base);
  const status = await driveOps(page, [{ op: "mkdir", parent: "documents", name: FOLDER }]);
  if (status !== 200) throw new Error(`mkdir answered ${status}`);
  const folderId = await page.evaluate(async (name) => {
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    return drive.entries.find((entry) => entry.name === name)?.id;
  }, FOLDER);
  await uploadFile(page, {
    parent: folderId,
    name: `${WORD}.txt`,
    type: "text/plain",
    text: "kept\n",
  });
  await uploadFile(page, { parent: "documents", name: LOOSE, type: "text/plain", text: "loose\n" });
  await reloadDesktop(page);

  const search = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    const option = page.getByRole("option", { name: new RegExp(`${WORD}\\.txt`) });
    // The drive's index and the setting each reach the page in their own time, so a miss is asked again.
    for (let tries = 0; tries < 5; tries += 1) {
      await field.fill("");
      await field.fill(WORD);
      await page.waitForTimeout(1_200);
      if ((await option.count()) > 0) return true;
    }
    return false;
  };
  const closeSearch = async () => {
    // Escape empties a field with words in it first, and then closes Spotlight.
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    for (let tries = 0; tries < 3 && (await field.isVisible()); tries += 1) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  };
  step("Spotlight finds the file at first", await search());
  await closeSearch();

  const dock = (name) => page.getByRole("button", { name }).first();
  await dock(/^Finder$/).click();
  const finder = page.locator("[data-window-id^='finder']").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByText("Documents", { exact: true }).first().click();
  await finder.getByText(FOLDER, { exact: true }).first().waitFor({ timeout: 8_000 });

  await dock(/^System Preferences$/).click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+l");
  await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
  await prefs.getByRole("button", { name: "Spotlight", exact: true }).first().click();
  await page.waitForTimeout(300);
  await prefs.getByRole("tab", { name: "Privacy", exact: true }).click();
  const list = prefs.getByRole("grid", { name: "Folders Spotlight leaves out" });
  await list.waitFor({ timeout: 5_000 });
  // System Preferences moves right, so that its list shows beside Finder.
  const frame = await prefs.boundingBox();
  await page.mouse.move(frame.x + 300, frame.y + 12);
  await page.mouse.down();
  await page.mouse.move(frame.x + 400, frame.y + 12, { steps: 6 });
  await page.mouse.move(frame.x + 300 + (1436 - frame.x - frame.width), frame.y + 12, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const dragToList = async (name) => {
    await dock(/^Finder$/).click();
    await page.waitForTimeout(400);
    const item = finder.getByText(name, { exact: true }).first();
    const from = await item.boundingBox();
    const placed = await prefs.boundingBox();
    const box = await finder.boundingBox();
    const to = { x: box.x + box.width + 30, y: placed.y + 250 };
    const icon = { x: from.x + from.width / 2, y: from.y - 30 };
    await page.mouse.move(icon.x, icon.y);
    await page.mouse.down();
    await page.mouse.move(icon.x + 12, icon.y + 12, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);
  };
  await dragToList(LOOSE);
  await prefs.getByText("Spotlight keeps out folders").waitFor({ timeout: 5_000 });
  step(
    "a file dragged to the list is refused, with the reason",
    (await list.getByText(LOOSE).count()) === 0,
  );
  await shot("refused");
  await dragToList(FOLDER);
  await list.getByText(FOLDER, { exact: true }).waitFor({ timeout: 5_000 });
  step("a folder dragged from Finder joins the list", true);

  await dock(/^System Preferences$/).click();
  await page.waitForTimeout(800);
  await shot("listed");
  step("Spotlight no longer finds a file inside it", !(await search()));
  await shot("not-found");
  await closeSearch();

  await reloadDesktop(page);
  step("nor after a reload", !(await search()));
  await closeSearch();

  await dock(/^System Preferences$/).click();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const again = prefs.getByRole("grid", { name: "Folders Spotlight leaves out" });
  await again.getByText(FOLDER, { exact: true }).click();
  await prefs.getByRole("button", { name: "Remove the selected folder" }).click();
  await page.waitForTimeout(800);
  await shot("removed");
  step("− takes it off the list", (await again.getByText(FOLDER, { exact: true }).count()) === 0);
  step("and Spotlight finds the file again", await search());
  await closeSearch();
});
