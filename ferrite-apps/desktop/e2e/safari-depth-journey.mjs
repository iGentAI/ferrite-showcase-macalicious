#!/usr/bin/env node
// Safari's depth on Ferrite: Find in page, zoom, tabs by menu and the page's selection, against a
// real page the server fetches, with real input only.
//
//   ferrite dev --egress allow                          # in ferrite-apps/desktop
//   node e2e/safari-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//
// Writes screenshots to --out. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";
import { chooseMenu, closeMenus, plainSpot } from "./media-census-kit.mjs";

// A listed site with a short page and no pictures: Wikipedia can take a busy sandbox past the page budget.
const PAGE = "news.ycombinator.com";
const WORD = "comments";
const { base, out } = options();
const { step, run } = journey("safari-depth", { ignoreOtherOrigins: true });
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const pageFrame = (page) =>
  page.frames().find((frame) => frame !== page.mainFrame() && frame.url() === "about:srcdoc");

async function openSafari(page) {
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
}

async function go(page, window, address) {
  const field = window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }));
  await field.first().fill(address);
  await page.keyboard.press("Enter");
  await window
    .locator("iframe[srcdoc]")
    .waitFor({ timeout: 25_000 })
    .catch(async (error) => {
      const shown = await window.locator(".mac-safari-content").innerText();
      throw new Error(`no page frame; the window shows: ${shown.slice(0, 300)}\n${error}`);
    });
  await page.waitForTimeout(500);
}

