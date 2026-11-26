#!/usr/bin/env node
// A right click on a Messages bubble, in a real browser against the running app: Copy puts the text
// on the clipboard, a tapback from the menu reaches the other person, and Reply sends a reply that
// names the message. Exits 0 only when every step passed and no page logged a console error, a page
// error, a failed request or an HTTP error.
//
//   node e2e/messages-bubble-menu-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                             [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-bubble-menu");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mbchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mbmartin-${id}`, fullName: `Martin ${id}`, password };
const SAID = `said ${id}`;
const ANSWER = `answer ${id}`;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const bubbleMenu = (page) => page.getByRole("menu", { name: "Message commands" });

await run({}, {}, async ({ person: open }) => {
  const other = await open("martin", martin);
  const page = await open("chris", chris);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromDock(other, "Messages");
  await openFromDock(page, "Messages");
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await field(page).fill(SAID);
  await field(page).press("Enter");
  const bubble = messagesOf(page).getByRole("listitem").filter({ hasText: SAID }).first();
  await within(15_000, () => bubble.isVisible());

  await bubble.click({ button: "right" });
  await bubbleMenu(page).getByRole("menuitem", { name: "Copy" }).click();
  step(
    "Copy on a bubble puts its text on the clipboard",
    (await within(5_000, async () => {
      return (await page.evaluate(() => navigator.clipboard.readText())) === SAID;
    })) !== null,
  );

  await bubble.click({ button: "right" });
  await shot(page, "messages-bubble-menu");
  await bubbleMenu(page).getByRole("menuitem", { name: /Love/ }).click();
  await messagesOf(other)
    .getByRole("option", { name: new RegExp(chris.fullName) })
    .first()
    .click();
  step(
    "A tapback from the bubble's menu reaches the other person",
    (await within(20_000, () => messagesOf(other).getByLabel("Tapbacks").first().isVisible())) !==
      null,
  );

  await bubble.click({ button: "right" });
  await bubbleMenu(page).getByRole("menuitem", { name: "Reply" }).click();
  await field(page).fill(ANSWER);
  await field(page).press("Enter");
  step(
    "Reply from the bubble's menu sends a reply naming that message",
    (await within(20_000, () =>
      messagesOf(other).getByText(`Reply to “${SAID}”`).first().isVisible(),
    )) !== null,
  );

  const answer = messagesOf(page).getByRole("listitem").filter({ hasText: ANSWER }).first();
  const copied = () => page.evaluate(() => navigator.clipboard.readText());
  const copyAt = async (target, x) => {
    const box = await target.boundingBox();
    await page.mouse.click(box.x + (x < 0 ? box.width + x : x), box.y + box.height / 2, {
      button: "right",
    });
    await bubbleMenu(page).getByRole("menuitem", { name: "Copy" }).click();
    await page.waitForTimeout(200);
    return copied();
  };
  const select = (forward) =>
    page.evaluate(
      ([first, second, forward]) => {
        const textOf = (words) => {
          const walk = document.createTreeWalker(document.querySelector('[role="log"]'), 4);
          while (walk.nextNode()) if (walk.currentNode.data === words) return walk.currentNode;
          throw new Error(`no text ${words}`);
        };
        const a = textOf(first);
        const b = textOf(second);
        if (forward) getSelection().setBaseAndExtent(a, 2, b, 3);
        else getSelection().setBaseAndExtent(b, 3, a, 2);
      },
      [SAID, ANSWER, forward],
    );
  const results = [];
  for (const forward of [true, false]) {
    await select(forward);
    results.push(await copyAt(bubble, -14));
    await select(forward);
    results.push(await copyAt(answer, 14));
  }
  step(
    "Copy on a bubble takes only that bubble's part of a selection across two, either way it was dragged",
    JSON.stringify(results) ===
      JSON.stringify([SAID.slice(2), ANSWER.slice(0, 3), SAID.slice(2), ANSWER.slice(0, 3)]),
    JSON.stringify(results),
  );
  await page.evaluate(() => getSelection().removeAllRanges());

  const blank = await messagesOf(page).getByRole("log").boundingBox();
  await page.mouse.click(blank.x + 4, blank.y + 4, { button: "right" });
  step(
    "A right click beside the bubbles offers nothing to copy",
    await bubbleMenu(page).getByRole("menuitem", { name: "Copy" }).isDisabled(),
  );
  await page.keyboard.press("Escape");
});
