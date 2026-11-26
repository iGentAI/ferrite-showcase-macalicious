#!/usr/bin/env node
// What Messages keeps for a person on Ferrite, in a real browser against the running app: the text
// size and the conversation shown, read from the server, and what was left typed, each back after a
// reload. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node e2e/messages-saved-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-saved");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mschris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `msmartin-${id}`, fullName: `Martin ${id}`, password };
const LEFT = `half a thought ${id}`;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};

await run({}, {}, async ({ person: open }) => {
  await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");

  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await field(page).fill(`hello ${id}`);
  await field(page).press("Enter");
  await within(15_000, () =>
    messagesOf(page).getByRole("log").getByText(`hello ${id}`).first().isVisible(),
  );
  await field(page).fill(LEFT);

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Make Text Bigger" }).click();
  const size = () =>
    messagesOf(page)
      .getByRole("log")
      .getByText(`hello ${id}`)
      .first()
      .evaluate((node) => getComputedStyle(node).fontSize);
  const bigger = await size();

  let saved = {};
  step(
    "the server holds the text size and the conversation shown",
    (await within(10_000, async () => {
      saved = await values(page);
      return (
        typeof saved["messages.settings"]?.textSize === "number" &&
        /./.test(saved["messages.selected"] ?? "") &&
        saved["messages.selected"] !== "ferrite-room"
      );
    })) !== null,
  );

  // Two tabs of one account, each typing in its own conversation.
  const stored = (name, text) =>
    page.evaluate(
      ([who, wanted]) =>
        Object.keys(window.localStorage).some(
          (key) =>
            key.startsWith(`macalicious.messages.unsent/${encodeURIComponent(who)}/`) &&
            window.localStorage.getItem(key) === wanted,
        ),
      [name, text],
    );
  await page.route(/\/api\/messages\/conversations(\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue().catch(() => {});
  });
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages");
  step(
    "with the list of conversations slow to arrive, what was typed stays stored",
    await stored(chris.name, LEFT),
  );
  step(
    "after a reload the conversation shown is the one left, with what was typed in its field",
    (await within(15_000, async () => (await field(page).inputValue()) === LEFT)) !== null,
  );
  await page.unroute(/\/api\/messages\/conversations(\?|$)/);
  step(
    "the transcript shows that conversation",
    (await within(10_000, () =>
      messagesOf(page).getByRole("log").getByText(`hello ${id}`).first().isVisible(),
    )) !== null,
  );
  step("the text size is the one chosen", (await size()) === bigger, bigger);
  await shot(page, "messages-saved");

  await field(page).press("Enter");
  step(
    "what was left is sent",
    (await within(15_000, () =>
      messagesOf(page).getByRole("log").getByText(LEFT).first().isVisible(),
    )) !== null,
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages");
  step(
    "after a reload the conversation shows it",
    (await within(15_000, () =>
      messagesOf(page).getByRole("log").getByText(LEFT).first().isVisible(),
    )) !== null,
  );
  step(
    "once it is sent, the field stays empty after a reload",
    (await field(page).inputValue()) === "",
  );

  // Typed before the account is known: kept once it is, with nothing typed after.
  const EARLY = `typed early ${id}`;
  await page.route(/\/api\/messages\/me(\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.continue().catch(() => {});
  });
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages");
  await field(page).fill(EARLY);
  step(
    "what is typed before the account is known is stored once it is",
    (await within(15_000, () => stored(chris.name, EARLY))) !== null,
  );
  await page.unroute(/\/api\/messages\/me(\?|$)/);
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages");
  step(
    "and is back after a reload",
    (await within(15_000, async () => (await field(page).inputValue()) === EARLY)) !== null,
  );

  // A second tab types in the Ferrite Room while the first types with Martin; each one's text stays
  // stored, and clearing one leaves the other.
  await messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: martin.fullName })
    .first()
    .click();
  const WITH_MARTIN = `with Martin ${id}`;
  await field(page).fill(WITH_MARTIN);
  const other = await page.context().newPage();
  await other.goto(page.url(), { waitUntil: "load" });
  await openFromDock(other, "Messages");
  await messagesOf(other)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: "Ferrite Room" })
    .first()
    .click();
  const ROOM = `in the room ${id}`;
  await field(other).fill(ROOM);
  step(
    "two tabs keep each one's text",
    (await within(
      10_000,
      async () => (await stored(chris.name, WITH_MARTIN)) && stored(chris.name, ROOM),
    )) !== null,
  );
  await field(page).fill("");
  step(
    "clearing one leaves the other",
    (await within(
      10_000,
      async () => !(await stored(chris.name, WITH_MARTIN)) && stored(chris.name, ROOM),
    )) !== null,
  );
  await other.close();

  // A kept text emptied before the account is known stays empty.
  const GONE = `to be cleared ${id}`;
  await messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: "Ferrite Room" })
    .first()
    .click();
  await field(page).fill(GONE);
  await within(5_000, () => stored(chris.name, GONE));
  await page.route(/\/api\/messages\/me(\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue().catch(() => {});
  });
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages");
  await field(page).fill("typed");
  await field(page).fill("");
  step(
    "a kept text emptied before the account is known leaves the store",
    (await within(15_000, async () => !(await stored(chris.name, GONE)))) !== null,
  );
  await page.unroute(/\/api\/messages\/me(\?|$)/);
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages");
  await within(5_000, () => field(page).isVisible());
  step("and does not come back after a reload", (await field(page).inputValue()) === "");
});
