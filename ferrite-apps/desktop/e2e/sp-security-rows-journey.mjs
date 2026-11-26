#!/usr/bin/env node
// Security & Privacy on a served desktop, row by row, signed in with a password: Disable automatic login, Allow apps
// and the lock are dimmed with why; the lock message shows on the lock screen, also after a reload while locked, and
// off it goes; FileVault and Firewall say a page cannot see them; Advanced's Log out after, kept across a reload,
// waits for a minute with no input, input starts it again, and then it logs out. Nothing is simulated. Exits 0 only
// when every step passed with no console error, page error, failed request or HTTP error, apart from reads the lock
// refuses. Takes about two and a half minutes.
//
//   node e2e/sp-security-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { nextSave } from "./journey-kit.mjs";
import { twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("sp-security-rows");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const SETTINGS = "/api/system-preferences/settings";
const MESSAGE = `If found, call the desk ${id}`;

await run({}, {}, async ({ person }) => {
  allow(/ 423/);
  allow(/status of 423/);
  allow(/the screen is locked/);
  const a = await person("ana", { name: `spsec-${id}`, fullName: `Ana ${id}`, password });
  const window = a.locator('[data-window-id="system-preferences"]');
  const openPane = async () => {
    await a
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await window.waitFor({ timeout: 10_000 });
    await a.waitForTimeout(800);
    if ((await window.getByRole("tab", { name: "FileVault" }).count()) === 0) {
      await window.getByRole("button", { name: "Show All" }).click();
      await window
        .getByRole("button", { name: /^Security & Privacy/ })
        .first()
        .click();
    }
    await window.getByRole("tab", { name: "General" }).click();
  };
  const saved = async (body) => {
    const save = nextSave(a, SETTINGS);
    await body();
    await save;
  };
  const values = () =>
    a.evaluate(async (url) => (await (await fetch(url)).json()).values, SETTINGS);
  const lockScreen = async () => {
    await a
      .getByRole("menuitem", { name: "Apple", exact: true })
      .or(a.getByRole("button", { name: "Apple", exact: true }))
      .first()
      .click();
    await a.getByRole("menuitem", { name: "Lock Screen" }).first().click();
    await field().waitFor({ timeout: 10_000 });
  };
  const field = () => a.getByRole("textbox", { name: "Enter Password" });
  const unlock = async () => {
    await field().fill(password);
    await field().press("Enter");
    await a
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 20_000 });
    await a.waitForTimeout(800);
  };

  await openPane();

  const noAuto = window.getByRole("checkbox", { name: "Disable automatic login" });
  step(
    "Disable automatic login is on, dimmed, with why",
    (await noAuto.isChecked()) &&
      (await noAuto.isDisabled()) &&
      /no automatic login/.test(
        (await window.locator('[title*="no automatic login"]').first().getAttribute("title")) ?? "",
      ),
  );
  const apps = window.getByRole("radio");
  const checks = await apps.evaluateAll((radios) =>
    radios.map((radio) => ({
      on: radio.getAttribute("aria-checked") === "true",
      off:
        radio.getAttribute("aria-disabled") === "true" ||
        radio.hasAttribute("disabled") ||
        radio.hasAttribute("data-disabled"),
    })),
  );
  step(
    "Allow apps is dimmed and claims nothing of this computer",
    checks.length === 2 && checks.every((radio) => radio.off && !radio.on),
    JSON.stringify(checks),
  );
  step(
    "Allow apps says why",
    await window
      .getByText(/A web page cannot decide what your computer may run/)
      .first()
      .isVisible(),
  );
  const lock = window.getByRole("button", { name: "Nothing here needs an administrator." });
  step(
    "the lock is dimmed and says why",
    (await lock.isDisabled()) && /administrator/.test((await lock.getAttribute("title")) ?? ""),
  );
  await shot(a, "sp-security-general");

  await window.getByRole("tab", { name: "FileVault" }).click();
  step(
    "FileVault says a page cannot see it",
    await window
      .getByText(/A web page cannot see or change whether your computer's disk/)
      .isVisible(),
  );
  await window.getByRole("tab", { name: "Firewall" }).click();
  step(
    "Firewall says a page cannot see it",
    await window.getByText(/A web page cannot see or change your computer's firewall/).isVisible(),
  );
  await window.getByRole("tab", { name: "General" }).click();

  const show = window.getByRole("checkbox", { name: "Show a message when the screen is locked" });
  const setMessage = window.getByRole("button", { name: "Set Lock Message…" });
  step("Set Lock Message is dimmed until the box is on", await setMessage.isDisabled());
  await saved(() => show.click());
  await setMessage.click();
  const dialog = a.getByRole("dialog", { name: "Set Lock Message" });
  const messageField = dialog.getByRole("textbox", { name: "Lock message" });
  await messageField.waitFor({ timeout: 5_000 });
  const focusIn = (sheet) => sheet.evaluate((element) => element.contains(document.activeElement));
  // A sheet takes the keyboard, holds it, and gives it back to the button that opened it.
  const holdsTheKeyboard = async (sheet, opener, name) => {
    await a.waitForTimeout(200);
    let held = await focusIn(sheet);
    step(`${name}: the keyboard goes into the sheet`, held);
    for (let press = 0; press < 6; press += 1) {
      await a.keyboard.press("Tab");
      await a.waitForTimeout(80);
      held = held && (await focusIn(sheet));
    }
    step(`${name}: Tab stays in the sheet`, held);
    await a.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached", timeout: 5_000 });
    await a.waitForTimeout(200);
    step(
      `${name}: Escape closes it and the keyboard is back on its button`,
      await opener.evaluate((element) => element === document.activeElement),
    );
    await opener.click();
    await sheet.waitFor({ timeout: 5_000 });
  };
  await holdsTheKeyboard(dialog, setMessage, "Set Lock Message");
  const pane = window.getByRole("tab", { name: "Firewall" });
  await pane.click({ force: true, timeout: 2_000 }).catch(() => {});
  step(
    "Set Lock Message: the pane behind it does not answer",
    (await window.getByRole("tab", { name: "General" }).getAttribute("aria-selected")) === "true" &&
      (await dialog.isVisible()),
  );
  await messageField.fill(MESSAGE);
  await shot(a, "sp-security-message");
  await saved(() => dialog.getByRole("button", { name: "OK" }).click());
  const stored = await values();
  step(
    "the message is saved",
    stored["security-and-privacy.lockMessage"] === MESSAGE &&
      stored["security-and-privacy.showMessage"] === true,
  );

  await lockScreen();
  step("the lock screen shows the message", await a.getByText(MESSAGE).isVisible());
  await shot(a, "sp-security-locked");
  const lockHeld = await within(10_000, async () =>
    a.evaluate(async () => (await (await fetch("/api/session")).json()).locked === true),
  );
  step("the server has locked the session", lockHeld !== null);
  await a.reload({ waitUntil: "load" });
  await field().waitFor({ timeout: 20_000 });
  const again = await within(5_000, async () => a.getByText(MESSAGE).isVisible());
  step("and after a reload while locked", again !== null);
  await unlock();

  await openPane();
  await saved(() => show.click());
  await lockScreen();
  await a.waitForTimeout(500);
  step(
    "with the box off, the lock screen has no message",
    !(await a.getByText(MESSAGE).isVisible()),
  );
  await unlock();

  await openPane();
  const advancedButton = window.getByRole("button", { name: "Advanced…" });
  await advancedButton.click();
  const advanced = a.getByRole("dialog", { name: "Advanced" });
  await advanced.waitFor({ timeout: 5_000 });
  await holdsTheKeyboard(advanced, advancedButton, "Advanced");
  const admin = advanced.getByRole("checkbox", { name: /Require an administrator password/ });
  step(
    "Require an administrator password is dimmed with why",
    (await admin.isDisabled()) &&
      (await advanced.locator('[title*="no administrators"]').count()) > 0,
  );
  const logOut = advanced.getByRole("checkbox", { name: "Log out after" });
  await saved(() => logOut.click());
  await saved(() => advanced.getByRole("textbox", { name: "Minutes of inactivity" }).fill("1"));
  await shot(a, "sp-security-advanced");
  await advanced.getByRole("button", { name: "OK" }).click();

  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 40_000 });
  await openPane();
  await window.getByRole("button", { name: "Advanced…" }).click();
  step(
    "Log out after is the same after a reload",
    (await logOut.isChecked()) &&
      (await advanced.getByRole("textbox", { name: "Minutes of inactivity" }).inputValue()) === "1",
  );

  const users = a.getByRole("group", { name: "Users" });
  const started = Date.now();
  await a.mouse.move(600, 500);
  await a.waitForTimeout(40_000);
  await a.mouse.move(610, 510);
  const moved = Date.now();
  await a.waitForTimeout(40_000);
  step(
    "input starts the minute again",
    !(await users.isVisible()),
    `${Math.round((Date.now() - started) / 1000)} s after the first input`,
  );
  await users.waitFor({ timeout: 40_000 });
  const idle = Math.round((Date.now() - moved) / 1000);
  step("a minute with no input logs out", idle >= 58 && idle <= 75, `after ${idle} s`);
  const session = await a.evaluate(
    async () => (await (await fetch("/api/session")).json()).account ?? null,
  );
  step("the server says no one is signed in", session === null);
  await shot(a, "sp-security-logged-out");
});
