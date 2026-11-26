#!/usr/bin/env node
// Kept versions on the served desktop. TextEdit saves a document three times; the drive keeps what
// each save replaced, read back through its routes, counted in the usage and not listed in the
// drive. Across a reload, Finder opens the one file, File > Revert To > Browse All Versions… shows
// the versions beside the document, Restore makes one the file's bytes and keeps what it replaced,
// and restoring again changes nothing. Previous Save goes back the same way. Erasing the file frees
// every byte. Exits 0 only when every step passed with no console error, page error, failed request
// or HTTP error other than the two refusals it provokes.
//
//   node e2e/versions-batch9-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("versions-batch9");
const stamp = Date.now();
const title = `Versions ${stamp}`;
const fileName = `${title}.rtf`;
const [one, two, three] = ["one", "two", "three"].map((word) => `Version ${word} ${stamp}`);

const ready = (page) =>
  page.waitForFunction(
    () => {
      const body = document.querySelector(".mac-textedit-body");
      return body && !body.hasAttribute("inert");
    },
    undefined,
    { timeout: 15_000 },
  );

/** Replaces the document's text with `text`. */
async function retype(page, editor, text) {
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type(text);
}

/** Chooses `item` under the desktop menu bar's File > Revert To. */
async function revertTo(page, item) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  const trigger = page.getByRole("menuitem", { name: "Revert To", exact: true });
  await trigger.waitFor({ timeout: 5_000 });
  await trigger.hover();
  const entry = page.getByRole("menuitem", { name: item, exact: true });
  await entry.waitFor({ timeout: 5_000 });
  await page.waitForFunction(
    (name) =>
      [...document.querySelectorAll('[role="menuitem"]')].some(
        (row) => row.textContent?.includes(name) && row.getAttribute("aria-disabled") !== "true",
      ),
    item,
    { timeout: 10_000 },
  );
  await entry.click();
}

const driveOf = async (page) => (await api(page, "GET", "/api/files/")).json;

async function fileOf(page) {
  const drive = await driveOf(page);
  return drive.entries.find((entry) => entry.name === fileName && entry.trashed_ms === undefined);
}

/** The bytes at `url`, as text. */
const textAt = (page, url) =>
  page.evaluate(async (at) => {
    const response = await fetch(at, { credentials: "same-origin" });
    return response.ok ? response.text() : `HTTP ${response.status}`;
  }, url);

/** Which of the three texts `text` holds. */
const word = (text) => [one, two, three].find((each) => text.includes(each)) ?? text.slice(0, 80);

/** The file's kept versions, newest first, each with the text its bytes hold. */
async function kept(page, id) {
  const { json } = await api(page, "GET", `/api/files/versions/${id}`);
  const versions = [];
  for (const version of json.versions) {
    versions.push({
      ...version,
      text: word(
        await textAt(page, `/api/files/versions/${id}/${version.version}?piece=0&count=8`),
      ),
    });
  }
  return { ...json, versions };
}

const current = async (page, id) =>
  word(await textAt(page, `/api/files/content/${id}?piece=0&count=8`));

/** Waits for `check` of the server's state to hold, and answers the last state it saw. */
async function until(page, read, check, seconds = 20) {
  let state = await read();
  for (let tries = 0; !check(state) && tries < seconds * 4; tries += 1) {
    await page.waitForTimeout(250);
    state = await read();
  }
  return state;
}

