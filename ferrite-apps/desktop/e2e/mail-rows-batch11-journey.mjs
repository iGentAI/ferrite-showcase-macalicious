#!/usr/bin/env node
// Mail's Take All Accounts Offline and the rows around it, on Ferrite, in a real browser against the running app.
// Offline: no read of the mailboxes reaches the server, what was loaded stays across a reload, a message sent waits
// in the Outbox, and taking Mail online delivers it once, also when the first answer is lost. Also: Include Original
// Attachments in Reply; Check for new messages under a fast-forwarded browser clock; Archive muted messages; a draft
// too large for keepalive saved across a reload; Log Out while offline forgets the copy of the mailboxes and keeps the
// Outbox. State is read from the server. Exits 0 only when every step passed and no page logged an error other than
// those this journey causes on purpose.
//
//   node e2e/mail-rows-batch11-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//   ONLY=offline,signout,attachments,clock,muted,large node e2e/mail-rows-batch11-journey.mjs

import {
  allOnServer,
  arrive,
  choose,
  closePreferences,
  compose,
  mailboxRow,
  menuPath,
  onServer,
  openPane,
  preferences,
  row,
  send,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("mail-rows-batch11");
allow(/request failed: .*\/api\/mail\/send/);
allow(/HTTP 422: .*\/api\/mail\/send/);
allow(/console: Failed to load resource/);
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mochris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `momartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `moann-${id}`, fullName: `Ann ${id}`, password };
const dee = { name: `modee-${id}`, fullName: `Dee ${id}`, password };
const only = process.env.ONLY?.split(",") ?? [
  "offline",
  "signout",
  "attachments",
  "clock",
  "muted",
  "large",
];
const subject = (word) => `${word} ${id}`;

const open = async (page) => {
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
};
const reload = async (page) => {
  await page.reload({ waitUntil: "load" });
  await open(page);
};
const menuItem = (page, name) => page.getByRole("menu").last().getByRole("menuitem", { name });
const takeOffline = (page) => menuPath(page, "Mailbox", "Take All Accounts Offline");
const takeOnline = (page) => menuPath(page, "Mailbox", "Take All Accounts Online");
const copies = async (page, word, mailbox) =>
  (await allOnServer(page)).filter((m) => m.subject === subject(word) && m.mailbox === mailbox);
const outboxShown = (page) => mailboxRow(page, "Outbox").isVisible();

/** What this browser's IndexedDB holds for Mail offline, whoever is signed in. */
const keptHere = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open("macalicious.mail.outbox");
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const reading = opening.result.transaction(["entries", "snapshots"]);
          const entries = reading.objectStore("entries").count();
          const snapshots = reading.objectStore("snapshots").count();
          reading.oncomplete = () => {
            opening.result.close();
            resolve({ entries: entries.result, snapshots: snapshots.result });
          };
        };
      }),
  );

/** The count on Mail's Dock tile; 0 when it shows none. */
const mailBadge = async (page) => {
  const badge = page
    .getByRole("button", { name: /^Mail$/ })
    .or(page.getByRole("link", { name: /^Mail$/ }))
    .first()
    .locator("[data-dock-badge]");
  return (await badge.count()) === 0 ? 0 : Number(await badge.textContent());
};

/** Counts the page's reads of mail from the server, from now on. */
const readsOf = (page) => {
  const reads = [];
  const seen = (request) => {
    const { pathname } = new URL(request.url());
    if (request.method() === "GET" && pathname.startsWith("/api/mail/messages")) {
      reads.push(pathname);
    }
  };
  page.on("request", seen);
  return { reads, stop: () => page.off("request", seen) };
};

async function offline(b, m) {
  await send(m, chris.name, subject("Opened"), "the text that was read");
  await send(m, chris.name, subject("Unopened"), "the text not yet read");
  await arrive(b, () => row(b, subject("Unopened")).isVisible());
  await row(b, subject("Opened")).click();
  await within(8_000, () => viewer(b).getByText("the text that was read").first().isVisible());

  await takeOffline(b);
  const banner = viewer(b).getByText("Mail is offline.");
  step(
    "Take All Accounts Offline: Mail says it is offline",
    (await within(5_000, () => banner.isVisible())) !== null,
  );
  await b
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Mailbox", exact: true })
    .first()
    .click();
  step(
    "the Mailbox menu now offers Take All Accounts Online, and Get All New Mail is dimmed",
    (await menuItem(b, "Take All Accounts Online").isVisible()) &&
      (await menuItem(b, "Get All New Mail").getAttribute("aria-disabled")) === "true",
  );
  await b.keyboard.press("Escape");
  step(
    "the toolbar's Get Mail is dimmed",
    await viewer(b).getByRole("button", { name: "Get Mail" }).isDisabled(),
  );

  // Delivered, announced on Chris's stream, and his window gains focus: none of it reads.
  const held = readsOf(b);
  await send(m, chris.name, subject("Meanwhile"), "sent to him while he was offline");
  step(
    "the server did deliver what came meanwhile",
    (await within(10_000, async () => (await onServer(b, subject("Meanwhile"))) !== undefined)) !==
      null,
  );
  await b.evaluate(() => window.dispatchEvent(new Event("focus")));
  await b.keyboard.press("Control+Shift+N");
  await b.waitForTimeout(2_500);
  step(
    "offline, mail that arrived is not shown",
    !(await row(b, subject("Meanwhile")).isVisible()),
  );
  await row(b, subject("Unopened")).click();
  step(
    "a message never opened says it has not been downloaded",
    (await within(5_000, () =>
      viewer(b)
        .getByText("This message has not been downloaded.", { exact: false })
        .first()
        .isVisible(),
    )) !== null,
  );
  await row(b, subject("Opened")).click();
  step(
    "a message already read still shows its text",
    await viewer(b).getByText("the text that was read").first().isVisible(),
  );
  step(
    "offline, the page read no mail from the server",
    held.reads.length === 0,
    held.reads.join(),
  );
  held.stop();

  // Sent offline, with a saved draft under it.
  await viewer(b).getByRole("button", { name: "New Message" }).click();
  const to = compose(b).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose(b).getByLabel("Subject:").fill(subject("Queued"));
  await compose(b).getByRole("textbox", { name: "Message" }).click();
  await b.keyboard.insertText("written offline, delivered once");
  step(
    "the open window's draft is saved on the server, as ever",
    (await within(12_000, async () => (await copies(b, "Queued", "drafts")).length === 1)) !== null,
  );
  await b.keyboard.press("Control+Shift+D");
  step(
    "Send closes the window",
    (await within(10_000, async () => (await compose(b).count()) === 0)) !== null,
  );
  step(
    "the Outbox appears in the sidebar with one message",
    (await within(5_000, () => outboxShown(b))) !== null &&
      /1/.test((await mailboxRow(b, "Outbox").textContent()) ?? ""),
    await mailboxRow(b, "Outbox")
      .textContent()
      .catch(() => ""),
  );
  await mailboxRow(b, "Drafts").click();
  step("it is not listed in Drafts as well", !(await row(b, subject("Queued")).isVisible()));
  await mailboxRow(b, "Outbox").click();
  await row(b, subject("Queued")).click();
  step(
    "the Outbox shows the message and that it is waiting",
    (await within(5_000, () =>
      viewer(b).getByText("written offline, delivered once").first().isVisible(),
    )) !== null &&
      (await viewer(b).getByText("Waiting in the Outbox", { exact: false }).isVisible()),
  );
  await shot(b, "mail-offline-outbox");
  step("nothing reached Martin", (await copies(m, "Queued", "inbox")).length === 0);

  await send(b, martin.name, subject("Dropped"), "changed my mind");
  await within(5_000, () => row(b, subject("Dropped")).isVisible());
  await row(b, subject("Dropped")).click();
  await viewer(b).getByRole("button", { name: "Delete" }).click();
  step(
    "Delete takes a message out of the Outbox",
    (await within(5_000, async () => !(await row(b, subject("Dropped")).isVisible()))) !== null,
  );
  await send(b, `nobody-${id}`, subject("Refused"), "to nobody");
  step(
    "a message to nobody also waits: the server decides when it goes",
    (await within(5_000, () => row(b, subject("Refused")).isVisible())) !== null,
  );

  const after = readsOf(b);
  await reload(b);
  step(
    "after a reload Mail is still offline and the Outbox holds both",
    (await within(15_000, () => viewer(b).getByText("Mail is offline.").isVisible())) !== null &&
      (await within(8_000, () => outboxShown(b))) !== null &&
      /2/.test((await mailboxRow(b, "Outbox").textContent()) ?? ""),
  );
  await mailboxRow(b, "Inbox").click();
  step(
    "after a reload the mailboxes show what was loaded, and what came meanwhile still does not",
    (await within(8_000, () => row(b, subject("Opened")).isVisible())) !== null &&
      !(await row(b, subject("Meanwhile")).isVisible()),
  );
  await row(b, subject("Opened")).click();
  step(
    "after a reload a message read before still shows its text",
    (await within(5_000, () =>
      viewer(b).getByText("the text that was read").first().isVisible(),
    )) !== null,
  );
  step("the reload read no mail from the server", after.reads.length === 0, after.reads.join());
  after.stop();
  const unreadOnServer = (await allOnServer(b)).filter(
    (each) => each.unread && each.mailbox === "inbox",
  ).length;
  step(
    "the Dock counts the unread mail Mail holds: what came meanwhile is not in it",
    (await within(5_000, async () => (await mailBadge(b)) === unreadOnServer - 1)) !== null,
    `${await mailBadge(b)} on the Dock, ${unreadOnServer} on the server`,
  );
  await shot(b, "mail-offline-after-reload");

  // Online: the first send's answer is lost after the server has done it.
  const SEND = /\/api\/mail\/send(\?|$)/;
  const keys = [];
  let lost = false;
  await b.route(SEND, async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (lost) {
      await route.continue();
      return;
    }
    lost = true;
    await route.fetch();
    await route.abort();
  });
  await takeOnline(b);
  step(
    "Take All Accounts Online: the message reaches Martin",
    (await within(15_000, async () => (await copies(m, "Queued", "inbox")).length === 1)) !== null,
  );
  await mailboxRow(b, "Outbox").click();
  await within(5_000, () => row(b, subject("Queued")).isVisible());
  await row(b, subject("Queued")).click();
  step(
    "its answer lost, it stays in the Outbox and says so",
    (await within(8_000, () =>
      viewer(b).getByText("Mail could not tell whether it was sent.", { exact: false }).isVisible(),
    )) !== null,
  );
  await b.keyboard.press("Control+Shift+N");
  step(
    "Get Mail sends it again and it leaves the Outbox",
    (await within(15_000, async () => !(await row(b, subject("Queued")).isVisible()))) !== null,
  );
  step(
    "both tries carried one idempotency key",
    keys.length >= 2 && keys[0] && keys[0] === keys[1],
    `${keys.length} sends`,
  );
  await b.unroute(SEND);
  await m.waitForTimeout(1_000);
  step(
    "Martin has it once, Chris has one Sent copy, and the draft is gone",
    (await copies(m, "Queued", "inbox")).length === 1 &&
      (await copies(b, "Queued", "sent")).length === 1 &&
      (await copies(b, "Queued", "drafts")).length === 0,
  );
  step(
    "what was deleted from the Outbox never went",
    (await copies(m, "Dropped", "inbox")).length === 0 &&
      (await copies(b, "Dropped", "sent")).length === 0,
  );
  await row(b, subject("Refused")).click();
  step(
    "what the server refused stays in the Outbox with its reason",
    (await within(8_000, async () => {
      const text = await viewer(b)
        .getByRole("status")
        .filter({ hasText: /./ })
        .last()
        .textContent();
      return text && !text.startsWith("Waiting") && /nobody|account/i.test(text);
    })) !== null,
  );
  await viewer(b).getByRole("button", { name: "Delete" }).click();
  step(
    "with the Outbox emptied, the sidebar drops it once another mailbox is chosen",
    (await within(5_000, async () => !(await row(b, subject("Refused")).isVisible()))) !== null,
  );
  await mailboxRow(b, "Inbox").click();
  step(
    "online, mail that came meanwhile shows",
    (await within(10_000, async () => {
      await b.keyboard.press("Control+Shift+N");
      return row(b, subject("Meanwhile")).isVisible();
    })) !== null && !(await outboxShown(b)),
  );
  await reload(b);
  step(
    "after a reload Mail is online with no Outbox",
    (await within(10_000, () => row(b, subject("Meanwhile")).isVisible())) !== null &&
      !(await outboxShown(b)) &&
      !(await viewer(b).getByText("Mail is offline.").isVisible()),
  );
}

async function signout(d, m) {
  await send(m, dee.name, subject("Private"), "not for the next person");
  await arrive(d, () => row(d, subject("Private")).isVisible());
  await row(d, subject("Private")).click();
  await within(8_000, () => viewer(d).getByText("not for the next person").first().isVisible());
  await takeOffline(d);
  await send(d, martin.name, subject("Waiting"), "sent before logging out");
  step(
    "offline, this browser holds a copy of the mailboxes and the Outbox",
    (await within(8_000, async () => {
      const { entries, snapshots } = await keptHere(d);
      return entries === 1 && snapshots === 1;
    })) !== null,
    JSON.stringify(await keptHere(d)),
  );

  await d
    .getByRole("button", { name: "Apple", exact: true })
    .or(d.getByRole("menuitem", { name: "Apple", exact: true }))
    .first()
    .click();
  await d
    .getByRole("menuitem", { name: new RegExp(`^Log Out ${dee.fullName}`) })
    .first()
    .click();
  const tile = d.getByRole("group", { name: "Users" }).getByRole("button", {
    name: dee.fullName,
    exact: true,
  });
  await tile.waitFor({ timeout: 20_000 });
  step(
    "logged out, the copy of the mailboxes is gone and the unsent message stays",
    (await within(8_000, async () => {
      const { entries, snapshots } = await keptHere(d);
      return entries === 1 && snapshots === 0;
    })) !== null,
    JSON.stringify(await keptHere(d)),
  );
  step("and nothing of the mail is shown", (await d.getByText(subject("Private")).count()) === 0);

  await tile.click();
  const secret = d.getByRole("textbox", { name: "Enter Password" });
  await secret.fill(password);
  await secret.press("Enter");
  await open(d);
  step(
    "signed in again, Mail is still offline with the message in the Outbox",
    (await within(15_000, () => viewer(d).getByText("Mail is offline.").isVisible())) !== null &&
      (await within(8_000, () => outboxShown(d))) !== null &&
      /1/.test((await mailboxRow(d, "Outbox").textContent()) ?? ""),
  );
  step("nothing reached Martin meanwhile", (await copies(m, "Waiting", "inbox")).length === 0);
  await takeOnline(d);
  step(
    "online, it reaches Martin once and the mailboxes come back from the server",
    (await within(15_000, async () => (await copies(m, "Waiting", "inbox")).length === 1)) !==
      null &&
      (await within(10_000, async () => {
        await mailboxRow(d, "Inbox").click();
        return row(d, subject("Private")).isVisible();
      })) !== null,
  );
}

async function attachments(b, m) {
  const name = `original-${id}.txt`;
  const bytes = `the bytes of ${id}`;
  await viewer(m).getByRole("button", { name: "New Message" }).click();
  const to = compose(m).getByLabel("To:");
  await to.click();
  await to.pressSequentially(chris.name);
  await to.press("Enter");
  await compose(m).getByLabel("Subject:").fill(subject("Filed"));
  await compose(m)
    .getByLabel("Files from this computer")
    .setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(bytes) });
  await within(10_000, () =>
    compose(m)
      .getByRole("listitem")
      .filter({ hasText: name })
      .filter({ hasText: "byte" })
      .isVisible(),
  );
  await m.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(m).count()) === 0);

  await arrive(b, () => row(b, subject("Filed")).isVisible());
  await row(b, subject("Filed")).click();
  await viewer(b).getByRole("button", { name: "Reply", exact: true }).click();
  await compose(b).waitFor({ timeout: 10_000 });
  await within(5_000, () => compose(b).getByLabel("Subject:").isVisible());
  await menuPath(b, "Edit", "Attachments");
  const include = b.getByRole("menu").last().getByRole("menuitemcheckbox", {
    name: "Include Original Attachments in Reply",
  });
  await include.waitFor({ timeout: 5_000 });
  step(
    "Edit > Attachments: Include Original Attachments in Reply is offered, unchecked",
    (await include.getAttribute("aria-checked")) === "false",
  );
  await include.click();
  step(
    "choosing it brings the original's file under the reply, uploaded anew",
    (await within(15_000, () =>
      compose(b)
        .getByRole("listitem")
        .filter({ hasText: name })
        .filter({ hasText: "byte" })
        .isVisible(),
    )) !== null,
  );
  await b.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(b).count()) === 0);
  let delivered;
  await within(15_000, async () => {
    delivered = await onServer(m, `Re: ${subject("Filed")}`);
    return delivered;
  });
  const file = delivered?.attachments?.[0];
  step("Martin's copy of the reply names the file", file?.name === name, file?.name);
  const reply = await m.request.get(
    new URL(`/api/mail/messages/${delivered.id}/attachments/${file.id}`, m.url()).href,
  );
  step("and its bytes are the original's", (await reply.text()) === bytes);
  // A reply to a message with no files: the row is dimmed and says why.
  await row(b, subject("Filed")).waitFor({ timeout: 5_000 });
  await send(m, chris.name, subject("Plain"), "no files");
  await arrive(b, () => row(b, subject("Plain")).isVisible());
  await row(b, subject("Plain")).click();
  await viewer(b).getByRole("button", { name: "Reply", exact: true }).click();
  await compose(b).waitFor({ timeout: 10_000 });
  await menuPath(b, "Edit", "Attachments");
  const dimmed = b.getByRole("menu").last().getByRole("menuitemcheckbox", {
    name: "Include Original Attachments in Reply",
  });
  await dimmed.waitFor({ timeout: 5_000 });
  step(
    "on a reply to a message with no files it is dimmed with the reason",
    (await dimmed.getAttribute("aria-disabled")) === "true" &&
      (await dimmed.getAttribute("title")) ===
        "The message you are replying to has no attachments.",
  );
  await b.keyboard.press("Escape");
  await b.keyboard.press("Escape");
  await compose(b).getByRole("button", { name: "Close" }).first().click();
  await within(10_000, async () => (await compose(b).count()) === 0);
}

async function clock(a, m) {
  // The check is a timer of the page: the browser's clock is what it reads, and it is fast-forwarded here.
  await a.clock.install();
  await reload(a);
  await openPane(a, "General");
  await choose(a, preferences(a), "Check for new messages:", "Every minute");
  await closePreferences(a);
  await a.waitForTimeout(800);
  await send(m, ann.name, subject("Timed"), "by the clock");
  await a.waitForTimeout(2_500);
  step(
    "Every minute: an announced delivery is not read at once",
    !(await row(a, subject("Timed")).isVisible()),
  );
  await a.clock.fastForward("01:10");
  step(
    "a minute later by the clock it is listed",
    (await within(8_000, () => row(a, subject("Timed")).isVisible())) !== null,
  );

  await openPane(a, "General");
  await choose(a, preferences(a), "Check for new messages:", "Manually");
  await closePreferences(a);
  await a.waitForTimeout(800);
  await send(m, ann.name, subject("Asked"), "only when asked");
  await a.waitForTimeout(2_000);
  await a.clock.fastForward("10:00");
  await a.waitForTimeout(2_500);
  step(
    "Manually: ten minutes pass and it is not listed",
    !(await row(a, subject("Asked")).isVisible()),
  );
  step("Get Mail lists it", (await arrive(a, () => row(a, subject("Asked")).isVisible())) !== null);
}

async function muted(b, m) {
  await send(m, chris.name, subject("Quiet"), "please mute");
  await arrive(b, () => row(b, subject("Quiet")).isVisible());
  await row(b, subject("Quiet")).click();
  await menuPath(b, "Message", "Mute");
  await within(8_000, async () => (await onServer(b, subject("Quiet")))?.muted === true);
  await openPane(b, "General");
  await preferences(b).getByRole("checkbox", { name: "Archive or delete muted messages" }).click();
  await closePreferences(b);
  await b.waitForTimeout(800);
  await send(m, chris.name, `Re: ${subject("Quiet")}`, "more of it");
  step(
    "Archive muted messages: new mail of the muted conversation leaves the Inbox on the server",
    (await within(20_000, async () => {
      await b.keyboard.press("Control+Shift+N");
      return (await onServer(b, `Re: ${subject("Quiet")}`))?.mailbox === "archive";
    })) !== null,
    (await onServer(b, `Re: ${subject("Quiet")}`))?.mailbox,
  );
}

async function large(b) {
  const tail = `the very last words ${id}`;
  await viewer(b).getByRole("button", { name: "New Message" }).click();
  await compose(b).getByLabel("Subject:").fill(subject("Large"));
  await compose(b).getByRole("textbox", { name: "Message" }).click();
  await b.keyboard.insertText(`${"A long line of the message. ".repeat(3_000)}\n${tail}`);
  // Well inside the three seconds after which the window saves by itself.
  await reload(b);
  const found = await within(15_000, async () => {
    const draft = await onServer(b, subject("Large"));
    if (draft?.mailbox !== "drafts") return false;
    const reply = await b.request.get(new URL(`/api/mail/messages/${draft.id}`, b.url()).href);
    return (await reply.json()).text.endsWith(tail);
  });
  step(
    "a draft over keepalive's limit keeps its last words across an immediate reload",
    found !== null,
  );
  step(
    "nothing is left waiting in this browser",
    (
      await b.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith("macalicious.mail.leaving")),
      )
    ).length === 0,
  );
}

await run({}, {}, async ({ person }) => {
  const m = await person("martin", martin);
  await open(m);
  const b = await person("chris", chris);
  await open(b);
  if (only.includes("offline")) await offline(b, m);
  if (only.includes("signout")) {
    const d = await person("dee", dee);
    await open(d);
    await signout(d, m);
  }
  if (only.includes("attachments")) await attachments(b, m);
  if (only.includes("muted")) await muted(b, m);
  if (only.includes("large")) await large(b);
  if (only.includes("clock")) {
    const a = await person("ann", ann);
    await open(a);
    await clock(a, m);
  }
});
