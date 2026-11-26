#!/usr/bin/env node
// Help Viewer's menus and page on the served desktop: Go's history and Home, the table of contents
// and text sizes, Find, Copy and Select All, the page's context menu, results on the web, and what
// comes back after a reload. It signs in as a new guest, whose settings it changes. Exits 0 only when
// every step passed with no console error, page error or failed request.
//
// Stand-in: a spy on `speechSynthesis.speak` stands for the voice, and one on the print frame's
// `print` for the browser's print dialog.
//
//   node e2e/help-viewer-page-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import {
  clipboardText,
  journey,
  launch,
  openDesktop,
  options,
  reloadDesktop,
  shot,
} from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("help-viewer-page", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const menuRow = (page, name) => page.getByRole("menuitem", { name }).first();
async function choose(page, title, name) {
  await bar(page, title).click();
  await page.waitForTimeout(250);
  await menuRow(page, name).click();
  await page.waitForTimeout(300);
}
async function chooseIn(page, title, submenu, name) {
  await bar(page, title).click();
  await page.waitForTimeout(250);
  await menuRow(page, submenu).hover();
  await page.waitForTimeout(300);
  await menuRow(page, name).click();
  await page.waitForTimeout(300);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const openViewer = async () => {
    await launch(page, "Notes");
    await page.waitForTimeout(500);
    await bar(page, "Help").click();
    await page.waitForTimeout(250);
    await page.getByRole("menu").getByRole("menuitem", { name: "Notes Help", exact: true }).click();
  };
  await openViewer();
  const window = page.locator('.mac-managed-window[data-window-id="help-viewer"]');
  await window
    .locator(".mac-help-viewer-body:not([aria-busy])")
    .first()
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  // Notes Help opens on a search; the page it started from has the contents.
  await window.getByRole("searchbox", { name: "Search" }).fill("");
  await page.waitForTimeout(300);
  const contents = window.getByRole("treegrid", { name: "Table of Contents" });
  const heading = window.locator("article h1").first();

  // A topic, by the contents.
  await contents.getByText("Basics", { exact: true }).click();
  await page.waitForTimeout(300);
  await window.locator("article li a, article li button").first().click();
  await page.waitForTimeout(300);
  const topic = (await heading.textContent()).trim();

  // Text sizes.
  const zoom = () =>
    window
      .locator(".mac-help-viewer-scroll")
      .evaluate((node) => node.querySelector("[style*=zoom]")?.style.zoom ?? "1");
  await choose(page, "View", /^Make Text Bigger/);
  step("View > Make Text Bigger makes the page bigger", (await zoom()) === "1.15", await zoom());
  await shot(page, path.join(out, "help-viewer-bigger.png"));

  // Find.
  await chooseIn(page, "Edit", "Find", /^Find…/);
  const finding = window.getByRole("searchbox", { name: "Find" });
  await finding.waitFor({ timeout: 5_000 });
  step(
    "Edit > Find gives the bar the keyboard",
    await finding.evaluate((node) => node === document.activeElement),
  );
  await page.keyboard.type("e");
  const status = window.getByRole("search", { name: "Find" }).getByRole("status");
  step(
    "it counts what it finds on the page",
    /of \d+/.test(await status.textContent()),
    await status.textContent(),
  );
  await shot(page, path.join(out, "help-viewer-find.png"));
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("th");
  step(
    "Command-A in the bar's field selects the field's text",
    (await finding.inputValue()) === "th",
    await finding.inputValue(),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Copy and Select All.
  await choose(page, "Edit", /^Select All/);
  await page.waitForTimeout(200);
  const copied = await page.evaluate(() => document.getSelection().toString());
  step("Edit > Select All selects the page", copied.includes(topic), topic);
  await choose(page, "Edit", /^Copy/);
  step("Edit > Copy copies it", (await clipboardText(page)).includes(topic));
  await choose(page, "Edit", /^Select All/);
  await page.waitForTimeout(200);

  // Speech, with a spy for the voice.
  await page.evaluate(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = (utterance) => window.__spoken.push(utterance.text);
  });
  await chooseIn(page, "Edit", "Speech", /^Start Speaking/);
  step(
    "Edit > Speech reads what is selected",
    ((await page.evaluate(() => window.__spoken.at(-1))) ?? "").includes(topic),
  );

  // Print, with a spy for the dialog.
  await page.evaluate(() => {
    window.__printed = [];
    new MutationObserver(() => {
      const frame = document.querySelector("iframe[data-dictionary-print]");
      if (!frame || frame.__spied) return;
      frame.__spied = true;
      frame.addEventListener(
        "load",
        () => {
          frame.contentWindow.print = () => {
            window.__printed.push(frame.contentDocument.body.textContent);
          };
        },
        { capture: true },
      );
    }).observe(document.body, { childList: true });
  });
  await choose(page, "File", /^Print/);
  await page.waitForTimeout(400);
  step(
    "File > Print calls print on a frame that holds the page",
    ((await page.evaluate(() => window.__printed.at(-1))) ?? "").includes(topic),
  );

  // The page's context menu.
  const text = window.locator("article p").first();
  await text.dblclick({ position: { x: 40, y: 6 } });
  const word = (await page.evaluate(() => document.getSelection().toString())).trim();
  await text.click({ button: "right", position: { x: 40, y: 6 } });
  const menu = page.getByRole("menu", { name: "Page commands" });
  await menu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "help-viewer-page-menu.png"));
  step(
    "the page's context menu names the word",
    (await menu.getByRole("menuitem", { name: `Look Up “${word}”` }).count()) === 1,
    word,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // The table of contents, and what comes back.
  await choose(page, "View", /^Hide Table of Contents/);
  step("View > Hide Table of Contents hides it", (await contents.count()) === 0);
  await reloadDesktop(page);
  await page.waitForTimeout(1500);
  if ((await window.count()) === 0) await openViewer();
  await window
    .locator(".mac-help-viewer-body:not([aria-busy])")
    .first()
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  step(
    "after a reload the size, the hidden contents and the page stay",
    (await zoom()) === "1.15" &&
      (await contents.count()) === 0 &&
      (await heading.textContent()).trim() === topic,
    `${await zoom()} ${await contents.count()}`,
  );
  await choose(page, "View", /^Show Table of Contents/);
  await contents.waitFor({ timeout: 5_000 });
  await choose(page, "View", /^Actual Size/);
  step("View > Actual Size", (await zoom()) === "1", await zoom());

  // Go's rows.
  await choose(page, "Go", /^Home/);
  await window.locator(".mac-help-viewer-welcome").waitFor({ timeout: 5_000 });
  step("Go > Home shows the welcome page", true);
  await choose(page, "Go", /^Back/);
  await page.waitForTimeout(200);
  step("Go > Back returns", (await heading.textContent()).trim() === topic);

  // Results on the web.
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.fill("desktop");
  const web = window.getByRole("button", { name: "See more results on the web" });
  await web.waitFor({ timeout: 5_000 });
  const asked = page.waitForResponse((response) => response.url().includes("google.com%2Fsearch"), {
    timeout: 30_000,
  });
  await web.click();
  step(
    "See more results on the web opens Safari on the search",
    (await asked).url().includes("desktop"),
  );
});