const listed = (state) => state.versions.map((version) => version.text);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", "/api/textedit/draft");
  const usageBefore = (await driveOf(page)).usage;
  await launch(page, "TextEdit");
  let window = page
    .locator(".mac-textedit")
    .filter({ has: page.getByRole("textbox", { name: "Document" }) })
    .first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await ready(page);
  let editor = window.getByRole("textbox", { name: "Document" });

  await retype(page, editor, one);
  await page.keyboard.press("ControlOrMeta+S");
  const sheet = page.getByRole("dialog", { name: "Save" });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("textbox", { name: "Save As:" }).fill(title);
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("region", { name: title, exact: true }).waitFor({ timeout: 15_000 });
  const file = await until(page, () => fileOf(page), Boolean);
  const id = file?.id;
  step("a new file has no earlier versions", same(listed(await kept(page, id)), []));

  for (const text of [two, three]) {
    const marked = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/files/versions/${id}/keep`,
      { timeout: 15_000 },
    );
    await retype(page, editor, text);
    await page.keyboard.press("ControlOrMeta+S");
    step(
      `File > Save marks "${text.split(" ")[1]}" as a saved version`,
      (await marked).status() === 204,
    );
  }
  let state = await until(
    page,
    () => kept(page, id),
    (seen) => same(listed(seen), [two, one]),
  );
  step(
    "the drive keeps what each save replaced, newest first, and the file holds the last",
    same(listed(state), [two, one]) && (await current(page, id)) === three,
    JSON.stringify(state.versions),
  );

  let drive = await driveOf(page);
  const sizes = state.versions.reduce((sum, version) => sum + version.size, 0);
  const entry = drive.entries.find((each) => each.id === id);
  step(
    "they count in the person's storage and are left out of the drive's list",
    drive.usage === usageBefore + entry.size + sizes &&
      drive.versions === undefined &&
      drive.entries.filter((each) => each.name.includes(String(stamp))).length === 1,
    `usage ${drive.usage}, was ${usageBefore}; file ${entry.size}; kept ${sizes}`,
  );

  // Across a reload: Finder lists the one file, and opens it.
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
  await reloadDesktop(page);
  await api(page, "DELETE", "/api/textedit/draft");
  state = await kept(page, id);
  step("the versions are still there after a reload", same(listed(state), [two, one]));
  await launch(page, "Finder");
  const finder = page.locator(".mac-finder").first();
  await finder.waitFor({ state: "visible", timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const icon = finder.getByRole("option", { name: fileName, exact: true });
  await icon.waitFor({ timeout: 15_000 });
  step(
    "Finder shows one file for them all",
    (await finder.getByRole("option", { name: new RegExp(String(stamp)) }).count()) === 1,
  );
  await icon.dblclick();
  window = page.getByRole("region", { name: title, exact: true });
  await window.waitFor({ state: "visible", timeout: 15_000 });
  editor = window.getByRole("textbox", { name: "Document" });
  await editor.getByText(three).waitFor({ timeout: 15_000 });
  await ready(page);

  // The sheet: the versions by date, the chosen one beside the document, Restore and Done.
  await revertTo(page, "Browse All Versions…");
  const versions = page.getByRole("dialog", { name: `Versions of “${fileName}”` });
  await versions.waitFor({ timeout: 10_000 });
  const pages = versions.getByRole("document");
  await versions.getByText(two).waitFor({ timeout: 10_000 });
  step(
    "Browse All Versions lists them by date, the newest chosen beside the document",
    (await versions.getByRole("row").count()) === 2 &&
      (await pages.nth(0).textContent()).includes(three) &&
      (await pages.nth(1).textContent()).includes(two),
  );
  await versions.getByRole("row").nth(1).click();
  await versions.getByText(one).waitFor({ timeout: 10_000 });
  step("choosing the older row shows its text", (await pages.nth(1).textContent()).includes(one));
  await shot(page, path.join(out, `versions-batch9-sheet-${browserName}.png`));
  await versions.getByRole("button", { name: "Done" }).click();
  await versions.waitFor({ state: "detached", timeout: 5_000 });
  step("Done changes nothing", (await current(page, id)) === three);

  await revertTo(page, "Browse All Versions…");
  await versions.waitFor({ timeout: 10_000 });
  await versions.getByText(two).waitFor({ timeout: 10_000 });
  await versions.getByRole("row").nth(1).click();
  await versions.getByText(one).waitFor({ timeout: 10_000 });
  const oldest = state.versions[1].version;
  await versions.getByRole("button", { name: "Restore" }).click();
  await editor.getByText(one).waitFor({ timeout: 15_000 });
  step("Restore puts that version in the window", true);
  state = await until(
    page,
    () => kept(page, id),
    (seen) => same(listed(seen), [three, two]),
  );
  step(
    "the file holds it now, and what it replaced is kept",
    (await current(page, id)) === one && same(listed(state), [three, two]),
    JSON.stringify(state.versions),
  );
  const restoredAt = (await fileOf(page)).version;
  step("the file stays the same file, at a new version", (await fileOf(page)).id === id);

  // The same request again, as after a lost reply.
  const usage = (await driveOf(page)).usage;
  const again = await api(page, "POST", `/api/files/versions/${id}/${oldest}/restore`, {
    base: restoredAt - 1,
  });
  step(
    "restoring it again changes nothing",
    again.status === 200 &&
      again.json.version === restoredAt &&
      (await fileOf(page)).version === restoredAt &&
      (await driveOf(page)).usage === usage &&
      same(listed(await kept(page, id)), [three, two]),
    `${again.status} at ${again.json.version}`,
  );

  // The next window's document is the restored one, across a reload, with Previous Save.
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
  await reloadDesktop(page);
  await api(page, "DELETE", "/api/textedit/draft");
  step(
    "after a reload the file still holds the restored version",
    (await current(page, id)) === one && same(listed(await kept(page, id)), [three, two]),
  );
  await launch(page, "Finder");
  await finder.waitFor({ state: "visible", timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await icon.waitFor({ timeout: 15_000 });
  await icon.dblclick();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await editor.getByText(one).waitFor({ timeout: 15_000 });
  await ready(page);
  await revertTo(page, "Previous Save");
  await editor.getByText(three).waitFor({ timeout: 15_000 });
  state = await until(
    page,
    () => kept(page, id),
    (seen) => same(listed(seen), [two, one]),
  );
  step(
    "Previous Save goes back to the save before, keeping what it replaced",
    (await current(page, id)) === three && same(listed(state), [two, one]),
    JSON.stringify(state.versions),
  );

  // A stale page is refused; a version that was never kept is not there.
  const staleAt = `/api/files/versions/${id}/${state.versions[0].version}/restore`;
  expectRefusal(412, staleAt);
  const stale = await api(page, "POST", staleAt, { base: 0 });
  step("a restore from a version the file has left is refused", stale.status === 412);

  // Erased, every byte is freed.
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
  await api(page, "POST", "/api/files/ops", { ops: [{ op: "trash", id }] });
  step(
    "in the Trash the versions stay, for Put Back",
    same(listed(await kept(page, id)), [two, one]),
  );
  await api(page, "POST", "/api/files/ops", { ops: [{ op: "empty-trash" }] });
  drive = await driveOf(page);
  step(
    "emptying the Trash frees the file and its versions",
    drive.usage === usageBefore,
    String(drive.usage),
  );
  expectRefusal(404, `/api/files/versions/${id}`);
  const gone = await api(page, "GET", `/api/files/versions/${id}`);
  step("its versions are gone with it", gone.status === 404);
});
