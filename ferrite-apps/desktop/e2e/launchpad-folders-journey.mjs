#!/usr/bin/env node
// Launchpad's folders: an application let go on another makes one, it opens and renames, takes another
// application, lets one out, and a folder of one goes. Kept per account across a reload.
//
//   node e2e/launchpad-folders-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("launchpad-folders");

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
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const openPad = async () => {
    await dock.getByRole("button", { name: "Launchpad", exact: true }).click();
    await page.locator(".mac-launchpad-item").first().waitFor({ timeout: 6_000 });
    await page.waitForTimeout(300);
  };
  const appTile = (id) => page.locator(`.mac-launchpad-item[data-app="${id}"]`);
  const folderTile = page.locator(".mac-launchpad-folder").first();
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[
      "launchpad.folders"
    ] ?? [];
  await openPad();
  const [one, two, three] = await page
    .locator(".mac-launchpad-item[data-app]")
    .evaluateAll((all) => all.slice(0, 3).map((each) => each.dataset.app));

  await appTile(two).dragTo(appTile(one));
  step(
    "An application let go on the middle of another makes a folder of the two",
    await until(async () => (await folderTile.count()) === 1),
  );
  step(
    "and both are kept in it on the server",
    await until(async () => {
      const [folder] = await stored();
      return folder?.apps?.join() === [one, two].join();
    }),
    JSON.stringify(await stored()),
  );
  step(
    "Neither stands by itself any more",
    (await appTile(one).count()) === 0 && (await appTile(two).count()) === 0,
  );

  await appTile(three).dragTo(folderTile);
  step(
    "An application let go on a folder goes in it",
    await until(async () => (await stored())[0]?.apps?.includes(three)),
    JSON.stringify(await stored()),
  );

  await folderTile.click();
  const panel = page.locator(".mac-launchpad-folder-panel");
  await panel.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(300);
  step(
    "A click opens the folder, with its applications",
    (await panel.locator(".mac-launchpad-item").count()) === 3,
  );
  const name = page.getByRole("textbox", { name: "Folder name" });
  await name.fill("My Tools");
  await page.keyboard.press("Enter");
  step(
    "Its name can be changed in place",
    await until(async () => (await stored())[0]?.name === "My Tools"),
  );
  await shot(page, path.join(out, `launchpad-folder-${browserName}.png`));

  await panel
    .locator(`.mac-launchpad-item[data-app="${three}"]`)
    .dragTo(page.locator(".mac-launchpad-folder-dismiss"), { targetPosition: { x: 10, y: 10 } });
  step(
    "An application dragged out of the panel leaves the folder",
    await until(async () => !(await stored())[0]?.apps?.includes(three)),
    JSON.stringify(await stored()),
  );

  await reloadDesktop(page);
  await openPad();
  step(
    "The folder holds after a reload, under its name",
    await until(async () => (await folderTile.innerText()).includes("My Tools")),
  );
  await folderTile.click();
  await panel.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(300);
  await panel
    .locator(`.mac-launchpad-item[data-app="${two}"]`)
    .dragTo(page.locator(".mac-launchpad-folder-dismiss"), { targetPosition: { x: 10, y: 10 } });
  step(
    "A folder left with one application goes",
    await until(async () => (await stored()).length === 0),
    JSON.stringify(await stored()),
  );
  step(
    "and the application stands by itself again",
    await until(async () => (await appTile(one).count()) >= 1),
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
});
