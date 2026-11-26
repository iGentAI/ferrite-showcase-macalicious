#!/usr/bin/env node

// Mail's census suite (round 3, R6): one ok/FAIL line per census id of e2e/census/mail.rows.mjs, real input only,
// against a served `ferrite dev`. Three people make accounts at the login window in contexts of their own (Chris,
// Martin, Ann; Dora joins for the isolation check). Chris writes to Martin with Ann in Cc after an outside address and
// an unknown name are refused; Martin and Ann get it with Get Mail; Martin reads it (Details, a link that opens Safari),
// replies and replies to all; Ann forwards. Chris flags in every colour, mutes, sorts, filters, searches, and moves
// mail through every mailbox with the toolbar and Move to…, erasing in the Trash. Drafts are kept on close, a lost
// save answer is retried with the same idempotency key, and Don’t Save discards. Load More reads past two pages.
// Then the Preferences window, the shared menus and shortcuts, and both windows' chrome. `--phase write` leaves its
// accounts in a state file; after a real restart `--phase restart-check` signs in again and finds the mail kept.
//
//   node e2e/mail-census-journey.mjs --browser chromium|chrome|firefox|webkit [--phase all|write|restart-check]
//        [--url http://127.0.0.1:8080] [--out e2e/output/r6] [--census campaign/round3/r6/census/mail.tsv]
//
// Network faults (the lost draft answer, the unreachable server for Don’t Save) are injected with page.route; the
// action under test is always a real click or key press.

import {
  DRAFT_MOVE,
  FLAG_COLORS,
  INCLUDE_ORIGINAL,
  MAILBOX_NAMES,
  MARKUP,
  MOVE_TO_DRAFTS,
  OUTSIDE,
  PREF_CHECKS,
  PREF_CHOICES,
  ROWS,
} from "./census/mail.rows.mjs";
import { reasonOf, shown, verifyChrome, verifyCommon } from "./r6-common.mjs";
import {
  api,
  appWindow,
  census,
  drag,
  loadState,
  menu,
  openApp,
  pause,
  reload,
  saveState,
  snapshot,
  typeInto,
  windowFrame,
  within,
} from "./r6-kit.mjs";

const { o, check, allow, run, shot } = census("mail", { rows: ROWS });
const stamp = `${o.browserName.slice(0, 2)}${Date.now().toString(36)}`;

/** The viewer window's region name: its title, the mailbox and its count, or the search. */
const MAILWIN =
  /^((Inbox|Drafts|Sent|Junk|Trash|Archive) \(\d+ messages?\)|Searching “All Mailboxes” \(Found \d+ match(es)?\))$/;
const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const composeFrame = (page) =>
  page
    .locator("[data-window-id]")
    .filter({ has: page.locator(".mac-mail-compose") })
    .first();
const list = (page) => viewer(page).getByRole("listbox", { name: "Messages" });
const rows = (page) => list(page).getByRole("option");
const toolbar = (page, name) => viewer(page).getByRole("button", { name, exact: true }).first();
const rowsText = async (page) =>
  (
    await rows(page)
      .allInnerTexts()
      .catch(() => [])
  ).join("\n");
const listed = async (page, text) => (await rowsText(page)).split("\n").includes(text);
const bySubject = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
const _title = (page) =>
  appWindow(page, MAILWIN)
    .getAttribute("aria-label")
    .catch(() => null);
const titleText = async (page) =>
  (
    await windowFrame(page, MAILWIN)
      .locator("[data-title-bar]")
      .first()
      .innerText()
      .catch(() => "")
  )
    .replace(/\s+/g, " ")
    .trim();

async function openMail(page) {
  await openApp(page, "Mail", MAILWIN);
  await viewer(page).waitFor({ state: "visible", timeout: 15_000 });
}

async function mailbox(page, name) {
  await viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: new RegExp(`^${name}\\b`) })
    .first()
    .click();
  await within(5_000, async () => (await titleText(page)).startsWith(name));
}

async function newMessage(page) {
  await toolbar(page, "New Message").click();
  await compose(page).waitFor({ state: "visible", timeout: 10_000 });
}

async function addRecipient(page, text, label = "To:") {
  const field = compose(page).getByRole("combobox", { name: label });
  await field.click();
  await field.pressSequentially(text);
  await field.press("Enter");
}

async function writeText(page, text) {
  const field = compose(page).getByRole("textbox", { name: "Message" });
  await field.click();
  await field.press("ControlOrMeta+Home");
  await field.pressSequentially(text);
}

async function sendNow(page) {
  await compose(page).getByRole("button", { name: "Send", exact: true }).click();
  return within(15_000, async () => (await compose(page).count()) === 0);
}

function getMailUntil(page, text) {
  return within(25_000, async () => {
    await toolbar(page, "Get Mail").click();
    await pause(600);
    return listed(page, text);
  });
}

/**
 * Click toolbar `button` (or Move to… > `target`, using the menu if it is already open) and wait for the PATCH that
 * stores it. Never leaves a pending wait behind: a click that cannot happen answers false.
 */
async function moveSelected(page, button, target) {
  const stored = page
    .waitForResponse(
      (r) => r.request().method() === "PATCH" && r.url().includes("/api/mail/messages/"),
      { timeout: 10_000 },
    )
    .catch(() => null);
  try {
    if (target) {
      const item = page.getByRole("menuitem", { name: target, exact: true });
      if (!(await item.isVisible().catch(() => false)))
        await toolbar(page, "Move to…").click({ timeout: 8_000 });
      await item.click({ timeout: 8_000 });
    } else await toolbar(page, button).click({ timeout: 8_000 });
  } catch {
    return false;
  }
  return (await stored)?.ok() ?? false;
}

/** Whether menu item `name` shows within `ms` (a menu animates open). */
const menuShows = (page, name, ms = 3_000) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .first()
    .waitFor({ state: "visible", timeout: ms })
    .then(() => true)
    .catch(() => false);

async function serverMessages(page) {
  const reply = await api(page, "GET", "/api/mail/messages");
  return reply.status === 200 && Array.isArray(reply.json?.messages) ? reply.json.messages : null;
}
const inBox = async (page, box) =>
  ((await serverMessages(page)) ?? []).filter((m) => m.mailbox === box).map((m) => m.subject);

/** Close every New Message window (discarding through Don’t Save when asked) and every menu. */
async function tidy(page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape").catch(() => {});
  for (let n = 0; n < 4 && (await compose(page).count()); n++) {
    await composeFrame(page)
      .getByRole("group", { name: "Window controls" })
      .getByRole("button", { name: "Close" })
      .click()
      .catch(() => {});
    await pause(800);
  }
  if (!(await shown(page, MAILWIN))) await openMail(page).catch(() => {});
}

/** Run one section; a throw is a FAIL of the section (and leaves its rows unverified), never the end of the run. */
async function part(label, page, body) {
  try {
    await body();
  } catch (error) {
    const where = [
      ...String(error.stack).matchAll(/(mail-census-journey|r6-common|r6-kit)\.mjs:(\d+)/g),
    ]
      .map((x) => `${x[1]}:${x[2]}`)
      .join(" < ");
    check(
      `mail.section.${label}`,
      false,
      `${String(error.message).split("\n")[0]}${where ? ` at ${where}` : ""}`,
    );
    await shot(page, `section-${label}`);
    await tidy(page).catch(() => {});
  }
}

