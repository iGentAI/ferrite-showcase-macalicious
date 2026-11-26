#!/usr/bin/env node
// Security & Privacy on a served desktop, signed in with a password: Privacy says what the browser
// reports; Change Password goes to Users & Groups; and with Require password immediately, a screen saver
// that starts by itself locks the screen, so waking it shows the lock screen and the password opens it.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error,
// apart from reads the lock refuses. Takes about a minute and a half.
//
//   node e2e/security-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("security");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const ana = { name: `secana-${id}`, fullName: `Ana ${id}`, password };
const other = { name: `secother-${id}`, fullName: `Other ${id}`, password };

await run({}, {}, async ({ person }) => {
  allow(/status of 423/);
  allow(/ 423/);
  const a = await person("ana", ana);
  await person("other", other);
  await openFromDock(a, "System Preferences");
  const window = a.locator('[data-window-id="system-preferences"]');
  const show = async (name) => {
    await window.getByRole("button", { name: "Show All" }).click();
    await window
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .first()
      .click();
  };
  await show("Security & Privacy");

  await window.getByRole("tab", { name: "Privacy" }).click();
  const camera = window.getByLabel("Camera:");
  await camera.waitFor();
  const browserSays = await a.evaluate(() =>
    navigator.permissions.query({ name: "camera" }).then(
      (status) => status.state,
      () => null,
    ),
  );
  const expected =
    {
      granted: "Allowed for this desktop",
      denied: "Refused for this desktop",
      prompt: "The browser will ask",
    }[browserSays] ?? "Not reported by this browser";
  const reported = await within(5_000, async () => (await camera.innerText()) === expected);
  step(
    "Privacy says what the browser reports",
    reported !== null,
    `${browserSays}: ${await camera.innerText()}`,
  );
  await shot(a, "security-privacy");

  await window.getByRole("tab", { name: "General" }).click();
  await window.getByRole("button", { name: "Change Password…" }).click();
  await window.getByText("Current user:").waitFor();
  step("Change Password goes to Users & Groups", true);

  await show("Security & Privacy");
  await window.getByRole("combobox", { name: "Require password after" }).click();
  await a.getByRole("option", { name: "immediately", exact: true }).click();

  await show("Desktop & Screen Saver");
  await window.getByRole("tab", { name: "Screen Saver" }).click();
  await window.getByRole("combobox", { name: "Start after:" }).click();
  await a.getByRole("option", { name: "1 Minute", exact: true }).click();
  const layer = a.locator(".mac-system-preferences-screen-saver");
  await layer.waitFor({ state: "attached", timeout: 70_000 });
  const locked = await within(10_000, async () =>
    a.evaluate(async () => (await (await fetch("/api/session")).json()).locked === true),
  );
  step("the screen saver locks the screen", locked !== null);

  await a.keyboard.press("a");
  await layer.waitFor({ state: "detached", timeout: 3_000 });
  const field = a
    .getByRole("textbox", { name: /password/i })
    .or(a.getByLabel(/password/i))
    .first();
  await field.waitFor({ timeout: 5_000 });
  await shot(a, "security-lock-screen");
  step("waking it shows the lock screen", (await field.inputValue()) === "");
  await field.fill(password);
  await field.press("Enter");
  const open = await within(10_000, async () =>
    a.evaluate(async () => (await (await fetch("/api/session")).json()).locked === false),
  );
  step("the password opens it", open !== null);
});
