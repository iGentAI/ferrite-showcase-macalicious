#!/usr/bin/env node
// Pressing a notification shows its item, for two people on the served desktop: Mail's message in its mailbox, a
// Messages conversation and the room, Calendar's event from a server-raised alert, Chess's game from a move's
// notification. Then a .vcf dragged from Finder into Contacts, read from the server and after a reload; Contacts'
// Invite to Chess…, read from the other person's list of games; and Automator's Get Selected Photos Items, its file
// proved by the album it fills on the server. Exits 0 only when every step passed and no page logged a problem.
//
//   node e2e/open-items-batch6-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot } = twoPeople("open-items-batch6");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `oichris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `oimartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `oiann-${id}`, fullName: `Ann ${id}`, password };

const seen = (check, ms = 20_000) => within(ms, check).then((took) => took !== null);
const get = async (page, url) => (await page.request.get(new URL(url, page.url()).href)).json();
const post = (page, url, data) => page.request.post(new URL(url, page.url()).href, { data });
const banner = (page, text) =>
  page.locator(".mac-desktop-shell-banners > *").filter({ hasText: text }).first();
const shows = (page, text) => seen(async () => (await banner(page, text).count()) > 0);
/** Press a banner on its text, as a person does; the press has to be let go where it began. */
async function press(page, text) {
  const body = banner(page, text).getByText(text).first();
  const box = await body.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const windowOf = (page, app) => page.locator(`[data-window-id^="${app}"]`).first();

/** A point of `frame` really on top there, so a drag lands in that window behind another. */
const visiblePointOf = (frame) =>
  frame.evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let y = box.bottom - 12; y > box.top + 40; y -= 24) {
      for (let x = box.left + 12; x < box.right - 12; x += 24) {
        if (element.contains(document.elementFromPoint(x, y))) return { x, y };
      }
    }
    return null;
  });

/** Drag the row at `from` to `to` with the mouse; `during` runs while it hangs over the target. */
async function dragRow(page, row, to, during) {
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await during?.();
  await page.mouse.up();
}

