#!/usr/bin/env node
// Get Info on the signed-in person's drive: the name, comments, Locked, Hide extension, Stationery
// pad and Open with, each read back from the server or seen doing what it says.
//
//   node scripts/dev-front-end.mjs --port 3020 --api 8792
//   node e2e/finder-info-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("finder-info");
const tag = Date.now().toString(36);
const NOTE = `Info note ${tag}.txt`;
const RENAMED = `Renamed ${tag}.txt`;
const PAD = `Pad ${tag}.txt`;

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries;
const entry = async (page, id) => (await entries(page)).find((each) => each.id === id);

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
  const up = (name) =>
    uploadFile(page, { parent: "documents", name, type: "text/plain", text: name });
  const noteId = await up(NOTE);
  const padId = await up(PAD);
  await page.reload();
  await openDesktop(page, base, step);
  const bar = page.getByRole("menubar").first();
  const choose = async (title, row) => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: row, exact: true }).click();
  };
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await choose("Go", "Documents");
  const item = (name) => win.getByRole("option", { name, exact: true });
  await item(NOTE).click();
  await choose("File", "Get Info");
  const info = page.locator(".mac-finder-info");
  await info.waitFor({ timeout: 5_000 });

  // The name.
  const name = info.getByRole("textbox", { name: "Name & Extension" });
  await name.fill(RENAMED);
  await name.press("Enter");
  step(
    "The name field renames the item, on the server",
    await until(async () => (await entry(page, noteId))?.name === RENAMED),
  );

  // Comments.
  await info.getByRole("button", { name: "Comments:" }).click();
  const comments = info.getByRole("textbox", { name: "Comments" });
  await comments.fill("Keep this");
  await comments.press("Tab");
  step(
    "Comments are kept on the server",
    await until(async () => (await entry(page, noteId))?.comment === "Keep this"),
  );

  // Hide extension.
  await info.getByRole("checkbox", { name: "Hide extension" }).click();
  step(
    "Hide extension is kept on the server",
    await until(async () => (await entry(page, noteId))?.hide_extension === true),
  );
  step(
    "and Finder shows the name without it",
    await until(async () => (await win.getByText(`Renamed ${tag}`, { exact: true }).count()) > 0),
  );
  await info.getByRole("checkbox", { name: "Hide extension" }).click();
  await until(async () => (await entry(page, noteId))?.hide_extension === undefined);

  // Locked.
  await info.getByRole("checkbox", { name: "Locked" }).click();
  step(
    "Locked is kept on the server",
    await until(async () => (await entry(page, noteId))?.locked === true),
  );
  await shot(page, path.join(out, `finder-info-locked-${browserName}.png`));
  expectRefusal(409, "/api/files/ops");
  const refused = await api(page, "POST", "/api/files/ops", { ops: [{ op: "trash", id: noteId }] });
  step(
    "A locked item cannot go to the Trash",
    refused.status === 409 && (await entry(page, noteId))?.trashed_ms === undefined,
    String(refused.status),
  );
  await info.getByRole("checkbox", { name: "Locked" }).click();
  await until(async () => (await entry(page, noteId))?.locked === undefined);

  // After a reload.
  await page.reload();
  await openDesktop(page, base, step);
  const back = page.locator(".mac-window.mac-finder").first();
  await back.waitFor({ timeout: 10_000 });
  await back.getByRole("option", { name: RENAMED, exact: true }).click();
  await choose("File", "Get Info");
  const again = page.locator(".mac-finder-info");
  await again.waitFor({ timeout: 5_000 });
  await again.getByRole("button", { name: "Comments:" }).click();
  step(
    "The comments are there after a reload",
    (await again.getByRole("textbox", { name: "Comments" }).inputValue()) === "Keep this",
  );
  await shot(page, path.join(out, `finder-info-comment-${browserName}.png`));

  // Stationery pad: what opens is a copy.
  await back.getByRole("option", { name: PAD, exact: true }).click();
  await choose("File", "Get Info");
  await page.locator(".mac-finder-info").getByRole("checkbox", { name: "Stationery pad" }).click();
  await until(async () => (await entry(page, padId))?.stationery === true);
  await back.getByRole("option", { name: PAD, exact: true }).dblclick();
  step(
    "Opening a stationery pad opens a copy, and the pad stays",
    await until(async () => {
      const all = await entries(page);
      const copy = all.find((each) => each.name.startsWith(`Pad ${tag}`) && each.id !== padId);
      return (
        copy !== undefined &&
        copy.stationery === undefined &&
        all.find((each) => each.id === padId)?.stationery === true
      );
    }),
  );

  // A pad of a file no application opens shows its copy in Quick Look.
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const odd = `Odd ${tag}.bin`;
  const oddId = await uploadFile(page, {
    parent: "documents",
    name: odd,
    type: "application/octet-stream",
    text: "odd",
  });
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "info", id: oddId, stationery: true }],
  });
  await page.reload();
  await openDesktop(page, base, step);
  const third = page.locator(".mac-window.mac-finder").first();
  await third.waitFor({ timeout: 10_000 });
  await third.getByRole("option", { name: odd, exact: true }).dblclick();
  const copyOfOdd = await until(async () =>
    (await entries(page)).find((each) => each.name.startsWith(`Odd ${tag}`) && each.id !== oddId),
  );
  step(
    "A stationery pad no application opens shows its copy in Quick Look",
    Boolean(copyOfOdd) &&
      (await until(
        async () =>
          (await page.locator(".mac-quick-look-panel-bar", { hasText: copyOfOdd.name }).count()) >
          0,
      )),
    copyOfOdd?.name,
  );
});
