#!/usr/bin/env node
// Finder's file commands, on the signed-in person's drive: Compress makes a zip whose bytes are read
// back from the server and unpacked, Undo takes it back; Make Alias opens its original and Show Original
// finds it, and says so once it has gone; Add to Sidebar keeps a folder there across a reload; Print
// prints from a frame.
//
//   node e2e/finder-files-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]
//
// --url also takes a development front end (scripts/dev-front-end.mjs) or the hosted site.

import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run, expectConsole } = journey("finder-files");
const tag = Date.now().toString(36);
const NOTE = `Zip me ${tag}.txt`;
const OTHER = `Also ${tag}.txt`;
const SCRIPTED = `Scripted ${tag}.svg`;
const FOLDER = `Box ${tag}`;
const LOOP = `Loop ${tag}`;
const ALIAS_TYPE = "application/x-macalicious-alias";
const TEXT = "hello from the drive ".repeat(200);

const bar = (page) => page.getByRole("menubar").first();
const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const named = async (page, name) =>
  (await drive(page)).entries.find((each) => each.name === name && each.trashed_ms === undefined);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const menusClosed = (page) =>
  until(async () => (await page.getByRole("menu").count()) === 0, 3_000);

async function choose(page, title, item, role = "menuitem") {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).click();
  await page.getByRole("menu").getByRole(role, { name: item, exact: true }).click();
  await menusClosed(page);
}

/** The bytes of a small drive file, from the route the desktop reads files by. */
const bytesOf = (page, entry) =>
  page.evaluate(
    async ({ id, version }) => {
      const response = await fetch(`/api/files/content/${id}?piece=0&count=8&version=${version}`, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`the file was refused: HTTP ${response.status}`);
      return [...new Uint8Array(await response.arrayBuffer())];
    },
    { id: entry.id, version: entry.version ?? 0 },
  );

/** Saves over the alias `id` a body naming itself, which only a tampered or restored file would hold. */
const pointAliasAtItself = (page, id) =>
  page.evaluate(
    async ({ id, name, type }) => {
      const bytes = new TextEncoder().encode(JSON.stringify({ id }));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "documents",
          name,
          size: bytes.length,
          type,
          existing: "overwrite",
          replaces: id,
        }),
      });
      if (started.status !== 201) throw new Error(`refused: HTTP ${started.status}`);
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      const done = await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
      if (done.status !== 200) throw new Error(`refused: HTTP ${done.status}`);
    },
    { id, name: LOOP, type: ALIAS_TYPE },
  );

/** The names and texts of a zip, read by its central directory. */
function unzip(list) {
  const bytes = Uint8Array.from(list);
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = {};
  for (let index = 0; index < count; index += 1) {
    const method = view.getUint16(at + 10, true);
    const packed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = Buffer.from(bytes.subarray(at + 46, at + 46 + nameLength)).toString();
    const start = local + 30 + view.getUint16(local + 26, true);
    const body = bytes.subarray(start, start + packed);
    entries[name] = (method === 8 ? inflateRawSync(body) : Buffer.from(body)).toString();
    at += 46 + nameLength;
  }
  return entries;
}

