#!/usr/bin/env node
// Spotlight finding a person's own Messages conversation, FaceTime call and book, and Help's topics: each in
// its group, opening where it says, and nothing of it for someone else.
//
//   node e2e/spotlight-people-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { twoPeople, within } from "./people-kit.mjs";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "e2e/output";
const { step, run } = twoPeople("spotlight-people");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const WORD = `Quillon${id}`;
const chris = { name: `spchris-${id}`, fullName: `Chris ${id}`, password };
const ada = { name: `spada-${id}`, fullName: `Ada ${id}`, password };
const eve = { name: `speve-${id}`, fullName: `Eve ${id}`, password };
const seen = (check, ms = 12_000) => within(ms, check).then((took) => took !== null);

const call = (page, method, url, body) =>
  page.evaluate(
    async ([method, url, body]) => {
      const reply = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: reply.status, json: await reply.json().catch(() => null) };
    },
    [method, url, body],
  );

const searchFor = async (page, words) => {
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  if ((await field.count()) === 0) {
    await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  }
  await field.fill(words);
  return field;
};
const inGroup = (page, group, name) =>
  page
    .getByRole("group", { name: new RegExp(`^(?:${group}|Top Hit)$`) })
    .getByRole("option", { name })
    .first();

await run({}, {}, async ({ person }) => {
  const chrisPage = await person("chris", chris);
  const adaPage = await person("ada", ada);
  const evePage = await person("eve", eve);

  const started = await call(chrisPage, "POST", "/api/messages/conversations", { to: [ada.name] });
  step("A conversation starts", started.status < 300, `HTTP ${started.status}`);
  const listed = await call(chrisPage, "GET", "/api/messages/conversations");
  const conv = listed.json?.conversations?.[0]?.id;
  const sent = await call(chrisPage, "POST", `/api/messages/conversations/${conv}/messages`, {
    text: `${WORD} lunch at noon`,
  });
  step("A message is written", sent.status < 300, `HTTP ${sent.status}`);

  const placed = await call(chrisPage, "POST", "/api/facetime/calls", {
    to: ada.name,
    kind: "audio",
    page: "journeypage0000000000",
  });
  step("A call is placed", placed.status < 300, `HTTP ${placed.status}`);

  const held = await call(chrisPage, "GET", "/api/books/library");
  const put = await call(chrisPage, "PUT", "/api/books/library", {
    library: {
      collections: [],
      pages: {},
      marks: {},
      sort: "recent",
      books: [
        {
          id: "pg-1342",
          title: `${WORD} Pride`,
          author: "Jane Austen",
          source: "gutenberg",
          added: Date.now(),
        },
      ],
    },
    rev: held.json?.rev ?? 0,
  });
  step("A book is kept", put.status < 300, `HTTP ${put.status} ${JSON.stringify(put.json)}`);

  const cards = await call(chrisPage, "GET", "/api/contacts/cards");
  await call(chrisPage, "PUT", "/api/contacts/cards", {
    cards: [
      {
        id: "c1",
        account: "icloud",
        first: WORD,
        last: "Card",
        phones: [{ label: "mobile", value: "555-0100" }],
        emails: [{ label: "home", value: "q@example.org" }],
      },
    ],
    rev: cards.json?.rev ?? 0,
  });
  await chrisPage.reload();
  await chrisPage.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await chrisPage.waitForTimeout(800);

  await searchFor(chrisPage, WORD);
  const message = inGroup(chrisPage, "Messages", ada.fullName);
  step("Messages lists the conversation", await seen(async () => (await message.count()) === 1));
  await message.click();
  const preview = chrisPage.getByRole("group", { name: "Preview" });
  step(
    "with the message that holds the word",
    await seen(async () => (await preview.innerText()).includes("lunch at noon")),
    await preview.innerText().catch(() => ""),
  );
  const book = inGroup(chrisPage, "Books", `${WORD} Pride`);
  step("Books lists the book", (await book.count()) === 1);
  await book.click();
  step(
    "with its author",
    await seen(async () => (await preview.innerText()).includes("Jane Austen")),
  );
  const contact = inGroup(chrisPage, "Contacts", `${WORD} Card`);
  await contact.click();
  const card = await preview.innerText();
  step(
    "A contact's preview is its card",
    card.includes("mobile 555-0100") && card.includes("home q@example.org"),
    card,
  );
  await chrisPage.screenshot({ path: path.join(OUT, "spotlight-contact-card.png") });

  await searchFor(chrisPage, ada.fullName);
  const called = inGroup(chrisPage, "FaceTime", ada.fullName);
  step("FaceTime lists the call", await seen(async () => (await called.count()) >= 1));
  const facetime = chrisPage
    .getByRole("group", { name: "FaceTime" })
    .getByRole("option", { name: ada.fullName });
  if ((await facetime.count()) > 0) await facetime.first().click();
  step(
    "said as a call",
    await seen(async () => /FaceTime Audio/.test(await preview.innerText())),
    await preview.innerText().catch(() => ""),
  );
  await chrisPage.screenshot({ path: path.join(OUT, "spotlight-facetime.png") });

  await searchFor(chrisPage, "filevault");
  const help = inGroup(chrisPage, "Help", "Change FileVault preferences on Mac");
  step("Help lists a topic", await seen(async () => (await help.count()) === 1));
  await help.click();
  await chrisPage.screenshot({ path: path.join(OUT, "spotlight-help.png") });
  await help.dblclick();
  step(
    "and opens Help Viewer on it",
    await seen(
      async () =>
        (await chrisPage.getByRole("searchbox").count()) > 0 ||
        (await chrisPage.getByText("macOS User Guide").count()) > 0,
    ),
  );

  await searchFor(chrisPage, WORD);
  await message.waitFor({ timeout: 10_000 });
  await message.dblclick();
  step(
    "Opening the conversation brings Messages",
    await seen(
      async () =>
        (await chrisPage.locator('.mac-managed-window[data-window-id*="messages"]').count()) > 0,
    ),
  );
  await chrisPage.waitForTimeout(800);
  await chrisPage.screenshot({ path: path.join(OUT, "spotlight-messages-opened.png") });

  const adaFinds = await call(adaPage, "GET", `/api/spotlight/search?q=${WORD}`);
  step(
    "The other member finds the conversation",
    adaFinds.json?.results?.some((result) => result.kind === "messages"),
    JSON.stringify(adaFinds.json?.results?.map((result) => result.kind)),
  );
  const eveFinds = await call(evePage, "GET", `/api/spotlight/search?q=${WORD}`);
  step(
    "Someone else finds nothing of it",
    eveFinds.status === 200 && eveFinds.json.results.length === 0,
    JSON.stringify(eveFinds.json?.results),
  );
  const cleared = await call(chrisPage, "POST", `/api/messages/conversations/${conv}/clear`, {
    seq: 1,
    listed: false,
  });
  const again = await call(chrisPage, "GET", `/api/spotlight/search?q=${WORD}`);
  step(
    "Deleted, the conversation is found no more",
    cleared.status < 300 && !again.json.results.some((result) => result.kind === "messages"),
    `HTTP ${cleared.status}`,
  );

  // A pick does not outlive its query.
  await chrisPage.reload();
  await chrisPage.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await chrisPage.waitForTimeout(800);
  const typed = await searchFor(chrisPage, "cal");
  await inGroup(chrisPage, "Applications", "Calculator").waitFor({ timeout: 10_000 });
  const panel = chrisPage.locator(".mac-desktop-shell-spotlight");
  const selected = () => panel.getByRole("option", { selected: true }).first().innerText();
  const firstPick = await selected();
  await typed.press("ArrowDown");
  await chrisPage.waitForTimeout(120);
  const picked = await selected();
  await typed.fill("calc");
  await chrisPage.waitForTimeout(500);
  const first = await panel.getByRole("option").first().innerText();
  step(
    "A new query selects its first result, not the pick",
    picked !== firstPick && (await selected()) === first,
    `${firstPick}, ${picked}, then ${await selected()}`,
  );

  // A reply answered by the journey, since a real drive past 100 text files takes minutes to make.
  await chrisPage.route("**/api/spotlight/search?*", (route) =>
    route.fulfill({
      json: {
        query: "stubbed",
        results: [],
        truncated: false,
        indexing: true,
        unsearched_files: 3,
        searched_mail: 0,
        unsearched_mail: false,
      },
    }),
  );
  await typed.fill("stubbed");
  const note = chrisPage.getByRole("note");
  step(
    "The note says how many text files went unsearched, and that it is still reading",
    await seen(async () => {
      const words = (await note.count()) ? await note.innerText() : "";
      return (
        words.includes("the words of 3 text files were not searched") &&
        words.includes("still reading your text files")
      );
    }),
  );
  await chrisPage.screenshot({ path: path.join(OUT, "spotlight-note.png") });
  await chrisPage.unroute("**/api/spotlight/search?*");
  await typed.press("Escape");
  await typed.press("Escape");

  // Siri.
  await call(chrisPage, "POST", "/api/mail/send", {
    to: [chris.name],
    cc: [],
    subject: `${WORD} supper`,
    text: "To oneself.",
  });
  const siri = chrisPage.locator(".mac-desktop-shell-siri");
  const said = siri.getByRole("textbox", { name: "Type to Siri" });
  await chrisPage.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  await said.waitFor({ timeout: 8_000 });
  const ask = async (words, shows) => {
    await said.fill(words);
    await said.press("Enter");
    return seen(async () => (await siri.innerText()).includes(shows));
  };
  step("Siri works out a sum said in words", await ask("what is six times seven", "42"));
  step("Siri says what is new in the inbox", await ask("check my mail", `${WORD} supper`));
  await chrisPage.screenshot({ path: path.join(OUT, "siri-mail.png") });
  step(
    "Siri gives one person's card, with every number and address",
    (await ask(`find ${WORD} in my contacts`, "555-0100")) &&
      (await siri.innerText()).includes("q@example.org"),
    await siri.innerText(),
  );
  await chrisPage.screenshot({ path: path.join(OUT, "siri-contact.png") });
  await siri.getByRole("button", { name: "Close" }).first().click();

  // Today's words about the next event.
  const held2 = await call(chrisPage, "GET", "/api/calendar/events");
  const start = Date.now() + 3_600_000;
  await call(chrisPage, "PUT", "/api/calendar/events", {
    events: [
      { id: "e1", title: `${WORD} review`, start, end: start + 1_800_000, calendar: "work" },
    ],
    rev: held2.json?.rev ?? 0,
  });
  await chrisPage.reload();
  await chrisPage.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await chrisPage.waitForTimeout(800);
  await chrisPage
    .getByRole("menuitem", { name: "Notification Center", exact: true })
    .first()
    .click();
  const today = chrisPage
    .locator(".mac-notification-center, .mac-desktop-shell-notifications")
    .first();
  const summary = async () => ((await today.count()) ? today.innerText() : "");
  step(
    "Today's summary counts the event and names the next",
    await seen(async () => (await summary()).includes(`${WORD} review`)),
    (await summary()).slice(0, 160),
  );
  await chrisPage.screenshot({ path: path.join(OUT, "today-summary.png") });
});