await run(async ({ person }) => {
  if (o.phase === "restart-check") return restartCheck(person);
  const a = await person("chris");
  const b = await person("martin");
  const c = await person("ann");
  const subject = `Ferry ${stamp}`;
  const link = `https://example.com/?pier=${stamp}`;
  // Refusals the steps provoke on purpose: the outside address and the unknown name are answered 422.
  allow(/HTTP 422: .*\/api\/mail\/send/);
  allow(/the server responded with a status of 422/);

  for (const page of [a, b, c]) await openMail(page);
  await snapshot(a, o, "mail", "viewer, fresh account");
  let dimmedSend = false;

  // ── The New Message window: dimmed controls and their reasons, Header Fields, Emoji, the format bar ──
  await part("compose-controls", a, async () => {
    await newMessage(a);
    check("mail.viewer.new-message", await compose(a).isVisible(), "a New Message window opened");
    await snapshot(a, o, "mail", "New Message window");
    const send = compose(a).getByRole("button", { name: "Send", exact: true });
    dimmedSend = await send.isDisabled();
    const attach = compose(a).getByRole("button", { name: "Attach", exact: true });
    check("mail.compose.attach", await attach.isEnabled(), "enabled in a served Mail");
    for (const [id, name, reason] of [
      ["mail.compose.markup", "Markup", MARKUP],
      ["mail.compose.include-original", "Include Original Message", INCLUDE_ORIGINAL],
    ]) {
      const button = compose(a).getByRole("button", { name, exact: true });
      const found = await reasonOf(a, button);
      check(
        id,
        (await button.isDisabled()) && found === reason,
        `disabled=${await button.isDisabled()} reason=${JSON.stringify(found)}`,
      );
    }
    check(
      "mail.compose.photo-browser",
      await compose(a).getByRole("button", { name: "Photo Browser", exact: true }).isEnabled(),
      "enabled in a served Mail: it lists the Photos library",
    );
    // Header Fields > Cc Address Field hides the Cc field, and again shows it.
    const cc = compose(a).getByRole("combobox", { name: "Cc:" });
    await compose(a).getByRole("button", { name: "Header Fields" }).click();
    // The pull-down's own item: the menu bar's View menu holds one of the same name.
    const openCc = () =>
      a
        .locator('[role="menu"][data-open]')
        .last()
        .getByRole("menuitemcheckbox", { name: "Cc Address Field", exact: true });
    const ccItem = openCc();
    const menuOpen = (await within(3_000, () => ccItem.isVisible())) !== null;
    check("mail.compose.header-fields", menuOpen, "its menu opened");
    const wasChecked = (await ccItem.getAttribute("aria-checked")) === "true";
    await ccItem.click();
    const hidden = await within(3_000, async () => !(await cc.isVisible()));
    await compose(a).getByRole("button", { name: "Header Fields" }).click();
    await openCc().click();
    const back = await within(3_000, () => cc.isVisible());
    check(
      "mail.compose.cc-field",
      wasChecked && hidden !== null && back !== null,
      `checked=${wasChecked} hid ${hidden} ms, showed ${back} ms`,
    );
    // Emoji: the first, a middle and the last item each type their character.
    const message = compose(a).getByRole("textbox", { name: "Message" });
    await message.click();
    await compose(a).getByRole("button", { name: "Emoji" }).click();
    const items = a.locator('[role="menu"][data-open]').last().getByRole("menuitem");
    await items.first().waitFor({ timeout: 3_000 });
    const count = await items.count();
    check("mail.compose.emoji", count > 0, `${count} emoji`);
    await a.keyboard.press("Escape");
    const typed = [];
    // The last item opens the Character Viewer: the emoji are the ones before it.
    for (const index of [...new Set([0, Math.floor((count - 1) / 2), count - 2])]) {
      await message.click();
      await a.keyboard.press("ControlOrMeta+End");
      await compose(a).getByRole("button", { name: "Emoji" }).click();
      const item = a.locator('[role="menu"][data-open]').last().getByRole("menuitem").nth(index);
      const label = (await item.innerText()).trim();
      await item.click();
      const character = label.split(" ")[0];
      typed.push([label, (await message.innerText()).includes(character)]);
    }
    check(
      "mail.compose.emoji-item",
      typed.length > 0 && typed.every(([, ok]) => ok),
      typed.map(([l, ok]) => `${l}:${ok}`).join(", "),
    );
    // The format bar shows and hides: Show Format Bar is a toggle (aria-pressed); its formatting is R4's census.
    const toggle = compose(a).getByRole("button", { name: "Show Format Bar" });
    const formatBar = compose(a).getByRole("toolbar", { name: "Format" });
    await toggle.click();
    const bar = await within(
      3_000,
      async () =>
        (await formatBar.isVisible()) && (await toggle.getAttribute("aria-pressed")) === "true",
    );
    await toggle.click();
    const gone = await within(
      3_000,
      async () =>
        !(await formatBar.isVisible()) && (await toggle.getAttribute("aria-pressed")) !== "true",
    );
    check(
      "mail.compose.format-bar",
      bar !== null && gone !== null,
      `bar shown ${bar} ms, hidden ${gone} ms`,
    );
    // Clear the emoji so this window can be closed without a draft.
    await message.click();
    await a.keyboard.press("ControlOrMeta+a");
    await a.keyboard.press("Backspace");
    // The New Message window's chrome, before its title changes with a subject.
    await verifyChrome(a, {
      app: "mail",
      slug: "compose",
      windowName: "New Message",
      windowItem: "New Message",
      check,
      reopen: async () => {
        if (!(await compose(a).count())) await newMessage(a);
      },
    });
  });

  // ── Refusals, then Chris sends to Martin with Ann in Cc ──
  await part("send", a, async () => {
    if (!(await compose(a).count())) await newMessage(a);
    await addRecipient(a, `someone-${stamp}@example.org`);
    await typeInto(compose(a).getByRole("textbox", { name: "Subject:" }), subject);
    check(
      "mail.compose.subject",
      (await titleOfCompose(a)).includes(subject),
      `window title ${await titleOfCompose(a)}`,
    );
    await writeText(a, `Meet at the pier. Map: ${link} `);
    await compose(a).getByRole("button", { name: "Send", exact: true }).click();
    const refused = await within(10_000, async () => OUTSIDE.test(await compose(a).innerText()));
    check(
      "mail.flow.outside-refused",
      refused !== null && (await compose(a).isVisible()),
      `refused in ${refused} ms; the window stays; notice ${JSON.stringify(await noticeOf(a))}`,
    );
    check(
      "mail.compose.to",
      refused !== null,
      "an outside address became a token and was refused with the reason",
    );
    // Remove the outside token (Backspace selects the last token, Backspace again removes it), try a name nobody has.
    // The keys go through page.keyboard: locator.press would focus the field again before each key.
    const to = compose(a).getByRole("combobox", { name: "To:" });
    const toTokens = () =>
      compose(a).getByRole("listbox", { name: "To recipients" }).getByRole("option");
    await to.click();
    await a.keyboard.press("Backspace");
    await a.keyboard.press("Backspace");
    await addRecipient(a, `nobody${stamp}`);
    await compose(a).getByRole("button", { name: "Send", exact: true }).click();
    const unknown = await within(10_000, async () =>
      (await compose(a).innerText()).includes(
        `No account on this desktop is called nobody${stamp}.`,
      ),
    );
    check(
      "mail.flow.unknown-refused",
      unknown !== null,
      `refused in ${unknown} ms; notice ${JSON.stringify(await noticeOf(a))}`,
    );
    await to.click();
    await a.keyboard.press("Backspace");
    await a.keyboard.press("Backspace");
    const cleared = await within(3_000, async () => (await toTokens().count()) === 0);
    if (cleared === null)
      throw new Error(`To still holds ${await toTokens().count()} tokens after Backspace twice`);
    await addRecipient(a, b.account.name);
    await addRecipient(a, c.account.name, "Cc:");
    const tokens = await compose(a)
      .getByRole("listbox", { name: "To recipients" })
      .innerText()
      .catch(() => "");
    const sent = await sendNow(a);
    check(
      "mail.compose.send",
      dimmedSend && sent !== null && !tokens.includes("example.org"),
      `dimmed without a recipient=${dimmedSend}; sent; window closed in ${sent} ms`,
    );
    check("mail.compose.message", sent !== null, "the typed text was sent");
  });

  await part("receive", b, async () => {
    const arrived = await getMailUntil(b, subject);
    const row = bySubject(b, subject);
    const unread = arrived !== null && (await row.getByLabel("Unread").count()) > 0;
    check(
      "mail.viewer.get-mail",
      arrived !== null && unread,
      `arrived in ${arrived} ms, unread=${unread}`,
    );
    const annGot = await getMailUntil(c, subject);
    check("mail.compose.cc", annGot !== null, `Ann (Cc) got it in ${annGot} ms`);
    const aSent = await inBox(a, "sent");
    check(
      "mail.flow.between-accounts",
      arrived !== null && annGot !== null && aSent.includes(subject),
      "Martin and Ann received it; Chris's Sent holds it",
    );
    await row.click();
    const read = await within(5_000, async () => (await row.getByLabel("Unread").count()) === 0);
    check(
      "mail.list.message",
      read !== null &&
        (await viewer(b).getByRole("article").innerText()).includes("Meet at the pier"),
      "opened in the reader and marked read",
    );
    await snapshot(b, o, "mail", "viewer, a message selected");
    // Details and Hide.
    const article = viewer(b).getByRole("article");
    await article.getByRole("button", { name: "Details" }).click();
    const detailed = await within(
      3_000,
      async () =>
        (await article.getByRole("button", { name: "Hide" }).isVisible()) &&
        /\bTo: \S/.test(await article.innerText()),
    );
    check(
      "mail.reader.details",
      detailed !== null,
      `the To line shows: ${JSON.stringify(((await article.innerText()).match(/To: [^\n]*/) ?? ["none"])[0])}`,
    );
    await article.getByRole("button", { name: "Hide" }).click();
    const short = await within(3_000, () =>
      article.getByRole("button", { name: "Details" }).isVisible(),
    );
    check("mail.reader.hide", short !== null, "the short header returns");
  });

  // ── Reply, Reply All, Forward ──
  await part("reply", b, async () => {
    await toolbar(b, "Reply").click();
    await compose(b).waitFor({ state: "visible", timeout: 10_000 });
    const to = await compose(b)
      .getByRole("listbox", { name: "To recipients" })
      .innerText()
      .catch(() => "");
    const quoted = /wrote:/.test(
      await compose(b).getByRole("textbox", { name: "Message" }).innerText(),
    );
    await writeText(b, "See you there. ");
    await sendNow(b);
    const got = await getMailUntil(a, `Re: ${subject}`);
    check(
      "mail.viewer.reply",
      to.includes(a.account.name) && quoted && got !== null,
      `to ${to.replace(/\s+/g, " ")}; quoted=${quoted}; reached Chris ${got} ms`,
    );
    await bySubject(b, subject).click();
    await toolbar(b, "Reply All").click();
    await compose(b).waitFor({ state: "visible", timeout: 10_000 });
    const allTo = await compose(b)
      .getByRole("listbox", { name: "To recipients" })
      .innerText()
      .catch(() => "");
    const allCc = await compose(b)
      .getByRole("listbox", { name: "Cc recipients" })
      .innerText()
      .catch(() => "");
    await writeText(b, "Count us in. ");
    await sendNow(b);
    const toA = await getMailUntil(a, `Re: ${subject}`);
    const toC = await getMailUntil(c, `Re: ${subject}`);
    check(
      "mail.viewer.reply-all",
      allTo.includes(a.account.name) &&
        allCc.includes(c.account.name) &&
        !`${allTo}${allCc}`.includes(b.account.name) &&
        toA !== null &&
        toC !== null,
      `to ${allTo.replace(/\s+/g, " ")} | cc ${allCc.replace(/\s+/g, " ")}`,
    );
    await bySubject(c, `Re: ${subject}`).click();
    await toolbar(c, "Forward").click();
    await compose(c).waitFor({ state: "visible", timeout: 10_000 });
    await addRecipient(c, a.account.name);
    await writeText(c, "For your list. ");
    await sendNow(c);
    const fwd = await getMailUntil(a, `Fwd: Re: ${subject}`).then(
      (t) => t ?? getMailUntil(a, `Fwd: ${subject}`),
    );
    check("mail.viewer.forward", fwd !== null, `the forward reached Chris in ${fwd} ms`);
  });

  // ── The reader's link opens in Safari ──
  await part("link", b, async () => {
    await mailbox(b, "Inbox");
    await bySubject(b, subject).click();
    const anchor = viewer(b).getByRole("article").getByRole("link", { name: link });
    await anchor.waitFor({ timeout: 10_000 });
    const url = b.url();
    await anchor.click();
    const field = b
      .getByRole("region", { name: "Safari", exact: true })
      .first()
      .getByRole("textbox", { name: "Search or enter website name" });
    const opened = await within(20_000, async () =>
      (await field.inputValue().catch(() => "")).includes("example.com"),
    );
    check(
      "mail.reader.link",
      opened !== null && b.url() === url,
      `Safari shows ${await field.inputValue().catch(() => "")}`,
    );
    await openMail(b);
  });

  // ── Flags, colours, mute: on Ann's forward, the one message of that subject, which stays in Chris's Inbox ──
  const reSubject = `Re: ${subject}`;
  const keptDraft = `Kept ${stamp}`;
  let fwd = "";
  await part("flags", a, async () => {
    fwd = (await inBox(a, "inbox")).find((s) => s.startsWith("Fwd:") && s.includes(subject)) ?? "";
    if (!fwd) throw new Error("Ann's forward is not in Chris's Inbox");
    await mailbox(a, "Inbox");
    const row = () => bySubject(a, fwd);
    await row().click();
    await toolbar(a, "Flag").click();
    const red = await within(5_000, async () => (await row().getByLabel("Red flag").count()) > 0);
    check(
      "mail.viewer.flag",
      red !== null && (await toolbar(a, "Clear Flag").isVisible()),
      `red flag in ${red} ms`,
    );
    await toolbar(a, "Clear Flag").click();
    const cleared = await within(
      5_000,
      async () => (await row().getByLabel(/flag$/i).count()) === 0,
    );
    check(
      "mail.viewer.clear-flag",
      cleared !== null && (await toolbar(a, "Flag").isVisible()),
      `cleared in ${cleared} ms`,
    );
    await toolbar(a, "Flag Color").click();
    check(
      "mail.viewer.flag-color",
      (await menuShows(a, "Purple")) && (await menuShows(a, "Clear Flag")),
      "the colour menu opened",
    );
    await snapshot(a, o, "mail", "Flag Color menu");
    await a.keyboard.press("Escape");
    const serverFlag = async () =>
      ((await serverMessages(a)) ?? []).find((m) => m.subject === fwd)?.flag;
    for (const color of FLAG_COLORS) {
      await row().click();
      await toolbar(a, "Flag Color").click();
      await a.getByRole("menuitem", { name: color, exact: true }).click();
      const marked = await within(
        5_000,
        async () => (await row().getByLabel(`${color} flag`).count()) > 0,
      );
      const stored = await within(8_000, async () => (await serverFlag()) === color.toLowerCase());
      check(
        `mail.flag-menu.${color.toLowerCase()}`,
        marked !== null && stored !== null,
        `mark ${marked} ms, server ${stored} ms (${await serverFlag()})`,
      );
    }
    await toolbar(a, "Flag Color").click();
    await a.getByRole("menuitem", { name: "Clear Flag", exact: true }).click();
    const none = await within(5_000, async () => (await row().getByLabel(/flag$/i).count()) === 0);
    check("mail.flag-menu.clear", none !== null, "the flag went");
    // Leave it purple for the restart check.
    await toolbar(a, "Flag Color").click();
    await a.getByRole("menuitem", { name: "Purple", exact: true }).click();
    await within(5_000, async () => (await row().getByLabel("Purple flag").count()) > 0);
    // Mute and unmute; leave it muted.
    await toolbar(a, "Mute").click();
    const muted = await within(
      5_000,
      async () => (await row().getByRole("img", { name: "Muted" }).count()) > 0,
    );
    await toolbar(a, "Mute").click();
    const unmuted = await within(
      5_000,
      async () => (await row().getByRole("img", { name: "Muted" }).count()) === 0,
    );
    await toolbar(a, "Mute").click();
    const again = await within(
      5_000,
      async () => (await row().getByRole("img", { name: "Muted" }).count()) > 0,
    );
    check(
      "mail.viewer.mute",
      muted !== null && unmuted !== null && again !== null,
      `muted ${muted}, unmuted ${unmuted}, muted ${again} ms`,
    );
  });

  // ── Every mailbox: toolbar Junk, Move to… every mailbox, toolbar Archive and Delete ──
  // Chris's Inbox holds two replies of one subject (Reply, Reply All) and the forward. The first reply goes Junk ->
  // Trash -> Archive -> Sent -> Drafts -> Inbox -> Junk; the second is archived; his sent message is deleted to the
  // Trash. All three stay where they end for the restart check. The replies are interchangeable (same subject, both
  // from Martin), so each step counts that subject per mailbox on the server rather than trusting which row it took.
  const countIn = async (box, text) => (await inBox(a, box)).filter((s) => s === text).length;
  await part("mailboxes", a, async () => {
    await mailbox(a, "Inbox");
    const inboxReplies = await countIn("inbox", reSubject);
    if (inboxReplies !== 2) throw new Error(`Chris's Inbox holds ${inboxReplies} replies, not 2`);
    await bySubject(a, reSubject).click();
    const junked = await moveSelected(a, "Junk");
    await mailbox(a, "Junk");
    const inJunk = await within(8_000, () => listed(a, reSubject));
    const placed = await within(
      5_000,
      async () =>
        (await countIn("junk", reSubject)) === 1 && (await countIn("inbox", reSubject)) === 1,
    );
    check(
      "mail.viewer.junk",
      junked && inJunk !== null && placed !== null,
      `stored=${junked}; Junk ${await countIn("junk", reSubject)}, Inbox ${await countIn("inbox", reSubject)}`,
    );
    check(
      "mail.sidebar.junk",
      inJunk !== null && /^Junk \(1 message\)/.test(await titleText(a)),
      await titleText(a),
    );
    // Move to… every mailbox it offers, in turn, the current mailbox dimmed each time. Drafts is never offered: it is
    // dimmed with the reason (only a draft the person saves is kept there), read on the first menu.
    const route = ["Trash", "Archive", "Sent", "Inbox", "Junk"];
    let from = "Junk";
    let menusOpened = 0;
    for (const to of route) {
      await mailbox(a, from);
      await bySubject(a, reSubject).click();
      // One open menu: the current mailbox is dimmed in it, and the target is chosen from it.
      await toolbar(a, "Move to…").click();
      const opened = await menuShows(a, to);
      if (opened) menusOpened++;
      if (to === "Trash") {
        const draftsItem = a.getByRole("menuitem", { name: "Drafts", exact: true });
        const draftsDimmed =
          (await draftsItem.getAttribute("aria-disabled").catch(() => null)) === "true" ||
          (await draftsItem.getAttribute("data-disabled").catch(() => null)) !== null;
        const draftsReason = await reasonOf(a, draftsItem);
        check(
          "mail.move-menu.drafts",
          draftsDimmed && draftsReason === MOVE_TO_DRAFTS,
          `dimmed=${draftsDimmed} reason=${JSON.stringify(draftsReason)}`,
        );
      }
      const current = a.getByRole("menuitem", { name: from, exact: true });
      const currentDimmed =
        (await current.getAttribute("aria-disabled").catch(() => null)) === "true" ||
        (await current.getAttribute("data-disabled").catch(() => null)) !== null;
      const before = await countIn(to.toLowerCase(), reSubject);
      const fromBefore = await countIn(from.toLowerCase(), reSubject);
      const ok = await moveSelected(a, null, to);
      await mailbox(a, to);
      const there = await within(8_000, () => listed(a, reSubject));
      const after = await countIn(to.toLowerCase(), reSubject);
      const fromAfter = await countIn(from.toLowerCase(), reSubject);
      check(
        `mail.move-menu.${to.toLowerCase()}`,
        ok &&
          there !== null &&
          after === before + 1 &&
          fromAfter === fromBefore - 1 &&
          currentDimmed,
        `${from} -> ${to}: ${to} ${before}->${after}, ${from} ${fromBefore}->${fromAfter}; ${from} dimmed=${currentDimmed}`,
      );
      if (to === "Trash")
        check(
          "mail.sidebar.trash",
          there !== null && /^Trash \(\d+ messages?\)/.test(await titleText(a)),
          await titleText(a),
        );
      if (to === "Archive")
        check(
          "mail.sidebar.archive",
          there !== null && /^Archive \(\d+ messages?\)/.test(await titleText(a)),
          await titleText(a),
        );
      from = to;
    }
    check(
      "mail.viewer.move-to",
      menusOpened === route.length,
      `the Move to… menu opened ${menusOpened} of ${route.length} times`,
    );
    // Toolbar Archive on the second reply, the only one left in the Inbox.
    await mailbox(a, "Inbox");
    await bySubject(a, reSubject).click();
    const archived = await moveSelected(a, "Archive");
    await mailbox(a, "Archive");
    const inArchive = await within(8_000, () => listed(a, reSubject));
    check(
      "mail.viewer.archive",
      archived &&
        inArchive !== null &&
        (await countIn("archive", reSubject)) === 1 &&
        (await countIn("inbox", reSubject)) === 0,
      "the second reply is in Archive and no longer in the Inbox",
    );
    // Toolbar Delete moves Chris's sent message to the Trash (erasing is the next section, on another message).
    await mailbox(a, "Sent");
    await bySubject(a, subject).click();
    const trashed = await moveSelected(a, "Delete");
    await mailbox(a, "Trash");
    const inTrash = await within(8_000, () => listed(a, subject));
    check(
      "mail.viewer.delete",
      trashed &&
        inTrash !== null &&
        (await countIn("trash", subject)) === 1 &&
        (await countIn("sent", subject)) === 0,
      "moved from Sent to the Trash",
    );
  });

  // ── Erasing in the Trash, on a message of its own: sent, deleted to the Trash, then Delete there erases it ──
  const eraseSubject = `Erase ${stamp}`;
  await part("erase", a, async () => {
    await newMessage(a);
    await addRecipient(a, b.account.name);
    await typeInto(compose(a).getByRole("textbox", { name: "Subject:" }), eraseSubject);
    await writeText(a, "This one goes for good. ");
    if ((await sendNow(a)) === null) throw new Error("the message to erase was not sent");
    await mailbox(a, "Sent");
    await within(8_000, () => listed(a, eraseSubject));
    await bySubject(a, eraseSubject).click();
    await moveSelected(a, "Delete");
    await mailbox(a, "Trash");
    await within(8_000, () => listed(a, eraseSubject));
    await bySubject(a, eraseSubject).click();
    const erased = a.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes("/api/mail/messages/"),
      { timeout: 10_000 },
    );
    await toolbar(a, "Delete").click();
    const erasedOk = (await erased).ok();
    const offScreen = await within(5_000, async () => !(await listed(a, eraseSubject)));
    const nowhere = !((await serverMessages(a)) ?? [{ subject: eraseSubject }]).some(
      (m) => m.subject === eraseSubject,
    );
    const martinKeeps = (await inBox(b, "inbox")).includes(eraseSubject);
    check(
      "mail.trash.erase",
      erasedOk && offScreen !== null && nowhere && martinKeeps,
      `erased from Chris's mail; Martin's copy kept=${martinKeeps}`,
    );
  });

  // ── Sidebar, favourites, search, filter, sort, the Mailboxes button, the splitter ──
  await part("navigation", a, async () => {
    for (const box of ["Inbox", "Drafts", "Sent"]) {
      await mailbox(a, box);
      check(
        `mail.sidebar.${box.toLowerCase()}`,
        (await titleText(a)).startsWith(`${box} (`),
        await titleText(a),
      );
    }
    for (const box of ["Sent", "Drafts", "Inbox"]) {
      await viewer(a)
        .getByRole("radio", { name: new RegExp(`^${box}\\b`) })
        .first()
        .click();
      const ok = await within(4_000, async () => (await titleText(a)).startsWith(`${box} (`));
      check(`mail.favorites.${box.toLowerCase()}`, ok !== null, await titleText(a));
    }
    await snapshot(a, o, "mail", "viewer with mail in several mailboxes");
    // Search finds by words of the text in every mailbox: the archived reply quotes Chris's message.
    const search = viewer(a).getByRole("searchbox", { name: "Search" });
    await typeInto(search, "Meet at the pier");
    const found = await within(
      10_000,
      async () => (await titleText(a)).startsWith("Searching") && (await listed(a, reSubject)),
    );
    check("mail.viewer.search", found !== null, await titleText(a));
    await typeInto(search, "");
    await a.keyboard.press("Escape");
    await mailbox(a, "Inbox");
    // Filter: Unread, in Ann's Inbox: Chris's message she never opened (unread) and the reply she opened to forward.
    await mailbox(c, "Inbox");
    const all = await rows(c).count();
    await viewer(c).getByRole("button", { name: "Filter: Unread" }).click();
    await pause(500);
    const unreadOnly = await rows(c).count();
    const unreadText = await rowsText(c);
    const everyUnread =
      unreadOnly > 0 &&
      (await rows(c).evaluateAll((els) =>
        els.every((e) => e.querySelector('[aria-label="Unread"]')),
      ));
    await viewer(c).getByRole("button", { name: "Filter: Unread" }).click();
    await pause(500);
    const allAgain = await rows(c).count();
    check(
      "mail.viewer.filter-unread",
      all >= 2 &&
        unreadOnly >= 1 &&
        unreadOnly < all &&
        everyUnread &&
        unreadText.split("\n").includes(subject) &&
        !unreadText.split("\n").includes(reSubject) &&
        allAgain === all,
      `${all} -> ${unreadOnly} unread -> ${allAgain}`,
    );
    // Sort by Subject, From, Date: the pop-up's label (its text) names the order, and the list follows it.
    // In Ann's Inbox, which holds messages of different subjects and senders.
    await mailbox(c, "Inbox");
    const sorter = viewer(c).getByRole("button", { name: /^Sort by / });
    const columnOf = async (sort) =>
      rows(c).evaluateAll(
        (els, which) =>
          els.map(
            (e) =>
              (which === "Subject"
                ? e.querySelector(".mac-mail-row-subject")
                : e.querySelector(".mac-mail-row-name")
              )?.textContent?.trim() ?? "",
          ),
        sort,
      );
    for (const sort of ["Subject", "From", "Date"]) {
      await sorter.click();
      if (sort === "Subject")
        check(
          "mail.viewer.sort",
          await c
            .getByRole("menuitemradio", { name: "From", exact: true })
            .waitFor({ timeout: 3_000 })
            .then(() => true)
            .catch(() => false),
          "the sort menu opened",
        );
      await c.getByRole("menuitemradio", { name: sort, exact: true }).click();
      const named = await within(
        3_000,
        async () => (await sorter.innerText()).replace(/\s+/g, " ").trim() === `Sort by ${sort}`,
      );
      let ordered = true;
      if (sort !== "Date") {
        const column = await columnOf(sort);
        ordered =
          column.length > 1 &&
          column.every((v, i) => i === 0 || column[i - 1].localeCompare(v) <= 0);
      }
      check(
        `mail.sort-menu.${sort.toLowerCase()}`,
        named !== null && ordered,
        `pop-up says ${JSON.stringify((await sorter.innerText()).trim())}; ordered=${ordered}`,
      );
    }
    // The Mailboxes button hides and shows the sidebar.
    const tree = viewer(a).getByRole("tree", { name: "Mailboxes" });
    await viewer(a).getByRole("button", { name: "Mailboxes" }).click();
    const hid = await within(3_000, async () => !(await tree.isVisible()));
    await viewer(a).getByRole("button", { name: "Mailboxes" }).click();
    const showed = await within(3_000, () => tree.isVisible());
    check(
      "mail.viewer.mailboxes",
      hid !== null && showed !== null,
      `hid ${hid} ms, showed ${showed} ms`,
    );
    // The splitter widens the sidebar.
    const divider = viewer(a).getByRole("separator", { name: "Resize mailbox list" });
    const before = (await tree.boundingBox())?.width ?? 0;
    const at = await divider.boundingBox();
    await drag(
      a,
      { x: at.x + at.width / 2, y: at.y + at.height / 2 },
      { x: at.x + at.width / 2 + 40, y: at.y + at.height / 2 },
      8,
    );
    const after = (await tree.boundingBox())?.width ?? 0;
    check(
      "mail.viewer.splitter",
      Math.abs(after - before - 40) <= 4,
      `${Math.round(before)} -> ${Math.round(after)} px`,
    );
  });

  // ── Drafts: kept on close, a lost answer retried with the same key, Don’t Save, opening a draft ──
  const draftSubject = `Draft ${stamp}`;
  await part("drafts", a, async () => {
    await mailbox(a, "Inbox");
    await newMessage(a);
    await addRecipient(a, b.account.name);
    await typeInto(compose(a).getByRole("textbox", { name: "Subject:" }), draftSubject);
    await writeText(a, "Not finished yet. ");
    // The first save reaches the server but its answer is lost.
    const keys = [];
    let lost = false;
    await a.route("**/api/mail/drafts*", async (routed) => {
      keys.push(routed.request().headers()["idempotency-key"] ?? "");
      if (!lost) {
        lost = true;
        await routed.fetch().catch(() => {});
        await routed.abort("failed");
      } else await routed.continue();
    });
    // The engines name the aborted request differently; the abort is this step's own.
    allow(
      /chris request failed: \S*\/api\/mail\/drafts\S* (net::ERR_FAILED|NS_ERROR_FAILURE|Blocked by Web Inspector)$/,
    );
    allow(/Failed to load resource|NetworkError|Load failed|net::ERR_FAILED/);
    // Bring the New Message window forward by its Subject field, then its own red button.
    const close = async () => {
      await compose(a)
        .getByRole("textbox", { name: "Subject:" })
        .click({ timeout: 5_000 })
        .catch(() => {});
      await compose(a)
        .getByRole("group", { name: "Window controls" })
        .first()
        .getByRole("button", { name: "Close" })
        .click({ timeout: 10_000 });
    };
    await close();
    const notice = await within(
      8_000,
      async () =>
        (await compose(a).count()) > 0 && /could not be saved/.test(await compose(a).innerText()),
    );
    await close();
    const closed = await within(10_000, async () => (await compose(a).count()) === 0);
    await a.unroute("**/api/mail/drafts*");
    const drafts = (await inBox(a, "drafts")).filter((s) => s === draftSubject);
    check(
      "mail.flow.draft-saved",
      closed !== null && drafts.length >= 1,
      `Drafts holds ${drafts.length}`,
    );
    check(
      "mail.flow.draft-idempotency",
      notice !== null &&
        keys.length === 2 &&
        keys[0] !== "" &&
        keys[0] === keys[1] &&
        drafts.length === 1,
      `keys ${keys.map((k) => k.slice(0, 8)).join(",")}; ${drafts.length} stored`,
    );
    // Don’t Save: the server cannot be reached; Don’t Save, then close, discards.
    const discarded = `Discard ${stamp}`;
    await newMessage(a);
    await typeInto(compose(a).getByRole("textbox", { name: "Subject:" }), discarded);
    await writeText(a, "Throw this away. ");
    await a.route("**/api/mail/drafts*", (routed) => routed.abort("failed"));
    await close();
    const dontSave = compose(a).getByRole("button", { name: "Don’t Save" });
    await dontSave.waitFor({ timeout: 8_000 });
    await snapshot(a, o, "mail", "New Message window, draft not saved");
    await dontSave.click();
    const told = await within(4_000, async () =>
      (await compose(a).innerText()).includes("Close the window to discard this message."),
    );
    await close();
    const gone = await within(8_000, async () => (await compose(a).count()) === 0);
    await a.unroute("**/api/mail/drafts*");
    check(
      "mail.compose.dont-save",
      told !== null && gone !== null && !(await inBox(a, "drafts")).includes(discarded),
      "discarded",
    );
    // Open the kept draft from Drafts (double-click) and send it.
    await mailbox(a, "Drafts");
    await bySubject(a, draftSubject).dblclick();
    const opened = await within(
      8_000,
      async () =>
        (await compose(a).count()) > 0 &&
        (await compose(a)
          .getByRole("textbox", { name: "Subject:" })
          .inputValue()
          .catch(() => "")) === draftSubject,
    );
    const sent = opened !== null && (await sendNow(a)) !== null;
    const martinGot = await getMailUntil(b, draftSubject);
    check(
      "mail.list.open-draft",
      sent && martinGot !== null && !(await inBox(a, "drafts")).includes(draftSubject),
      `opened ${opened} ms; Martin got it ${martinGot} ms`,
    );
    // A draft kept in Drafts for the restart check: closing a window with text saves it.
    await newMessage(a);
    await typeInto(compose(a).getByRole("textbox", { name: "Subject:" }), keptDraft);
    await writeText(a, "Still thinking. ");
    await close();
    const kept = await within(
      10_000,
      async () =>
        (await compose(a).count()) === 0 && (await inBox(a, "drafts")).includes(keptDraft),
    );
    if (kept === null) check("mail.flow.draft-saved", false, "the second draft was not kept");
    // A draft can only be deleted: Archive, Junk and Move to… > Inbox are dimmed for it, each saying why.
    await mailbox(a, "Drafts");
    await bySubject(a, keptDraft).click();
    const dimmedWith = async (locator) => ({
      dimmed:
        (await locator.isDisabled().catch(() => false)) ||
        (await locator.getAttribute("aria-disabled").catch(() => null)) === "true" ||
        (await locator.getAttribute("data-disabled").catch(() => null)) !== null,
      reason: await reasonOf(a, locator),
    });
    const archiveState = await dimmedWith(toolbar(a, "Archive"));
    const junkState = await dimmedWith(toolbar(a, "Junk"));
    await toolbar(a, "Move to…").click();
    const inboxItem = a.getByRole("menuitem", { name: "Inbox", exact: true });
    await inboxItem.waitFor({ timeout: 3_000 }).catch(() => {});
    const inboxState = await dimmedWith(inboxItem);
    const trashOffered = !(
      await dimmedWith(a.getByRole("menuitem", { name: "Trash", exact: true }))
    ).dimmed;
    await a.keyboard.press("Escape");
    const allSay = [archiveState, junkState, inboxState].every(
      (s) => s.dimmed && s.reason === DRAFT_MOVE,
    );
    check(
      "mail.drafts.moves-dimmed",
      allSay && trashOffered,
      `Archive ${JSON.stringify(archiveState)}; Junk ${JSON.stringify(junkState)}; Inbox ${JSON.stringify(inboxState)}; Trash offered=${trashOffered}`,
    );
  });

  // ── Load More: more mail than the two pages a window reads first ──
  await part("load-more", c, async () => {
    let seeded = 0;
    for (let start = 0; start < 1_001; start += 50) {
      const batch = Array.from({ length: Math.min(50, 1_001 - start) }, (_, n) =>
        api(c, "POST", "/api/mail/drafts", { to: [], subject: `Seed ${start + n}`, text: "" }).then(
          (r) => r.status === 200,
        ),
      );
      seeded += (await Promise.all(batch)).filter(Boolean).length;
    }
    // WebKit logs a read the reload cuts off as a failed access check, on the same origin; nothing was thrown.
    let reloading = true;
    allow({
      test: (text) =>
        reloading &&
        /^ann page error: \S*\/api\/mail\/messages\S* due to access control checks/.test(text),
    });
    await reload(c);
    reloading = false;
    await openMail(c);
    const notice = await within(
      20_000,
      async () =>
        (await viewer(c)
          .getByText(/Older messages are not loaded/)
          .count()) > 0,
    );
    const hiddenFirst = !(await listed(c, subject));
    await snapshot(c, o, "mail", "viewer with older messages not loaded");
    await viewer(c).getByRole("button", { name: "Load More" }).click();
    const more = await within(25_000, () => listed(c, subject));
    await typeInto(viewer(c).getByRole("searchbox", { name: "Search" }), "Meet at the pier");
    const foundOld = await within(10_000, () => listed(c, subject));
    check(
      "mail.list.load-more",
      seeded === 1_001 && notice !== null && hiddenFirst && more !== null && foundOld !== null,
      `seeded ${seeded}; loaded in ${more} ms`,
    );
    await typeInto(viewer(c).getByRole("searchbox", { name: "Search" }), "");
  });

  // ── Preferences, the shared menus and shortcuts, the viewer's chrome ──
  await part("preferences", a, async () => {
    await menu(a, "Mail", "Preferences…");
    // The Preferences window is a region named after its current pane; its own element is .mac-mail-preferences.
    const prefs = a.locator(".mac-mail-preferences").first();
    await prefs.waitFor({ timeout: 8_000 });
    await snapshot(a, o, "mail", "Preferences window");
    const tab = (name) => prefs.getByRole("tab", { name, exact: true });
    for (const [name, slug] of [
      ["General", "general"],
      ["Accounts", "accounts"],
      ["Junk Mail", "junk"],
      ["Fonts & Colors", "fonts"],
      ["Viewing", "viewing"],
      ["Composing", "composing"],
      ["Signatures", "signatures"],
      ["Rules", "rules"],
    ]) {
      await tab(name).click();
      const selected = await within(
        3_000,
        async () =>
          (await tab(name).getAttribute("aria-selected")) === "true" &&
          (await a.getByRole("region", { name, exact: true }).count()) > 0,
      );
      check(
        `mail.prefs.tab-${slug}`,
        selected !== null,
        `${name} selected; the window is titled ${name}`,
      );
      await snapshot(a, o, "mail", `Preferences window, ${name}`);
    }
    for (const [pane, label] of PREF_CHECKS) {
      await tab(pane).click();
      const box = prefs.getByRole("checkbox", { name: label, exact: true });
      const rowId = `mail.prefs.check-${label
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")
        .replace(/^-|-$/g, "")}`;
      // A setting this Mail cannot honour is dimmed and says why.
      if (await box.isDisabled()) {
        const why = await reasonOf(a, box);
        check(rowId, Boolean(why), `dimmed: ${why}`);
        continue;
      }
      const before = await box.isChecked();
      await box.click();
      const flipped = await within(2_000, async () => (await box.isChecked()) !== before);
      await box.click();
      const back = await within(2_000, async () => (await box.isChecked()) === before);
      check(rowId, flipped !== null && back !== null, `${before} -> ${!before} -> ${before}`);
    }
    await tab("General").click();
    for (const [label, option] of PREF_CHOICES) {
      const popup = prefs.getByRole("combobox", { name: label, exact: true });
      const rowName = `mail.prefs.${label
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")
        .replace(/-$/, "")}`;
      // A choice this Mail cannot honour is dimmed and says why.
      if (await popup.isDisabled()) {
        const why = await reasonOf(a, popup);
        check(rowName, Boolean(why), `dimmed: ${why}`);
        continue;
      }
      await popup.click();
      await a.getByRole("option", { name: option, exact: true }).click();
      const shows = await within(3_000, async () => (await popup.innerText()).trim() === option);
      check(rowName, shows !== null, `shows ${JSON.stringify((await popup.innerText()).trim())}`);
    }
    // The Trash checkbox decides whether a search of all mailboxes includes the Trash: Chris's message is there.
    const trashBox = prefs.getByRole("checkbox", { name: "Trash", exact: true });
    if (await trashBox.isChecked()) await trashBox.click();
    const search = viewer(a).getByRole("searchbox", { name: "Search" });
    await typeInto(search, subject);
    const without = await within(
      5_000,
      async () =>
        (await titleText(a)).startsWith("Searching") &&
        !(await rowsText(a)).split("\n").includes(subject),
    );
    // A press on the viewer sent Preferences under it, as on a Mac; the command brings it back.
    await menu(a, "Mail", "Preferences…");
    await trashBox.click();
    const withTrash = await within(5_000, () => listed(a, subject));
    await typeInto(search, "");
    await menu(a, "Mail", "Preferences…");
    check(
      "mail.prefs.search-trash-effect",
      without !== null && withTrash !== null,
      `left out ${without} ms; found once ticked ${withTrash} ms`,
    );
    // The Help button: what the page shows for it.
    const help = prefs.getByRole("button", { name: "Help", exact: true });
    const helpDimmed = await help.isDisabled().catch(() => false);
    const helpReason = await reasonOf(a, help);
    if (!helpDimmed) await help.click().catch(() => {});
    const helpOpened =
      !helpDimmed &&
      (await within(
        3_000,
        async () => (await a.getByRole("region", { name: /Help/ }).count()) > 0,
      )) !== null;
    check(
      "mail.prefs.help",
      (helpDimmed &&
        helpReason === "Mail Help is not available: this desktop has no help book for Mail.") ||
        helpOpened,
      `dimmed=${helpDimmed} reason=${JSON.stringify(helpReason)} opened=${helpOpened}`,
    );
    await tidyHelp(a);
    await prefs
      .getByRole("group", { name: "Window controls" })
      .first()
      .getByRole("button", { name: "Close" })
      .click();
    await prefs.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  });

  await part("common", a, async () => {
    await tidy(a);
    const prefsName = await (async () => {
      await menu(a, "Mail", "Preferences…");
      const region = a.locator(".mac-mail-preferences").first();
      await region.waitFor({ timeout: 8_000 });
      const name = (await region.getAttribute("aria-label").catch(() => null)) ?? "General";
      await region
        .getByRole("group", { name: "Window controls" })
        .first()
        .getByRole("button", { name: "Close" })
        .click();
      await region.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
      return name;
    })();
    await verifyCommon(a, {
      app: "mail",
      appName: "Mail",
      windowName: MAILWIN,
      windowItem: "Mail",
      check,
      rows: ROWS,
      prefsWindow: prefsName,
      reopen: () => openMail(a),
    });
  });

  await part("viewer-chrome", a, async () => {
    await tidy(a);
    await verifyChrome(a, {
      app: "mail",
      slug: "viewer",
      windowName: MAILWIN,
      windowItem: "Mail",
      check,
      reopen: () => openMail(a),
    });
  });

  // ── Isolation: a new account sees none of this mail, on screen or through the API ──
  await part("isolation", a, async () => {
    const d = await person("dora");
    await openMail(d);
    const empty = await within(
      10_000,
      async () => (await viewer(d).getByText("No Messages").count()) > 0,
    );
    const theirs = (await serverMessages(d)) ?? ["unreadable"];
    const martin = (await serverMessages(b)) ?? [];
    const leaks = martin.filter((m) => m.subject === draftSubject && m.mailbox === "drafts").length;
    check(
      "mail.flow.isolation",
      empty !== null && theirs.length === 0 && leaks === 0,
      `Dora sees ${theirs.length} messages; Chris's draft in Martin's Drafts: ${leaks}`,
    );
  });

  await shot(a, "end");
  saveState(o, "mail", {
    a: a.account,
    b: b.account,
    subject,
    reSubject,
    fwd,
    eraseSubject,
    draftSubject,
    keptDraft,
    // Where every one of Chris's messages is at the end, by id: the restart check expects exactly this.
    placement: ((await serverMessages(a)) ?? []).map((m) => ({
      id: m.id,
      subject: m.subject,
      mailbox: m.mailbox,
      flag: m.flag ?? null,
    })),
  });
});