await run(async (page) => {
  // A browser without a printer does nothing on print(): count the calls on the frames it is asked of.
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      get() {
        const frame = original.get.call(this);
        if (frame && this.dataset.finderPrint !== undefined) {
          frame.print = () => {
            window.__printed = (window.__printed ?? 0) + 1;
          };
        }
        return frame;
      },
    });
  });
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: NOTE, type: "text/plain", text: TEXT });
  const loop = await uploadFile(page, {
    parent: "documents",
    name: LOOP,
    type: ALIAS_TYPE,
    text: "{}",
  });
  await pointAliasAtItself(page, loop);
  await uploadFile(page, { parent: "documents", name: OTHER, type: "text/plain", text: "also" });
  await uploadFile(page, {
    parent: "documents",
    name: SCRIPTED,
    type: "image/svg+xml",
    text: '<svg xmlns="http://www.w3.org/2000/svg"><script>parent.__printedScript=1</script></svg>',
  });
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
  });
  const folderId = made.json.created?.[0];
  await uploadFile(page, {
    parent: folderId,
    name: "inner.txt",
    type: "text/plain",
    text: "inner",
  });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  let win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(NOTE).waitFor({ timeout: 10_000 });

  // Compress one file, then Undo.
  await item(NOTE).click();
  await choose(page, "File", `Compress “${NOTE}”`);
  const zipName = `${NOTE}.zip`;
  const zip = await until(() => named(page, zipName), 15_000);
  step("Compress makes a zip beside the file, on the server", Boolean(zip));
  const inside = unzip(await bytesOf(page, zip));
  step("The zip holds the file's own bytes", inside[NOTE] === TEXT, Object.keys(inside).join(", "));
  step("The zip is smaller than the file", zip.size < TEXT.length, String(zip.size));
  await item(zipName).waitFor({ timeout: 8_000 });
  await shot(page, path.join(out, `finder-files-zip-${browserName}.png`));
  await choose(page, "Edit", `Undo Compress “${NOTE}”`);
  step(
    "Undo sends the zip to the Trash, on the server",
    await until(async () => (await named(page, zipName)) === undefined),
  );

  // Compress a folder and a file together.
  await item(FOLDER).click();
  await item(OTHER).click({ modifiers: ["Control"] });
  await choose(page, "File", "Compress 2 Items");
  const archive = await until(() => named(page, "Archive.zip"), 15_000);
  const both = archive ? unzip(await bytesOf(page, archive)) : {};
  step(
    "Several items go in Archive.zip, a folder with what it holds",
    both[`${FOLDER}/inner.txt`] === "inner" && both[OTHER] === "also",
    Object.keys(both).join(", "),
  );

  // An alias.
  await item(OTHER).click();
  await choose(page, "File", "Make Alias");
  const aliasName = `${OTHER} alias`;
  step(
    "Make Alias makes a file that names the original, on the server",
    await until(async () => (await named(page, aliasName))?.type?.includes("alias")),
  );
  await item(aliasName).waitFor({ timeout: 8_000 });
  await shot(page, path.join(out, `finder-files-alias-${browserName}.png`));
  await item(aliasName).click();
  await choose(page, "File", "Show Original");
  step(
    "Show Original selects the original in its folder",
    await until(async () => (await item(OTHER).getAttribute("aria-selected")) === "true"),
  );
  await choose(page, "View", "as Columns", "menuitemradio");
  await item(aliasName).click();
  await choose(page, "File", "Show Original");
  step(
    "and in column view too",
    await until(async () => (await item(OTHER).getAttribute("aria-selected")) === "true"),
  );
  await choose(page, "View", "as Icons", "menuitemradio");

  // Add to Sidebar, across a reload.
  await item(FOLDER).click();
  await choose(page, "File", "Add to Sidebar");
  const sideRow = () => win.getByRole("treeitem", { name: FOLDER, exact: true });
  step(
    "Add to Sidebar shows the folder there",
    await until(async () => (await sideRow().count()) === 1),
  );
  await until(async () =>
    JSON.stringify((await api(page, "GET", "/api/system-preferences/settings")).json).includes(
      folderId,
    ),
  );
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  step("It is there after a reload", await until(async () => (await sideRow().count()) === 1));
  await sideRow().click();
  step(
    "The row opens the folder",
    await until(
      async () => (await win.getByRole("option", { name: "inner.txt", exact: true }).count()) === 1,
    ),
  );
  await shot(page, path.join(out, `finder-files-sidebar-${browserName}.png`));
  await sideRow().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove from Sidebar", exact: true }).click();
  step(
    "Remove from Sidebar takes it away",
    await until(async () => (await sideRow().count()) === 0),
  );

  // Print.
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(NOTE).click();
  await choose(page, "File", "Print");
  step(
    "Print puts the file's bytes in a frame to print from",
    (await until(async () => (await page.locator("iframe[data-finder-print]").count()) === 1)) &&
      (await until(() =>
        page.evaluate(
          (text) =>
            document
              .querySelector("iframe[data-finder-print]")
              ?.contentDocument?.body?.textContent?.trim() === text.trim(),
          TEXT,
        ),
      )),
  );
  step(
    "and asks the browser to print it",
    await until(() => page.evaluate(() => window.__printed === 1)),
  );
  await item(SCRIPTED).click();
  const blocked = expectConsole("Blocked script execution");
  await choose(page, "File", "Print");
  const frames = page.locator("iframe[data-finder-print]");
  await until(async () => (await frames.count()) === 2);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  step(
    "A script in a printed SVG does not run",
    (await frames.nth(1).getAttribute("sandbox"))?.includes("allow-scripts") === false &&
      (await page.evaluate(() => window.__printedScript)) === undefined &&
      blocked.seen,
  );

  // Opening an alias, then one whose original has gone.
  await item(aliasName).dblclick();
  const opened = page.getByRole("textbox", { name: "Document" }).first();
  const documentText = () =>
    opened
      .evaluate((element) => element.value ?? element.textContent, undefined, { timeout: 500 })
      .catch(() => "");
  const openedText = await until(async () => {
    const text = (await documentText()).trim();
    return text === "also" ? text : null;
  }, 10_000);
  await shot(page, path.join(out, `finder-files-alias-opened-${browserName}.png`));
  step(
    "Opening the alias opens the original in its application",
    openedText === "also",
    await documentText(),
  );
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await item(OTHER).click();
  await choose(page, "File", "Move to Trash");
  await until(async () => (await named(page, OTHER)) === undefined);
  await item(aliasName).dblclick();
  const alert = page.getByRole("alertdialog");
  step(
    "An alias whose original is in the Trash says it can't be found",
    await alert
      .getByText(/can’t be found/)
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await shot(page, path.join(out, `finder-files-alias-gone-${browserName}.png`));
  await alert.getByRole("button").first().click();

  // An alias that leads back to itself says so, rather than reading it for ever.
  await item(LOOP).dblclick();
  step(
    "An alias that names itself says it leads back to itself",
    await alert
      .getByText(/leads back to itself/)
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await alert.getByRole("button").first().click();
});
