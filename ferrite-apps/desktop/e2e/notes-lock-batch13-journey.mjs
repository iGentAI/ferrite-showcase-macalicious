#!/usr/bin/env node
// Notes' password lock on Ferrite in a real browser. Chris locks a note: the sheet says what forgetting the password
// loses, and the server holds only ciphertext, read back from /api/notes/data after every step that changes it, as does
// no page storage. A locked note stays in the list with a lock, and Spotlight, the search, previews and sharing reveal
// nothing. A wrong password gives the hint. Two tabs of one account prove the refused late save: one tab's save is held
// on the wire, the other saves first, and the late one is refused with a clear state, the stored ciphertext unchanged,
// with Show Latest and Keep as Copy. Change Password re-encrypts every note. A switch to another account forgets the keys;
// a reload does too. Remove Lock brings the text back. A third person's note closes after the idle wait, on a fast-forwarded
// clock. Exits 0 only when every step passed and no page logged a problem other than the refusals it provokes.
//
//   node e2e/notes-lock-batch13-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("notes-lock-batch13");
const id = Date.now().toString(36);
const accountPassword = `tide-${id}-pool`;
const chris = { name: `lkchris-${id}`, fullName: `Chris ${id}`, password: accountPassword };
const martin = { name: `lkmartin-${id}`, fullName: `Martin ${id}`, password: accountPassword };
const ben = { name: `lkben-${id}`, fullName: `Ben ${id}`, password: accountPassword };
const PASSWORD = `harbor-${id}`;
const NEW_PASSWORD = `lantern-${id}`;
const HINT = "where the boats are";
const TITLE = `Vault ${id}`;
const SECRET = `PIN-4411-${id}`;

allow(/HTTP 409: \S*\/api\/notes\/(locked|data)/);
allow(/console: Failed to load resource: the server responded with a status of 409/);
// The late save is held back and answered; a page closing its own feeds is not a problem.

const seen = (check, ms = 15_000) => within(ms, check).then((took) => took !== null);
const get = async (page, path) => (await page.request.get(new URL(path, page.url()).href)).json();
const rawNotes = async (page) =>
  (await page.request.get(new URL("/api/notes/data", page.url()).href)).text();
const ownNotes = async (page) => (await get(page, "/api/notes/data")).data?.notes ?? [];
const noteOf = async (page, noteId) => (await ownNotes(page)).find((note) => note.id === noteId);
const win = (page) => page.getByRole("region", { name: "Notes", exact: true }).first();
const editor = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();
const toolbar = (page) => win(page).getByRole("toolbar", { name: "Notes toolbar" });
const list = (page) => win(page).getByRole("listbox", { name: "Notes" });
const pane = (page) => win(page).getByRole("form", { name: "Locked note" });
const unlockField = (page) => pane(page).getByRole("textbox");
const sheet = (page, name) => page.getByRole("dialog", { name }).last();
const banner = (page) =>
  win(page).getByRole("alert").filter({ hasText: "changed in another window" });
const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

