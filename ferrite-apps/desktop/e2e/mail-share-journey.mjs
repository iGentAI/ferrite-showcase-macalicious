#!/usr/bin/env node
// Share > Mail (gap round, WS7 13). Safari, News and Stocks hand a link to Mail through the Share
// menu (`demos/desktop/desktop-share-link.tsx`); Mail opens a New Message with the page's title as
// its subject and its address as its text (`takesSharedLinks` in `demos/mail/mail.tsx`):
//
// - from Safari (Email This Page) while Mail is closed: Mail opens and takes the link it was kept;
//   the message is addressed to another account (the friend) and sent;
// - from News while Mail is open: the link reaches the open Mail; closing the window keeps the
//   message as a draft on the server;
// - from Stocks after Mail was closed again: taken when Mail opens, kept as a draft;
// - after a reload the server holds the sent message and both drafts, each with its link, the
//   friend's Inbox holds the message, and a third account (the stranger) has none of them.
//
// Every person is a new account made at the login window, so the journey changes nobody's data.
// Exits 0 only when every step passed and the desktop logged no console error, page error, failed
// request or HTTP error.
//
//   ferrite dev --egress allow                       # in ferrite-apps/desktop
//   node e2e/mail-share-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("mail-share", { ignoreOtherOrigins: true });
const CATALINA = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const CATALINA_TITLE = "macOS Catalina - Wikipedia";
const AAPL = "https://www.cnbc.com/quotes/AAPL";
const tag = `${browserName.slice(0, 2)}${Date.now().toString(36)}`;
const person = (label, fullName) => ({
  name: `ws7${label}${tag}`,
  fullName,
  password: randomBytes(12).toString("base64url"),
});
const sharer = person("s", "WS7 Sharer");
const friend = person("f", "WS7 Friend");
const stranger = person("x", "WS7 Stranger");

const region = (page, name) => page.getByRole("region", { name, exact: true }).first();
// By their classes: the viewer is named after its mailbox, a New Message after its subject.
const viewer = (page) => page.locator(".mac-mail").first();
const composers = (page) => page.locator(".mac-mail-compose");

/** A new account, made at the login window. */
async function newPerson(page, who) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, who);
}

/** Open (or bring forward) an app through Spotlight, as the News and Stocks journeys do. */
async function spotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
  const window = region(page, name);
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
}

/** Close a window with its close button; it must be gone within 10 s. */
async function closeWindow(window) {
  await window
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
}

/** The next response that passes `accept`, or `null` after `ms`. */
const nextResponse = (page, accept, ms = 20_000) =>
  page.waitForResponse(accept, { timeout: ms }).catch(() => null);

