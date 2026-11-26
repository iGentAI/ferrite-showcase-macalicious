#!/usr/bin/env node
// Siri's rows nothing drove one by one: how it opens and closes, help and its example buttons, the
// commands by name read back from the server, a card with its items and its Open button, another account
// seeing none of it, and a resend acting once.
//
//   node e2e/siri-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, launch, options, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("siri-rows");
const tag = Date.now().toString(36);
const me = `sirirows${tag}`;

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: me,
    fullName: "Siri Rows",
    password: randomBytes(12).toString("base64url"),
  });
  const picture = (name) => shot(page, path.join(out, `siri-rows-${name}-${browserName}.png`));
  const siri = page.locator(".mac-desktop-shell-siri");
  const field = siri.getByRole("textbox", { name: "Type to Siri" });
  const dock = page.getByRole("toolbar", { name: "Dock" });

  // How it opens and closes.
  await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  step("The menu bar extra opens Siri", await until(() => field.isVisible()));
  await picture("menu-extra");
  await siri.getByRole("button", { name: "Close" }).first().click();
  step("Its close button closes it", await until(async () => (await siri.count()) === 0));
  await dock.getByRole("button", { name: "Siri", exact: true }).click();
  step("The Dock tile opens it", await until(() => field.isVisible()));

  // Before anything is asked: the examples, as buttons that ask.
  const examples = siri.getByRole("list", { name: "Example requests" }).getByRole("button");
  step("Examples are listed", (await examples.count()) === 5, String(await examples.count()));
  await picture("examples");
  await examples.filter({ hasText: "Buy flowers" }).click();
  const notesText = async () => JSON.stringify((await api(page, "GET", "/api/notes/data")).json);
  step(
    "and one pressed makes its note, on the server",
    await until(async () => (await notesText()).includes("Buy flowers")),
  );

  const ask = async (text) => {
    const answered = page.waitForResponse(
      (reply) =>
        reply.request().method() === "POST" && new URL(reply.url()).pathname === "/api/siri/ask",
      { timeout: 15_000 },
    );
    if ((await siri.count()) === 0 || !(await field.isVisible())) {
      await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
      await field.waitFor({ timeout: 5_000 });
    }
    await field.fill(text);
    await field.press("Enter");
    await answered;
    const shown = siri.locator("[data-answer]").last();
    await shown.waitFor({ timeout: 10_000 });
    return (await shown.textContent()) ?? "";
  };

  const card = siri.locator(".mac-siri-card");
  const inCard = async (words) =>
    until(async () => (await card.count()) > 0 && (await card.last().innerText()).includes(words));

  // Help.
  const help = await ask("What can you do");
  step(
    "Help lists things to ask, in a card",
    help.length > 0 && (await siri.innerText()).toLowerCase().includes("some things you can ask"),
    help.slice(0, 60),
  );
  await picture("help");

  // The commands.
  let said = await ask("What time is it");
  step("The time", /\d{1,2}:\d{2}/.test(said), said);
  await picture("time");
  said = await ask("What is today's date");
  step(
    "The date",
    said.includes(String(new Date().getUTCDate())) &&
      said.includes(new Date().toLocaleString("en-US", { month: "long", timeZone: "UTC" })),
    said,
  );
  await picture("date");
  said = await ask("What is 6 times 7");
  step("Sums in words", said.includes("42"), said);
  await picture("sum");
  said = await ask("Hello");
  step("A greeting", /^(?:hello|hi)\b/i.test(said), said);
  await picture("greeting");

  said = await ask(`Remind me to water the fern ${tag}`);
  const reminders = async () =>
    (await api(page, "GET", "/api/reminders/data")).json.data?.reminders ?? [];
  step(
    "A reminder is added, on the server",
    (await reminders()).some((each) => each.title?.includes(`water the fern ${tag}`)),
    said,
  );
  said = await ask("What are my reminders");
  step("and listed in its card", await inCard(`water the fern ${tag}`), said);
  await picture("card");
  await siri.getByRole("button", { name: /^Open / }).click();
  step(
    "The card's Open button opens its application",
    await until(() => page.locator('[data-window-id="reminders"]').isVisible()),
  );
  said = await ask(`Complete water the fern ${tag}`);
  step(
    "and completed, on the server",
    await until(async () =>
      (await reminders()).some((each) => each.title?.includes(tag) && each.completed === true),
    ),
    said,
  );

  said = await ask(`Add an event called Fern review ${tag} tomorrow at 10am`);
  const events = async () => (await api(page, "GET", "/api/calendar/events")).json.events ?? [];
  step(
    "An event is added, on the server",
    (await events()).some((each) => each.title?.includes(`Fern review ${tag}`)),
    said,
  );
  said = await ask("What is on my calendar tomorrow");
  step("and the day is read back in its card", await inCard(`Fern review ${tag}`), said);
  await picture("calendar");

  said = await ask(`Make a note that says Fern care ${tag}`);
  step("A note is made, on the server", (await notesText()).includes(`Fern care ${tag}`), said);
  said = await ask("Show my notes");
  step("and listed in its card", await inCard(`Fern care ${tag}`), said);
  await picture("notes");

  said = await ask(`Add a sticky that says Fern sticky ${tag}`);
  const stickies = JSON.stringify((await api(page, "GET", "/api/stickies/data")).json);
  step("A sticky is added, on the server", stickies.includes(`Fern sticky ${tag}`), said);
  await picture("sticky");

  const cards = await api(page, "GET", "/api/contacts/cards");
  await api(page, "PUT", "/api/contacts/cards", {
    cards: [
      {
        id: "c1",
        account: "icloud",
        first: "Fernanda",
        last: tag,
        phones: [{ label: "mobile", value: "555 0100" }],
      },
    ],
    rev: cards.json.rev,
  });
  said = await ask(`What is Fernanda ${tag}'s number`);
  step("A contact's number is read, in its card", await inCard("555 0100"), said);
  await picture("contact");

  said = await ask("Open Calculator");
  step(
    "An application opens by name",
    await until(() => page.locator('[data-window-id="calculator"]').isVisible()),
    said,
  );
  said = await ask("Open Nonesuch");
  step("and one the desktop lacks is refused", /couldn.t find/i.test(said), said);
  await picture("refused");
  said = await ask("Turn on dark mode");
  step(
    "Appearance is set",
    await until(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-appearance") === "dark"),
    ),
    said,
  );
  await picture("dark");
  said = await ask("Turn off dark mode");
  step(
    "and turned off again",
    await until(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-appearance") !== "dark"),
    ),
    said,
  );

  // A resend acts once.
  const key = `journey-${tag}`;
  const once = () =>
    page.evaluate(
      async ({ text, key }) => {
        const reply = await fetch("/api/siri/ask", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "idempotency-key": key },
          body: JSON.stringify({ text, tz: 0 }),
        });
        return reply.status;
      },
      { text: `Add a sticky that says Once ${tag}`, key },
    );
  const first = await once();
  const second = await once();
  const count = (
    JSON.stringify((await api(page, "GET", "/api/stickies/data")).json).match(
      new RegExp(`Once ${tag}`, "g"),
    ) ?? []
  ).length;
  step(
    "A request sent twice acts once",
    first === 200 && second === 200 && count === 1,
    `${count} stickies`,
  );
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "Stickies");
  const stickyHolding = (words) =>
    page.locator('[data-window-id^="stickies"]').filter({ hasText: words });
  step(
    "and Stickies shows that one",
    await until(async () => (await stickyHolding(`Once ${tag}`).count()) === 1),
    String(await stickyHolding(`Once ${tag}`).count()),
  );
  // The new sticky opens exactly behind the one before it: that one is dragged off it for the picture.
  const above = await stickyHolding(`Fern sticky ${tag}`).boundingBox();
  await page.mouse.move(above.x + above.width / 2, above.y + 5);
  await page.mouse.down();
  await page.mouse.move(above.x + above.width / 2 - 350, above.y + 300, { steps: 6 });
  await page.mouse.up();
  await picture("once");

  // Another account.
  const stranger = await page.context().browser().newContext();
  const other = await stranger.newPage();
  await other.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(other, {
    name: `siriother${tag}`,
    fullName: "Someone Else",
    password: randomBytes(12).toString("base64url"),
  });
  const theirNotes = await api(other, "GET", "/api/notes/data");
  step(
    "Another account's notes hold none of it",
    theirNotes.status === 200 && !JSON.stringify(theirNotes.json).includes(tag),
    String(theirNotes.status),
  );
  await other
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await other.waitForTimeout(600);
  await other.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  const theirSiri = other.locator(".mac-desktop-shell-siri");
  const theirField = theirSiri.getByRole("textbox", { name: "Type to Siri" });
  await theirField.fill("Show my notes");
  await theirField.press("Enter");
  await theirSiri.locator("[data-answer]").waitFor({ timeout: 15_000 });
  await shot(other, path.join(out, `siri-rows-stranger-${browserName}.png`));
  const theirAnswer = await theirSiri.locator("[data-answer]").innerText();
  step(
    "and asking Siri there says it has none",
    /you have no notes/i.test(theirAnswer) && !(await theirSiri.innerText()).includes(tag),
    theirAnswer,
  );
  await stranger.close();
});
