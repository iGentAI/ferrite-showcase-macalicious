#!/usr/bin/env node
// Storage Management's rows not walked elsewhere, on a served desktop: a file row's menu, Delete… and Show in Finder; the Trash
// the same as Finder's, there and after Empty Trash; and more than 500 files, where each kind says it lists the largest.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/storage-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";
import { driveOps, openWithSpotlight, uploadFile } from "./system-kit.mjs";

const RUN = Date.now().toString(36);
const KEPT = `kept-${RUN}.txt`;
const GONE = `gone-${RUN}.txt`;
const BINNED = `binned-${RUN}.txt`;
const FILLING = 501;

await journey("storage-more", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `storage-more-${name}.png`) });
  };
  await openDesktop(page, base);
  const text = "text/plain";
  const kept = await uploadFile(page, { parent: "documents", name: KEPT, type: text, size: 3_000 });
  await uploadFile(page, { parent: "documents", name: GONE, type: text, size: 2_000 });
  const binned = await uploadFile(page, {
    parent: "documents",
    name: BINNED,
    type: text,
    size: 4_000,
  });
  const trashed = await driveOps(page, [{ op: "trash", id: binned }]);
  step("a file goes to the Trash through the drive", trashed === 200, `HTTP ${trashed}`);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });

  await openWithSpotlight(page, "Storage Management");
  const win = page.locator('[data-window-id="storage-management"]');
  await win.waitFor({ timeout: 10_000 });
  const kind = (name) => win.getByRole("treeitem", { name });
  const file = (name) => win.getByRole("row", { name });
  await win.getByText(/Ferrite Drive - .* available of /).waitFor({ timeout: 10_000 });

  // A file row's menu.
  await kind(/^Documents/).click();
  await file(new RegExp(GONE)).waitFor({ timeout: 5_000 });
  await file(new RegExp(GONE)).click({ button: "right" });
  const menu = page.getByRole("menu");
  await menu.getByRole("menuitem", { name: /^Delete/ }).waitFor();
  await shot("row-menu");
  step(
    "a file row's menu offers Delete, Show in Finder and Quick Look",
    (await menu.getByRole("menuitem", { name: "Show in Finder" }).isVisible()) &&
      (await menu.getByRole("menuitem", { name: "Quick Look" }).isVisible()),
  );
  await menu.getByRole("menuitem", { name: /^Delete/ }).click();
  const alert = page.getByRole("alertdialog");
  await alert.waitFor({ timeout: 5_000 });
  await alert.getByRole("button", { name: /^(Delete|Remove)/ }).click();
  await file(new RegExp(GONE)).waitFor({ state: "detached", timeout: 5_000 });
  const names = () =>
    page.evaluate(async () => {
      const drive = await fetch("/api/files/").then((reply) => reply.json());
      return drive.entries.map((entry) => entry.name);
    });
  // The row goes as the request is sent: the drive answers a moment later.
  let held = await names();
  for (let tries = 0; tries < 20 && held.includes(GONE); tries += 1) {
    await page.waitForTimeout(250);
    held = await names();
  }
  step("its Delete… asks, and the file leaves the drive", !held.includes(GONE));

  await file(new RegExp(KEPT)).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Show in Finder" }).click();
  const finder = page.locator('[data-window-id^="finder"]').first();
  await finder.getByText(KEPT).first().waitFor({ timeout: 10_000 });
  await shot("row-show-in-finder");
  step("its Show in Finder opens Finder on the file", true);

  // The same Trash, here and in Finder.
  const dockTrash = page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Trash" });
  await dockTrash.click();
  await finder.getByText(BINNED).first().waitFor({ timeout: 10_000 });
  await shot("finder-trash");
  await openWithSpotlight(page, "Storage Management");
  await page.waitForTimeout(500);
  await kind(/^Trash/).click();
  await file(new RegExp(BINNED)).waitFor({ timeout: 5_000 });
  await shot("storage-trash");
  step(
    "Finder's Trash and this one list the same file",
    (await win.getByRole("row", { name: new RegExp(KEPT) }).count()) === 0,
  );
  await kind(/^Recommendations/).click();
  await win.getByRole("button", { name: "Empty Trash", exact: true }).click();
  await alert.waitFor({ timeout: 5_000 });
  await alert.getByRole("button", { name: "Empty Trash" }).click();
  await alert.waitFor({ state: "hidden", timeout: 5_000 });
  await page.waitForTimeout(800);
  await dockTrash.click();
  await finder.getByText(BINNED).first().waitFor({ state: "detached", timeout: 10_000 });
  await shot("finder-trash-emptied");
  await openWithSpotlight(page, "Storage Management");
  await page.waitForTimeout(500);
  await kind(/^Trash/).click();
  // The window reads the drive again as it comes forward.
  const gone = await file(new RegExp(BINNED))
    .waitFor({ state: "detached", timeout: 8_000 })
    .then(
      () => true,
      () => false,
    );
  step("this Trash no longer lists it either", gone);
  await shot("storage-trash-emptied");
  step(
    "Empty Trash here empties Finder's, and the drive no longer holds the file",
    !(await names()).includes(BINNED),
  );

  // More files than the report lists, as copies of one file: the drive takes up to 64 changes in a request.
  for (let n = 0; n < FILLING; n += 60) {
    const batch = Array.from({ length: Math.min(60, FILLING - n) }, (_, at) => ({
      op: "copy",
      id: kept,
      parent: "documents",
      name: `fill-${RUN}-${n + at}.txt`,
    }));
    const filled = await driveOps(page, batch);
    if (filled !== 200) throw new Error(`filling the drive: HTTP ${filled}`);
  }
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 40_000 });
  await openWithSpotlight(page, "Storage Management");
  await win.waitFor({ timeout: 10_000 });
  await win.getByText(/Ferrite Drive - .* available of /).waitFor({ timeout: 20_000 });
  const report = await page.evaluate(() =>
    fetch("/api/storage-management/usage").then((reply) => reply.json()),
  );
  step(
    "the report lists 500 files, the largest, and says it stopped",
    report.drive.files.length === 500 && report.drive.files_truncated === true,
    `${report.drive.files.length} files`,
  );
  await kind(/^Documents/).click();
  const said = win.getByText(/Only the 500 largest files of the drive are listed\./);
  await said.first().waitFor({ timeout: 5_000 });
  await shot("stops-at-500");
  step("a kind says so", true);
});
