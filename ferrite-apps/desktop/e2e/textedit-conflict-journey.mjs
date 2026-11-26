#!/usr/bin/env node
// One TextEdit draft changed in several browser windows at once: the version saved first stays, and
// each other window's version waits, across a reload, until the person chooses.
//
//   node e2e/textedit-conflict-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal, expectConsole } = journey("textedit-conflict");
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

const storedText = (page) =>
  page.evaluate(async (url) => {
    const answer = await fetch(url);
    return JSON.stringify(await answer.json());
  }, DRAFT);

const conflictKeys = (page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("textedit-conflict")));

const append = async (page, words) => {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(words);
};

/** Holds `page`'s next save, so another window's is stored first. */
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

  const winner = await page.context().newPage();
  await openDesktop(winner, base, step);
  await open(winner);
  const third = await page.context().newPage();
  await openDesktop(third, base, step);
  await open(third);
  step(
    "the other windows read the same draft",
    (await editor(winner).innerText()).includes(stamp) &&
      (await editor(third).innerText()).includes(stamp),
  );

  // Two windows lose to a third at once.
  const holds = [await holdSave(page), await holdSave(third)];
  await append(page, " alpha");
  await append(third, " gamma");
  await page.waitForTimeout(1500);
  const theirs = storedSave(winner);
  await append(winner, " theirs");
  await theirs;
  expectRefusal(409, DRAFT);
  expectConsole(["did not keep a change"]);
  for (const hold of holds) hold.release();
  await bannerOf(page).waitFor({ timeout: 10_000 });
  await bannerOf(third).waitFor({ timeout: 10_000 });
  step("each window saved second says so", true);
  const stored = await storedText(page);
  step(
    "the version saved first is what is stored",
    stored.includes(" theirs") && !stored.includes(" alpha") && !stored.includes(" gamma"),
  );
  const both = await conflictKeys(page);
  step("each losing version has its own record", both.length === 2, JSON.stringify(both.length));

  for (const each of [page, third]) {
    await holds[each === page ? 0 : 1].stop();
    await each.reload();
    await each.getByRole("menubar").first().waitFor({ timeout: 30_000 });
    await open(each);
    await bannerOf(each).waitFor({ timeout: 10_000 });
  }
  step("after reloading both, each still offers a version back", true);
  await page.screenshot({ path: `${out}/textedit-conflict.png` });

  // Keep Mine with its save refused, then a reload: the version is still there to offer.
  const refuse = (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
      : route.continue();
  const draftPath = (address) => address.pathname === DRAFT;
  await page.route(draftPath, refuse);
  // A failed save is tried once more, and Keep Mine asks once more after that.
  for (let at = 0; at < 4; at += 1) expectRefusal(503, DRAFT);
  expectConsole(["could not save"]);
  await bannerOf(page).getByRole("button", { name: "Keep Mine" }).click();
  await page.waitForTimeout(2500);
  step("a refused save leaves both records", (await conflictKeys(page)).length === 2);
  step("the next version waits for it", !(await bannerOf(page).isVisible()));
  await page.unroute(draftPath, refuse);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await open(page);
  await bannerOf(page).waitFor({ timeout: 10_000 });
  step("after a reload the version is offered again", true);

  await bannerOf(page).getByRole("button", { name: "Keep Mine" }).click();
  await page.waitForTimeout(2500);
  const first = await storedText(page);
  const one = first.includes(" alpha") ? " alpha" : first.includes(" gamma") ? " gamma" : null;
  step("Keep Mine stores one version kept across the reload", one !== null, String(one));
  step(
    "choosing one leaves the other",
    (await conflictKeys(page)).length === 1 && (await bannerOf(page).isVisible()),
  );
  await bannerOf(page).getByRole("button", { name: "Keep Mine" }).click();
  await page.waitForTimeout(2500);
  const second = await storedText(page);
  const other = one === " alpha" ? " gamma" : " alpha";
  step("Keep Mine then stores the other", second.includes(other), other);
  step("Keep Mine shows it", (await editor(page).innerText()).includes(other));
  step("the banner goes", !(await bannerOf(page).isVisible()));
  step("the other tab's banner goes with it", !(await bannerOf(third).isVisible()));
  step("nothing is left in the browser's storage", (await conflictKeys(page)).length === 0);
  await third.close();

  // Storage that refuses the version: the window says a reload loses it, and can still restore it.
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes("textedit-conflict")) throw new DOMException("full", "QuotaExceededError");
      setItem.call(this, key, value);
    };
  });
  await winner.reload();
  await winner.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await open(winner);
  const hold = await holdSave(page);
  await append(page, " unkept");
  await page.waitForTimeout(1500);
  const again = storedSave(winner);
  await append(winner, " again");
  await again;
  expectRefusal(409, DRAFT);
  expectConsole(["did not keep a change"]);
  hold.release();
  await bannerOf(page).waitFor({ timeout: 10_000 });
  const words = await bannerOf(page).innerText();
  step("the banner says a reload loses it", words.includes("lost on reload"), words);
  step("no older version waits in storage", (await conflictKeys(page)).length === 0);
  await bannerOf(page).getByRole("button", { name: "Keep Mine" }).click();
  await page.waitForTimeout(2500);
  step("Keep Mine still restores it", (await storedText(page)).includes(" unkept"));
  await winner.close();
});