/** Click an app's Dock tile and wait for its window. */
async function openApp(page, name) {
  await page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first()
    .click();
  await windowOf(page, name.toLowerCase()).waitFor({ timeout: 20_000 });
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
  "base64",
);

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);

  // Mail: the window closed, then open on another mailbox.
  const subject = `Ferry ${id}`;
  const sent = await post(a, "/api/mail/send", {
    to: [martin.name],
    cc: [],
    subject,
    text: `Eight o'clock ${id}.`,
  });
  step("Chris's mail is sent", sent.ok(), `HTTP ${sent.status()}`);
  step("it comes to Martin as a banner", await shows(b, subject));
  await press(b, subject);
  const mail = windowOf(b, "mail");
  await mail.waitFor({ timeout: 20_000 });
  const mailRow = (text) =>
    mail.getByRole("listbox", { name: "Messages" }).getByRole("option", { name: new RegExp(text) });
  step(
    "pressing it opens Mail with that message selected and shown",
    await seen(
      async () =>
        (await mailRow(subject).getAttribute("aria-selected")) === "true" &&
        (await mail.getByText(`Eight o'clock ${id}.`).count()) > 0,
    ),
  );
  await mail
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: /^Sent/ })
    .click();
  const second = `Tide ${id}`;
  await post(a, "/api/mail/send", { to: [martin.name], cc: [], subject: second, text: "Low." });
  await shows(b, second);
  await press(b, second);
  step(
    "with Mail open on Sent, the next one goes to the Inbox and selects its message",
    await seen(async () => (await mailRow(second).getAttribute("aria-selected")) === "true"),
  );

  // Messages: an account conversation, then the shared room.
  for (const page of [a, b]) await openFromDock(page, "Messages");
  const messages = (page) => windowOf(page, "messages");
  const hello = `Bring boots ${id}`;
  await messages(a).getByRole("button", { name: "Compose new message" }).click();
  await messages(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messages(a).getByRole("textbox", { name: "Message" });
  await field.fill(hello);
  await field.press("Enter");
  step("Chris's message comes to Martin as a banner", await shows(b, hello));
  await press(b, hello);
  const transcriptHas = (text) => async () =>
    (await messages(b).locator("[data-direction]").filter({ hasText: text }).count()) > 0;
  step("pressing it shows the conversation", await seen(transcriptHas(hello)));
  await shot(b, "open-items-messages");

  const inRoom = `Room note ${id}`;
  await messages(a)
    .getByRole("option", { name: /Ferrite Room/ })
    .click();
  await field.fill(inRoom);
  await field.press("Enter");
  step("a word in the room comes as a banner", await shows(b, inRoom));
  await press(b, inRoom);
  step("pressing it shows the room", await seen(transcriptHas(inRoom)));

  // Calendar: no window open, so the server raises the alert (`alerts.rs`).
  const events = await get(b, "/api/calendar/events");
  const title = `Standup ${id}`;
  const eventId = `ev-${id}`;
  const inTen = Date.now() + 10 * 60_000;
  const put = await b.request.put(new URL("/api/calendar/events", b.url()).href, {
    data: {
      rev: events.rev,
      events: [
        ...(events.events ?? []),
        { id: eventId, title, start: inTen, end: inTen + 30 * 60_000, calendar: "work", alert: 15 },
      ],
    },
  });
  step(
    "Martin's event is saved, with an alert 15 minutes before",
    put.ok(),
    `HTTP ${put.status()}`,
  );
  const inbox = async () => (await get(b, "/api/notification-center/inbox")).items ?? [];
  const raised = () =>
    inbox().then((items) => items.find((item) => String(item.id).startsWith(`alert:${eventId}@`)));
  step("the server raises its alert", await seen(raised, 40_000), JSON.stringify(await raised()));
  step(
    "and it comes as an alert",
    await shows(b, title),
    JSON.stringify(await inbox()).slice(0, 300),
  );
  // An alert's own buttons are Close and Snooze: the row in Notification Center opens it.
  await b.getByRole("menuitem", { name: "Notification Center" }).click();
  const center = b.locator(".mac-desktop-shell-notification-center");
  await center.waitFor();
  await center.getByRole("tab", { name: "Notifications" }).click();
  await center.getByText(title).first().click();
  const calendar = windowOf(b, "calendar");
  await calendar.waitFor({ timeout: 20_000 });
  const block = calendar.locator('[aria-pressed="true"]').filter({ hasText: title });
  step(
    "its row in Notification Center opens Calendar with that event selected",
    await seen(async () => (await block.count()) > 0),
  );
  await shot(b, "open-items-calendar");
  // Open, Calendar shows the alert itself, in the corner where the next banners come.
  await b
    .locator(".mac-calendar-alerts > *")
    .filter({ hasText: title })
    .getByRole("button", { name: "Close" })
    .click();

  // A .vcf and a text file on Martin's drive, dragged from Finder.
  const first = `Vera${id}`;
  const vcfName = `${first}.vcf`;
  await uploadFile(b, {
    parent: "documents",
    name: vcfName,
    type: "text/vcard",
    text: `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Stone;${first};;;\r\nFN:${first} Stone\r\nEND:VCARD\r\n`,
  });
  const textName = `plain-${id}.txt`;
  await uploadFile(b, { parent: "documents", name: textName, type: "text/plain", text: "plain\n" });
  await b.reload({ waitUntil: "load" });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(b, "Contacts");
  const contacts = windowOf(b, "contacts");
  const split = contacts.locator(".mac-contacts-split");
  await b.waitForFunction(() => !document.querySelector(".mac-contacts-split[inert]"), null, {
    timeout: 20_000,
  });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click();
  const finder = b.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 15_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const fileRow = (name) => finder.getByRole("option", { name, exact: true }).first();
  await fileRow(vcfName).waitFor({ timeout: 15_000 });
  const frame = await finder.boundingBox();
  await b.mouse.move(frame.x + frame.width / 2, frame.y + 8);
  await b.mouse.down();
  await b.mouse.move(frame.x + frame.width / 2 + 500, frame.y + 150, { steps: 8 });
  await b.mouse.up();
  const over = await visiblePointOf(split);
  step("Contacts' window shows behind Finder's", over !== null);

  let refusedMark = null;
  await dragRow(b, fileRow(textName), over, async () => {
    refusedMark = await split.getAttribute("data-desktop-drop");
  });
  step("a text file is refused over the window", refusedMark === "refuse", String(refusedMark));
  const refusal = b
    .getByRole("alertdialog")
    .filter({ hasText: `“${textName}” is not a vCard file.` });
  step("and letting it go says why", await seen(async () => (await refusal.count()) > 0));
  await refusal.getByRole("button").first().click();
  await refusal.waitFor({ state: "hidden", timeout: 5_000 });

  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  let acceptedMark = null;
  await dragRow(b, fileRow(vcfName), await visiblePointOf(split), async () => {
    acceptedMark = await split.getAttribute("data-desktop-drop");
  });
  step("a .vcf is taken over the window", acceptedMark === "accept", String(acceptedMark));
  const cardOnServer = async () =>
    ((await get(b, "/api/contacts/cards")).cards ?? []).find((card) => card.first === first);
  step(
    "its card is on the server",
    await seen(async () => (await cardOnServer())?.last === "Stone"),
  );
  await b.reload({ waitUntil: "load" });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(b, "Contacts");
  await b.waitForFunction(() => !document.querySelector(".mac-contacts-split[inert]"), null, {
    timeout: 20_000,
  });
  const windowAgain = windowOf(b, "contacts");
  step(
    "and in Contacts after a reload",
    await seen(
      async () => (await windowAgain.getByRole("option", { name: new RegExp(first) }).count()) > 0,
    ),
  );
  await windowAgain.getByRole("option", { name: new RegExp(first) }).click();
  await windowAgain.getByRole("button", { name: "Contacts commands" }).click();
  const dimmed = b.getByRole("menuitem", { name: "Invite to Chess…" });
  step(
    "on a card with no account, Invite to Chess… is dimmed with its reason",
    (await dimmed.getAttribute("aria-disabled")) === "true" &&
      (await dimmed.getAttribute("title")) === "This card has no account on this desktop.",
  );
  await b.keyboard.press("Escape");
  await dimmed.waitFor({ state: "hidden", timeout: 5_000 });

  // Contacts' Invite to Chess…: a card with Martin's account, on Chris's desktop.
  await openFromDock(a, "Contacts");
  const theirs = windowOf(a, "contacts");
  await a.waitForFunction(() => !document.querySelector(".mac-contacts-split[inert]"), null, {
    timeout: 20_000,
  });
  await theirs.getByRole("button", { name: "Contacts commands" }).click();
  await a.getByRole("menuitem", { name: "Add Desktop User…" }).click();
  const sheet = a.getByRole("dialog", { name: "Add a Desktop User" });
  await sheet.getByRole("textbox", { name: "Account Name" }).fill(martin.name);
  await sheet.getByRole("button", { name: "Add" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 10_000 });
  await seen(async () =>
    ((await theirs.getByRole("heading", { level: 2 }).innerText()) ?? "").includes("Martin"),
  );
  await theirs.getByRole("button", { name: "Contacts commands" }).click();
  await a.getByRole("menuitem", { name: "Invite to Chess…" }).click();
  const newGame = a.getByRole("dialog").filter({ hasText: "New Game" });
  await newGame.waitFor({ timeout: 20_000 });
  const account = newGame.getByRole("textbox", { name: "Account name" });
  step(
    "Invite to Chess… on the card opens New Game with the person's account filled in",
    (await account.inputValue()) === martin.name,
    await account.inputValue(),
  );
  await newGame.getByRole("button", { name: "Send Invitation" }).click();
  await newGame.waitFor({ state: "hidden", timeout: 10_000 });
  step("Chris's invitation comes to Martin as a banner", await shows(b, /invites you to a game/));
  await banner(b, /invites you to a game/)
    .getByRole("button", { name: "Show" })
    .click();
  const game = async (page) => (await get(page, "/api/chess/mine")).games?.[0]?.id;
  const gameId = await game(a);
  const mine = await get(b, "/api/chess/mine");
  step(
    "and is on Martin's side of the server",
    JSON.stringify(mine).includes(gameId),
    String(gameId),
  );
  const chess = b.locator(".mac-chess").first();
  await chess.waitFor({ timeout: 20_000 });
  const status = () => chess.locator(".mac-chess-status").innerText();
  step(
    "pressing it opens Chess on that game",
    await seen(
      async () => (await status()).length > 0 && (await status()).includes(chris.fullName),
    ),
    await status().catch(() => ""),
  );
  const accepted = await post(b, `/api/chess/games/${gameId}/accept`, {});
  step("Martin accepts", accepted.ok(), `HTTP ${accepted.status()}`);
  const resigned = await post(a, `/api/chess/games/${gameId}/resign`, {});
  step("Chris resigns", resigned.ok(), `HTTP ${resigned.status()}`);
  step("Martin gets word of it", await shows(b, /resign/i));
  await banner(b, /resign/i)
    .getByRole("button", { name: "Show" })
    .click();
  step(
    "pressing it stays on the game: the id `<game>-end` is read as the game",
    await seen(async () => /resign/i.test(await status())),
    await status().catch(() => ""),
  );

  // Automator: Photos' selection, on a desktop of its own with nothing else open.
  const c = await person("ann", ann);
  const store = await get(c, "/api/app-store/library");
  const got = await c.request.put(new URL("/api/app-store/library", c.url()).href, {
    data: { installed: [...new Set([...(store.installed ?? []), "automator"])], rev: store.rev },
  });
  step("Automator is got from the App Store", got.ok(), `HTTP ${got.status()}`);
  const photoName = `Dot${id}`;
  await uploadFile(c, {
    parent: "pictures",
    name: `${photoName}.png`,
    type: "image/png",
    bytes: PNG,
  });
  await c.reload({ waitUntil: "load" });
  await c
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openApp(c, "Automator");
  const automator = c.locator(".mac-automator").last();
  const actions = automator.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const search = automator.getByRole("searchbox", { name: "Search" });
  const steps = automator.locator(".mac-automator-step");
  const addAction = async (name) => {
    const before = await steps.count();
    await search.fill(name);
    await actions.getByText(name, { exact: true }).first().dblclick();
    await steps.nth(before).waitFor({ timeout: 5_000 });
    await search.fill("");
    return steps.nth(before);
  };
  const removeAll = async () => {
    for (const name of await steps
      .locator("[aria-label^='Remove ']")
      .evaluateAll((all) => all.map((each) => each.getAttribute("aria-label")))) {
      await automator.getByRole("button", { name }).click();
    }
    await within(5_000, async () => (await steps.count()) === 0);
  };
  const runIt = async () => {
    const before = await c.getByText(/^Workflow (completed|failed)$/).count();
    await automator.getByRole("button", { name: "Run", exact: true }).click();
    await seen(
      async () => (await c.getByText(/^Workflow (completed|failed)$/).count()) > before,
      40_000,
    );
    return (await c.locator(".mac-automator-lower").first().innerText()) ?? "";
  };
  const specified = await addAction("Get Specified Finder Items");
  await specified.getByLabel("paths", { exact: true }).fill(`Pictures/${photoName}.png`);
  await addAction("Import Files into Photos");
  const imported = await runIt();
  step(
    "the picture goes into Photos",
    imported.includes("Workflow completed"),
    imported.slice(0, 200),
  );
  await removeAll();

  await addAction("Get Selected Photos Items");
  const empty = await runIt();
  step(
    "with Photos closed the action fails, saying nothing is selected",
    /Nothing is selected in Photos\./.test(`${empty}${await automator.innerText()}`),
    empty.slice(0, 200),
  );

  await openApp(c, "Photos");
  const photos = windowOf(c, "photos");
  await photos.waitFor({ timeout: 20_000 });
  const library = async () => get(c, "/api/photos/library");
  const photo = (await library()).photos.find((each) => each.name === photoName);
  const tile = photos.locator(`[data-photo-id="${photo?.id}"]`).first();
  await photos
    .getByRole("button", { name: "All Photos" })
    .click()
    .catch(() => {});
  await tile.waitFor({ timeout: 20_000 });
  await tile.click();
  const album = `Chosen ${id}`;
  await openApp(c, "Automator");
  const made = await addAction("New Photo Album");
  await made.getByLabel("name", { exact: true }).fill(album);
  const done = await runIt();
  step(
    "with a photo selected Get Selected Photos Items runs",
    done.includes("Workflow completed"),
    done.slice(0, 200),
  );
  const held = await library();
  step(
    "and hands on its file: the new album holds that photo on the server",
    (held.albums ?? []).find((each) => each.name === album)?.photos?.includes(photo?.id) === true,
    JSON.stringify((held.albums ?? []).find((each) => each.name === album)),
  );
  await c.reload({ waitUntil: "load" });
  await c
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  const again = await library();
  step(
    "and after a reload",
    (again.albums ?? []).find((each) => each.name === album)?.photos?.includes(photo?.id) === true,
  );
});
