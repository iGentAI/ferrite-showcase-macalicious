#!/usr/bin/env node
// Mail on Ferrite, two people: Chris and Martin each make an account at the login window, in
// browsers of their own, and open Mail. Martin's Mail is open and empty. Chris writes to Martin by
// his account name, makes a word bold and sends it: Martin's desktop shows a banner for it, and
// Get Mail brings it into his open Inbox, unread, without a reload. Martin opens it and sees the
// bold text, and replies; the reply reaches Chris. Chris flags it, finds it by searching from his
// Sent mailbox, moves his own message to the Trash, and finds the flag kept after a reload. Each
// person's Sent holds only what they sent. Ann then joins: Chris writes to Martin with Ann in Cc,
// Martin answers with Reply All (to Chris, Ann in Cc) and it reaches both, and Ann forwards it to
// Chris. Chris moves the forward to Junk and back to the Inbox with Move to…, and his message from
// the Trash back to Sent; Martin moves Chris's message to the Trash and deletes it again, which
// erases it. After reloads, every person's mailboxes hold what they should. Last, Ann has more
// mail than the two pages a window reads first: the list says older messages are not loaded, and
// Load More brings in her oldest messages, which search then finds. Exits 0 only when every step
// passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/mail-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                             [--browser chromium|chrome|firefox|webkit]
//
// Accounts are made fresh for each run, so the journey can run again on the same deployment.

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, browserName } = twoPeople("mail");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mlchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mlmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `mlann-${id}`, fullName: `Ann ${id}`, password };
const subject = `Ferry on Saturday ${id}`;
const picnic = `Picnic ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const rowsText = async (page) =>
  (
    await rows(page)
      .allInnerTexts()
      .catch(() => [])
  ).join("\n");

/** Choose a mailbox in the sidebar. */
async function mailbox(page, name) {
  await viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByText(name, { exact: true })
    .click();
}

/** Press Get Mail until the Inbox lists `text`: the time it took, or `null`. */
function getMailUntil(page, text) {
  return within(20_000, async () => {
    await viewer(page).getByRole("button", { name: "Get Mail" }).click();
    await page.waitForTimeout(500);
    return (await rowsText(page)).includes(text);
  });
}

/** Type a recipient into a New Message window's To (or Cc) field and make a token of it. */
async function addRecipient(page, text, label = "To:") {
  const field = compose(page).getByLabel(label);
  await field.click();
  await field.pressSequentially(text);
  await field.press("Enter");
}

/** Whether the message list has a line that is exactly `text` (a subject, say). */
const listed = async (page, text) => (await rowsText(page)).split("\n").includes(text);

/** Press Get Mail until the list has a line that is exactly `text`: the time, or `null`. */
function getMailLine(page, text) {
  return within(20_000, async () => {
    await viewer(page).getByRole("button", { name: "Get Mail" }).click();
    await page.waitForTimeout(500);
    return listed(page, text);
  });
}

/** The row whose subject is exactly `text`. */
const bySubject = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();

/** Write and send a message from an open New Message window, and wait for it to close. */
async function writeAndSend(page, words) {
  const field = compose(page).getByRole("textbox", { name: "Message" });
  await field.click();
  await field.press("ControlOrMeta+Home");
  await field.pressSequentially(words);
  await compose(page).getByRole("button", { name: "Send" }).click();
  return within(15_000, async () => (await compose(page).count()) === 0);
}

/** Click the message's toolbar `button` (or Move to… `target`) and wait for the change to be stored. */
async function moveSelected(page, button, target) {
  const stored = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().includes("/api/mail/messages/"),
  );
  if (target) {
    await viewer(page)
      .getByRole("button", { name: /Move to/ })
      .click();
    await page.getByRole("menuitem", { name: target, exact: true }).click();
  } else {
    await viewer(page).getByRole("button", { name: button, exact: true }).click();
  }
  return (await stored).ok();
}

/** Reload the page and open Mail again. */
async function reloadMail(page) {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
}

/** The subjects in `mailbox` of the person's mail, read from the server. */
async function serverSubjects(page, box) {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  const messages = (await reply.json().catch(() => null))?.messages;
  if (reply.status() !== 200 || !Array.isArray(messages)) return null;
  return messages.filter((m) => m.mailbox === box).map((m) => m.subject);
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  step("Chris and Martin each have a desktop of their own", true);

  await openFromDock(b, "Mail", undefined).catch(() => {});
  const martinOpen = await within(15_000, () => viewer(b).isVisible());
  step("Martin's Mail opens", martinOpen !== null);
  const empty = await within(
    10_000,
    async () => (await viewer(b).getByText("No Messages").count()) > 0,
  );
  step("Martin's Inbox starts empty", empty !== null);

  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());

  // ── Chris writes to Martin, with a bold word ──
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).waitFor({ state: "visible", timeout: 10_000 });
  await addRecipient(a, martin.name);
  await compose(a).getByLabel("Subject:").fill(subject);
  const text = compose(a).getByRole("textbox", { name: "Message" });
  await text.click();
  await text.pressSequentially("Meet at the pier. ");
  await text.press("ControlOrMeta+b");
  await text.pressSequentially("Bring coffee");
  await text.press("ControlOrMeta+b");
  await text.pressSequentially(`. Map: https://example.com/?pier=${id}`);
  await shot(a, "mail-compose");

  await compose(a).getByRole("button", { name: "Send" }).click();
  const closed = await within(15_000, async () => (await compose(a).count()) === 0);
  step("Chris's message is sent and its window closes", closed !== null);

  // ── Martin's desktop shows a banner, and Get Mail brings it into his open Inbox ──
  const banner = await within(
    15_000,
    async () =>
      (await b
        .locator('[data-app="mail"][data-style="banner"]')
        .filter({ hasText: chris.fullName })
        .filter({ hasText: subject })
        .count()) > 0,
  );
  step("Martin's desktop shows a banner for the new mail", banner !== null, `${banner} ms`);
  const arrived = await getMailUntil(b, subject);
  step("Get Mail brings it into Martin's open Inbox", arrived !== null, `${arrived} ms`);
  const row = rows(b).filter({ hasText: subject }).first();
  step(
    "it is from Chris and unread",
    (await row.innerText()).includes(chris.fullName) &&
      (await row.getByLabel("Unread").count()) > 0,
  );

  await row.click();
  const article = viewer(b).getByRole("article");
  const bold = await within(
    10_000,
    async () =>
      (await article
        .locator("b, strong, [style*='bold']")
        .filter({ hasText: "Bring coffee" })
        .count()) > 0,
  );
  step("Martin sees the bold words as Chris wrote them", bold !== null);
  await shot(b, "mail-received");

  // ── Martin replies; it reaches Chris ──
  await viewer(b).getByRole("button", { name: "Reply", exact: true }).click();
  await compose(b).waitFor({ state: "visible", timeout: 10_000 });
  const to = await compose(b)
    .getByRole("listbox", { name: "To recipients" })
    .innerText()
    .catch(() => "");
  step(
    "the reply is addressed to Chris",
    to.includes(chris.fullName) || to.includes(chris.name),
    to,
  );
  const reply = compose(b).getByRole("textbox", { name: "Message" });
  await reply.click();
  await reply.press("ControlOrMeta+Home");
  await reply.pressSequentially("See you there.");
  await compose(b).getByRole("button", { name: "Send" }).click();
  await within(15_000, async () => (await compose(b).count()) === 0);
  const replied = await getMailUntil(a, `Re: ${subject}`);
  step("Martin's reply reaches Chris's Inbox", replied !== null, `${replied} ms`);

  // ── Chris flags the reply, searches, and moves his sent message to the Trash ──
  const replyRow = rows(a)
    .filter({ hasText: `Re: ${subject}` })
    .first();
  await replyRow.click();
  await viewer(a).getByRole("button", { name: "Flag", exact: true }).click();
  const flagged = await within(
    10_000,
    async () => (await replyRow.getByLabel("Red flag").count()) > 0,
  );
  step("Chris flags the reply", flagged !== null);

  // Off a Mac, Control-Option with a number is a Space's key too: with Mail in front it is Mail's Flag.
  const flagKey = async (digit, label) => {
    await a.keyboard.press(`Control+Alt+Digit${digit}`);
    return within(5_000, async () => (await replyRow.getByLabel(label).count()) > 0);
  };
  step(
    "Message > Flag's keys reach Mail, not Spaces",
    (await flagKey(2, "Orange flag")) !== null && (await flagKey(1, "Red flag")) !== null,
  );

  await mailbox(a, "Sent");
  const sentA = await rowsText(a);
  step(
    "Chris's Sent holds his message",
    sentA.includes(subject) && !sentA.includes(`Re: ${subject}`),
  );
  await mailbox(b, "Sent");
  const sentB = await within(10_000, async () => (await rowsText(b)).includes(`Re: ${subject}`));
  step(
    "Martin's Sent holds only his reply",
    sentB !== null && !(await rowsText(b)).split("\n").some((line) => line === subject),
  );

  // Searched from Sent, the reply is found in the Inbox by a phrase only it holds, and Chris's
  // own message, which Sent shows, is filtered out.
  const search = viewer(a).getByRole("searchbox");
  await search.fill("See you there");
  const found = await within(10_000, async () => {
    const lines = (await rowsText(a)).split("\n");
    return lines.includes(`Re: ${subject}`) && !lines.includes(subject);
  });
  step("searching finds a message by words of its text, in every mailbox", found !== null);
  await search.fill("");

  await mailbox(a, "Sent");
  await rows(a).filter({ hasText: subject }).first().click();
  // The move is stored before anything else happens.
  const moved = a.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().includes("/api/mail/messages/"),
  );
  await viewer(a).getByRole("button", { name: "Delete" }).click();
  step("the move to the Trash is stored", (await moved).ok());
  await mailbox(a, "Trash");
  const trashed = await within(10_000, async () => (await rowsText(a)).includes(subject));
  step("Chris's message moves to the Trash", trashed !== null);

  // ── After a reload the flag and the Trash are kept on the server ──
  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  // Mail reopens on the mailbox it was left on, which was the Trash: the Inbox is asked for.
  const reopened = await within(15_000, async () =>
    /Trash \(/.test(
      await viewer(a).locator(".mac-title-bar, .mac-window-title").first().innerText(),
    ),
  );
  step("Mail reopens on the mailbox it was left on", reopened !== null);
  await mailbox(a, "Inbox");
  const kept = await within(
    15_000,
    async () =>
      (await rows(a)
        .filter({ hasText: `Re: ${subject}` })
        .first()
        .getByLabel("Red flag")
        .count()) > 0,
  );
  step("the flag is kept after a reload", kept !== null);
  await mailbox(a, "Trash");
  const stillTrashed = await within(10_000, async () => (await rowsText(a)).includes(subject));
  step("the Trash is kept after a reload", stillTrashed !== null);
  await shot(a, "mail-after-reload");

  // ── Ann joins: Chris writes to Martin with Ann in Cc ──
  const c = await person("ann", ann);
  await openFromDock(c, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(c).isVisible());
  await mailbox(a, "Inbox");
  await mailbox(b, "Inbox");
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).waitFor({ state: "visible", timeout: 10_000 });
  await addRecipient(a, martin.name);
  await addRecipient(a, ann.name, "Cc:");
  await compose(a).getByLabel("Subject:").fill(picnic);
  await writeAndSend(a, "Sandwiches at noon.");
  const toMartin = await getMailLine(b, picnic);
  const toAnn = await getMailLine(c, picnic);
  step("Chris's message reaches Martin, and Ann in Cc", toMartin !== null && toAnn !== null);

  // ── Martin answers with Reply All ──
  await bySubject(b, picnic).click();
  await viewer(b).getByRole("button", { name: "Reply All" }).click();
  await compose(b).waitFor({ state: "visible", timeout: 10_000 });
  const allTo = await compose(b)
    .getByRole("listbox", { name: "To recipients" })
    .innerText()
    .catch(() => "");
  const allCc = await compose(b)
    .getByRole("listbox", { name: "Cc recipients" })
    .innerText()
    .catch(() => "");
  step(
    "Reply All is addressed to Chris, with Ann in Cc, and not to Martin himself",
    allTo.includes(chris.name) &&
      allCc.includes(ann.name) &&
      !`${allTo}${allCc}`.includes(martin.name),
    `${allTo.replace(/\s+/g, " ")} | ${allCc.replace(/\s+/g, " ")}`,
  );
  await writeAndSend(b, "Count us in. ");
  const allA = await getMailLine(a, `Re: ${picnic}`);
  const allC = await getMailLine(c, `Re: ${picnic}`);
  step("Martin's Reply All reaches Chris and Ann", allA !== null && allC !== null);

  // ── Ann forwards it to Chris ──
  await bySubject(c, `Re: ${picnic}`).click();
  await viewer(c).getByRole("button", { name: "Forward" }).click();
  await compose(c).waitFor({ state: "visible", timeout: 10_000 });
  await addRecipient(c, chris.name);
  await writeAndSend(c, "For your list. ");
  const forwarded = await getMailLine(a, `Fwd: ${picnic}`);
  step("Ann's Forward reaches Chris", forwarded !== null);

  // ── Junk and back; the Trash and back; erase ──
  await bySubject(a, `Fwd: ${picnic}`).click();
  step("the move to Junk is stored", await moveSelected(a, "Junk"));
  await mailbox(a, "Junk");
  const inJunk = await within(10_000, () => listed(a, `Fwd: ${picnic}`));
  step("the forward is in Junk", inJunk !== null);
  await bySubject(a, `Fwd: ${picnic}`).click();
  step("Move to… Inbox is stored", await moveSelected(a, null, "Inbox"));
  await mailbox(a, "Inbox");
  const backFromJunk = await within(10_000, () => listed(a, `Fwd: ${picnic}`));
  step("Move to… Inbox restores it from Junk", backFromJunk !== null);
  await mailbox(a, "Trash");
  await bySubject(a, subject).click();
  step("Move to… Sent is stored", await moveSelected(a, null, "Sent"));
  await mailbox(a, "Sent");
  const backFromTrash = await within(10_000, () => listed(a, subject));
  step("Move to… Sent restores Chris's message from the Trash", backFromTrash !== null);

  await bySubject(b, picnic).click();
  step("Martin's move of Chris's message to the Trash is stored", await moveSelected(b, "Delete"));
  await mailbox(b, "Trash");
  await bySubject(b, picnic).click();
  const erasedReply = b.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" && response.url().includes("/api/mail/messages/"),
  );
  await viewer(b).getByRole("button", { name: "Delete", exact: true }).click();
  step("deleting it again in the Trash erases it", (await erasedReply).ok());

  // ── After reloads, each person's mailboxes are as they were left ──
  await reloadMail(a);
  const aInbox = await within(15_000, async () => {
    const inbox = await serverSubjects(a, "inbox");
    return inbox?.includes(`Re: ${picnic}`) && inbox.includes(`Fwd: ${picnic}`);
  });
  const aSent = (await serverSubjects(a, "sent")) ?? [];
  const aTrash = (await serverSubjects(a, "trash")) ?? [];
  const aJunk = (await serverSubjects(a, "junk")) ?? [];
  step(
    "after a reload Chris's Inbox holds the reply-all and the forward, his Sent his two messages, and his Junk and Trash nothing",
    aInbox !== null &&
      aSent.includes(subject) &&
      aSent.includes(picnic) &&
      aTrash.length === 0 &&
      aJunk.length === 0,
  );
  // Mail reopens on the mailbox it was left on, Sent here; the forward is in the Inbox.
  await within(15_000, () => viewer(a).isVisible());
  await mailbox(a, "Inbox");
  const aShown = await within(15_000, () => listed(a, `Fwd: ${picnic}`));
  step("Chris's window shows the restored forward in his Inbox after the reload", aShown !== null);
  await reloadMail(c);
  const cInbox = (await serverSubjects(c, "inbox")) ?? [];
  const cSent = (await serverSubjects(c, "sent")) ?? [];
  step(
    "after a reload Ann's Inbox holds Chris's message and the reply-all, and her Sent the forward",
    cInbox.includes(picnic) && cInbox.includes(`Re: ${picnic}`) && cSent.includes(`Fwd: ${picnic}`),
  );
  await reloadMail(b);
  const bInbox = await serverSubjects(b, "inbox");
  const bTrash = await serverSubjects(b, "trash");
  const bSent = (await serverSubjects(b, "sent")) ?? [];
  step(
    "after a reload Martin's erased message is gone, and his Sent holds his reply-all",
    bInbox !== null &&
      bTrash !== null &&
      !bInbox.includes(picnic) &&
      !bTrash.includes(picnic) &&
      bSent.includes(`Re: ${picnic}`),
  );

  // ── More mail than two pages: Load More ──
  // 1,001 newer drafts for Ann, made through her own session, push her received mail past the
  // first two pages (1,000 messages) a window reads.
  const draftsUrl = new URL("/api/mail/drafts", c.url()).href;
  let seeded = 0;
  for (let start = 0; start < 1_001; start += 25) {
    const batch = Array.from({ length: Math.min(25, 1_001 - start) }, (_, n) =>
      c.request.post(draftsUrl, {
        headers: { "content-type": "application/json" },
        data: JSON.stringify({ to: [], subject: `Seed ${start + n}`, text: "" }),
      }),
    );
    for (const response of await Promise.all(batch)) if (response.ok()) seeded += 1;
  }
  step("Ann has 1,001 newer drafts", seeded === 1_001, `${seeded}`);
  await reloadMail(c);
  const notLoaded = await within(
    20_000,
    async () =>
      (await viewer(c)
        .getByText(/Older messages are not loaded/)
        .count()) > 0,
  );
  step(
    "the list says older messages are not loaded, and her Inbox does not show them yet",
    notLoaded !== null && !(await listed(c, picnic)),
  );
  await viewer(c).getByRole("button", { name: "Load More" }).click();
  const more = await within(20_000, () => listed(c, picnic));
  step("Load More brings in her older mail", more !== null, `${more} ms`);
  await viewer(c).getByRole("searchbox").fill("Sandwiches at noon");
  const foundOld = await within(10_000, () => listed(c, picnic));
  step("search then finds a message from the third page", foundOld !== null);
  await shot(c, "mail-load-more");
  // ── A web address in a message opens in Safari, not in the desktop page ──
  await mailbox(b, "Inbox");
  await bySubject(b, subject).click();
  const pierLink = viewer(b)
    .getByRole("article")
    .getByRole("link", { name: `https://example.com/?pier=${id}` });
  const linked = await within(15_000, async () => (await pierLink.count()) > 0);
  step(
    "the address in Chris's message is a link",
    linked !== null && (await pierLink.getAttribute("rel")) === "noopener noreferrer",
  );
  const desktopUrl = b.url();
  await pierLink.click();
  const safariField = b
    .getByRole("region", { name: "Safari", exact: true })
    .first()
    .getByRole("textbox", { name: "Search or enter website name" });
  const opened = await within(20_000, async () =>
    (await safariField.inputValue().catch(() => "")).includes("example.com"),
  );
  step(
    "clicking it opens the address in Safari, and the desktop page stays where it was",
    opened !== null && b.url() === desktopUrl,
    await safariField.inputValue().catch(() => ""),
  );
  await shot(b, "mail-link-safari");
  console.log(`engine ${browserName} done`);
});
