#!/usr/bin/env node
// A Mail attachment dropped while another tab signs someone else in: the attachment is still being read when Bob signs
// in, and the copy is refused rather than landing on Bob's drive, from Finder and from the desktop.
//
//   node e2e/mail-attachment-accounts-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { api, journey, options } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("mail-attachment-accounts");
const tag = Date.now().toString(36);
const password = `tide-${tag}-pool`;
const alice = { name: `maa-alice-${tag}`, fullName: "Alice" };
const bob = { name: `maa-bob-${tag}`, fullName: "Bob" };
const FILE = `held-${tag}.txt`;

const tile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();

async function desktopOf(page, person) {
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 20_000 });
  await menuTitle(page, person.fullName).waitFor({ timeout: 20_000 });
  return true;
}

async function createAccount(page, person) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await tile(page, "Create Account…").click({ timeout: 20_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
}

async function dragTo(page, from, x, y) {
  const box = await from.boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();
}

await run(async (watched) => {
  const context = watched.context();
  const bobsBrowser = await context.browser().newContext();
  const bobsPage = await bobsBrowser.newPage();
  await createAccount(bobsPage, bob);
  step("Bob has an account", await desktopOf(bobsPage, bob));
  await bobsBrowser.close();

  const stale = await context.newPage();
  await stale.setViewportSize({ width: 2400, height: 1000 });
  await createAccount(stale, alice);
  await desktopOf(stale, alice);

  await stale.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Mail" }).click();
  const mail = stale.locator(".mac-mail").first();
  await mail.waitFor({ timeout: 15_000 });
  await mail.getByRole("button", { name: "New Message" }).click();
  const compose = stale.locator(".mac-mail-compose").first();
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(alice.name);
  await to.press("Enter");
  await compose.getByLabel("Subject:").fill(`Held ${tag}`);
  await compose
    .getByLabel("Files from this computer")
    .setInputFiles({ name: FILE, mimeType: "text/plain", buffer: Buffer.from(`held ${tag}`) });
  await compose
    .getByRole("list", { name: "Attachments" })
    .getByText("byte")
    .waitFor({ timeout: 15_000 });
  await compose.getByRole("button", { name: "Send" }).click();
  const row = mail
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: `Held ${tag}` })
    .first();
  await row.waitFor({ timeout: 20_000 });
  await row.click();
  const attachment = mail.getByRole("list", { name: "Attachments" }).getByRole("listitem").first();
  await attachment.waitFor({ timeout: 10_000 });

  // Finder at the right of a wide screen, clear of Mail.
  await stale
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Finder" })
    .click();
  const finder = stale.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).click();
  const title = await finder.boundingBox();
  await stale.mouse.move(title.x + title.width / 2, title.y + 10);
  await stale.mouse.down();
  await stale.mouse.move(2400 - title.width / 2 - 10, title.y + 60, { steps: 8 });
  await stale.mouse.up();
  const mailTitle = await mail.boundingBox();
  await stale.mouse.move(mailTitle.x + mailTitle.width / 2, mailTitle.y + 10);
  await stale.mouse.down();
  await stale.mouse.move(mailTitle.width / 2 + 150, mailTitle.y + 10, { steps: 8 });
  await stale.mouse.up();

  // The attachment's bytes, and what would tell this tab who is signed in, wait until released.
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
  // The server answers for Alice, and the answer is on its way while Bob signs in.
  await stale.route(
    (url) => /\/attachments\//.test(url.pathname),
    async (route) => {
      const answer = await route.fetch();
      await released;
      await route.fulfill({ response: answer }).catch(() => undefined);
    },
  );
  const refused = [];
  stale.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/files/uploads"
    ) {
      refused.push(response.status());
    }
  });
  const place = await finder.boundingBox();
  const box = await mail.boundingBox();
  // The first refusal ends the page's session, so one run drives one target; `--desktop` is the other.
  if (process.argv.includes("--desktop")) await dragTo(stale, attachment, 60, 300);
  else {
    await dragTo(
      stale,
      attachment,
      Math.max(place.x + 240, box.x + box.width + 60),
      place.y + place.height - 60,
    );
  }

  const second = await context.newPage();
  await second.goto(`${base}/`, { waitUntil: "load" });
  await desktopOf(second, alice);
  await menuTitle(second, alice.fullName).click();
  await second.getByRole("menuitem", { name: "Login Window…" }).first().click();
  await tile(second, "Other…").click();
  const signIn = second.getByRole("form", { name: "Log In" });
  await signIn.getByLabel("Account Name:").fill(bob.name);
  await signIn.getByLabel("Password:").fill(password);
  await signIn.getByRole("button", { name: "Log In" }).click();
  step("Bob signs in from a second tab while the attachment is read", await desktopOf(second, bob));

  release();
  const end = Date.now() + 15_000;
  while (refused.length < 1 && Date.now() < end) await second.waitForTimeout(200);
  step("The copy is refused", refused.length === 1 && refused[0] === 409, refused.join());
  await second.waitForTimeout(800);
  const drive = await api(second, "GET", "/api/files/");
  step(
    "Bob's drive does not hold it",
    drive.status === 200 && !drive.json.entries.some((entry) => entry.name === FILE),
  );
  await stale.close();
  await second.close();
});