async function lockMenu(page, name) {
  await toolbar(page).getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

async function newNote(page, lines) {
  await toolbar(page).getByRole("button", { name: "New Note" }).click();
  await editor(page).click();
  for (const [at, line] of lines.entries()) {
    if (at > 0) await page.keyboard.press("Enter");
    await page.keyboard.type(line);
  }
  let noteId;
  await seen(async () => {
    noteId = (await ownNotes(page)).find((note) => note.lines?.[0] === lines[0])?.id;
    return noteId !== undefined && (await noteOf(page, noteId)).lines.length === lines.length;
  });
  return noteId;
}

async function createPassword(page, password, hint) {
  const form = sheet(page, "Create a Password");
  await form.getByLabel("Password:", { exact: true }).fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByLabel("Password Hint:").fill(hint);
  await form.getByRole("button", { name: "OK" }).click();
}

async function unlock(page, password) {
  await unlockField(page).fill(password);
  await unlockField(page).press("Enter");
}

await run({}, {}, async ({ person, base }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await b.context().close();
  await openFromDock(a, "Notes", "Notes");
  const noteId = await newNote(a, [TITLE, SECRET]);
  step("a plain note is saved in the clear first", (await rawNotes(a)).includes(SECRET));

  await lockMenu(a, "Lock Note");
  const create = sheet(a, "Create a Password");
  await create.waitFor({ timeout: 10_000 });
  step(
    "the sheet says forgetting the password loses the note's text",
    /If you forget this password, the text of the notes locked with it is lost/.test(
      await create.innerText(),
    ),
  );
  await create.getByLabel("Password:", { exact: true }).waitFor();
  await a.waitForTimeout(600);
  await shot(a, "lock-create-sheet");
  const fieldEdges = await create
    .locator(".mac-notes-lock-fields input")
    .evaluateAll((inputs) => inputs.map((input) => Math.round(input.getBoundingClientRect().left)));
  step(
    "the sheet's three fields start in one column",
    fieldEdges.length === 3 && new Set(fieldEdges).size === 1,
    fieldEdges.join(", "),
  );
  await create.getByLabel("Password:", { exact: true }).fill(PASSWORD);
  await create.getByLabel("Verify:").fill("something else");
  step(
    "a verify that differs is said and refused",
    (await create.getByRole("alert").innerText()).includes("don’t match") &&
      (await create.getByRole("button", { name: "OK" }).isDisabled()),
  );
  await create.getByRole("button", { name: "Cancel" }).click();
  await lockMenu(a, "Lock Note");
  await createPassword(a, PASSWORD, HINT);

  step(
    "the server keeps an envelope and no text of the note",
    await seen(async () => {
      const note = await noteOf(a, noteId);
      return (
        note?.sealed?.ciphertext?.length > 0 &&
        note.lines.length === 0 &&
        note.html === undefined &&
        note.locked === true
      );
    }),
  );
  const raw = await rawNotes(a);
  step(
    "no word of the note is anywhere in the stored document",
    !raw.includes(SECRET) && !raw.includes(TITLE),
  );
  const sealed = (await noteOf(a, noteId)).sealed;
  step(
    "PBKDF2 with SHA-256 at 600,000 iterations, with the hint",
    sealed.kdf.name === "PBKDF2-SHA-256" &&
      sealed.kdf.iterations === 600_000 &&
      sealed.hint === HINT,
    JSON.stringify(sealed.kdf),
  );
  step(
    "the note stays open here, marked unlocked in the list",
    await seen(
      async () =>
        (await editor(a).innerText()).includes(SECRET) &&
        (await list(a).getByRole("img", { name: "Unlocked" }).count()) === 1,
    ),
  );
  await shot(a, "lock-open");

  await editor(a).click();
  await a.keyboard.press("Control+End").catch(() => {});
  await a.keyboard.press("Meta+ArrowDown");
  const typed = ` more-${id}`;
  await a.keyboard.type(typed);
  step(
    "an edit is saved as a new revision of ciphertext",
    await seen(async () => {
      const note = await noteOf(a, noteId);
      return note?.sealed?.rev === sealed.rev + 1 && note.sealed.ciphertext !== sealed.ciphertext;
    }),
  );
  step("the edit is not on the server in the clear", !(await rawNotes(a)).includes(typed.trim()));
  const storage = await a.evaluate(() =>
    JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
  );
  step("nor in the browser's storage", !storage.includes(typed.trim()));

  await lockMenu(a, "Close All Locked Notes");
  step(
    "Close All Locked Notes leaves the password field and no text in the window",
    await seen(async () => (await pane(a).isVisible()) && !(await win(a).innerText()).includes(id)),
  );
  const row = list(a).getByRole("option").filter({ hasText: "Locked Note" });
  step(
    "the locked note stays in the list, with a lock and no preview",
    (await row.count()) === 1 &&
      (await row.getByRole("img", { name: "Locked" }).count()) === 1 &&
      !(await row.innerText()).includes(TITLE),
  );
  await a.waitForTimeout(400);
  await shot(a, "lock-closed");

  const search = await get(a, `/api/spotlight/search?q=${encodeURIComponent(SECRET)}`);
  const searchTitle = await get(a, `/api/spotlight/search?q=${encodeURIComponent(TITLE)}`);
  step(
    "Spotlight finds nothing of it, by its text or its title",
    !JSON.stringify(search).includes(noteId) && !JSON.stringify(searchTitle).includes(noteId),
  );
  const field = win(a).getByRole("searchbox");
  await field.fill(SECRET);
  step(
    "the note list's search finds nothing",
    await seen(async () => (await list(a).getByRole("option").count()) === 0),
  );
  await field.fill("");
  await toolbar(a).getByRole("button", { name: "Gallery View" }).click();
  const cards = await win(a).innerText();
  step("the gallery previews nothing of it", !cards.includes(SECRET));
  await toolbar(a).getByRole("button", { name: "List View" }).click();

  const refused = await a.request.post(new URL("/api/notes/shared", a.url()).href, {
    data: { note: noteId, people: [martin.name] },
  });
  step(
    "the server refuses to share it, to an account that exists",
    refused.status() === 409 && (await refused.text()).includes("can’t be shared"),
    `HTTP ${refused.status()}`,
  );
  await toolbar(a).getByRole("button", { name: "Add People" }).click();
  step(
    "and Add People says a locked note can't be shared",
    await seen(() => a.getByText("A locked note can’t be shared.").isVisible()),
  );
  await a.keyboard.press("Escape");

  await unlock(a, "not the password");
  step(
    "a wrong password is refused, with the hint",
    await seen(async () =>
      (await pane(a).getByRole("alert").innerText()).includes(`Password hint: ${HINT}`),
    ),
  );
  await shot(a, "lock-wrong-password");
  step("and shows no text", !(await win(a).innerText()).includes(SECRET));
  await unlock(a, PASSWORD);
  step(
    "the right one opens the note, with the edit",
    await seen(async () => (await editor(a).innerText()).includes(typed.trim())),
  );

  // Two tabs of Chris's account: a late save is refused.
  const tab = await a.context().newPage();
  tab.on("pageerror", (error) => step(`second tab: ${error.message}`, false));
  await tab.goto(`${base}/`);
  await finder(tab).waitFor({ timeout: 30_000 });
  await openFromDock(tab, "Notes", "Notes");
  await pane(tab).waitFor({ timeout: 15_000 });
  step("a second tab holds no key: it asks for the password", true);
  await unlock(tab, PASSWORD);
  await seen(async () => (await editor(tab).innerText()).includes(SECRET));
  step("its own unlock opens it there", (await editor(tab).innerText()).includes(SECRET));

  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let heldSeen = false;
  await a.route("**/api/notes/locked*", async (route) => {
    heldSeen = true;
    await held;
    await route.continue();
  });
  await editor(a).click();
  await a.keyboard.press("Meta+ArrowDown");
  await a.keyboard.type(" late-from-tab-one");
  step("the first tab's save is on its way, and held", await seen(() => heldSeen));
  const before = (await noteOf(a, noteId)).sealed.rev;

  await editor(tab).click();
  await tab.keyboard.press("Meta+ArrowDown");
  await tab.keyboard.type(" first-from-tab-two");
  step(
    "the second tab saves first",
    await seen(async () => (await noteOf(a, noteId))?.sealed?.rev === before + 1),
  );
  const winner = (await noteOf(a, noteId)).sealed;
  release();
  step(
    "the late save is refused with a clear state",
    await seen(async () => banner(a).isVisible()),
  );
  await a.unroute("**/api/notes/locked*");
  await shot(a, "lock-late-save-refused");
  const after = (await noteOf(a, noteId)).sealed;
  step(
    "the stored ciphertext is the winner's, unchanged",
    after.rev === winner.rev && after.ciphertext === winner.ciphertext,
  );
  step(
    "what was typed is still there, read-only",
    (await editor(a).innerText()).includes("late-from-tab-one") &&
      (await editor(a).getAttribute("aria-readonly")) === "true",
  );
  await banner(a).getByRole("button", { name: "Keep as Copy" }).click();
  step(
    "Keep as Copy makes a new locked note, in ciphertext",
    await seen(async () => (await ownNotes(a)).filter((note) => note.sealed).length === 2),
  );
  step("the copy's text isn't on the server", !(await rawNotes(a)).includes("late-from-tab-one"));
  step(
    "and the note shows the winner's text",
    await seen(async () => {
      const text = await editor(a).innerText();
      return text.includes("first-from-tab-two") && !text.includes("late-from-tab-one");
    }),
  );
  step(
    "the copy, open here, says in its title what it is",
    await seen(async () => (await list(a).innerText()).includes("(conflicted copy)")),
  );

  // Change Password.
  const envelopes = (await ownNotes(a)).filter((note) => note.sealed);
  await lockMenu(a, "Change Password…");
  const change = sheet(a, "Change Password");
  await change.waitFor({ timeout: 10_000 });
  await change.getByLabel("Old Password:").fill("wrong old one");
  await change.getByLabel("New Password:").fill(NEW_PASSWORD);
  await change.getByLabel("Verify:").fill(NEW_PASSWORD);
  await change.getByRole("button", { name: "OK" }).click();
  step(
    "Change Password refuses a wrong old password",
    await seen(
      async () => (await change.getByRole("alert").innerText()).includes("not correct"),
      30_000,
    ),
  );
  step(
    "and changes nothing",
    JSON.stringify((await ownNotes(a)).filter((note) => note.sealed)) === JSON.stringify(envelopes),
  );
  await change.getByLabel("Old Password:").fill(PASSWORD);
  await change.getByRole("button", { name: "OK" }).click();
  step(
    "Change Password seals every note under a new salt, in one write",
    await seen(async () => {
      const now = (await ownNotes(a)).filter((note) => note.sealed);
      return (
        now.length === 2 &&
        now.every(
          (note) =>
            note.sealed.kdf.salt !== sealed.kdf.salt &&
            note.sealed.ciphertext !==
              envelopes.find((was) => was.id === note.id).sealed.ciphertext,
        )
      );
    }, 30_000),
  );
  step(
    "the other tab no longer holds a key that opens it: it asks again",
    await seen(() => pane(tab).isVisible(), 20_000),
  );
  await tab.close();
  step(
    "this tab's note is still open",
    await seen(async () => (await editor(a).innerText()).includes(id)),
  );
  await lockMenu(a, "Close All Locked Notes");
  await pane(a).waitFor({ timeout: 10_000 });
  await unlock(a, PASSWORD);
  step(
    "the old password no longer opens it",
    await seen(async () => (await pane(a).getByRole("alert").innerText()).includes("not correct")),
  );
  await unlock(a, NEW_PASSWORD);
  step(
    "the new one does",
    await seen(async () => (await editor(a).innerText()).includes("first-from-tab-two")),
  );

  // A change of account: the keys don't outlive it.
  await a
    .getByRole("menuitem", { name: chris.fullName, exact: true })
    .or(a.getByRole("button", { name: chris.fullName, exact: true }))
    .first()
    .click();
  await a.getByRole("menuitem", { name: "Login Window…" }).first().click();
  const users = a.getByRole("group", { name: "Users" });
  await users.getByRole("button", { name: "Other…", exact: true }).click();
  const signIn = a.getByRole("form", { name: "Log In" });
  await signIn.getByLabel("Account Name:").fill(martin.name);
  await signIn.getByLabel("Password:").fill(accountPassword);
  await signIn.getByRole("button", { name: "Log In" }).click();
  await finder(a).waitFor({ timeout: 30_000 });
  await openFromDock(a, "Notes", "Notes");
  await toolbar(a).waitFor({ timeout: 15_000 });
  step(
    "Martin, in the same tab, sees nothing of Chris's note",
    !(await a.locator("body").innerText()).includes(SECRET),
  );
  await a
    .getByRole("menuitem", { name: martin.fullName, exact: true })
    .or(a.getByRole("button", { name: martin.fullName, exact: true }))
    .first()
    .click();
  await a.getByRole("menuitem", { name: "Login Window…" }).first().click();
  await users.getByRole("button", { name: chris.fullName, exact: true }).click();
  const back = a.getByRole("textbox", { name: "Enter Password" });
  await back.fill(accountPassword);
  await back.press("Enter");
  await finder(a).waitFor({ timeout: 30_000 });
  await openFromDock(a, "Notes", "Notes");
  step(
    "back as Chris, the key is gone: the note asks again",
    await seen(() => pane(a).isVisible(), 20_000),
  );
  await shot(a, "lock-after-switch");

  await a.reload();
  await finder(a).waitFor({ timeout: 30_000 });
  await openFromDock(a, "Notes", "Notes");
  step("a reload holds no key either", await seen(() => pane(a).isVisible(), 20_000));

  // Remove Lock, on a note not open: it asks for the password.
  await list(a).getByRole("option").first().click();
  await lockMenu(a, "Remove Lock");
  const enter = sheet(a, "Enter the Notes Password");
  await enter.waitFor({ timeout: 10_000 });
  await enter.getByLabel("Password:", { exact: true }).fill(NEW_PASSWORD);
  await enter.getByRole("button", { name: "OK" }).click();
  step(
    "Remove Lock asks for the password, and stores the text in the clear again",
    await seen(async () => {
      const notes = (await ownNotes(a)).filter((note) => !note.sealed);
      return notes.some((note) => note.lines?.[0]?.startsWith(TITLE));
    }, 30_000),
  );
  const freed = (await ownNotes(a)).find(
    (note) => note.lines?.[0]?.startsWith(TITLE) && !note.sealed,
  );
  step(
    "with no lock left on it",
    freed !== undefined && freed.locked === undefined && freed.sealed === undefined,
  );

  // The idle lock, on a clock moved forward.
  const c = await person("ben", ben);
  await openFromDock(c, "Notes", "Notes");
  await c.clock.install();
  const benNote = await newNote(c, [`Ben ${id}`, "idle words"]);
  await lockMenu(c, "Lock Note");
  await createPassword(c, PASSWORD, "");
  step(
    "Ben's note locks, and stays open",
    await seen(async () => {
      const note = await noteOf(c, benNote);
      return note?.sealed !== undefined && (await editor(c).innerText()).includes("idle words");
    }),
  );
  await c.clock.fastForward(4 * 60_000);
  step("four idle minutes leave it open", (await editor(c).innerText()).includes("idle words"));
  await c.clock.fastForward(61_000);
  step("past five, the note closes by itself", await seen(() => pane(c).isVisible()));
  step("with nothing left to read", !(await win(c).innerText()).includes("idle words"));
  await shot(c, "lock-idle-closed");
});
