#!/usr/bin/env node
// About This Mac's window on a served desktop: the Apple menu opening one window, the fixed size and dimmed zoom, the five
// tabs and arrow keys across them, what each tab shows, the windows its buttons open, and Command-M and Command-W. The links
// to Apple's pages are the census's (about-this-mac-census-journey.mjs). Exits 0 only when every step passed with no console
// error, page error, failed request or HTTP error.
//
//   node e2e/about-this-mac-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

await journey("about-this-mac-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const apple = async () => {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Apple" }).click();
    await page.getByRole("menuitem", { name: "About This Mac", exact: true }).first().click();
  };
  const window = page.locator('[data-window-id="about-this-mac"]');
  await apple();
  await window.waitFor({ timeout: 10_000 });
  step("the Apple menu opens it", true);

  await page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .click();
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  await apple();
  await page.waitForTimeout(400);
  const windows = await window.count();
  const key = await window.locator("[data-window-state]").first().getAttribute("data-window-state");
  step(
    "choosing it again brings the one window forward",
    windows === 1 && key === "key",
    `${windows}, ${key}`,
  );

  const before = await window.boundingBox();
  await page.mouse.move(before.x + before.width - 1, before.y + before.height - 1);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 80, before.y + before.height + 80);
  await page.mouse.up();
  const after = await window.boundingBox();
  step("the window keeps one size", after.width === before.width && after.height === before.height);
  step(
    "Zoom is dimmed",
    await window
      .getByRole("button", { name: /zoom|full screen/i })
      .first()
      .isDisabled(),
  );

  const tab = (name) => window.getByRole("tab", { name, exact: true });
  const shot = (name) => page.screenshot({ path: path.join(out, `about-${name}.png`) });
  step(
    "the five tabs are there",
    (await window.getByRole("tab").allInnerTexts()).join() ===
      "Overview,Displays,Storage,Support,Service",
  );

  await tab("Overview").click();
  for (const words of [
    "Macalicious Desktop",
    "Deployment",
    "App Modules",
    "Session Data",
    "Browser",
    "Processors",
  ]) {
    await window.getByText(words, { exact: false }).first().waitFor({ timeout: 5_000 });
  }
  await shot("rows-overview");
  step("Overview names the desktop and its figures", true);

  await tab("Overview").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await shot("rows-arrow-tab");
  step(
    "an arrow key moves across the tabs",
    (await tab("Displays").getAttribute("aria-selected")) === "true",
  );
  await tab("Displays").click();
  const button = (name) => window.getByRole("button", { name, exact: true });
  await button("Displays Preferences…").waitFor();
  await shot("rows-displays");
  const width = await page.evaluate(() => String(screen.width));
  step("Displays reports this browser's screen", (await window.innerText()).includes(width), width);
  const cdp = await page.context().newCDPSession(page);
  const { targetInfo } = await cdp.send("Target.getTargetInfo");
  await cdp.send("Browser.grantPermissions", {
    origin: base,
    browserContextId: targetInfo.browserContextId,
    permissions: ["windowManagement"],
  });
  await button("Show Every Screen…").click();
  await button("Show Every Screen…").waitFor({ state: "detached", timeout: 5_000 });
  const refusal = await window.getByText("The browser did not allow other screens").count();
  const reported = await page.evaluate(async () =>
    (await window.getScreenDetails()).screens.map((entry, index) => [
      entry.label || `Screen ${index + 1}`,
      `${entry.width} × ${entry.height} points at ${entry.devicePixelRatio}×`,
    ]),
  );
  const shown = await window
    .locator(".mac-about-this-mac-display figcaption")
    .evaluateAll((captions) =>
      captions.map((caption) => [...caption.children].map((part) => part.textContent)),
    );
  await shot("rows-every-screen");
  step(
    "Show Every Screen… names and sizes what the browser reports, with no refusal",
    refusal === 0 && JSON.stringify(shown) === JSON.stringify(reported),
    JSON.stringify(shown),
  );
  await button("Displays Preferences…").click();
  await page
    .locator('[data-window-id="system-preferences"] [data-pane="displays"]')
    .waitFor({ timeout: 10_000 });
  step("Displays Preferences… opens the pane", true);

  await apple();
  await page.waitForTimeout(300);
  await tab("Storage").click();
  await button("Manage…").waitFor();
  await window.getByText(/available of/).waitFor();
  await shot("rows-storage");
  step("Storage reports the drive against its quota", true);
  await button("Manage…").click();
  await page.locator('[data-window-id="storage-management"]').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await shot("rows-manage");
  step("Manage… opens Storage Management", true);

  await apple();
  await page.waitForTimeout(300);
  await tab("Overview").click();
  await button("System Report…").click();
  await page.locator('[data-window-id="system-information"]').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await shot("rows-system-report");
  step("System Report… opens System Information", true);

  await apple();
  await page.waitForTimeout(300);
  await tab("Support").click();
  await button("macOS Support").waitFor();
  await shot("rows-support");
  await button("macOS Help").click();
  await page.locator('[data-window-id="help-viewer"]').waitFor({ timeout: 10_000 });
  step("macOS Help opens Help Viewer", true);
  // Help Viewer floats over every other app's windows, so it has to go for the tabs under it.
  await page
    .locator('[data-window-id="help-viewer"]')
    .getByRole("button", { name: "Close" })
    .first()
    .click();

  await apple();
  await page.waitForTimeout(300);
  await tab("Service").click();
  await button("Check my repair options…").waitFor();
  await shot("rows-service");
  step("Service lists its links", true);

  // The menu bar's rows, on the same window. The Window menu lists it by name, and brings it back from the Dock.
  const menuBar = async (title) => {
    const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
    await item.click();
    await page.waitForTimeout(150);
    if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
  };
  const windowVisible = () =>
    window
      .locator("[data-window-state]")
      .first()
      .isVisible()
      .catch(() => false);
  // The Window menu's row for the window, a check item as the front one is.
  const windowRow = () =>
    page.locator("[role='menu'] [role^='menuitem']").filter({ hasText: "About This Mac" }).last();
  await menuBar("Window");
  await windowRow().waitFor();
  await shot("rows-window-menu");
  step("the Window menu lists it", true);
  await page.getByRole("menuitem", { name: /^Minimize/ }).click();
  await page.waitForTimeout(800);
  await shot("rows-menu-minimized");
  step("Window > Minimize takes it to the Dock", !(await windowVisible()));
  await page
    .getByRole("button", { name: /^About This Mac/ })
    .first()
    .click();
  await page.waitForTimeout(700);
  step("its Dock item brings it back", await windowVisible());

  await page.keyboard.press("Control+m");
  await page.waitForTimeout(800);
  await shot("rows-minimized");
  const minimized = await window
    .locator("[data-window-state]")
    .first()
    .isVisible()
    .catch(() => false);
  step("Command-M takes it to the Dock", !minimized);
  await page
    .getByRole("button", { name: /^About This Mac/ })
    .first()
    .click();
  await window.locator("[data-window-state]").first().waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+w");
  await window.waitFor({ state: "detached", timeout: 5_000 });
  step("Command-W closes it", true);

  await apple();
  await window.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await menuBar("File");
  await shot("rows-file-menu");
  await page.getByRole("menuitem", { name: /^Close Window/ }).click();
  await window.waitFor({ state: "detached", timeout: 5_000 });
  step("File > Close Window closes it", true);
});
