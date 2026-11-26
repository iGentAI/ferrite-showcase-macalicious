#!/usr/bin/env node
// Batch 4 of Notes and Mail, with TextEdit's File > Open, on Ferrite in a real browser. Chris shares a note with Martin
// by account name; it leaves his own document for a shared one, read from the server. Martin finds it in Shared, adds
// a line, and Chris sees it; both survive a reload. Chris and Martin change different lines at once: Chris's save meets
// a 409, and both changes are kept. A third account is answered 404. Martin leaves, is added back, and Chris stops
// sharing: the note is in his own document again. Then Mail's attachment Share > Add to Photos, read from the Photos
// library, and two files opened at once in TextEdit, each in its window. Exits 0 only when every step passed and no
// page logged a problem other than the 409 the conflict sets out to provoke.
//
//   node e2e/mail-notes-batch4-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { compose, menuPath, row, viewer } from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot, browserName } = twoPeople("mail-notes-batch4");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `b4chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `b4martin-${id}`, fullName: `Martin ${id}`, password };
const ben = { name: `b4ben-${id}`, fullName: `Ben ${id}`, password };
const SHARED = "/api/notes/shared";

const seen = (check, ms = 15_000) => within(ms, check).then((took) => took !== null);
const get = async (page, path) => (await page.request.get(new URL(path, page.url()).href)).json();
const driveOf = (page) => get(page, "/api/files/");
const sharedNow = async (page) => (await get(page, SHARED)).notes ?? [];
const ownNotes = async (page) => (await get(page, "/api/notes/data")).data?.notes ?? [];
const notesWindow = (page) => page.getByRole("region", { name: "Notes", exact: true }).first();
const editor = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();
const peopleButton = (page) =>
  notesWindow(page)
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "Add People" });
const popover = (page) => page.getByRole("dialog", { name: "Add People" }).last();
const sidebarRow = (page, name) =>
  notesWindow(page)
    .getByRole("tree", { name: "Folders" })
    .getByRole("treeitem", { name: new RegExp(`^${name}`) });
