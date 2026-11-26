#!/usr/bin/env node
// TextEdit's Keep Mine while another window saves the draft: the other window's text takes the window,
// and the version being put back is not lost: it is offered again, across a reload too.
//
//   node e2e/textedit-keep-mine-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base } = options();
const { step, run, expectRefusal, expectConsole } = journey("textedit-keep-mine");
const stamp = Date.now().toString(36);
const DRAFT = "/api/textedit/draft";

const editor = (page) =>
  page.locator('[data-window-id^="textedit"]').first().getByRole("textbox", { name: "Document" });
const bannerOf = (page) => page.getByRole("note").filter({ hasText: "Changed in another window" });
const open = async (page) => {
  await launch(page, "TextEdit");
  await editor(page).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
};
const storedSave = (page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === DRAFT &&
      response.status() === 200,
    { timeout: 10_000 },
  );
const append = async (page, words) => {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(words);
};
async function holdSave(page) {
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let holding = true;
  const matches = (address) => address.pathname === DRAFT;
  await page.route(matches, async (route) => {
    if (holding && route.request().method() === "PUT") {
      holding = false;
      await held;
    }
    await route.continue();
  });
  return { release: () => release(), stop: () => page.unroute(matches) };
}

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await open(page);
  const start = storedSave(page);
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(`Start ${stamp}`);
  await start;

  const other = await page.context().newPage();
  await openDesktop(other, base, step);
  await open(other);

  // The first conflict: this window's version loses.
  expectRefusal(409, DRAFT);
  expectRefusal(409, DRAFT);
  expectConsole(["did not keep a change"]);
  const first = await holdSave(page);
  await append(page, " mine");
  await page.waitForTimeout(1500);
  const theirs = storedSave(other);
  await append(other, " theirs");
  await theirs;
  first.release();
  await bannerOf(page).waitFor({ timeout: 10_000 });
  await first.stop();

  // Keep Mine is on its way when the other window saves again.
  const restoring = await holdSave(page);
  await bannerOf(page).getByRole("button", { name: "Keep Mine" }).click();
  await page.waitForTimeout(500);
  const later = storedSave(other);
  await append(other, " later");
  await later;
  restoring.release();
  await page.waitForTimeout(2500);
  await restoring.stop();
  const shown = await editor(page).innerText();
  step("the other window's text takes the window", shown.includes(" later"), shown);
  step("Keep Mine's version is offered again", await bannerOf(page).isVisible());

  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await open(page);
  await bannerOf(page).waitFor({ timeout: 10_000 });
  step("it is still offered after a reload", true);

  await bannerOf(page).getByRole("button", { name: "Keep Mine" }).click();
  await page.waitForTimeout(2500);
  step("Keep Mine then puts it back", (await editor(page).innerText()).includes(" mine"));
  step("the banner goes", !(await bannerOf(page).isVisible()));
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await open(page);
  step("it is what is stored", (await editor(page).innerText()).includes(" mine"));
  await other.close();
});
