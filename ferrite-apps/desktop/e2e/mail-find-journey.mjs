#!/usr/bin/env node
// Find in a message on Ferrite, in a real browser against the running app: Edit > Find and its key open
// the bar, the matches are counted and marked, Find Next and Find Previous step through them by the
// menu, keys and buttons, Use Selection for Find searches for what is selected, and another message is
// searched again. Exits 0 only when every step passed and no page logged a console error, a page error,
// a failed request or an HTTP error.
//
//   node e2e/mail-find-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { arrive, menuPath, row, rows, send, viewer } from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-find");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fichris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fimartin-${id}`, fullName: `Martin ${id}`, password };

const field = (page) => viewer(page).getByRole("searchbox", { name: "Find in Message" });
const status = (page) => viewer(page).locator(".mac-mail-find").getByRole("status");
const says = (page, text) =>
  within(8_000, async () => (await status(page).innerText()).trim() === text);
const marked = (page) =>
  page.evaluate(() => ({
    all: CSS.highlights.get("mail-find")?.size ?? 0,
    current: [...(CSS.highlights.get("mail-find-current") ?? [])].map((each) => each.toString()),
  }));

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await send(a, martin.name, `Boats ${id}`, "Ferry one, FERRY two, ferry three and a heron");
  await send(a, martin.name, `Birds ${id}`, "Only one ferry here");

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await arrive(b, async () => (await rows(b).count()) === 2);
  await menuPath(b, "Edit", "Find");
  const menu = b.getByRole("menu").last();
  step(
    "Find is dimmed while no message is shown",
    (await menu.getByRole("menuitem", { name: "Find…" }).getAttribute("aria-disabled")) === "true",
  );
  await b.keyboard.press("Escape");
  await b.keyboard.press("Escape");
  await row(b, `Boats ${id}`).click();
  await within(8_000, () =>
    viewer(b)
      .getByText(/a heron/)
      .isVisible(),
  );

  await menuPath(b, "Edit", "Find", "Find…");
  await within(5_000, () => field(b).isVisible());
  step(
    "the menu opens the bar with the keyboard in its field",
    await field(b).evaluate((node) => node === document.activeElement),
  );
  await field(b).fill("ferry");
  step("it counts the matches, in any case", (await says(b, "1 of 3")) !== null);
  step(
    "it marks them all, the current one apart",
    (await marked(b)).all === 3 && (await marked(b)).current[0] === "Ferry",
  );
  await b.waitForTimeout(400);
  await shot(b, "mail-find");

  await b.keyboard.press("Control+G");
  step(
    "Find Next by its key goes on, to the second",
    (await says(b, "2 of 3")) !== null && (await marked(b)).current[0] === "FERRY",
  );
  await menuPath(b, "Edit", "Find", "Find Next");
  step("Find Next from the menu goes on", (await says(b, "3 of 3")) !== null);
  await b.keyboard.press("Control+G");
  step("it comes round to the first", (await says(b, "1 of 3")) !== null);
  await b.keyboard.press("Control+Shift+G");
  step("Find Previous goes back round", (await says(b, "3 of 3")) !== null);
  await field(b).press("Enter");
  step("Return in the field is Find Next", (await says(b, "1 of 3")) !== null);

  await row(b, `Birds ${id}`).click();
  step("another message is searched again", (await says(b, "1 of 1")) !== null);
  await field(b).fill("nothing like it");
  step("it says when nothing is found", (await says(b, "Not found")) !== null);
  await viewer(b).getByRole("button", { name: "Done" }).click();
  step(
    "Done closes the bar and takes the marks off",
    (await field(b).count()) === 0 && (await marked(b)).all === 0,
  );

  await row(b, `Boats ${id}`).click();
  await within(8_000, () =>
    viewer(b)
      .getByText(/a heron/)
      .isVisible(),
  );
  await viewer(b)
    .locator(".mac-mail-message-content")
    .getByText(/a heron/)
    .first()
    .evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      const at = text.nodeValue.indexOf("heron");
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + 5);
      const selection = document.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await b.keyboard.press("Control+E");
  step(
    "Use Selection for Find searches for the words selected",
    (await says(b, "1 of 1")) !== null && (await field(b).inputValue()) === "heron",
  );
  await b.keyboard.press("Control+F");
  step(
    "Find's key gives the field the keyboard",
    (await within(3_000, () => field(b).evaluate((node) => node === document.activeElement))) !==
      null,
  );
  await field(b).press("Escape");
  step(
    "Escape closes the bar",
    (await within(3_000, async () => (await field(b).count()) === 0)) !== null,
  );
});