const menuShot = async (page, title, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
  await closeMenus(page);
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const window = await openSafari(page);
  await go(page, window, PAGE);
  step("a real page opens in its frame", pageFrame(page) !== undefined);

  // ---- Find ----------------------------------------------------------------------------------
  await chooseMenu(page, "Edit", "Find", "Find…");
  const field = window.getByRole("searchbox", { name: "Find in page" });
  await field.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  step(
    "Edit > Find > Find opens the banner with the keyboard in it",
    await field.evaluate((input) => input === document.activeElement),
  );
  await field.fill(WORD);
  const status = window.getByRole("status").filter({ hasText: /match/ });
  await status.waitFor({ timeout: 5_000 });
  const first = await status.textContent();
  step("typing counts the matches and selects the first", /^1 of \d+ matches$/.test(first), first);
  step(
    "the match is selected in the page",
    (await pageFrame(page).evaluate(() => String(getSelection()))) === WORD,
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-find.png"));
  await field.press("Enter");
  await page.waitForFunction(() =>
    /^2 of /.test(document.querySelector(".mac-safari-find [role=status]")?.textContent ?? ""),
  );
  step("Return goes to the next match", true);
  await field.press("Shift+Enter");
  await page.waitForFunction(() =>
    /^1 of /.test(document.querySelector(".mac-safari-find [role=status]")?.textContent ?? ""),
  );
  step("Shift-Return goes back", true);
  await chooseMenu(page, "Edit", "Find", "Find Next");
  await page.waitForFunction(() =>
    /^2 of /.test(document.querySelector(".mac-safari-find [role=status]")?.textContent ?? ""),
  );
  step("Edit > Find > Find Next does too", true);
  await field.fill("zzqxqzzqx");
  await window.getByRole("status").filter({ hasText: "Not Found" }).waitFor({ timeout: 5_000 });
  step("words the page lacks say Not Found", true);
  await field.press("Escape");
  await field.waitFor({ state: "detached", timeout: 5_000 });
  step("Escape closes the banner", true);

  // A key pressed while the page has the keyboard reaches the window.
  const body = window.frameLocator("iframe[srcdoc]").locator("html");
  await body.click({ position: await plainSpot(window.frameLocator("iframe[srcdoc]")) });
  await page.keyboard.press(`${COMMAND}+f`);
  await field.waitFor({ timeout: 5_000 });
  step("Command-F from inside the page opens the banner", true);
  await field.fill(WORD);
  await window
    .getByRole("status")
    .filter({ hasText: /^1 of / })
    .waitFor({ timeout: 5_000 });
  const typed = await pageFrame(page).evaluate(() => {
    const box = document.createElement("input");
    box.id = "depth-box";
    box.value = "one two";
    document.body.prepend(box);
    box.focus();
    box.setSelectionRange(7, 7);
    return box.selectionStart;
  });
  await page.keyboard.press("Control+ArrowLeft");
  step(
    "Control-Arrow stays with a field in the page",
    (await pageFrame(page).evaluate(() => document.getElementById("depth-box").selectionStart)) <
      typed,
  );
  await pageFrame(page).evaluate(() => {
    window.depthPrevented = [];
    document.addEventListener("keydown", (event) => {
      window.depthPrevented.push(`${event.key}:${event.defaultPrevented}`);
    });
  });
  await page.keyboard.press("Control+Shift+E");
  await page.keyboard.press("Control+Alt+F");
  step(
    "a combination Safari does not use stays with the page",
    (await pageFrame(page).evaluate(() => window.depthPrevented.join())).includes("E:false") &&
      (await pageFrame(page).evaluate(() => window.depthPrevented.join())).includes("F:false"),
    await pageFrame(page).evaluate(() => window.depthPrevented.join()),
  );
  await pageFrame(page).evaluate(() => document.getElementById("depth-box").remove());
  await field.focus();
  await field.press("Escape");

  // ---- The selection -------------------------------------------------------------------------
  await chooseMenu(page, "Edit", "Select All");
  await page.waitForTimeout(300);
  step(
    "Edit > Select All selects the page",
    (await pageFrame(page).evaluate(() => String(getSelection()).length)) > 200,
  );
  await pageFrame(page).evaluate(() => {
    const paragraph =
      [...document.querySelectorAll("p")].find((each) => each.textContent.trim().length > 20) ??
      document.body;
    const walker = document.createTreeWalker(paragraph, 4);
    let text = walker.nextNode();
    while (text && text.length < 6) text = walker.nextNode();
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(5, text.length));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  const chosen = await pageFrame(page).evaluate(() => String(getSelection()));
  await chooseMenu(page, "Edit", "Find", "Use Selection for Find");
  await field.waitFor({ timeout: 5_000 });
  step(
    "Use Selection for Find searches for the selection",
    (await field.inputValue()) === chosen,
    chosen,
  );
  await field.press("Escape");

  // ---- Zoom, kept across a reload -------------------------------------------------------------
  const scale = () => pageFrame(page).evaluate(() => document.documentElement.style.zoom);
  await chooseMenu(page, "View", "Zoom In");
  await page.waitForTimeout(300);
  step("View > Zoom In enlarges the page", (await scale()) === "1.15", await scale());
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-zoomed.png"));
  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  const again = await openSafari(page);
  await again.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(800);
  step("the zoom is kept across a reload", (await scale()) === "1.15", await scale());
  await chooseMenu(page, "View", "Actual Size");
  await page.waitForTimeout(300);
  step("View > Actual Size puts it back", (await scale()) === "1", await scale());
  await chooseMenu(page, "View", "Zoom Out");
  await page.waitForTimeout(300);
  step("View > Zoom Out shrinks it", (await scale()) === "0.85", await scale());
  await chooseMenu(page, "View", "Actual Size");

  // ---- Tabs ----------------------------------------------------------------------------------
  await chooseMenu(page, "File", "New Tab");
  const selected = () => again.getByRole("tab", { selected: true }).first().textContent();
  await again.getByRole("tablist").waitFor({ timeout: 5_000 });
  const opened = await selected();
  await chooseMenu(page, "Window", "Show Previous Tab");
  await page.waitForTimeout(300);
  step("Window > Show Previous Tab moves to it", (await selected()) !== opened, await selected());
  await chooseMenu(page, "Window", "Show Next Tab");
  await page.waitForTimeout(300);
  step("Window > Show Next Tab moves back", (await selected()) === opened, await selected());
  // With the keyboard in the page, Control-Tab reaches the window and moves between the tabs.
  await chooseMenu(page, "Window", "Show Previous Tab");
  await again.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  const pageTab = await selected();
  await again
    .frameLocator("iframe[srcdoc]")
    .locator("html")
    .click({ position: await plainSpot(again.frameLocator("iframe[srcdoc]")) });
  await page.keyboard.press("Control+Tab");
  await page.waitForTimeout(400);
  step(
    "Control-Tab from inside the page moves on",
    (await selected()) !== pageTab,
    await selected(),
  );
  await chooseMenu(page, "Window", "Show Previous Tab");
  await again.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  await again
    .frameLocator("iframe[srcdoc]")
    .locator("html")
    .click({ position: await plainSpot(again.frameLocator("iframe[srcdoc]")) });
  await page.keyboard.press("Control+Shift+Tab");
  await page.waitForTimeout(400);
  step(
    "Control-Shift-Tab from inside the page moves back",
    (await selected()) !== pageTab,
    await selected(),
  );
  await chooseMenu(page, "Window", "Show Next Tab");
  await menuShot(page, "Window", "safari-menu-window.png");
  await chooseMenu(page, "File", "Close Tab");

  // ---- The tab bar and each tab's menu --------------------------------------------------------
  const tabCount = () => again.getByRole("tab").count();
  await chooseMenu(page, "View", "Show Tab Bar");
  await again.getByRole("tablist").waitFor({ timeout: 5_000 });
  step("View > Show Tab Bar shows one tab", (await tabCount()) === 1);
  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  const kept = await openSafari(page);
  await kept.getByRole("tablist").waitFor({ timeout: 15_000 });
  step("the tab bar stays after a reload", (await kept.getByRole("tab").count()) === 1);
  const tabs = () => kept.getByRole("tab");
  await tabs().first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Duplicate Tab", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 2);
  step("a tab's menu duplicates it", true);
  await chooseMenu(page, "File", "New Tab");
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 3);
  await tabs().first().click({ button: "right" });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-tab-menu.png"));
  await page.getByRole("menuitem", { name: "Close Tabs to the Right", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 1);
  step("Close Tabs to the Right leaves the first", true);
  await chooseMenu(page, "File", "New Tab");
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 2);
  await chooseMenu(page, "File", "Close Other Tabs");
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 1);
  step("File > Close Other Tabs leaves the tab in front", true);
  await chooseMenu(page, "View", "Hide Tab Bar");
  await kept.getByRole("tablist").waitFor({ state: "detached", timeout: 5_000 });
  step("View > Hide Tab Bar hides it", true);

  // ---- Bookmarks: a link's menu, dragging along the bar, kept across a reload -----------------
  const stored = async () => (await api(page, "GET", "/api/safari/bookmarks")).json;
  const barItem = (name) =>
    kept
      .getByRole("navigation", { name: "Favorites bar" })
      .getByRole("button", { name, exact: true });
  const storedWhen = async (accept) => {
    for (let waited = 0; waited < 10_000; waited += 250) {
      const now = await stored();
      if (accept(now)) return now;
      await page.waitForTimeout(250);
    }
    return null;
  };
  await barItem("NPR").click({ button: "right" });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-link-menu.png"));
  await page.getByRole("menuitem", { name: "Rename…", exact: true }).click();
  const nameField = page.getByRole("textbox", { name: "Bookmark name" });
  await nameField.fill("Public Radio");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await barItem("Public Radio").waitFor({ timeout: 5_000 });
  step(
    "Rename names the favourite, on the server",
    (await storedWhen((doc) => doc.favorites?.some((f) => f.title === "Public Radio"))) !== null,
  );
  await barItem("BBC").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Bookmarks", exact: true }).click();
  step(
    "Move to Bookmarks moves it there",
    (await storedWhen(
      (doc) =>
        doc.bookmarks?.some((f) => f.title === "BBC") &&
        !doc.favorites?.some((f) => f.title === "BBC"),
    )) !== null,
  );
  await barItem("Hacker News").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  step(
    "Delete takes it off the bar",
    (await storedWhen((doc) => !doc.favorites?.some((f) => f.title === "Hacker News"))) !== null,
  );
  await barItem("Ars Technica").dragTo(barItem("Wikipedia"));
  step(
    "a favourite dragged along the bar moves there",
    (await storedWhen((doc) => doc.favorites?.[0]?.title === "Ars Technica")) !== null,
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-favorites-edited.png"));
  await chooseMenu(page, "View", "Hide Favorites Bar");
  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  const last = await openSafari(page);
  await page.waitForTimeout(1000);
  step(
    "the hidden Favorites bar stays hidden after a reload",
    (await last.getByRole("navigation", { name: "Favorites bar" }).count()) === 0,
  );
  await chooseMenu(page, "View", "Show Favorites Bar");
  await last
    .getByRole("navigation", { name: "Favorites bar" })
    .getByRole("button", { name: "Public Radio", exact: true })
    .waitFor({ timeout: 5_000 });
  step("and the edited Favorites are kept", true);
});
process.exit(0);
