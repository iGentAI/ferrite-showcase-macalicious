#!/usr/bin/env node
// Two people, one browser, through the real login window and Finder. Alice uploads a file. In a second
// tab Bob signs in from the login window while Alice's first tab has not yet heard of it (the requests
// that would tell it are held back, which is all the journey holds). An upload chosen in that stale
// Finder names Alice's session and the server refuses it with 409. Bob's Finder shows his drive, with
// neither Alice's file nor the refused one, and his own upload lands there. The stale tab then follows
// to Bob's desktop, and when Alice signs in again her drive has her file and nothing else.
//
// A change that is no upload is held to the same rule: New Folder in the stale Finder, and a document
// save named for Alice's session, are refused with 409, and neither reaches Bob.
//
// Exits 0 only when every step passed and the page showing Bob's drive logged no console error, page
// error, failed request or HTTP error. The other tabs change person on purpose, so their pages' reads
// are refused and loaded again; those are checked by their results.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/upload-two-accounts-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("upload-two-accounts");
const tag = Date.now().toString(36);
const password = `tide-${tag}-pool`;
const alice = { name: `alice-${tag}`, fullName: "Alice" };
const bob = { name: `bob-${tag}`, fullName: "Bob" };
const ALICES = `Alices ${tag}.txt`;
const STRAY = `Stray ${tag}.txt`;
const BOBS = `Bobs ${tag}.txt`;

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();
const userTile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
const menuItem = (page, name) => page.getByRole("menuitem", { name }).first();

async function desktopOf(page, person) {
  await finder(page).waitFor({ timeout: 20_000 });
  await menuTitle(page, person.fullName).waitFor({ timeout: 20_000 });
  return true;
}

async function createAccount(page, person) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Create Account…").click({ timeout: 20_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
}

/** The Finder window, opened from the Dock and showing Documents. */
async function documents(page) {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  return win;
}

const row = (win, name) => win.getByRole("option", { name, exact: true });
const choose = (win, name) =>
  win.locator('input[type="file"][aria-label="Upload Files"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(`the words of ${name}`),
  });

async function namesOnDrive(page) {
  const { status, json } = await api(page, "GET", "/api/files/");
  if (status !== 200) throw new Error(`the drive answered ${status}`);
  return json.entries.map((entry) => entry.name);
}