/** The New Message window whose subject holds `subject`, once one does (within 15 s), or `null`. */
async function composerFor(page, subject) {
  for (let waited = 0; waited <= 15_000; waited += 250) {
    for (const window of await composers(page).all()) {
      const value = await window
        .getByLabel("Subject:")
        .inputValue()
        .catch(() => "");
      if (value.includes(subject)) return window;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

/** What a New Message window holds: its recipients' field, subject and text. */
async function holds(window) {
  return {
    subject: await window.getByLabel("Subject:").inputValue(),
    to: await window.getByLabel("To:").inputValue(),
    tokens: await window.locator(".mac-token-field-token, [data-token]").count(),
    text: (await window.getByRole("textbox", { name: "Message" }).innerText()).trim(),
  };
}

/** Share > Mail from `source`, the row called `row`: the New Message it opens, checked. */
async function shareToMail(page, source, { openShare, row, url, title, mailWas }) {
  await openShare();
  await page.getByRole("menuitem", { name: row, exact: true }).first().click();
  const window = await composerFor(page, title);
  const held = window ? await holds(window) : null;
  step(
    `${source}: Share > ${row}, with Mail ${mailWas}, opens a New Message: the title as its subject, the address as its text, no recipient yet`,
    held !== null && held.text === url && held.to === "" && held.tokens === 0,
    JSON.stringify(held),
  );
  if (!window) {
    const subjects = [];
    for (const each of await composers(page).all()) {
      subjects.push(
        await each
          .getByLabel("Subject:")
          .inputValue()
          .catch(() => "?"),
      );
    }
    await shot(
      page,
      path.join(out, `mail-share-${source.toLowerCase()}-missing-${browserName}.png`),
    );
    throw new Error(
      `${source}: no New Message holding "${title}" (Mail ${(await viewer(page).count()) ? "open" : "closed"}; New Message subjects: ${JSON.stringify(subjects)})`,
    );
  }
  return window;
}

/** Close the New Message window: Mail keeps it as a draft on the server. */
async function keepAsDraft(page, source, window, url) {
  const saved = nextResponse(
    page,
    (r) =>
      new URL(r.url()).pathname === "/api/mail/drafts" &&
      r.request().method() === "POST" &&
      (r.request().postData() ?? "").includes(url),
  );
  await closeWindow(window);
  const status = (await saved)?.status() ?? 0;
  step(
    `${source}: closing the New Message keeps it as a draft on the server`,
    status === 200,
    `HTTP ${status}`,
  );
}

/** The person's messages on the server, each with its whole text. A read that fails, or answers
 * something else, stops the run: an unread mailbox is never taken for an empty one. */
async function mailOf(page) {
  const list = await api(page, "GET", "/api/mail/messages");
  if (list.status !== 200 || !Array.isArray(list.json?.messages)) {
    throw new Error(`the mailboxes could not be read: HTTP ${list.status}`);
  }
  const all = [];
  for (const header of list.json.messages) {
    const read = await api(page, "GET", `/api/mail/messages/${encodeURIComponent(header.id)}`);
    if (read.status !== 200 || typeof read.json?.text !== "string") {
      throw new Error(`message ${header.id} could not be read: HTTP ${read.status}`);
    }
    all.push({ mailbox: header.mailbox, subject: header.subject, text: read.json.text });
  }
  return all;
}

await run(async (page) => {
  // What was shared, for the third account's check at the end.
  const shared = [CATALINA, CATALINA_TITLE, AAPL];
  // The friend exists first, so the sharer can address mail to them; their page stays signed in.
  const friendContext = await page.context().browser().newContext();
  try {
    const friendPage = await friendContext.newPage();
    await newPerson(friendPage, friend);
    await newPerson(page, sharer);
    step("the sharer and the friend are new accounts", true, `${sharer.name}, ${friend.name}`);
    // Stocks does not come with the desktop: get it from the App Store first.
    const library = await api(page, "GET", "/api/app-store/library");
    await api(page, "PUT", "/api/app-store/library", {
      installed: [...new Set([...(library.json?.installed ?? []), "stocks"])],
      rev: library.json?.rev ?? 0,
    });
    await reloadDesktop(page);
    step("Mail is not open", (await viewer(page).count()) === 0);

    // ── From Safari, Mail closed: Email This Page, then sent to the friend ──
    await launch(page, "Safari");
    const safari = region(page, "Safari");
    await safari.waitFor({ state: "visible", timeout: 15_000 });
    const address = safari.getByRole("textbox", { name: "Search or enter website name" });
    await address.click();
    await address.fill(CATALINA);
    await address.press("Enter");
    await safari.locator(`iframe[title="${CATALINA_TITLE}"]`).waitFor({ timeout: 20_000 });
    const fromSafari = await shareToMail(page, "Safari", {
      openShare: () => safari.getByRole("button", { name: "Share" }).click(),
      row: "Email This Page",
      url: CATALINA,
      title: CATALINA_TITLE,
      mailWas: "closed",
    });
    await shot(page, path.join(out, `mail-share-safari-${browserName}.png`));
    const sent = nextResponse(
      page,
      (r) =>
        new URL(r.url()).pathname === "/api/mail/send" &&
        r.request().method() === "POST" &&
        (r.request().postData() ?? "").includes(CATALINA),
    );
    const to = fromSafari.getByLabel("To:");
    await to.click();
    await to.pressSequentially(friend.name);
    await to.press("Enter");
    await fromSafari.getByRole("button", { name: "Send" }).click();
    const sentStatus = (await sent)?.status() ?? 0;
    await fromSafari.waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
    step(
      "Safari: addressed to the friend, the message with the link is sent and its window closes",
      (sentStatus === 200 || sentStatus === 201) && (await fromSafari.count()) === 0,
      `HTTP ${sentStatus}`,
    );
    await closeWindow(safari);

    // ── From News, Mail open: kept as a draft ──
    let news = await spotlight(page, "News");
    await page.waitForFunction(
      (frame) => !frame.hasAttribute("aria-busy"),
      await news.elementHandle(),
      {
        timeout: 20_000,
      },
    );
    const story = news.locator(".mac-news-story-link").first();
    await story.waitFor({ state: "visible", timeout: 30_000 });
    const headline = (await story.textContent())?.trim() ?? "";
    const visited = nextResponse(
      page,
      (r) =>
        r.request().method() === "PUT" &&
        new URL(r.url()).pathname === "/api/news/library" &&
        JSON.parse(r.request().postData() ?? "null")?.library?.history?.[0]?.title === headline,
    );
    await story.click();
    await news
      .getByRole("heading", { level: 2, name: headline, exact: true })
      .waitFor({ timeout: 15_000 });
    const storyLink = JSON.parse((await visited)?.request().postData() ?? "null")?.library
      ?.history?.[0]?.link;
    step(
      "News: the story opens, and its link is known from History",
      Boolean(storyLink),
      storyLink,
    );
    if (!storyLink) throw new Error("no story link: News kept no visit");
    const newsLink = new URL(storyLink).href;
    shared.push(newsLink, headline);
    step("Mail is open when News shares", (await viewer(page).count()) === 1);
    news = await spotlight(page, "News");
    const fromNews = await shareToMail(page, "News", {
      openShare: () => news.getByRole("button", { name: "Share" }).click(),
      row: "Mail",
      url: newsLink,
      title: headline,
      mailWas: "open",
    });
    await keepAsDraft(page, "News", fromNews, newsLink);
    await closeWindow(news);

    // ── From Stocks, Mail closed again: kept as a draft ──
    await closeWindow(viewer(page));
    step("Mail is closed again", (await viewer(page).count()) === 0);
    const stocks = await spotlight(page, "Stocks");
    await stocks
      .getByRole("button", { name: /^AAPL\b/ })
      .first()
      .click();
    await stocks.getByText("P/E").first().waitFor({ timeout: 15_000 });
    const fromStocks = await shareToMail(page, "Stocks", {
      openShare: () => stocks.getByRole("button", { name: "Share" }).click(),
      row: "Mail",
      url: AAPL,
      title: "AAPL",
      mailWas: "closed",
    });
    await shot(page, path.join(out, `mail-share-stocks-${browserName}.png`));
    await keepAsDraft(page, "Stocks", fromStocks, AAPL);
    await closeWindow(stocks);

    // ── After a reload: on the server, the sharer's and the friend's, and nobody else's ──
    await reloadDesktop(page);
    const mine = await mailOf(page);
    const has = (list, mailbox, subject, url) =>
      list.some(
        (m) => m.mailbox === mailbox && m.subject.includes(subject) && m.text.includes(url),
      );
    step(
      "after a reload the sharer's Sent holds the message, and Drafts the two drafts, each with its link",
      has(mine, "sent", CATALINA_TITLE, CATALINA) &&
        has(mine, "drafts", headline, newsLink) &&
        has(mine, "drafts", "AAPL", AAPL),
      JSON.stringify(mine.map((m) => [m.mailbox, m.subject])),
    );
    await launch(page, "Mail");
    await viewer(page).waitFor({ state: "visible", timeout: 15_000 });
    const reopened = await composers(page).count();
    step(
      "Mail opened again after the reload opens no New Message: each link was taken once",
      reopened === 0,
    );
    await shot(page, path.join(out, `mail-share-after-reload-${browserName}.png`));
    const theirs = await mailOf(friendPage);
    step(
      "the friend's Inbox holds the shared message with its link",
      has(theirs, "inbox", CATALINA_TITLE, CATALINA),
      JSON.stringify(theirs.map((m) => [m.mailbox, m.subject])),
    );
  } finally {
    await friendContext.close();
  }

  // ── Another account sees none of it ──
  const strangerContext = await page.context().browser().newContext();
  try {
    const other = await strangerContext.newPage();
    await newPerson(other, stranger);
    const strangers = await mailOf(other);
    const leaked = shared.filter(
      (text) => text && strangers.some((m) => m.subject.includes(text) || m.text.includes(text)),
    );
    step(
      "a third account, its mailboxes read, has none of the three shared messages",
      shared.length === 5 && leaked.length === 0,
      `${strangers.length} message(s); ${leaked.length ? `leaked: ${leaked.join(", ")}` : "none shared"}`,
    );
  } finally {
    await strangerContext.close();
  }
});
