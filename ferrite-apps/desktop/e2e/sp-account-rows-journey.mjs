#!/usr/bin/env node
// Users & Groups' picture and card, and Screen Time's Notifications, on accounts made for the run. The picture is chosen from
// this computer, read back from the server and shown at the login window after a real log-out; one dragged from Finder
// replaces it; Contacts Card: Open… selects My Card; Remove Picture takes it away. A message mailed by another account is
// counted under Notifications, once, across a reload. Nothing is simulated. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
//   node e2e/sp-account-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, reloadDesktop } from "./journey-kit.mjs";
import { createAccount, person } from "./r2-census-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const PICTURE = "users-and-groups.picture";
const RUN = Date.now().toString(36);

/** A PNG of one colour, drawn in the page. */
const pngOf = (page, colour) =>
  page.evaluate(async (fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext("2d");
    context.fillStyle = fill;
    context.fillRect(0, 0, 300, 200);
    return canvas.toDataURL("image/png").split(",")[1];
  }, colour);

await journey("sp-account-rows", async ({ page, base, out, step }) => {
  const me = person(RUN, "pic", `Pic ${RUN}`);
  await createAccount(page, base, me);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json?.values?.[key];
  const until = async (check, ms = 10_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };
  const dock = (name) => page.getByRole("button", { name, exact: true }).first();
  const toPane = async (name) => {
    await prefs.getByRole("button", { name: "Show All" }).click({ button: "right" });
    await page.getByRole("menu").getByRole("menuitem", { name, exact: true }).click();
    await page.waitForTimeout(300);
  };
  const openPrefs = async () => {
    await dock("System Preferences").click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
  };
  await openPrefs();
  await toPane("Users & Groups");

  // Edit…, from this computer.
  let saved = nextSave(page, SETTINGS);
  const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
  await prefs.getByRole("button", { name: "Edit…", exact: true }).click();
  await (await chooser).setFiles({
    name: "me.png",
    mimeType: "image/png",
    buffer: Buffer.from(await pngOf(page, "#c23b22"), "base64"),
  });
  await saved;
  const well = prefs.getByLabel("Your picture").locator("img");
  step("Edit…: the picture chosen shows in the well", await until(() => well.isVisible()));
  const first = await until(() => stored(PICTURE));
  step(
    "and is kept on the server, small enough for a setting",
    typeof first === "string" && first.startsWith("data:image/jpeg") && first.length <= 4000,
    `${first?.length} characters`,
  );
  await page.screenshot({ path: path.join(out, "sp-account-picture.png") });

  // Dragged from Finder.
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    context.fillStyle = "#1b7c86";
    context.fillRect(0, 0, 64, 64);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    const json = { "content-type": "application/json" };
    const started = await fetch("/api/files/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: JSON.stringify({
        parent: "documents",
        name: "face.png",
        type: "image/png",
        size: blob.size,
      }),
    }).then((reply) => reply.json());
    await fetch(`/api/files/uploads/${started.upload}/0`, {
      method: "PUT",
      credentials: "same-origin",
      body: blob,
    });
    await fetch(`/api/files/uploads/${started.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    });
  });
  await dock("Finder").click();
  const finder = page.locator('[data-window-id="finder"]').last();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  const frame = await finder.boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 8);
  await page.mouse.down();
  await page.mouse.move(frame.width / 2 + 10, 520, { steps: 10 });
  await page.mouse.up();
  await prefs.click({ position: { x: 300, y: 10 } });
  const middle = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const face = finder.getByText("face.png", { exact: true }).first();
  await face.waitFor({ timeout: 10_000 });
  const from = middle(await face.boundingBox());
  const to = middle(await prefs.getByLabel("Your picture").boundingBox());
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y - 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  saved = nextSave(page, SETTINGS);
  await page.mouse.up();
  await saved;
  step(
    "a picture dragged from Finder replaces it",
    await until(async () => {
      const now = await stored(PICTURE);
      return typeof now === "string" && now !== first;
    }),
  );
  await page.screenshot({ path: path.join(out, "sp-account-picture-dragged.png") });

  // Contacts Card: Open…
  // Another card sorts first, so only the request can choose My Card.
  const seeded = await api(page, "PUT", "/api/contacts/cards", {
    cards: [{ id: "new-1", account: "icloud", first: "Aaron", last: "Aardvark" }],
    rev: 0,
  });
  step("another card is there first", seeded.status === 200, String(seeded.status));
  await prefs.getByRole("button", { name: "Contacts Card: Open…" }).click();
  const contacts = page.locator('[data-window-id="contacts"]');
  await contacts.waitFor({ timeout: 15_000 });
  await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  step(
    "Contacts Card: Open… selects My Card in Contacts",
    await until(async () =>
      (await contacts.getByRole("heading", { level: 2 }).innerText()).includes(me.fullName),
    ),
  );
  await page.screenshot({ path: path.join(out, "sp-account-contacts-card.png") });

  // A real log-out shows it at the login window.
  await page.waitForTimeout(1_500);
  await page
    .getByRole("menuitem", { name: "Apple", exact: true })
    .or(page.getByRole("button", { name: "Apple", exact: true }))
    .first()
    .click();
  await page
    .getByRole("menuitem", { name: /^Log Out / })
    .first()
    .click();
  const tile = page
    .getByRole("group", { name: "Users" })
    .getByRole("button", { name: me.fullName, exact: true });
  await tile.waitFor({ timeout: 30_000 });
  const shown = await tile
    .locator("img")
    .getAttribute("src")
    .catch(() => null);
  step("the login window shows the picture", shown?.startsWith("data:image/jpeg") === true);
  await page.screenshot({ path: path.join(out, "sp-account-login-window.png") });
  await tile.click();
  const field = page.getByRole("textbox", { name: "Enter Password" });
  await field.fill(me.password);
  await field.press("Enter");
  await dock("Finder").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);

  // Screen Time counts a notification, once.
  if (!(await prefs.isVisible())) await openPrefs();
  await toPane("Screen Time");
  await prefs.getByRole("option", { name: "Notifications", exact: true }).click();
  step(
    "Notifications: says what is counted, and what a page cannot see",
    /notifications this desktop delivered/.test(await prefs.innerText()) &&
      /how often you pick up a device/.test(await prefs.innerText()),
  );
  step("with none yet, it says so", /Today:\s*Nothing yet/.test(await prefs.innerText()));

  const other = await page.context().browser().newContext();
  const sender = await other.newPage();
  await createAccount(sender, base, person(RUN, "sender", `Sender ${RUN}`));
  const sent = await api(sender, "POST", "/api/mail/send", {
    to: [me.name],
    cc: [],
    subject: `Hello ${RUN}`,
    text: "Counted once.",
  });
  step("another account mails this one", sent.status === 201, String(sent.status));
  await other.close();

  const today = async () => {
    const text = await prefs.innerText();
    return /Today:\s*1 notification\b/.test(text);
  };
  step("Today counts the one notification", await until(today, 20_000));
  step("under Mail", /Mail:\s*1 notification\b/.test(await prefs.innerText()));
  const bar = await prefs
    .getByRole("group", { name: "The last seven days" })
    .getByRole("button")
    .last()
    .locator("span")
    .first()
    .evaluate((each) => each.style.height);
  step("and today's bar has height", bar !== "0%", bar);
  await page.screenshot({ path: path.join(out, "sp-account-screen-time-notifications.png") });

  await page.waitForTimeout(1_500);
  await reloadDesktop(page);
  await page.waitForTimeout(1_500);
  const counted = (await stored("screen-time.notifications")) ?? {};
  const total = Object.values(counted.days ?? {}).flatMap((apps) => Object.values(apps));
  step(
    "a reload counts nothing again",
    total.length === 1 && total[0] === 1,
    JSON.stringify(counted),
  );

  // Remove Picture.
  if (!(await prefs.isVisible())) await openPrefs();
  await toPane("Users & Groups");
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("button", { name: "Remove Picture" }).click();
  await saved;
  step("Remove Picture empties the well", await until(async () => (await well.count()) === 0));
  step("and clears it on the server", await until(async () => (await stored(PICTURE)) === ""));
  const inBrowser = () =>
    page.evaluate(
      (name) =>
        JSON.parse(localStorage.getItem("macalicious-account-pictures") ?? "{}")[name] ?? null,
      me.name,
    );
  step(
    "and from this browser's login window",
    await until(async () => (await inBrowser()) === null),
  );
  await page.screenshot({ path: path.join(out, "sp-account-removed.png") });

  // Login Options: Name and password lists no account, and the account still logs in.
  const display = prefs.getByRole("combobox", { name: "Display login window as:" });
  await display.click();
  await page.getByRole("option", { name: "Name and password", exact: true }).click();
  await page.waitForTimeout(1_500);
  await page
    .getByRole("menuitem", { name: "Apple", exact: true })
    .or(page.getByRole("button", { name: "Apple", exact: true }))
    .first()
    .click();
  await page
    .getByRole("menuitem", { name: /^Log Out / })
    .first()
    .click();
  const users = page.getByRole("group", { name: "Users" });
  await users.getByRole("button", { name: "Other…", exact: true }).waitFor({ timeout: 30_000 });
  step(
    "Name and password: the login window lists no account",
    (await users.getByRole("button", { name: me.fullName, exact: true }).count()) === 0,
  );
  await page.screenshot({ path: path.join(out, "sp-account-login-by-name.png") });
  await users.getByRole("button", { name: "Other…", exact: true }).click();
  const logIn = page.getByRole("form", { name: "Log In" });
  await logIn.getByLabel("Account Name:").fill(me.name);
  await logIn.getByLabel("Password:").fill(me.password);
  await logIn.getByLabel("Password:").press("Enter");
  await dock("Finder").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  step(
    "and across a log-out the choice stays, with the account logging in by name",
    await page.evaluate(() => localStorage.getItem("macalicious-login-by-name") === "1"),
  );

  // Options: off, Screen Time counts nothing.
  if (!(await prefs.isVisible())) await openPrefs();
  await toPane("Screen Time");
  await page.screenshot({ path: path.join(out, "sp-account-screen-time-options.png") });
  step("Scope: says apps have no categories here", /no categories/.test(await prefs.innerText()));
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("option", { name: "Options", exact: true }).click();
  await prefs.getByRole("checkbox", { name: "Count Screen Time on this desktop" }).click();
  await saved;
  step(
    "Options: off is kept on the server",
    await until(async () => (await stored("screen-time.enabled")) === false),
  );
  await page.waitForTimeout(1_500);
});