await run(async (watched) => {
  const context = watched.context();

  // Bob has an account, made at the login window of a browser of his own.
  const bobsBrowser = await context
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const bobsPage = await bobsBrowser.newPage();
  await createAccount(bobsPage, bob);
  step("Bob's account opens his desktop", await desktopOf(bobsPage, bob));
  await bobsBrowser.close();

  // Alice, in the browser the rest happens in.
  const stale = await context.newPage();
  await createAccount(stale, alice);
  step("Alice's account opens her desktop", await desktopOf(stale, alice));
  const staleFinder = await documents(stale);
  await choose(staleFinder, ALICES);
  await row(staleFinder, ALICES).waitFor({ timeout: 15_000 });
  step("Alice's upload is in her Finder", true);
  step("and on her drive", (await namesOnDrive(stale)).includes(ALICES));
  const { json: signedIn } = await api(stale, "GET", "/api/session");
  step("The session is Alice's", signedIn.account?.name === alice.name, signedIn.account?.name);

  // This tab has not heard who is signed in yet: its session reads and its live stream's ticket, the
  // two requests that would tell it, wait until released.
  let release = () => {};
  const released = new Promise((resolve) => {
    release = resolve;
  });
  await stale.route(
    (url) => url.pathname === "/api/session" || url.pathname === "/api/session/ticket",
    async (route) => {
      await released;
      await route.continue().catch(() => undefined);
    },
  );

  // Bob signs in from the login window of a second tab.
  const second = await context.newPage();
  await second.goto(`${base}/`, { waitUntil: "load" });
  await desktopOf(second, alice);
  await menuTitle(second, alice.fullName).click();
  await menuItem(second, "Login Window…").click();
  await userTile(second, "Other…").click();
  const signIn = second.getByRole("form", { name: "Log In" });
  await signIn.getByLabel("Account Name:").fill(bob.name);
  await signIn.getByLabel("Password:").fill(password);
  await signIn.getByRole("button", { name: "Log In" }).click();
  step("The second tab opens Bob's desktop", await desktopOf(second, bob));

  // The tab still showing Alice's Finder uploads.
  step(
    "The first tab still shows Alice's desktop",
    await menuTitle(stale, alice.fullName).isVisible(),
  );
  const opsAnswered = stale.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/files/ops",
    { timeout: 15_000 },
  );
  await menuTitle(stale, "File").click();
  await stale.getByRole("menuitem", { name: "New Folder", exact: true }).click();
  const opsRefusal = await opsAnswered;
  step(
    "Its New Folder names Alice's session",
    new URL(opsRefusal.url()).searchParams.get("desktop_session") === signedIn.session,
  );
  step("The server refuses it with 409", opsRefusal.status() === 409, String(opsRefusal.status()));
  const opsAlert = stale.getByRole("alertdialog");
  await opsAlert.getByText("this page belongs to a session that has ended").waitFor({
    timeout: 10_000,
  });
  step("Finder says New Folder was refused", true);
  await opsAlert.getByRole("button").first().click();
  await opsAlert.waitFor({ state: "hidden", timeout: 10_000 });

  const recentsOfBobBefore = await api(second, "GET", "/api/quicktime-player/recents");
  const documentSave = await api(
    stale,
    "PUT",
    `/api/quicktime-player/recents?desktop_session=${encodeURIComponent(signedIn.session)}`,
    { recents: [{ id: STRAY, name: STRAY }], rev: recentsOfBobBefore.json?.rev ?? 0 },
  );
  step(
    "A document save named for Alice's session is refused with 409",
    documentSave.status === 409,
    String(documentSave.status),
  );
  const recentsOfBobAfter = await api(second, "GET", "/api/quicktime-player/recents");
  step(
    "and Bob's document is as it was",
    recentsOfBobAfter.status === 200 &&
      JSON.stringify(recentsOfBobAfter.json) === JSON.stringify(recentsOfBobBefore.json),
  );

  const answered = stale.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/files/uploads",
    { timeout: 15_000 },
  );
  await choose(staleFinder, STRAY);
  const refusal = await answered;
  step(
    "Its upload names Alice's session",
    new URL(refusal.url()).searchParams.get("desktop_session") === signedIn.session,
  );
  step("The server refuses it with 409", refusal.status() === 409, String(refusal.status()));
  await stale
    .getByText("this page belongs to a session that has ended")
    .first()
    .waitFor({ timeout: 10_000 });
  step("Finder says the upload was refused", true);

  // Bob's drive, on a page whose console and requests the journey watches.
  await watched.goto(`${base}/`, { waitUntil: "load" });
  step("A new tab opens Bob's desktop", await desktopOf(watched, bob));
  const bobsFinder = await documents(watched);
  await choose(bobsFinder, BOBS);
  await row(bobsFinder, BOBS).waitFor({ timeout: 15_000 });
  step("Bob's own upload is in his Finder", true);
  step(
    "Bob's Finder shows neither Alice's file nor the refused one",
    (await row(bobsFinder, ALICES).count()) === 0 && (await row(bobsFinder, STRAY).count()) === 0,
  );
  const bobsNames = await namesOnDrive(watched);
  step(
    "Nor does his drive on the server",
    bobsNames.includes(BOBS) &&
      !bobsNames.includes(ALICES) &&
      !bobsNames.includes(STRAY) &&
      !bobsNames.includes("untitled folder"),
    bobsNames.join(", "),
  );
  await shot(watched, path.join(out, `upload-two-accounts-bob-${browserName}.png`));
  await watched.close();

  // The stale tab asks again, and follows.
  release();
  await stale.bringToFront();
  await stale.evaluate(() => window.dispatchEvent(new Event("focus"))).catch(() => undefined);
  step("The first tab follows to Bob's desktop", await desktopOf(stale, bob));
  step(
    "and shows none of Alice's Finder window",
    (await stale.getByText(ALICES, { exact: true }).count()) === 0,
  );
  await stale.close();

  // Alice comes back through the login window's list.
  await second.bringToFront();
  await menuTitle(second, "Apple").click();
  await menuItem(second, /^Log Out Bob/).click();
  await userTile(second, alice.fullName).click({ timeout: 20_000 });
  const field = second.getByRole("textbox", { name: "Enter Password" });
  await field.fill(password);
  await field.press("Enter");
  step("Alice signs in again from the list", await desktopOf(second, alice));
  const alicesFinder = await documents(second);
  await row(alicesFinder, ALICES).waitFor({ timeout: 15_000 });
  step("Alice's file is in her Finder", true);
  const alicesNames = await namesOnDrive(second);
  step(
    "Her drive holds neither Bob's file nor the refused one",
    alicesNames.includes(ALICES) &&
      !alicesNames.includes(BOBS) &&
      !alicesNames.includes(STRAY) &&
      !alicesNames.includes("untitled folder"),
    alicesNames.join(", "),
  );
});
