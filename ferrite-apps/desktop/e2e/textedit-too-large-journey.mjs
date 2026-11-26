#!/usr/bin/env node
// A TextEdit document past what the server keeps: another window's save reaching this one does not
// replace the text it holds with the shorter version stored.
//
//   node e2e/textedit-too-large-journey.mjs [--url http://127.0.0.1:8787]

import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base } = options();
const { step, run, expectRefusal, expectConsole } = journey("textedit-too-large");
const stamp = Date.now().toString(36);
const DRAFT = "/api/textedit/draft";
const LONG = 300_000;

const editor = (page) =>
  page.locator('[data-window-id^="textedit"]').first().getByRole("textbox", { name: "Document" });
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
const length = (page) => editor(page).evaluate((node) => node.textContent.length);

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  // This window's next save may lose to the other's, which is what the conflict banner is for.
  expectRefusal(409, DRAFT);
  expectConsole(["did not keep a change"]);
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

  await editor(page).click();
  await page.evaluate((size) => document.execCommand("insertText", false, "x".repeat(size)), LONG);
  await page.locator(".mac-textedit-too-large").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2_500);
  step("its own save coming back leaves the long text", (await length(page)) > LONG);

  await editor(other).click();
  await other.keyboard.press("ControlOrMeta+End");
  const theirs = storedSave(other);
  await other.keyboard.type(" theirs");
  await theirs;
  await page.waitForTimeout(3_000);
  const now = await length(page);
  step("another window's save leaves the long text", now > LONG, String(now));
  step(
    "the window still says it will not be kept",
    await page.locator(".mac-textedit-too-large").isVisible(),
  );

  // Another document takes the window: the window no longer holds too much, and hears the store again.
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: /^New/ }).last().click();
  await page.waitForTimeout(400);
  const leave = page.getByRole("button", { name: /^Don.t Save$/ });
  if (await leave.isVisible().catch(() => false)) await leave.click();
  await page.waitForTimeout(1_000);
  step(
    "a new document ends the notice",
    !(await page.locator(".mac-textedit-too-large").isVisible()) && (await length(page)) < 100,
    String(await length(page)),
  );
  await page.waitForTimeout(2_000);
  await editor(other).click();
  await other.keyboard.press("ControlOrMeta+End");
  const after = storedSave(other);
  await other.keyboard.type(` after ${stamp}`);
  await after;
  await page.waitForTimeout(3_000);
  const heard = await editor(page).innerText();
  step("and it takes another window's save again", heard.includes(`after ${stamp}`), heard);
  await other.close();
});
