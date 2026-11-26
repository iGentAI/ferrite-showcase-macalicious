#!/usr/bin/env node
// About This Mac's depth on a served desktop: the hardware statement, the version cycling, the coloured
// storage bar and legend, the figures read again when the window returns to the front, the tab kept
// across a reload, and the application menu's About row. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
//   node e2e/about-this-mac-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const open = async (page) => {
  await page
    .getByRole("button", { name: /^About This Mac$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="about-this-mac"]');
  await window.waitFor({ timeout: 10_000 });
  return window;
};

await journey("about-this-mac-depth", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  let window = await open(page);
  await window.getByText("A web page cannot read the model or serial").waitFor({ timeout: 10_000 });
  await window.getByText("Deployment").waitFor({ timeout: 10_000 });
  await page.screenshot({ path: path.join(out, "about-overview.png") });
  step("Overview says what a page cannot read", true);

  const version = window.getByRole("button", { name: /^build / });
  await version.click();
  await window.getByRole("button", { name: /^Site sha256:/ }).waitFor();
  await window.getByRole("button", { name: /^Site sha256:/ }).click();
  await window.getByRole("button", { name: /deployed|Generation/ }).click();
  await version.waitFor();
  step("clicking the version shows the full build, the deployment, and comes back", true);

  await window.getByRole("tab", { name: "Storage" }).click();
  const figures = window.getByText(/available of/);
  const figuresBefore = await figures.innerText();
  await page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .click();
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  await uploadFile(page, {
    parent: "documents",
    name: "about-journey.txt",
    type: "text/plain",
    size: 12_000_000,
  });
  await uploadFile(page, {
    parent: "documents",
    name: "about-journey.png",
    type: "image/png",
    size: 6_000_000,
  });
  await page.waitForTimeout(300);
  const read = page.waitForResponse(
    (response) => response.url().includes("/api/about-this-mac/facts"),
    { timeout: 25_000 },
  );
  await window.click({ position: { x: 300, y: 10 } });
  const reply = await (await read).json();
  await page.waitForTimeout(300);
  const figuresAfter = await figures.innerText();
  step(
    "the figures are read again when the window returns to the front",
    reply.drive.used >= 18_000_000 && figuresAfter !== figuresBefore,
    `${figuresBefore} became ${figuresAfter}`,
  );

  const segments = window.locator(".mac-about-this-mac-segments");
  await segments.waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "about-storage.png") });
  const shown = await segments.locator(".mac-about-this-mac-segment").count();
  const swatches = await window.locator(".mac-about-this-mac-legend [data-swatch]").count();
  step(
    "the files added behind it show as coloured segments with a legend",
    shown >= 2 && swatches === shown && (await window.getByText("Documents").count()) === 1,
    `${shown} segments, ${swatches} swatches`,
  );

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  window = await open(page);
  await window.getByRole("tab", { name: "Storage", selected: true }).waitFor({ timeout: 5_000 });
  step("the tab comes back after a reload", true);

  await page.getByRole("menubar").getByRole("menuitem", { name: "Finder", exact: true }).click();
  await page.waitForTimeout(150);
  const about = page.getByRole("menuitem", { name: "About This Mac", exact: true });
  step(
    "the application menu says About This Mac, once",
    (await about.count()) >= 1 &&
      (await page.getByRole("menuitem", { name: "About About This Mac" }).count()) === 0,
  );
});
