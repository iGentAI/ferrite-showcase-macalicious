#!/usr/bin/env node
// Storage Management's depth on a served desktop: the honest iCloud and Optimize rows, Empty Trash
// Automatically turning Finder's 30-day rule on and off, the Applications list to read only, Downloads,
// Space and Quick Look handing a file to Finder, and the row and order surviving a reload. Exits 0 only
// when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/storage-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";
import { openWithSpotlight, uploadFile } from "./system-kit.mjs";

await journey("storage-depth", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await uploadFile(page, {
    parent: "downloads",
    name: "Installer.txt",
    type: "text/plain",
    text: "storage depth",
  });
  await page.evaluate(() =>
    fetch("/api/launchpad/layout", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ["storage-management"], page: 0, rev: 0 }),
    }),
  );
  // The page learned of the drive before this upload, which came in behind its back.
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });
  await openWithSpotlight(page, "Storage Management");
  const win = page.locator('[data-window-id="storage-management"]');
  await win.waitFor({ timeout: 10_000 });
  const row = (name) => win.getByRole("treeitem", { name });

  await win.getByRole("heading", { name: "Store in iCloud" }).waitFor({ timeout: 10_000 });
  step(
    "Store in iCloud says there is no iCloud and offers no button",
    await win.getByText("This desktop has no iCloud.").isVisible(),
  );
  step(
    "Optimize Storage says there is nothing to remove",
    await win.getByText(/Nothing here downloads movies/).isVisible(),
  );

  await win.getByRole("button", { name: "Turn On…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Turn On" }).click();
  await win.getByRole("button", { name: "Turn Off" }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  const rule = await page.evaluate(async () => {
    const reply = await fetch("/api/system-preferences/settings", { credentials: "same-origin" });
    return (await reply.text()).includes('"finder.trashAfter30":true');
  });
  step("Empty Trash Automatically turns Finder's 30-day rule on for the person", rule);
  await page.screenshot({ path: path.join(out, "storage-recommendations.png") });
  await win.getByRole("button", { name: "Turn Off" }).click();
  await win.getByRole("button", { name: "Turn On…" }).waitFor({ timeout: 5_000 });
  step("and off again", true);

  await row(/^Applications/).click();
  const noDelete = (await win.getByRole("button", { name: "Delete…" }).count()) === 0;
  step("Applications lists the apps by what they keep, with no Delete", noDelete);
  await page.screenshot({ path: path.join(out, "storage-applications.png") });

  await row(/^Downloads/).click();
  const listed = win.getByRole("row", { name: /Installer\.txt/ });
  await listed.waitFor({ timeout: 5_000 });
  step("Downloads lists the file in the Downloads folder", await listed.isVisible());
  await listed.click();
  await page.keyboard.press("Space");
  const preview = page.locator(".mac-finder-quick-look-plain");
  await preview.waitFor({ timeout: 10_000 });
  await page.screenshot({ path: path.join(out, "storage-quick-look.png") });
  const shown = await preview.innerText();
  step(
    "Space shows the file's text in Finder's Quick Look",
    shown.includes("storage depth"),
    shown,
  );
  await page.keyboard.press("Escape");
  await preview.waitFor({ state: "hidden", timeout: 5_000 });
  await openWithSpotlight(page, "Storage Management");
  await page.waitForTimeout(500);

  await listed.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Quick Look" }).click();
  await preview.waitFor({ timeout: 10_000 });
  step(
    "Quick Look on the row's menu shows it too",
    (await preview.innerText()).includes("storage depth"),
  );
  await page.keyboard.press("Escape");
  await preview.waitFor({ state: "hidden", timeout: 5_000 });
  await openWithSpotlight(page, "Storage Management");
  await page.waitForTimeout(500);

  await row(/^App Data/).click();
  const document = win.getByRole("row", { name: /Launchpad Order and Page/ });
  await document.click();
  await document.click({ button: "right" });
  const noLook = page.getByRole("menuitem", { name: "Quick Look" });
  step(
    "an app's document offers no Quick Look",
    (await noLook.getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
  step("and Space does not show one", (await preview.count()) === 0);

  await row(/^Downloads/).click();
  await win.getByRole("button", { name: "Name" }).click();
  await page.waitForTimeout(1_200);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });
  await openWithSpotlight(page, "Storage Management");
  await win.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, "storage-after-reload.png") });
  step(
    "after a reload the same row is shown",
    (await row(/^Downloads/).getAttribute("aria-selected")) === "true",
  );
  step(
    "and the same order",
    (await win.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")) ===
      "ascending",
  );
});
