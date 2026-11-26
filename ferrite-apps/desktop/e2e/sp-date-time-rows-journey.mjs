#!/usr/bin/env node
// Date & Time on a served desktop, row by row: with the browser's time zone overridden to Asia/Tokyo, the date, the
// time, the dimmed date and time fields, the calendar and the clock, and the Time Zone tab are all what the browser
// reads; the page says it cannot set them; Open Language & Region goes there; the lock is dimmed with why; the Clock
// tab sets the menu bar clock, which keeps its format after a reload, digits or a face, and announces the time. The time zone
// override, Playwright's clock and a recorder in place of the browser's voice are what is simulated. Exits 0 only when every step
// passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/sp-date-time-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

await journey("sp-date-time-rows", async ({ page, base, out, step }) => {
  // An afternoon, so that a 12-hour hour shows as a different number from the 24-hour one.
  await page.clock.install({ time: new Date("2026-03-14T06:30:00Z") });
  // What the browser's voice is asked to say: a recorder, as headless has no voice to hear.
  await page.addInitScript(() => {
    window.__spoken = [];
    speechSynthesis.getVoices = () => [{ name: "Stand-in" }];
    speechSynthesis.speak = (speech) => {
      window.__spoken.push({ text: speech.text, volume: speech.volume });
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await prefs.getByRole("button", { name: "Show All" }).click();
  await prefs
    .getByRole("button", { name: /^Date & Time/ })
    .first()
    .click();
  const fact = (label) => prefs.locator("dl > div", { hasText: `${label}:` }).locator("dd");
  await fact("Date").waitFor({ timeout: 8_000 });

  const browser = await page.evaluate(() => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-US", { dateStyle: "full" }),
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    };
  });
  step("the date is the browser's", (await fact("Date").innerText()) === browser.date);
  step(
    "the date's line is not squeezed away",
    ((await fact("Time").boundingBox())?.height ?? 0) > 10,
  );
  const time = await fact("Time").innerText();
  step("the time is the browser's", /^\d{1,2}:\d\d:\d\d\s[AP]M$/.test(time), time);
  const first = await fact("Time").innerText();
  await page.waitForTimeout(1_300);
  step("the time runs", (await fact("Time").innerText()) !== first);

  // Read the page's time between two readings of the browser's clock, in the zone it is told.
  const readClock = () =>
    fact("Time").evaluate((element) => {
      const reading = (date) =>
        date.toLocaleTimeString("en-US", { timeStyle: "medium", timeZone: "Asia/Tokyo" });
      const before = Date.now();
      return {
        shown: element.textContent,
        allowed: [before - 2_000, before - 1_000, before, before + 1_000].map((at) =>
          reading(new Date(at)),
        ),
      };
    });
  const clockNow = await readClock();
  step(
    "the time shown is the browser's clock, in its time zone",
    clockNow.allowed.includes(clockNow.shown),
    JSON.stringify(clockNow),
  );

  const spin = (group, name) =>
    prefs.getByRole("group", { name: group }).getByRole("spinbutton", { name });
  step(
    "Date field shows today, dimmed",
    (await spin("Date", "Year").getAttribute("aria-valuenow")) === String(browser.year) &&
      (await spin("Date", "Day").getAttribute("aria-valuenow")) === String(browser.day) &&
      (await spin("Date", "Day").getAttribute("aria-disabled")) === "true",
  );
  const calendar = prefs.getByRole("group", { name: "Calendar" });
  step(
    "the calendar is dimmed",
    await calendar.getByRole("button", { name: "Today" }).isDisabled(),
  );
  step(
    "Time field shows the hour now, dimmed",
    Number(await spin("Time", "Hour").getAttribute("aria-valuenow")) % 12 === browser.hour % 12 &&
      (await spin("Time", "Hour").getAttribute("aria-disabled")) === "true",
  );
  const clockFace = await prefs
    .getByRole("img", { name: /^\d+:\d\d:\d\d$/ })
    .getAttribute("aria-label");
  const [faceHour, faceMinute] = (clockFace ?? "").split(":").map(Number);
  step(
    "the clock shows the time now",
    faceHour % 12 === browser.hour % 12 &&
      (faceMinute === browser.minute || faceMinute === (browser.minute + 1) % 60),
    clockFace ?? "",
  );
  const pageText = await prefs.innerText();
  step("the page says it cannot set them", /A web page cannot set them/.test(pageText));
  step(
    "the page says automatic setting is not its to change",
    /set them automatically/.test(pageText),
  );
  step("the page says the time server is not its to choose", /choose a time server/.test(pageText));
  step("no captured time server shows", !/time\.apple\.com/.test(pageText));
  const lock = prefs.getByRole("button", { name: /needs an administrator/ });
  step(
    "the lock is dimmed and says why",
    (await lock.isDisabled()) && /administrator/.test((await lock.getAttribute("title")) ?? ""),
  );
  await page.screenshot({ path: path.join(out, "sp-date-time.png") });

  await prefs.getByRole("button", { name: "Open Language & Region…" }).click();
  await prefs.getByRole("tab", { name: "General" }).waitFor({ timeout: 5_000 });
  const moved = await prefs.locator(".mac-title-bar").first().innerText();
  step("Open Language & Region goes there", /Language & Region/.test(moved), moved);
  await prefs.getByRole("button", { name: "Back" }).click();

  await prefs.getByRole("tab", { name: "Time Zone" }).click();
  await fact("Time zone").waitFor();
  step(
    "the Time Zone tab reads the browser's zone",
    (await fact("Time zone").innerText()) === "Asia/Tokyo",
    await fact("Time zone").innerText(),
  );
  step("its name", /Japan/.test(await fact("Name").innerText()), await fact("Name").innerText());
  step(
    "its difference from UTC",
    (await fact("Difference from UTC").innerText()) === "UTC+09:00",
    await fact("Difference from UTC").innerText(),
  );
  step("the page says it cannot change it", /cannot change it/.test(await prefs.innerText()));
  await page.screenshot({ path: path.join(out, "sp-time-zone.png") });

  await prefs.getByRole("tab", { name: "Clock" }).click();
  const clock = page.locator('.mac-desktop-shell-menu-bar [aria-label^="Clock,"]');
  const text = async () => (await clock.innerText()).replace(/\s+/g, " ").trim();
  const check = (name) => prefs.getByRole("checkbox", { name, exact: true });
  const set = async (name) => {
    const saved = nextSave(page, SETTINGS);
    await check(name).click();
    await saved;
    await page.waitForTimeout(100);
  };
  step(
    "the clock starts with the day and the hour",
    /^[A-Z][a-z]{2} \d{1,2}:\d\d [AP]M$/.test(await text()),
    await text(),
  );

  await set("Display the time with seconds");
  step("seconds show in the menu bar", /\d:\d\d:\d\d [AP]M$/.test(await text()), await text());
  await set("Use a 24-hour clock");
  const menuTime = await text();
  const hour24 = await page.evaluate(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", hourCycle: "h23" }).slice(0, 2),
  );
  step(
    "the 24-hour clock drops AM/PM and writes the hour of the day",
    /\d:\d\d:\d\d$/.test(menuTime) &&
      (menuTime.match(/(\d\d):\d\d:\d\d$/)?.[1] === hour24 ||
        menuTime.match(/(\d\d):\d\d:\d\d$/)?.[1] ===
          String((Number(hour24) + 23) % 24).padStart(2, "0")),
    `${menuTime}, browser ${hour24}`,
  );
  step("Show AM/PM is dimmed under it", await check("Show AM/PM").isDisabled());
  await set("Use a 24-hour clock");
  await set("Show AM/PM");
  step("Show AM/PM off drops it", /\d:\d\d:\d\d$/.test(await text()), await text());
  await set("Show AM/PM");
  await set("Show the day of the week");
  step("the day goes", /^\d/.test(await text()), await text());
  await set("Show date");
  const month = await page.evaluate(() =>
    new Date().toLocaleDateString("en-US", { month: "short" }),
  );
  step("the date comes", (await text()).startsWith(month), await text());
  const box = await clock.boundingBox();
  step(
    "the longer clock is not cut",
    (await clock.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)) &&
      (box?.width ?? 0) > 107,
    `${box?.width} wide`,
  );

  const flashed = new Set();
  await set("Flash the time separators");
  for (let i = 0; i < 12; i += 1) {
    flashed.add((await text()).includes(":"));
    await page.waitForTimeout(200);
  }
  step("the separators flash", flashed.size === 2);
  await set("Flash the time separators");
  await page.screenshot({ path: path.join(out, "sp-clock-tab.png") });

  await reloadDesktop(page);
  await page.waitForFunction(
    () =>
      /^Clock, [A-Z][a-z]{2} \d/.test(
        document
          .querySelector('.mac-desktop-shell-menu-bar [aria-label^="Clock,"]')
          ?.getAttribute("aria-label") ?? "",
      ),
    undefined,
    { timeout: 8_000 },
  );
  const after = await text();
  step(
    "the format holds after a reload, with System Preferences unopened",
    after.startsWith(month) && /\d:\d\d:\d\d [AP]M$/.test(after),
    after,
  );

  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  if ((await prefs.getByRole("tab", { name: "Clock" }).count()) === 0) {
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs
      .getByRole("button", { name: /^Date & Time/ })
      .first()
      .click();
  }
  await prefs.getByRole("tab", { name: "Clock" }).click();
  step("the tab shows the settings kept", await check("Show date").isChecked());

  // Analog: a face in the menu bar that follows the time, kept across a reload.
  const face = clock.locator("[data-menu-clock-face]");
  const hand = () => face.locator('[data-hand="minute"]').getAttribute("transform");
  const choose = async (name) => {
    const saved = nextSave(page, SETTINGS);
    await prefs.getByRole("radio", { name }).click();
    await saved;
    await page.waitForTimeout(100);
  };
  step("Digital shows no face", (await face.count()) === 0);
  await choose("Analog");
  await face.waitFor({ timeout: 3_000 });
  step("Analog puts a face in the menu bar", !/\d:\d\d/.test(await text()));
  step("and dims what only digits show", await check("Show date").isDisabled());
  const handBefore = await hand();
  await page.clock.fastForward("10:00");
  await page.waitForTimeout(300);
  step(
    "the face follows the time",
    (await hand()) !== handBefore,
    `${handBefore} to ${await hand()}`,
  );
  await reloadDesktop(page);
  await face.waitFor({ timeout: 8_000 });
  step("Analog holds after a reload", (await face.count()) === 1);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  if ((await prefs.getByRole("tab", { name: "Clock" }).count()) === 0) {
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs
      .getByRole("button", { name: /^Date & Time/ })
      .first()
      .click();
  }
  await prefs.getByRole("tab", { name: "Clock" }).click();
  step("and the tab says Analog", await prefs.getByRole("radio", { name: "Analog" }).isChecked());
  await choose("Digital");
  await face.waitFor({ state: "detached", timeout: 3_000 });
  step("Digital brings the digits back", /\d:\d\d/.test(await text()), await text());

  // Announce the time: said by the browser's voice, at the times chosen, under the volume.
  await set("Announce the time:");
  await page.clock.setSystemTime(new Date("2026-03-14T06:59:50Z"));
  await page.clock.fastForward("00:20");
  await page.waitForTimeout(300);
  const spoken = await page.evaluate(() => window.__spoken.splice(0));
  step(
    "Announce the time says the hour, in the browser's voice",
    spoken.length === 1 && /^It's 4:00\sPM$/.test(spoken[0].text) && spoken[0].volume === 1,
    JSON.stringify(spoken),
  );
  await page.clock.fastForward("05:00");
  await page.waitForTimeout(300);
  step(
    "and says nothing between",
    (await page.evaluate(() => window.__spoken.splice(0))).length === 0,
  );
  await set("Announce the time:");

  await set("Show date and time in menu bar");
  await page.waitForTimeout(200);
  step("Show date and time off takes the clock out of the menu bar", !(await clock.isVisible()));
  step("and dims the others", await check("Show date").isDisabled());
  await reloadDesktop(page);
  await page.waitForTimeout(1_000);
  step("it stays out after a reload", !(await clock.isVisible()));
});
