#!/usr/bin/env node
// The desktop's cross-app pieces, with real mouse input, on the signed-in person's drive: a drag of
// several files shows one image with a count and moves them all, Option copies, the Dock's Trash
// takes what Finder drags, an application's Dock tile opens the file it opens and refuses one it
// does not, Escape stops a drag, a second Finder window pastes what the first copied, and Finder's
// Share menu lists its destinations. Everything that changes the drive is read back from the server.
//
//   node scripts/pack-site.mjs && ferrite dev --port 8787    # in ferrite-apps/desktop
//   node e2e/cross-app-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("cross-app");
const tag = Date.now().toString(36);
const A = `Drag A ${tag}.png`;
const B = `Drag B ${tag}.png`;
const TEXT = `Drag text ${tag}.txt`;
const SOUND = `Drag sound ${tag}.mp3`;
const FOLDER = `Drag folder ${tag}`;

const finderWindow = (page) => page.locator(".mac-window.mac-finder");
const item = (win, name) => win.getByRole("option", { name, exact: true }).first();
const place = (win, name) => win.getByRole("treeitem", { name, exact: true }).first();
const dockTile = (page, target) => page.locator(`.mac-dock [data-dock-target="${target}"]`);
const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const entry = async (page, name) => (await drive(page)).entries.filter((e) => e.name === name);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses on `from` and moves to `to`, leaving the button down. */
async function dragTo(page, from, to) {
  const a = await centre(from);
  const b = await centre(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 12 });
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const ids = {};
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
  });
  const folderId = made.json.created?.[0];
  step("a folder and four files are on the drive", made.status === 200 && Boolean(folderId));
  for (const [name, type] of [
    [A, "image/png"],
    [B, "image/png"],
    [TEXT, "text/plain"],
    [SOUND, "audio/mpeg"],
  ]) {
    ids[name] = await uploadFile(page, {
      parent: "documents",
      name,
      type,
      text: `bytes of ${name}`,
    });
  }

  await dockTile(page, "trash").waitFor({ timeout: 15_000 });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = finderWindow(page).first();
  await win.waitFor({ timeout: 10_000 });
  await place(win, "Documents").click();
  await item(win, A).waitFor({ timeout: 10_000 });

  // Two files selected, then dragged by one of them.
  await item(win, A).click();
  await item(win, B).click({ modifiers: ["Control"] });
  await dragTo(page, item(win, A), item(win, FOLDER));
  const image = page.locator(".mac-desktop-drag");
  step("the drag shows one image", (await image.count()) === 1);
  step(
    "the image counts both files",
    (await page.locator(".mac-desktop-drag-count").textContent()) === "2",
  );
  step(
    "the folder under the pointer is marked as the target",
    (await item(win, FOLDER).getAttribute("data-desktop-drop")) === "accept",
  );
  await shot(page, path.join(out, `cross-app-drag-${browserName}.png`));
  await page.mouse.up();
  const bothMoved = await until(async () => {
    const entries = (await drive(page)).entries;
    return [ids[A], ids[B]].every((id) => entries.find((e) => e.id === id)?.parent === folderId);
  });
  step("both files moved into the folder, on the server", bothMoved);
  step("the image is gone", (await image.count()) === 0);

  // Option copies: the original stays in the folder.
  await item(win, FOLDER).dblclick();
  await item(win, A).waitFor({ timeout: 10_000 });
  const a = await centre(item(win, A));
  const documents = await centre(place(win, "Documents"));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.keyboard.down("Alt");
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
  await page.mouse.move(documents.x, documents.y, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const copied = await until(async () => {
    const named = await entry(page, A);
    return (
      named.some((e) => e.id === ids[A] && e.parent === folderId) &&
      named.some((e) => e.id !== ids[A] && e.parent === "documents")
    );
  });
  step("Option-drag copies: the original stays and a copy is in Documents", copied);

  // Escape stops a drag, and nothing moves.
  await dragTo(page, item(win, B), place(win, "Documents"));
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(400);
  step(
    "Escape stops a drag: the file stays where it was",
    (await entry(page, B)).some((e) => e.id === ids[B] && e.parent === folderId),
  );

  // The Dock's Trash.
  await dragTo(page, item(win, B), dockTile(page, "trash"));
  await page.mouse.up();
  const trashed = await until(async () => {
    const found = (await drive(page)).entries.find((e) => e.id === ids[B]);
    return found?.trashed_ms !== undefined;
  });
  step("a file dragged onto the Dock's Trash is in the Trash, on the server", trashed);

  // An application's Dock tile: refused by one that does not open the file, opened by one that does.
  await place(win, "Documents").click();
  await item(win, TEXT).waitFor({ timeout: 10_000 });
  const refuser = dockTile(page, "calculator").or(dockTile(page, "chess")).first();
  if ((await refuser.count()) > 0) {
    await dragTo(page, item(win, SOUND), refuser);
    step(
      "an application's tile that cannot open the file refuses it",
      (await refuser.getAttribute("data-desktop-drop")) === "refuse",
    );
    await page.mouse.up();
  }
  const textEdit = dockTile(page, "textedit");
  if ((await textEdit.count()) > 0) {
    await dragTo(page, item(win, TEXT), textEdit);
    step(
      "TextEdit's tile accepts a text file",
      (await textEdit.getAttribute("data-desktop-drop")) === "accept",
    );
    await page.mouse.up();
    const editor = page.locator('.mac-managed-window[data-window-id^="textedit"]').first();
    await editor.waitFor({ timeout: 10_000 });
    const document = editor.locator("textarea").first();
    const opened = await until(async () =>
      (await document.inputValue().catch(() => "")).includes(`bytes of ${TEXT}`),
    );
    step("dropped on TextEdit's tile, the text file opens in TextEdit", opened);
    await shot(page, path.join(out, `cross-app-open-${browserName}.png`));
    await page.keyboard.press("Control+q");
  }

  // Copy in one Finder window, Paste in another.
  const inDownloads = async () =>
    (await entry(page, SOUND)).filter((e) => e.parent === "downloads").length;
  await win.click({ position: { x: 300, y: 12 } });
  await item(win, SOUND).click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+n");
  await until(async () => (await finderWindow(page).count()) === 2);
  const second = finderWindow(page).last();
  await place(second, "Downloads").click();
  await page.waitForTimeout(300);
  const list = second.getByRole("listbox").first();
  await list.click({ position: { x: 5, y: 5 } });

  await page.keyboard.press("Control+v");
  const pasted = await until(async () => (await inDownloads()) === 1);
  step("a file copied in one Finder window pastes in another, on the server", pasted);
  await shot(page, path.join(out, `cross-app-paste-${browserName}.png`));

  // Share.
  await item(second, SOUND).click();
  const share = second.getByRole("button", { name: "Share", exact: true }).first();
  await share.click();
  const menu = page.getByRole("menu").last();
  await menu.waitFor({ timeout: 5_000 });
  const rows = (await menu.getByRole("menuitem").allInnerTexts()).map((text) => text.trim());
  step(
    "Share lists Mail, Messages, AirDrop, Notes and Add to Photos",
    ["Mail", "Messages", "AirDrop", "Notes", "Add to Photos"].every((row) => rows.includes(row)),
    rows.join(", "),
  );
  const airdrop = menu.getByRole("menuitem", { name: "AirDrop" });
  step(
    "AirDrop is dimmed with its reason",
    (await airdrop.getAttribute("aria-disabled")) === "true" &&
      Boolean(await airdrop.getAttribute("data-reason")),
  );
  await shot(page, path.join(out, `cross-app-share-${browserName}.png`));
  await page.keyboard.press("Escape");
});
