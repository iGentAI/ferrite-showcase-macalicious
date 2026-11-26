#!/usr/bin/env node
// The key equivalents of Messages' menus, in a real browser against the running app: each is pressed
// and what it does is read back from the window. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/messages-keys-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-keys");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mkchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mkmartin-${id}`, fullName: `Martin ${id}`, password };
const SAID = `said ${id}`;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });

await run({}, {}, async ({ person: open }) => {
  await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");
  const window = messagesOf(page);
  const seen = (check) => within(5_000, check).then((took) => took !== null);

  await page.keyboard.press("Control+n");
  step(
    "⌘N starts a new conversation",
    await seen(() => window.getByRole("textbox", { name: "To" }).isVisible()),
  );
  await window.getByRole("textbox", { name: "To" }).fill(martin.name);
  await field(page).fill(SAID);
  await field(page).press("Enter");
  const bubble = window.getByRole("listitem").filter({ hasText: SAID }).first();
  await within(15_000, () => bubble.isVisible());

  await page.keyboard.press("Control+f");
  step(
    "⌘F goes to the search field",
    await seen(() =>
      window
        .getByRole("searchbox", { name: "Search" })
        .evaluate((node) => node === document.activeElement),
    ),
  );

  const sizeOf = () =>
    window
      .getByRole("log")
      .getByText(SAID)
      .first()
      .evaluate((node) => getComputedStyle(node).fontSize);
  const normal = await sizeOf();
  await page.keyboard.press("Control+=");
  step(
    "⌘= makes the text bigger",
    await seen(async () => Number.parseFloat(await sizeOf()) > Number.parseFloat(normal)),
  );
  await page.keyboard.press("Control+-");
  await page.keyboard.press("Control+-");
  step(
    "⌘- makes it smaller",
    await seen(async () => Number.parseFloat(await sizeOf()) < Number.parseFloat(normal)),
  );
  await page.keyboard.press("Control+0");
  step("⌘0 puts it back", await seen(async () => (await sizeOf()) === normal));

  const rows = window.getByRole("option");
  const shown = (at) => rows.nth(at).getAttribute("aria-selected");
  await page.keyboard.press("Control+2");
  const second = await seen(async () => (await shown(1)) === "true");
  await page.keyboard.press("Control+1");
  step(
    "⌘1 and ⌘2 show those conversations",
    second && (await seen(async () => (await shown(0)) === "true")),
  );

  await page.keyboard.press("Control+i");
  step(
    "⌘I opens Details",
    await seen(() => page.getByRole("checkbox", { name: "Do Not Disturb" }).isVisible()),
  );
  await page.waitForTimeout(600);
  step(
    "Details stays open",
    await page.getByRole("checkbox", { name: "Do Not Disturb" }).isVisible(),
  );
  await shot(page, "messages-keys");
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await page.keyboard.press("Control+p");
  step(
    "⌘P hands the browser the transcript",
    await seen(async () =>
      ((await page.evaluate(() => globalThis.printedPage)) ?? "").includes(SAID),
    ),
  );
});