/** Close a Help Viewer window a Help button opened, if any. */
async function tidyHelp(page) {
  const helpWin = page.getByRole("region", { name: /Help/ }).first();
  if (await helpWin.isVisible().catch(() => false))
    await helpWin
      .getByRole("group", { name: "Window controls" })
      .first()
      .getByRole("button", { name: "Close" })
      .click()
      .catch(() => {});
}

async function titleOfCompose(page) {
  return (
    (await compose(page)
      .getAttribute("aria-label")
      .catch(() => "")) ?? ""
  );
}

/** The New Message window's notice line (a refused send says why there). */
async function noticeOf(page) {
  return (
    await compose(page)
      .getByRole("alert")
      .first()
      .innerText()
      .catch(() => "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** After a real restart: the accounts sign in again and find what the write phase left. */
async function restartCheck(person) {
  const state = loadState(o, "mail");
  if (!state) {
    check("mail.restart.state", false, "no state file from a write phase");
    return;
  }
  const a = await person("chris", { existing: state.a });
  const b = await person("martin", { existing: state.b });
  await openMail(a);
  await openMail(b);
  const aAll = (await serverMessages(a)) ?? [];
  const bAll = (await serverMessages(b)) ?? [];
  const byId = new Map(aAll.map((m) => [m.id, m]));
  // Every saved message is where it was, by id, and nothing came back or went missing.
  const moved = state.placement.filter((m) => byId.get(m.id)?.mailbox !== m.mailbox);
  const samePlaces = aAll.length === state.placement.length && moved.length === 0;
  const placesDetail = `${aAll.length}/${state.placement.length} messages; ${moved.length} not where they were`;
  // The forward stays flagged purple and muted, in the Inbox.
  const fwd = aAll.find((m) => m.subject === state.fwd);
  await mailbox(a, "Inbox");
  const row = bySubject(a, state.fwd);
  const purple = await within(
    10_000,
    async () => (await row.getByLabel("Purple flag").count()) > 0,
  );
  check(
    "mail.flag-menu.purple",
    purple !== null && fwd?.flag === "purple" && fwd?.mailbox === "inbox",
    `server flag ${fwd?.flag} in ${fwd?.mailbox}`,
  );
  check(
    "mail.viewer.flag",
    purple !== null && fwd?.flag === "purple",
    "the flag is kept on screen and on the server",
  );
  const muted = (await row.getByRole("img", { name: "Muted" }).count()) > 0;
  check("mail.viewer.mute", muted && fwd?.muted !== false, "still muted");
  check(
    "mail.viewer.get-mail",
    bAll.some((m) => m.subject === state.subject && m.mailbox === "inbox"),
    "Martin's Inbox still holds the message",
  );
  check(
    "mail.flow.between-accounts",
    bAll.some((m) => m.subject === state.subject) && aAll.some((m) => m.subject === state.subject),
    "both copies kept across the restart",
  );
  const count = (box, text) => aAll.filter((m) => m.mailbox === box && m.subject === text).length;
  check(
    "mail.viewer.archive",
    samePlaces && count("archive", state.reSubject) === 1,
    `one reply in Archive; ${placesDetail}`,
  );
  check(
    "mail.viewer.junk",
    samePlaces && count("junk", state.reSubject) === 1,
    `one reply in Junk; ${placesDetail}`,
  );
  check(
    "mail.viewer.delete",
    samePlaces && count("trash", state.subject) === 1 && count("sent", state.subject) === 0,
    "Chris's message is still in the Trash",
  );
  for (const box of MAILBOX_NAMES.filter((name) => name !== "Drafts"))
    check(`mail.move-menu.${box.toLowerCase()}`, samePlaces, placesDetail);
  check(
    "mail.trash.erase",
    !aAll.some((m) => m.subject === state.eraseSubject) &&
      bAll.some((m) => m.subject === state.eraseSubject),
    "the erased message stays erased; Martin's copy stays",
  );
  check(
    "mail.flow.draft-saved",
    count("drafts", state.keptDraft) === 1,
    `the kept draft is in Drafts (${count("drafts", state.keptDraft)})`,
  );
  check(
    "mail.flow.draft-idempotency",
    aAll.filter((m) => m.subject === state.draftSubject).length === 1 &&
      bAll.filter((m) => m.subject === state.draftSubject).length === 1,
    "one copy of the retried draft, sent once",
  );
  await mailbox(a, "Archive");
  check(
    "mail.sidebar.archive",
    (await titleText(a)).startsWith("Archive (") && (await listed(a, state.reSubject)),
    await titleText(a),
  );
  await mailbox(a, "Junk");
  check(
    "mail.sidebar.junk",
    (await titleText(a)).startsWith("Junk (") && (await listed(a, state.reSubject)),
    await titleText(a),
  );
  await mailbox(a, "Trash");
  check(
    "mail.sidebar.trash",
    (await titleText(a)).startsWith("Trash (") && (await listed(a, state.subject)),
    await titleText(a),
  );
}
