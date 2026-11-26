#!/usr/bin/env node
// Messages on Ferrite between accounts: Chris, Martin and Ann each make an account at the login
// window, in browsers of their own, and open Messages. Chris starts a conversation with Martin by
// his account name; it appears in Martin's open window without a reload (the window reads its
// list again every few seconds), unread, with a notification. Martin opens it (Chris sees Read),
// types (Chris sees him typing) and answers; the answer reaches Chris. Martin gives Chris's first
// message a tapback, which Chris sees. Chris then starts a group with Martin and Ann; Ann's answer
// reaches both, under her name, and Ann's list holds no conversation of Chris and Martin alone,
// whose transcript her session cannot read. After a reload Chris's conversations are all still
// there. Martin turns on Do Not Disturb for his conversation with Chris: it is kept on the server
// (Ann's setting is untouched), still on after a reload, and Chris's next message reaches him with
// no notification. Ann then leaves the group from its Details: it goes from her list and stays
// gone after a
// reload, her session can no longer read it, Chris and Martin carry on in it as two, and Martin is
// told she left. Exits 0 only when every step passed and no page logged a console error, a page
// error, a failed request or an HTTP error (except Ann's own last read of the group she left,
// which answers 404 by design).
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/messages-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                 [--browser chromium|chrome|firefox|webkit]
//
// Accounts are made fresh for each run, so the journey can run again on the same deployment.

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot, browserName } = twoPeople("messages");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mschris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `msmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `msann-${id}`, fullName: `Ann ${id}`, password };

/**
 * A GET through the browser context's own request client (the page's cookies, so the same
 * person), not from the page: a refusal here is the point, not one of the page's errors.
 */
async function apiGet(page, path) {
  const response = await page.request.get(new URL(path, page.url()).href);
  let json = null;
  try {
    json = await response.json();
  } catch {
    // No JSON body.
  }
  return { status: response.status(), json };
}

/** The id of the conversation in `conversations` whose members are exactly `names`. */
function conversationOf(conversations, names) {
  const wanted = [...names].sort().join(",");
  return (conversations ?? []).find(
    (each) =>
      each.members
        .map((member) => member.name)
        .sort()
        .join(",") === wanted,
  )?.id;
}

const windowOf = (page) => page.locator('[aria-label="Messages"]').first();
const list = (page) => windowOf(page).getByRole("listbox", { name: "Conversations" });
/** A conversation's row, by its exact name (a group's name lists all the other members). */
const row = (page, name) =>
  list(page)
    .getByRole("option")
    .filter({
      has: page.locator(".mac-messages-row-name", {
        hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      }),
    })
    .first();
const transcript = (page) => windowOf(page).getByRole("log").first();
const said = async (page, text) =>
  (
    await transcript(page)
      .innerText()
      .catch(() => "")
  ).includes(text);

/** Start a conversation with `names` (account names) and send `text` as its first message. */
async function start(page, names, text) {
  await windowOf(page).getByRole("button", { name: "Compose new message" }).click();
  const to = windowOf(page).getByRole("textbox", { name: "To" });
  await to.fill(names.join(", "));
  const field = windowOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(text);
  await field.press("Enter");
}

async function say(page, text) {
  const field = windowOf(page).getByRole("textbox", { name: "Message" });
  await field.click();
  await field.pressSequentially(text);
  await field.press("Enter");
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  const c = await person("ann", ann);
  step("Chris, Martin and Ann each have a desktop of their own", true);
  for (const page of [b, a, c]) await openFromDock(page, "Messages");

  // ── Chris writes to Martin by his account name ──
  const first = `Ferry at 8:40? ${id} https://example.com/?ferry=${id}`;
  await start(a, [martin.name], first);
  const made = await within(15_000, async () => (await row(a, martin.fullName).count()) > 0);
  step("Chris's conversation with Martin is made and listed", made !== null);
  const stored = await within(
    15_000,
    async () =>
      (await windowOf(a).locator('[data-direction="sent"]').filter({ hasText: first }).count()) >
        0 && !(await transcript(a).innerText()).includes("Not Delivered"),
  );
  step("the message is stored", stored !== null);

  const arrived = await within(20_000, async () => (await row(b, chris.fullName).count()) > 0);
  step(
    "the conversation appears in Martin's open window without a reload",
    arrived !== null,
    `${arrived} ms`,
  );
  step("it is marked unread", (await row(b, chris.fullName).getByLabel("Unread").count()) > 0);
  const notified = await within(
    15_000,
    async () => (await b.getByText(first.slice(0, 20)).count()) > 1,
  );
  step("Martin is notified", notified !== null);

  // ── Martin reads, types and answers ──
  await row(b, chris.fullName).click();
  const shown = await within(10_000, () => said(b, first));
  step("Martin reads Chris's message", shown !== null);
  const read = await within(15_000, async () => (await transcript(a).innerText()).includes("Read"));
  step("Chris sees that Martin read it", read !== null);
  const field = windowOf(b).getByRole("textbox", { name: "Message" });
  await field.click();
  await field.pressSequentially("Yes, see");
  const typing = await within(
    10_000,
    async () => (await windowOf(a).getByText(`${martin.fullName} is typing`).count()) > 0,
  );
  step("Chris sees Martin typing", typing !== null);
  await field.pressSequentially(" you there");
  await field.press("Enter");
  const answered = await within(15_000, () => said(a, "Yes, see you there"));
  step("Martin's answer reaches Chris", answered !== null, `${answered} ms`);
  await shot(a, "messages-conversation");

  // ── Martin gives Chris's first message a tapback ──
  await transcript(b).getByRole("button", { name: "Tapback or reply to message 1" }).click();
  await b.getByRole("menuitem", { name: /Love/ }).click();
  const loved = await within(15_000, async () =>
    (
      await transcript(a)
        .getByLabel("Tapbacks")
        .innerText()
        .catch(() => "")
    ).includes(martin.name),
  );
  step("Chris sees Martin's tapback", loved !== null);
  await shot(b, "messages-tapback");

  // ── A group with Martin and Ann ──
  const hello = `Island trip on Saturday? ${id}`;
  await start(a, [martin.name, ann.name], hello);
  const group = await within(
    20_000,
    async () => (await row(c, `${chris.fullName}, ${martin.fullName}`).count()) > 0,
  );
  step("the group reaches Ann", group !== null);
  await row(c, `${chris.fullName}, ${martin.fullName}`).click();
  await within(10_000, () => said(c, hello));
  await say(c, "Count me in");
  for (const [label, page] of [
    ["Chris", a],
    ["Martin", b],
  ]) {
    if (page === b) await row(b, `${chris.fullName}, ${ann.fullName}`).click();
    const heard = await within(
      20_000,
      async () => (await said(page, "Count me in")) && (await said(page, ann.fullName)),
    );
    step(`Ann's answer reaches ${label}, under her name`, heard !== null);
  }
  await shot(c, "messages-group");
  // Ann's isolation, by who is in each conversation: Chris's own list names the conversation of
  // Chris and Martin alone; Ann's list holds none with those members, and her session cannot read
  // its transcript.
  const pair = conversationOf(
    (await apiGet(a, "/api/messages/conversations")).json?.conversations,
    [chris.name, martin.name],
  );
  step("Chris's list names his conversation with Martin", pair !== undefined, pair);
  const annList = await apiGet(c, "/api/messages/conversations");
  step(
    "Ann's list holds no conversation of Chris and Martin alone",
    annList.status === 200 &&
      Array.isArray(annList.json?.conversations) &&
      annList.json.conversations.some((each) => each.members.length === 3) &&
      conversationOf(annList.json.conversations, [chris.name, martin.name]) === undefined &&
      !annList.json.conversations.some((each) => each.id === pair),
  );
  const peek = await apiGet(c, `/api/messages/conversations/${pair}`);
  step(
    "Ann cannot read Chris and Martin's transcript",
    pair !== undefined && peek.status === 404 && !JSON.stringify(peek.json).includes(first),
    `HTTP ${peek.status}`,
  );

  // ── After a reload Chris's conversations are still there ──
  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(a, "Messages");
  // Chris's list: the shared Ferrite Room, which every desktop lists, and the two conversations
  // made above (with Martin, and the group with Martin and Ann).
  const kept = await within(15_000, async () => (await list(a).getByRole("option").count()) >= 3);
  step("Chris's conversations are kept after a reload", kept !== null);
  await row(a, martin.fullName).click();
  const history = await within(
    10_000,
    async () => (await said(a, first)) && (await said(a, "Yes, see you there")),
  );
  step("the conversation's messages are kept", history !== null);

  // ── Martin turns on Do Not Disturb for Chris ──
  await row(b, chris.fullName).click();
  await windowOf(b).getByRole("button", { name: "Details" }).click();
  const quiet = b.getByRole("checkbox", { name: "Do Not Disturb" });
  await quiet.click();
  const quietKept = await within(
    10_000,
    async () =>
      (await quiet.getAttribute("aria-checked")) === "true" &&
      ((await apiGet(b, "/api/messages/muted")).json?.muted ?? []).includes(pair),
  );
  step("Martin's Do Not Disturb for Chris is kept on the server", quietKept !== null);
  await b.keyboard.press("Escape");
  const annMuted = await apiGet(c, "/api/messages/muted");
  step(
    "Ann's Do Not Disturb is her own",
    annMuted.status === 200 && (annMuted.json?.muted ?? []).length === 0,
  );
  await b.reload({ waitUntil: "load" });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(b, "Messages");
  const moon = await within(
    15_000,
    async () =>
      (await row(b, chris.fullName).getByRole("img", { name: "Do Not Disturb" }).count()) > 0,
  );
  step("after a reload Martin's conversation with Chris still shows Do Not Disturb", moon !== null);
  await shot(b, "messages-do-not-disturb");
  const hush = `Quiet now ${id}`;
  await say(a, hush);
  const hushed = await within(15_000, async () =>
    ((await apiGet(b, "/api/messages/conversations")).json?.conversations ?? []).some(
      (each) => each.id === pair && each.last?.text === hush,
    ),
  );
  const hushNote = ((await apiGet(b, "/api/notification-center/inbox")).json?.items ?? []).some(
    (item) => item.body === hush,
  );
  step(
    "Chris's next message reaches Martin with no notification",
    hushed !== null && !hushNote,
    `arrived ${hushed} ms, notified ${hushNote}`,
  );

  // ── Ann leaves the group ──
  const groupId = conversationOf(
    (await apiGet(a, "/api/messages/conversations")).json?.conversations,
    [chris.name, martin.name, ann.name],
  );
  step("Chris's list names the group", groupId !== undefined, groupId);
  // A read of the group Ann's window started before her leave was answered answers 404: she is
  // no longer in it. Allowed from here on for Ann alone: that conversation's reads (the URL
  // carries the page's session query), and the line Chromium and WebKit log for a 404, which
  // names no URL.
  // Her open conversation may read its files once more as she is removed.
  allow(new RegExp(`^ann HTTP 404: .*/api/messages/conversations/${groupId}(/files)?(\\?[^/]*)?$`));
  allow(/^ann console: Failed to load resource: the server responded with a status of 404/);
  const groupRow = () => row(c, `${chris.fullName}, ${martin.fullName}`);
  await groupRow().click();
  await windowOf(c).getByRole("button", { name: "Details" }).click();
  await c.getByRole("button", { name: "Leave this Conversation" }).click();
  const gone = await within(15_000, async () => (await groupRow().count()) === 0);
  step("the group leaves Ann's list", gone !== null);
  await shot(c, "messages-left");
  const annPeekGroup = await apiGet(c, `/api/messages/conversations/${groupId}`);
  step(
    "Ann can no longer read the group",
    annPeekGroup.status === 404,
    `HTTP ${annPeekGroup.status}`,
  );
  const remaining = await apiGet(a, `/api/messages/conversations/${groupId}`);
  const names = (remaining.json?.state?.members ?? []).map((member) => member.name).sort();
  step(
    "Chris and Martin carry on in the group as two",
    remaining.status === 200 && names.join(",") === [chris.name, martin.name].sort().join(","),
    names.join(","),
  );
  const told = await within(15_000, async () =>
    ((await apiGet(b, "/api/notification-center/inbox")).json?.items ?? []).some(
      (item) =>
        item.app === "messages" &&
        item.title === ann.fullName &&
        item.body === "left the conversation",
    ),
  );
  step("Martin is told Ann left", told !== null);
  await c.reload({ waitUntil: "load" });
  await c
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(c, "Messages");
  // Her list after the reload: the shared Ferrite Room, and nothing of the group.
  const listed = await within(15_000, async () => (await list(c).getByRole("option").count()) >= 1);
  const annAfter = await apiGet(c, "/api/messages/conversations");
  step(
    "after a reload the group is still gone from Ann's list",
    listed !== null &&
      (await groupRow().count()) === 0 &&
      annAfter.status === 200 &&
      !(annAfter.json?.conversations ?? []).some((each) => each.id === groupId),
  );
  // ── A web address in a message opens in Safari, not in the desktop page ──
  await row(b, chris.fullName).click();
  const ferryLink = transcript(b)
    .getByRole("link", { name: `https://example.com/?ferry=${id}` })
    .first();
  const linked = await within(15_000, async () => (await ferryLink.count()) > 0);
  step(
    "the address in Chris's message is a link",
    linked !== null && (await ferryLink.getAttribute("rel")) === "noopener noreferrer",
  );
  const desktopUrl = b.url();
  await ferryLink.click();
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
  await shot(b, "messages-link-safari");
  console.log(`engine ${browserName} done`);
});
