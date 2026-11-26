#!/usr/bin/env node
// Mail and Notes rows of batch 3 on Ferrite, in a real browser against the running app. Chris writes to Martin:
// the junk filter learns from what Martin files and files new mail itself; a muted conversation brings no
// notification; a word past the 4,000 characters a header holds is found; a date in a message goes to Calendar; a
// message is shared with Notes; the classic layout's columns sort, kept over a reload; Markup draws on a picture and
// the marked-up file is what is sent. Then Notes: the On My Mac account, Media > Photos from the real library, Undo
// and Redo of a list's kind. Each is read back from the server where it is stored. Exits 0 only when every step
// passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-notes-batch3-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import {
  allOnServer,
  arrive,
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

const { step, run, shot, browserName } = twoPeople("mail-notes-batch3");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `b3chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `b3martin-${id}`, fullName: `Martin ${id}`, password };

const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
const openMail = (page) => openFromDock(page, "Mail", undefined).catch(() => {});
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
  "base64",
);
const PRIZE = "winner prize lottery claim money jackpot";
const json = async (page, path) => {
  const reply = await page.request.get(new URL(path, page.url()).href);
  return reply.json();
};
const goTo = async (page, name) => {
  await mailboxRow(page, name).getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(250);
};
const toJunk = async (page, subject) => {
  await row(page, subject).click();
  await viewer(page).getByRole("button", { name: "Junk", exact: true }).click();
  return seen(async () => (await onServer(page, subject))?.mailbox === "junk");
};
const notesData = async (page) => (await json(page, "/api/notes/data")).data;
const editor = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();
const notesWindow = (page) => page.getByRole("region", { name: "Notes", exact: true }).first();
const newNote = async (page, title) => {
  await notesWindow(page)
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "New Note" })
    .click();
  await editor(page).waitFor({ timeout: 10_000 });
  await editor(page).click();
  await page.keyboard.type(title);
  await page.waitForTimeout(250);
};
const storedNote = async (page, title) =>
  (await notesData(page)).notes.find((note) => (note.lines?.[0] ?? "").trim() === title);
const listClass = (page) =>
  editor(page)
    .locator("ul")
    .first()
    .evaluate((list) => list.getAttribute("class"));

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openMail(a);
  await openMail(b);
  await viewer(a).waitFor();
  await viewer(b).waitFor();

  // The junk filter.
  await openPane(b, "Junk Mail");
  const filterBox = preferences(b).getByRole("checkbox", { name: "Enable junk mail filtering" });
  step(
    "Preferences > Junk Mail: the filter is on and can be turned off",
    (await filterBox.isEnabled()) && (await filterBox.isChecked()),
  );
  step(
    "the filter's exemptions act; Trust junk mail headers is dimmed, saying why",
    (await preferences(b)
      .getByRole("checkbox", { name: "Exempt senders I have written to before" })
      .isEnabled()) &&
      /no outside server/.test(
        (await preferences(b)
          .getByRole("checkbox", { name: "Trust junk mail headers in messages" })
          .getAttribute("title")) ?? "",
      ),
  );
  await closePreferences(b);
  const friend = `Lunch ${id}`;
  await send(a, martin.name, friend, "Shall we have lunch near the harbor on the pier");
  const prizes = [1, 2, 3].map((n) => `Offer ${n} ${id}`);
  for (const subject of prizes) await send(a, martin.name, subject, `${PRIZE} ${subject}`);
  await arrive(b, async () => (await row(b, prizes[2]).count()) > 0);
  let filed = true;
  for (const subject of prizes) filed = (await toJunk(b, subject)) && filed;
  step("three messages are filed as junk, on the server", filed);
  const fourth = `Offer 4 ${id}`;
  await send(a, martin.name, fourth, PRIZE);
  const plain = `Picnic ${id}`;
  await send(a, martin.name, plain, "Shall we take a picnic to the harbor");
  await arrive(b, async () => Boolean(await onServer(b, plain)));
  step(
    "new mail that reads like them goes to Junk by itself, read from the server",
    await seen(async () => (await onServer(b, fourth))?.mailbox === "junk", 15_000),
  );
  step(
    "new mail that reads like the rest stays in the Inbox",
    await seen(async () => (await onServer(b, plain))?.rules_pending !== true, 15_000).then(
      async (done) => done && (await onServer(b, plain))?.mailbox === "inbox",
    ),
  );

  // Mute.
  const quiet = `Ferry ${id}`;
  await send(a, martin.name, quiet, "First of a conversation");
  await arrive(b, async () => (await row(b, quiet).count()) > 0);
  await row(b, quiet).click();
  await viewer(b).getByRole("button", { name: "Mute", exact: true }).click();
  step(
    "Mute is kept on the message",
    await seen(async () => (await onServer(b, quiet))?.muted === true),
  );
  const inbox = async () =>
    ((await json(b, "/api/notification-center/inbox")).items ?? []).map((each) => each.subtitle);
  step("the first message of it did notify", (await inbox()).includes(quiet));
  const reply = `Re: ${quiet}`;
  await send(a, martin.name, reply, "The reply nobody asked for");
  await arrive(b, async () => Boolean(await onServer(b, reply)));
  step(
    "new mail of the muted conversation is delivered, muted",
    await seen(async () => (await onServer(b, reply))?.muted === true, 15_000),
  );
  step("and brings no notification", !(await inbox()).includes(reply));

  // Search past the start a header holds.
  const longSubject = `Long ${id}`;
  const needle = `heron${id}`;
  await send(
    a,
    martin.name,
    longSubject,
    `${"Words in a long message. ".repeat(220)}\nThe ${needle} is here.`,
  );
  await arrive(b, async () => (await row(b, longSubject).count()) > 0);
  const held = await onServer(b, longSubject);
  step(
    "the header holds only the start of a long message",
    held.text.length === 4000 && !held.text.includes(needle),
  );
  const search = viewer(b).getByRole("searchbox", { name: "Search" });
  await search.fill(needle);
  step(
    "search finds a word past that start, from the server",
    await seen(async () => (await row(b, longSubject).count()) > 0),
  );
  await shot(b, "b3-search-whole-text");
  await search.fill("");

  // Data detectors.
  const dated = `Dated ${id}`;
  await send(a, martin.name, dated, "Meet on March 3, 2027 at 4 PM by the ferry");
  await arrive(b, async () => (await row(b, dated).count()) > 0);
  await row(b, dated).click();
  const dateButton = viewer(b).getByRole("button", { name: "March 3, 2027 at 4 PM" });
  await dateButton.waitFor({ timeout: 10_000 });
  await dateButton.click();
  step(
    "a date in a message opens Calendar's Quick Event holding it",
    await seen(() =>
      b
        .getByRole("textbox", { name: "Quick Event" })
        .inputValue()
        .then((value) => value === "March 3, 2027 at 4 PM"),
    ),
  );
  await shot(b, "b3-date-to-calendar");
  await b.keyboard.press("Escape");
  await openMail(b);

  // Share a message with Notes.
  await row(b, dated).click();
  await menuPath(b, "File", "Share", "Notes");
  step(
    "File > Share > Notes makes a note of the message, read from the server",
    await seen(async () =>
      ((await notesData(b))?.notes ?? []).some(
        (note) => note.lines?.[0] === dated && note.lines.join(" ").includes("March 3, 2027"),
      ),
    ),
  );
  await openMail(b);

  // Markup.
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  const window = compose(a);
  const markup = window.getByRole("button", { name: "Markup", exact: true }).first();
  step(
    "Markup is dimmed, saying why, until the message holds a picture",
    (await markup.isDisabled()) &&
      /attach a picture/i.test((await markup.getAttribute("title")) ?? ""),
  );
  await window.getByRole("button", { name: "Attach", exact: true }).click();
  await a.getByLabel("Files from this computer").setInputFiles({
    name: "chart.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await a
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
    .catch(() => {});
  await seen(() => markup.isEnabled());
  await markup.click();
  const sheet = a.getByRole("dialog", { name: /^Markup: chart\.png/ });
  await sheet.waitFor({ timeout: 8_000 });
  const canvas = sheet.getByLabel("Picture to mark up");
  const done = sheet.getByRole("button", { name: "Done" });
  await seen(async () => (await canvas.evaluate((element) => element.width)) === 8);
  const place = await canvas.boundingBox();
  await a.mouse.move(place.x + 1, place.y + 1);
  await a.mouse.down();
  await a.mouse.move(place.x + place.width - 1, place.y + place.height - 1, { steps: 4 });
  await a.mouse.up();
  await shot(a, "b3-markup");
  await done.click();
  const strip = window.getByRole("list", { name: "Attachments" });
  step(
    "Done puts the marked-up picture in the message",
    await seen(
      async () =>
        (await strip.getByRole("listitem").count()) === 1 &&
        /KB|bytes/.test(await strip.innerText()),
    ),
  );
  const marked = `Chart ${id}`;
  const to = window.getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await window.getByLabel("Subject:").fill(marked);
  await seen(
    async () => /\d/.test(await strip.innerText()) && !/Uploading/.test(await strip.innerText()),
  );
  await a.keyboard.press("Control+Shift+D");
  await seen(async () => (await compose(a).count()) === 0, 15_000);
  await arrive(b, async () => Boolean(await onServer(b, marked)));
  const sent = (await onServer(b, marked))?.attachments?.[0];
  step(
    "the file Martin receives is the marked-up one, not the original",
    sent?.name === "chart.png" && sent.size !== PNG.length,
    `${sent?.name} ${sent?.size} bytes against ${PNG.length}`,
  );

  // The classic layout's columns.
  await goTo(b, "Inbox");
  await openPane(b, "Viewing");
  await preferences(b).getByRole("checkbox", { name: "Use classic layout" }).click();
  await closePreferences(b);
  const columns = viewer(b).getByRole("group", { name: "Columns" });
  await columns.waitFor({ timeout: 8_000 });
  await columns.getByRole("button", { name: /^Subject/ }).click();
  const subjects = () =>
    viewer(b)
      .locator(".mac-mail-classic-subject")
      .evaluateAll((all) => all.map((each) => each.textContent));
  step(
    "the classic list has a line a message, in columns, sorted by the one pressed",
    await seen(async () => {
      const shown = await subjects();
      return (
        shown.length > 1 && shown.join() === [...shown].sort((x, y) => x.localeCompare(y)).join()
      );
    }),
  );
  await shot(b, "b3-classic-columns");
  await b.waitForTimeout(1_500);
  await b.reload();
  await openMail(b);
  await viewer(b).waitFor({ timeout: 30_000 });
  step(
    "after a reload the columns and their sort are as they were",
    await seen(
      async () =>
        (await viewer(b)
          .getByRole("group", { name: "Columns" })
          .getByRole("button", { name: /^Subject/ })
          .getAttribute("aria-pressed")) === "true",
    ),
  );
  await openPane(b, "Viewing");
  await preferences(b).getByRole("checkbox", { name: "Use classic layout" }).click();
  await closePreferences(b);

  // A second viewer of the same mail.
  const viewers = b.locator(".mac-mail");
  await menuPath(b, "File", "New Viewer Window");
  step(
    "File > New Viewer Window opens a second viewer",
    await seen(async () => (await viewers.count()) === 2),
  );
  const second = viewers.nth(1);
  await second
    .getByRole("tree", { name: "Mailboxes" })
    .getByText("Sent", { exact: true })
    .click()
    .catch(() => {});
  await second.getByRole("button", { name: "Close", exact: true }).first().click();
  step("closing it leaves the first", await seen(async () => (await viewers.count()) === 1));

  // Notes: the On My Mac account.
  await openFromDock(b, "Notes", "Notes");
  await menuPath(b, "Notes", "Preferences");
  const notesPreferences = b.locator(".mac-preferences-window").last();
  await notesPreferences.getByRole("checkbox", { name: "Enable the On My Mac account" }).click();
  await notesPreferences.getByRole("button", { name: "Close" }).first().click();
  const folders = notesWindow(b).getByRole("tree", { name: "Folders" });
  step(
    "the sidebar lists On My Mac, and the server keeps its folder as the account's",
    (await seen(() => folders.getByText("On My Mac", { exact: true }).isVisible())) &&
      (await seen(async () =>
        (
          await notesData(b)
        ).folders.some((folder) => folder.local === true && folder.name === "Notes"),
      )),
  );
  await b.locator('[data-notes-folder="on-my-mac"]').click();
  const local = `Local ${id}`;
  await newNote(b, local);
  step(
    "a note made there is kept in that folder",
    await seen(async () => (await storedNote(b, local))?.folder === "on-my-mac"),
  );
  await shot(b, "b3-on-my-mac");
  await b.waitForTimeout(1_500);
  await b.reload();
  await openFromDock(b, "Notes", "Notes");
  await notesWindow(b).waitFor({ timeout: 30_000 });
  step(
    "after a reload the account and its note are there",
    (await seen(() =>
      notesWindow(b)
        .getByRole("tree", { name: "Folders" })
        .getByText("On My Mac", { exact: true })
        .isVisible(),
    )) && (await storedNote(b, local))?.folder === "on-my-mac",
  );

  // Undo and Redo of a list's kind.
  await b.locator('[data-notes-folder="notes"]').click();
  const listed = `List ${id}`;
  await newNote(b, listed);
  await menuPath(b, "Format", "Bulleted List");
  await menuPath(b, "Format", "Dashed List");
  step(
    "Format > Dashed List makes a bulleted list dashed",
    await seen(async () => (await listClass(b)) === "mac-notes-dashed"),
  );
  await menuPath(b, "Edit", "Undo");
  step(
    "Edit > Undo takes the kind back, the list and text staying",
    (await seen(async () => (await listClass(b)) === null)) &&
      (await editor(b).innerText()).includes(listed),
  );
  await menuPath(b, "Edit", "Redo");
  step(
    "Edit > Redo puts it back, on the server too",
    (await seen(async () => (await listClass(b)) === "mac-notes-dashed")) &&
      (await seen(async () => (await storedNote(b, listed))?.html?.includes("mac-notes-dashed"))),
  );
  await menuPath(b, "Edit", "Undo");
  await menuPath(b, "Edit", "Undo");
  step(
    "a further Undo takes the list away, as the browser's own step",
    await seen(async () => (await editor(b).locator("ul").count()) === 0),
  );
  await menuPath(b, "Edit", "Redo");
  await menuPath(b, "Edit", "Redo");
  step(
    "Redo twice brings the list and then its kind back",
    await seen(async () => (await listClass(b)) === "mac-notes-dashed"),
  );

  // Media > Photos from the library.
  const photos = await openFromDock(b, "Photos", "Photos");
  await photos
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `Tern${id}.png`,
      mimeType: "image/png",
      buffer: PNG,
    });
  await within(
    15_000,
    async () => ((await json(b, "/api/photos/library").catch(() => ({}))).photos ?? []).length > 0,
  );
  await openFromDock(b, "Notes", "Notes");
  const pictured = `Picture ${id}`;
  await newNote(b, pictured);
  await notesWindow(b)
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "Media" })
    .click();
  await b.getByRole("menuitem", { name: "Photos…", exact: true }).click();
  const photo = b.locator(`.mac-notes-photo[aria-label="Tern${id}"]`);
  step("Media > Photos… lists the Photos library", await seen(() => photo.isVisible(), 15_000));
  await shot(b, "b3-notes-photos");
  await photo.click();
  step(
    "the picture chosen stands in the note, kept on the server",
    await seen(async () => {
      const note = await storedNote(b, pictured);
      return (note?.files ?? []).some((file) => file.type === "image/png");
    }, 15_000),
  );

  // What Chris's own data shows: none of Martin's filing reached him.
  step(
    "Chris's Sent copies stay in Sent",
    (await allOnServer(a))
      .filter((each) => each.subject.startsWith("Offer"))
      .every((each) => each.mailbox === "sent"),
  );
  console.log(`engine run: ${browserName}`);
});