const linesOf = (note) => note?.note?.lines ?? [];

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
  "base64",
);

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  const c = await person("ben", ben);

  await openFromDock(a, "Notes", "Notes");
  await openFromDock(b, "Notes", "Notes");
  await notesWindow(a)
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "New Note" })
    .click();
  await editor(a).click();
  const title = `Trip ${id}`;
  await a.keyboard.type(title);
  await a.keyboard.press("Enter");
  await a.keyboard.type("boots");
  await a.keyboard.press("Enter");
  await a.keyboard.type("map");

  await peopleButton(a).click();
  await popover(a).getByRole("textbox", { name: "Account name" }).fill("nobody-here");
  allow(/HTTP 400: \S*\/api\/notes\/shared\?/);
  allow(/status of 400/);
  await popover(a).getByRole("button", { name: "Share", exact: true }).click();
  step(
    "an account that does not exist is refused, by name",
    await seen(async () =>
      /No one on this desktop/.test((await popover(a).getByRole("alert").innerText()) ?? ""),
    ),
  );
  await popover(a).getByRole("textbox", { name: "Account name" }).fill(martin.name);
  await popover(a).getByRole("button", { name: "Share", exact: true }).click();
  step(
    "the note is a shared document on the server, with Martin on it",
    await seen(async () => {
      const [note] = await sharedNow(a);
      return note?.owned === true && note.members[0]?.name === martin.name;
    }),
  );
  const noteId = (await sharedNow(a))[0].id;
  step(
    "and it left Chris's own document",
    await seen(async () => !(await ownNotes(a)).some((note) => note.lines?.[0] === title)),
  );
  await a.keyboard.press("Escape");
  step(
    "Chris's window shows the Shared row",
    await seen(() => sidebarRow(a, "Shared").isVisible()),
  );
  await shot(a, "b4-notes-shared-owner");

  step(
    "Martin's window finds it under Shared, without a reload",
    await seen(() => sidebarRow(b, "Shared").isVisible(), 20_000),
  );
  await sidebarRow(b, "Shared").click();
  step(
    "Martin's note names who shares it",
    await seen(async () =>
      (await notesWindow(b).innerText()).includes(`Shared by ${chris.fullName}`),
    ),
  );
  await editor(b).click();
  await b.keyboard.press("Control+End");
  await b.keyboard.press("Enter");
  await b.keyboard.type("rope");
  step(
    "Martin's line is stored on the note",
    await seen(async () => linesOf((await sharedNow(b))[0]).includes("rope")),
  );
  step(
    "Chris's open note shows it, and who edited",
    await seen(async () => {
      const text = await editor(a).innerText();
      return text.includes("rope") && (await sharedNow(a))[0].edited_by === martin.fullName;
    }, 20_000),
  );
  await shot(b, "b4-notes-shared-member");

  // Both change different lines: Chris's save waits until Martin's has landed, and meets a 409.
  allow(new RegExp(`HTTP 409: \\S*/api/notes/shared/${noteId}`));
  let releaseSave;
  const saveHeld = new Promise((resolve) => {
    releaseSave = resolve;
  });
  let saveSeen = false;
  await a.route(`**${SHARED}/${noteId}`, async (route) => {
    if (route.request().method() === "PUT" && !saveSeen) {
      saveSeen = true;
      await saveHeld;
    }
    await route.continue();
  });
  await editor(a).click();
  await a.keyboard.press("Control+Home");
  await a.keyboard.press("End");
  await a.keyboard.type(" Mine");
  await seen(async () => saveSeen, 5_000);
  const before = (await sharedNow(b))[0];
  const lines = linesOf(before).map((line) => (line === "map" ? "map Theirs" : line));
  const put = await b.request.put(new URL(`${SHARED}/${noteId}`, b.url()).href, {
    data: { base: before.rev, note: { ...before.note, folder: "notes", lines, html: undefined } },
  });
  step("Martin's change lands first", put.status() === 200, `HTTP ${put.status()}`);
  releaseSave();
  step(
    "Chris's change is merged onto it: both lines are kept on the server",
    await seen(async () => {
      const now = linesOf((await sharedNow(a))[0]);
      return now.includes(`${title} Mine`) && now.includes("map Theirs");
    }, 20_000),
  );
  await a.unroute(`**${SHARED}/${noteId}`);

  await a.reload({ waitUntil: "load" });
  await openFromDock(a, "Notes", "Notes").catch(() => {});
  step(
    "after a reload Chris still has the note, merged",
    await seen(async () => {
      await sidebarRow(a, "Shared").click({ timeout: 1000 });
      return (await editor(a).innerText()).includes("map Theirs");
    }, 25_000),
  );

  // Ben is on nothing: every route answers 404.
  const asBen = await c.request.put(new URL(`${SHARED}/${noteId}`, c.url()).href, {
    data: { base: 1, note: { ...before.note, folder: "notes" } },
  });
  const listBen = await sharedNow(c);
  const stopBen = await c.request.post(new URL(`${SHARED}/${noteId}/stop`, c.url()).href, {
    data: {},
  });
  step(
    "another account is answered 404 and lists nothing",
    asBen.status() === 404 && stopBen.status() === 404 && listBen.length === 0,
    `${asBen.status()} ${stopBen.status()}`,
  );
  // Martin cannot stop what is not his.
  const stopMartin = await b.request.post(new URL(`${SHARED}/${noteId}/stop`, b.url()).href, {
    data: {},
  });
  step("Martin may not stop sharing Chris's note", stopMartin.status() === 403);

  // Martin leaves from the popover; Chris adds him back; Chris stops sharing.
  await peopleButton(b).click();
  await popover(b).getByRole("button", { name: "Leave Note" }).click();
  step(
    "Martin leaves, and it is gone from his window and the server's list of his",
    await seen(
      async () => !(await sidebarRow(b, "Shared").isVisible()) && (await sharedNow(b)).length === 0,
    ),
  );
  await a.keyboard.press("Escape");
  await peopleButton(a).click();
  await popover(a).getByRole("textbox", { name: "Account name" }).fill(martin.name);
  await popover(a).getByRole("button", { name: "Add", exact: true }).click();
  step("Chris adds him back", await seen(async () => (await sharedNow(b)).length === 1));
  // A file one person adds is read by the other.
  const words = `the words ${id}`;
  const attachment = await b.evaluate(
    async ({ words }) => {
      const json = { "content-type": "application/json" };
      const made = await (
        await fetch("/api/notes/attachments", {
          method: "POST",
          headers: json,
          body: JSON.stringify({ name: "plan.txt", type: "text/plain", size: words.length }),
        })
      ).json();
      const fileId = made.id ?? made.attachment?.id;
      await fetch(`/api/notes/attachments/${fileId}/0`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: new TextEncoder().encode(words),
      });
      await fetch(`/api/notes/attachments/${fileId}/complete`, {
        method: "POST",
        headers: json,
        body: "{}",
      });
      return { id: fileId, name: "plan.txt", type: "text/plain", size: words.length };
    },
    { words },
  );
  const carrying = (await sharedNow(b))[0];
  const withFile = await b.request.put(new URL(`${SHARED}/${noteId}`, b.url()).href, {
    data: { base: carrying.rev, note: { ...carrying.note, folder: "notes", files: [attachment] } },
  });
  const read = await a.request.get(
    new URL(`/api/notes/attachments/${attachment.id}?piece=0&count=1`, a.url()).href,
  );
  step(
    "a file Martin puts on the note is read by Chris, whose own notes do not hold it",
    withFile.status() === 200 && read.status() === 200 && (await read.text()) === words,
    `HTTP ${withFile.status()} ${read.status()}`,
  );
  const asBenFile = await c.request.get(
    new URL(`/api/notes/attachments/${attachment.id}?piece=0&count=1`, c.url()).href,
  );
  step("and Ben, who is not on it, cannot", asBenFile.status() === 404);
  await seen(async () => (await notesWindow(a).innerText()).includes("plan.txt"));

  // A change to the note builds the window again, which closes the popover.
  if (!(await popover(a).isVisible())) await peopleButton(a).click();
  await popover(a).getByRole("button", { name: "Stop Sharing" }).click();
  step(
    "Stop Sharing brings the note back to Chris's own document, from Martin's",
    await seen(async () => {
      const own = await ownNotes(a);
      return (
        own.some((note) => note.id === noteId && note.lines.includes("map Theirs")) &&
        (await sharedNow(a)).length === 0 &&
        (await sharedNow(b)).length === 0
      );
    }),
  );

  // Mail: an attachment goes to Photos from its Share menu.
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await viewer(a).waitFor();
  await viewer(b).waitFor();
  const pictured = `Picture ${id}`;
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  const message = compose(a);
  await message.getByRole("button", { name: "Attach", exact: true }).click();
  await a.getByLabel("Files from this computer").setInputFiles({
    name: `Tern${id}.png`,
    mimeType: "image/png",
    buffer: PNG,
  });
  await a
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
    .catch(() => {});
  const strip = message.getByRole("list", { name: "Attachments" });
  await seen(async () => /KB|bytes/.test(await strip.innerText()));
  const to = message.getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await message.getByLabel("Subject:").fill(pictured);
  await a.keyboard.press("Control+Shift+D");
  await seen(async () => (await compose(a).count()) === 0);
  await seen(async () => (await row(b, pictured).count()) > 0, 20_000);
  await row(b, pictured).click();
  await b
    .locator(".mac-mail-live-attachment")
    .first()
    .getByRole("button", { name: "Share" })
    .click();
  await b.getByRole("menuitem", { name: "Add to Photos" }).click();
  step(
    "Share > Add to Photos on an attachment puts it in the Photos library, read from the server",
    await seen(async () => ((await get(b, "/api/photos/library")).photos ?? []).length > 0, 25_000),
  );

  // TextEdit: File > Open takes two files, each in its window.
  const one = `One${id}.txt`;
  const two = `Two${id}.txt`;
  for (const name of [one, two]) {
    await a.evaluate(
      async ({ name }) => {
        const json = { "content-type": "application/json" };
        const drive = await (await fetch("/api/files/")).json();
        const parent = drive.entries.find((entry) => entry.name === "Documents").id;
        const started = await fetch("/api/files/uploads", {
          method: "POST",
          headers: json,
          body: JSON.stringify({ parent, name, size: 5, type: "text/plain", existing: "rename" }),
        });
        const { upload } = await started.json();
        await fetch(`/api/files/uploads/${upload}/0`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: new TextEncoder().encode("words"),
        });
        await fetch(`/api/files/uploads/${upload}/complete`, {
          method: "POST",
          headers: json,
          body: "{}",
        });
      },
      { name },
    );
  }
  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(a, "TextEdit", undefined).catch(() => {});
  await menuPath(a, "File", "Open…");
  const panel = a
    .getByRole("dialog")
    .filter({ has: a.getByRole("button", { name: "Open", exact: true }) })
    .last();
  await panel.waitFor({ timeout: 10_000 });
  const place = panel.getByRole("treeitem", { name: "Documents" });
  if (await place.count()) await place.first().click();
  await panel.getByText(one, { exact: true }).click();
  await panel.getByText(two, { exact: true }).click({ modifiers: ["Control"] });
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  step(
    "File > Open opens both files chosen, each in a window",
    await seen(
      async () =>
        (await a.getByRole("region", { name: new RegExp(one) }).count()) === 1 &&
        (await a.getByRole("region", { name: new RegExp(two) }).count()) === 1,
    ),
  );
  await shot(a, "b4-textedit-two");

  // Automator: what is selected in Mail, and an image made a BMP.
  await b.evaluate(async () => {
    const library = await (await fetch("/api/app-store/library")).json();
    await fetch("/api/app-store/library", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        installed: [...new Set([...(library.installed ?? []), "automator"])],
        rev: library.rev,
      }),
    });
  });
  await b.evaluate(
    async ({ data, name }) => {
      const json = { "content-type": "application/json" };
      const drive = await (await fetch("/api/files/")).json();
      const parent = drive.entries.find((entry) => entry.name === "Pictures").id;
      const bytes = Uint8Array.from(data);
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          parent,
          name,
          size: bytes.length,
          type: "image/png",
          existing: "rename",
        }),
      });
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        headers: json,
        body: "{}",
      });
    },
    { data: [...PNG], name: `Dot${id}.png` },
  );
  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await viewer(b).waitFor();
  await row(b, pictured).click();
  await openFromDock(b, "Automator", undefined).catch(() => {});
  const automator = b.locator(".mac-automator").last();
  const actions = automator.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const search = automator.getByRole("searchbox", { name: "Search" });
  const steps = automator.locator(".mac-automator-step");
  const addAction = async (title) => {
    const before = await steps.count();
    await search.fill(title);
    await actions.getByText(title, { exact: true }).first().dblclick();
    await steps.nth(before).waitFor({ timeout: 5_000 });
    if (title === "Change Type of Images") {
      await b.getByRole("button", { name: /Don.t Add/ }).click();
    }
    await search.fill("");
    return steps.nth(before);
  };
  await addAction("Get Selected Mail Items");
  await automator.getByRole("button", { name: "Run", exact: true }).click();
  await b
    .getByText(/^Workflow (completed|failed)$/)
    .first()
    .waitFor({ timeout: 30_000 });
  await within(5_000, async () =>
    (await b.locator(".mac-automator-lower").first().textContent())?.includes("Workflow"),
  );
  await steps.first().getByRole("button", { name: "Results" }).click();
  step(
    "Get Selected Mail Items hands on the message selected in Mail",
    await seen(async () => (await steps.first().innerText()).includes(`${pictured}, from`)),
  );

  await automator.getByRole("button", { name: "Remove Get Selected Mail Items" }).click();
  await within(5_000, async () => (await steps.count()) === 0);
  const getFiles = await addAction("Get Specified Finder Items");
  await getFiles.getByLabel("paths", { exact: true }).fill(`Pictures/Dot${id}.png`);
  const change = await addAction("Change Type of Images");
  await change.getByRole("combobox", { name: "to" }).click();
  await b.getByRole("option", { name: "BMP", exact: true }).click();
  await automator.getByRole("button", { name: "Run", exact: true }).click();
  const bmp = `Dot${id}.bmp`;
  step(
    "Change Type of Images replaces the picture with a BMP: 54 bytes of header and 8 rows of 24, the picture in the Trash",
    await seen(async () => {
      const drive = await driveOf(b);
      return (
        drive.entries.find((entry) => entry.name === bmp)?.size === 54 + 8 * 24 &&
        Boolean(drive.entries.find((entry) => entry.name === `Dot${id}.png`)?.trashed_ms)
      );
    }, 30_000),
  );

  await menuPath(b, "File", "Share", "Mail");
  step(
    "File > Share > Mail puts the workflow in a New Message, as a file",
    await seen(async () =>
      /\.workflow/.test(await compose(b).getByRole("list", { name: "Attachments" }).innerText()),
    ),
  );
  console.log(`engine run: ${browserName}`);
});
