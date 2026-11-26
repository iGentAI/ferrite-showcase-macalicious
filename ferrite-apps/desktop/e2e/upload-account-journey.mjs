#!/usr/bin/env node
// An upload names the person it was started for. Two tabs of one browser share its cookie. Tab B signs
// someone else in while tab A has not heard yet (the requests that would tell it are held back). An
// upload chosen in tab A's Finder names its own session and is refused, so it does not land on the next
// person's drive; a New Folder there is refused the same way.
// Tab A then follows, and an upload in its Finder lands on the drive of the person signed in now.
//
//   node e2e/upload-account-journey.mjs [--url http://127.0.0.1:8787] [--browser chromium]

import { api, journey, openDesktop, options } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("upload-account");
const tag = Date.now().toString(36);
const STRAY = `Stray ${tag}.txt`;
const OWN = `Own ${tag}.txt`;
const FULL_NAME = "Upload";

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The Finder window, opened from the Dock and showing Documents. */
async function documents(page) {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  return win;
}

const choose = (win, name) =>
  win.locator('input[type="file"][aria-label="Upload Files"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(`the words of ${name}`),
  });

// Both tabs are opened here, out of the watch the journey keeps on its first page: a page that is
// switching people has its reads refused and loads again, as it should, which is not what this checks.
await run(async (first) => {
  await first.goto(`${base}/ferrite-site.json`);
  const a = await first.context().newPage();
  await openDesktop(a, base, step);
  const startedFor = (await api(a, "GET", "/api/session")).json.session;
  step("The server names the session the page was loaded for", Boolean(startedFor));
  const staleFinder = await documents(a);

  // This tab does not hear who is signed in: all it would read waits, and only its saves go out.
  let release = () => {};
  const released = new Promise((resolve) => {
    release = resolve;
  });
  await a.route(
    (url) =>
      url.pathname.startsWith("/api/") &&
      url.pathname !== "/api/files/uploads" &&
      url.pathname !== "/api/files/ops",
    async (route) => {
      await released;
      await route.continue().catch(() => undefined);
    },
  );

  // The other tab of this browser signs someone else in.
  const b = await a.context().newPage();
  await b.goto(`${base}/`, { waitUntil: "load" });
  const signedUp = await api(b, "POST", "/api/session/sign-up", {
    name: `upload-${tag}`,
    full_name: FULL_NAME,
    password: `tide-${tag}-pool`,
  });
  if (signedUp.status !== 201) {
    throw new Error(`no second person can sign up here: ${JSON.stringify(signedUp.json)}`);
  }
  step("The other tab signs someone else in", true);
  const onDrive = async (name) => {
    const { json } = await api(b, "GET", "/api/files/");
    return json.entries.some((entry) => entry.name === name);
  };

  const answered = a.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/files/uploads",
    { timeout: 15_000 },
  );
  await choose(staleFinder, STRAY);
  const refusal = await answered;
  step(
    "An upload in the first tab's Finder names the session it was loaded for",
    new URL(refusal.url()).searchParams.get("desktop_session") === startedFor,
  );
  step("and is refused with a conflict", refusal.status() === 409, String(refusal.status()));
  await a
    .getByText("this page belongs to a session that has ended")
    .first()
    .waitFor({ timeout: 10_000 });
  step("Finder says the upload was refused", true);
  step("and the file is not on the next person's drive", !(await onDrive(STRAY)));

  // A New Folder in the same stale Finder is refused the same way.
  const notice = a.getByRole("alertdialog");
  if (await notice.isVisible()) await notice.getByRole("button").first().click();
  await a.getByRole("menubar").first().getByRole("menuitem", { name: "File", exact: true }).click();
  const askedFolder = a.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/files/ops",
    { timeout: 15_000 },
  );
  await a.getByRole("menu").getByRole("menuitem", { name: "New Folder", exact: true }).click();
  const folder = await askedFolder;
  step(
    "A New Folder there names the session the page was loaded for",
    new URL(folder.url()).searchParams.get("desktop_session") === startedFor,
  );
  step("and is refused with a conflict", folder.status() === 409, String(folder.status()));
  step("and no folder is on the next person's drive", !(await onDrive("untitled folder")));

  // The tab asks again, and follows.
  release();
  await a.bringToFront();
  step(
    "The first tab follows to the person signed in",
    await until(async () => {
      await a.evaluate(() => window.dispatchEvent(new Event("focus"))).catch(() => undefined);
      return (
        (await a
          .getByRole("menuitem", { name: FULL_NAME, exact: true })
          .or(a.getByRole("button", { name: FULL_NAME, exact: true }))
          .count()
          .catch(() => 0)) > 0
      );
    }),
  );
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 15_000 });
  const finder = await documents(a);
  await choose(finder, OWN);
  await finder.getByRole("option", { name: OWN, exact: true }).waitFor({ timeout: 15_000 });
  step("An upload for the person signed in now shows in Finder", true);
  step("and it is on their drive", await onDrive(OWN));
});
