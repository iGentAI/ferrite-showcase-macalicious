#!/usr/bin/env node
// Notification Center's rows nothing drove on their own: how it opens and closes, Option-click, Today's
// head, the list, clearing, banners' time and number, Show, Do Not Disturb kept, an alert with its actions
// and a failed one, in one account with a second window of it.
//
//   node e2e/notification-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("notification-rows");
const tag = Date.now().toString(36);
const INBOX = "/api/notification-center/inbox";
const SETTINGS = "/api/system-preferences/settings";

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await run(async (page) => {
  await openDesktop(page, base, step);
  const picture = (name) =>
    shot(page, path.join(out, `notification-rows-${name}-${browserName}.png`));
  const extra = page.getByRole("menuitem", { name: "Notification Center", exact: true }).first();
  const panel = page.getByRole("complementary", { name: "Notification Center" });
  const banners = page.locator(".mac-desktop-shell-banners");
  const banner = (name) => banners.getByRole("status", { name, exact: true });
  const raise = (title, app = "finder", more = {}) =>
    api(page, "POST", "/api/notification-center/notify", { app, title, ...more });
  const inbox = async () => (await api(page, "GET", INBOX)).json;
  const shown = () => panel.isVisible();
  const openPanel = async (tab) => {
    await extra.click();
    await panel.waitFor({ timeout: 5_000 });
    if (tab) await panel.getByRole("tab", { name: tab }).click();
  };
  const closePanel = async () => {
    await page.keyboard.press("Escape");
    await until(async () => !(await shown()));
  };
  // Start from nothing: an account that has run this before may hold some.
  await page.waitForTimeout(800);
  for (const item of (await inbox()).items ?? []) {
    await api(page, "DELETE", `${INBOX}/${item.seq}`);
  }

  // Opening and closing.
  await openPanel();
  step("The menu bar extra opens it", await shown());
  await closePanel();
  step("Escape closes it", !(await shown()));
  await openPanel();
  await page.mouse.click(300, 400);
  step("A press beside it closes it", await until(async () => !(await shown())));

  // Option-click.
  await extra.click({ modifiers: ["Alt"] });
  step(
    "Option-click turns Do Not Disturb on, without opening it",
    (await until(async () => (await inbox()).dnd === true)) && !(await shown()),
  );
  await page.locator('[aria-label="Notification Center"][data-dnd]').first().waitFor();
  await picture("dnd-extra");
  const quiet = `Quiet ${tag}`;
  await raise(quiet);
  await sleep(1_500);
  step("Do Not Disturb holds a banner back", (await banner(quiet).count()) === 0);
  await reloadDesktop(page);
  step("Do Not Disturb is kept for the person after a reload", (await inbox()).dnd === true);
  await extra.waitFor();
  await page.waitForTimeout(800);
  await extra.click({ modifiers: ["Alt"] });
  step("and Option-click turns it off", await until(async () => (await inbox()).dnd === false));

  // Today's head, and the tabs.
  await openPanel("Today");
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const text = () => panel.innerText();
  step("Today shows the date", (await text()).includes(`${weekday},`));
  step(
    "and a summary with the count",
    /You have 1 notification\./.test(await text()),
    (await text()).slice(0, 120),
  );
  await picture("today");
  const dnd = panel.getByRole("switch", { name: "Do Not Disturb" });
  await dnd.click();
  step(
    "Today's switch turns Do Not Disturb on",
    await until(async () => (await inbox()).dnd === true),
  );
  await dnd.click();
  await until(async () => (await inbox()).dnd === false);

  // The list.
  await panel.getByRole("tab", { name: "Notifications" }).click();
  const finderGroup = panel.getByRole("region", { name: "Finder" });
  step("The tab shows the list", await until(() => finderGroup.isVisible()));
  await closePanel();

  // Banners.
  const first = `Banner ${tag}`;
  await page.waitForTimeout(500);
  await raise(first);
  await banner(first).waitFor({ timeout: 8_000 });
  await picture("banner");
  const came = Date.now();
  await sleep(3_000);
  step("A banner stays while its time runs", await banner(first).isVisible());
  step(
    "and goes by itself after about five seconds",
    await until(async () => (await banner(first).count()) === 0, 5_000),
    `${Date.now() - came} ms`,
  );
  const many = [1, 2, 3, 4].map((n) => `Many ${n} ${tag}`);
  for (const title of many) await raise(title);
  await until(async () => (await banner(many[3]).count()) === 1);
  step(
    "At most three banners show at once",
    (await banners.getByRole("status").count()) === 3,
    String(await banners.getByRole("status").count()),
  );
  await picture("three-banners");
  await until(async () => (await banners.getByRole("status").count()) === 0, 8_000);

  // Show.
  const show = `Show ${tag}`;
  await raise(show, "calculator");
  await banner(show).waitFor({ timeout: 8_000 });
  await banner(show).getByRole("button", { name: "Show" }).click();
  step(
    "Show opens the application",
    await until(() => page.locator('[data-window-id="calculator"]').isVisible()),
  );
  await picture("show");

  // Cleared in another window of the person.
  // A second window saves the settings when it opens: this one's next save meets that, and merges.
  expectRefusal(409, SETTINGS);
  const other = await page.context().newPage();
  await other.goto(`${base}/`, { waitUntil: "load" });
  await other.getByRole("toolbar", { name: "Dock" }).waitFor({ timeout: 20_000 });
  const leaving = `Leaving ${tag}`;
  await raise(leaving);
  await banner(leaving).waitFor({ timeout: 8_000 });
  const seq = (await inbox()).items.find((item) => item.title === leaving).seq;
  await api(other, "DELETE", `${INBOX}/${seq}`);
  step(
    "Cleared elsewhere, a banner leaves the screen",
    await until(async () => (await banner(leaving).count()) === 0, 3_500),
  );
  await other.close();

  // The list again: groups, one, a group, none, and a reload between.
  await page.waitForTimeout(6_000);
  await raise(`Note ${tag}`, "notes");
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await extra.waitFor();
  await page.waitForTimeout(800);
  await openPanel("Notifications");
  const notesGroup = panel.getByRole("region", { name: "Notes" });
  step(
    "The list groups by application, and survives a reload",
    (await until(() => finderGroup.isVisible())) && (await until(() => notesGroup.isVisible())),
  );
  await picture("list");
  const row = (title) =>
    panel.locator(".mac-notification-banner").filter({ hasText: title }).first();
  await row(first).hover();
  await row(first).getByRole("button", { name: "Clear", exact: true }).click();
  step(
    "Clear takes one away",
    await until(async () => (await finderGroup.getByText(first).count()) === 0),
  );
  step(
    "on the server too",
    (await until(async () => !(await inbox()).items.some((item) => item.title === first))) === true,
  );
  await finderGroup.getByRole("button", { name: "Clear Finder" }).click();
  step("A group's Clear takes it all", await until(async () => (await finderGroup.count()) === 0));
  // Show clears what it showed; the rest is cleared here.
  for (;;) {
    const left = panel.getByRole("button", { name: /^Clear [A-Z]/ }).first();
    if ((await left.count()) === 0) break;
    await left.click();
    await page.waitForTimeout(300);
  }
  step(
    "With none left it says No Notifications",
    await until(() => panel.getByText("No Notifications").isVisible()),
  );
  await picture("none");
  await closePanel();

  // Order, as set in Preferences.
  const setOrder = async (order) => {
    for (let tries = 0; tries < 4; tries += 1) {
      const now = await api(page, "GET", SETTINGS);
      expectRefusal(409, SETTINGS);
      const { status } = await api(page, "PUT", SETTINGS, {
        values: { ...now.json.values, "notifications.sortOrder": order },
        rev: now.json.rev,
      });
      if (status === 200) break;
      await page.waitForTimeout(500);
    }
    await reloadDesktop(page);
    await extra.waitFor();
    await page.waitForTimeout(800);
  };
  const orderThen = (await api(page, "GET", SETTINGS)).json.values?.["notifications.sortOrder"];
  await raise(`Older ${tag}`, "finder");
  await raise(`Between ${tag}`, "notes");
  await raise(`Newer ${tag}`, "finder");
  await setOrder("Recents");
  await openPanel("Notifications");
  const headings = () => panel.locator(".mac-notification-center-heading").allInnerTexts();
  step(
    "Recents keeps arrival order, so an application comes back as a new group",
    await until(async () => (await headings()).join() === "Finder,Notes,Finder"),
    (await headings()).join(),
  );
  await picture("recents");
  await closePanel();
  await setOrder("Recents by App");
  await openPanel("Notifications");
  step(
    "Recents by App holds each application together",
    await until(async () => (await headings()).join() === "Finder,Notes"),
    (await headings()).join(),
  );
  await closePanel();
  await setOrder(orderThen ?? "Recents by App");
  for (const item of (await inbox()).items ?? []) {
    await api(page, "DELETE", `${INBOX}/${item.seq}`);
  }

  // An alert.
  const title = `Alert ${tag}`;
  const stored = (await api(page, "GET", "/api/reminders/data")).json;
  const reminders = stored.data ?? { lists: [], reminders: [] };
  const list = reminders.lists?.[0] ?? { id: `l${tag}`, name: "Reminders", color: "blue" };
  const day = new Date();
  const two = (n) => String(n).padStart(2, "0");
  const saved = await api(page, "PUT", "/api/reminders/data", {
    base: stored.rev ?? 0,
    data: {
      ...reminders,
      lists: reminders.lists?.length ? reminders.lists : [list],
      reminders: [
        ...(reminders.reminders ?? []),
        {
          id: `r${tag}`,
          listId: list.id,
          title,
          due: `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`,
        },
      ],
    },
    alerts: { ...(stored.alerts ?? {}), [`r${tag}`]: Date.now() - 1_000 },
  });
  console.log(`note reminder saved: HTTP ${saved.status}`);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Reminders" }).click();
  const alert = page.getByRole("alert", { name: "Reminders" }).filter({ hasText: title });
  await alert.waitFor({ timeout: 20_000 });
  await sleep(6_500);
  step("An alert stays past a banner's time", await alert.isVisible());
  await picture("alert");
  await alert.getByRole("button", { name: "Close" }).click();
  step("Close takes the alert away", await until(async () => (await alert.count()) === 0));
});
