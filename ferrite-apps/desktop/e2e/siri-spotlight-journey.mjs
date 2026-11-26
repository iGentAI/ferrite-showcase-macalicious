#!/usr/bin/env node
// Siri and Spotlight's panes on a served desktop: Enable Ask Siri and Show Siri in menu bar take Siri off the
// Dock and the menu bar, and last through a reload; Spotlight leaves out the categories turned off.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/siri-spotlight-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("siri-spotlight");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;

await run({}, {}, async ({ person }) => {
  const a = await person("ana", { name: `ssana-${id}`, fullName: `Ana ${id}`, password });
  await person("other", { name: `ssother-${id}`, fullName: `Other ${id}`, password });
  const prefs = a.locator('[data-window-id="system-preferences"]');
  const openPane = async (name) => {
    if ((await prefs.count()) === 0)
      await a
        .getByRole("button", { name: /^System Preferences$/ })
        .first()
        .click();
    await prefs.waitFor();
    await prefs
      .getByRole("button", { name: "Show All" })
      .click()
      .catch(() => {});
    await prefs
      .getByRole("group", { name: "All preferences" })
      .getByRole("button", { name, exact: true })
      .click();
  };
  const dockSiri = a.locator('.mac-dock-item[aria-label="Siri"]');
  const extraSiri = a.locator('.mac-desktop-shell-menu-bar [aria-label="Siri"]');
  const gone = (locator) => within(3_000, async () => !(await locator.isVisible()));
  const shown = (locator) => within(3_000, async () => locator.isVisible());

  step(
    "Siri starts in the Dock and the menu bar",
    (await dockSiri.isVisible()) && (await extraSiri.isVisible()),
  );
  await openPane("Siri");
  await prefs.getByRole("checkbox", { name: "Show Siri in menu bar" }).click();
  step("Show Siri in menu bar off takes the extra away", (await gone(extraSiri)) !== null);
  step("and leaves the Dock's", await dockSiri.isVisible());
  await prefs.getByRole("checkbox", { name: "Show Siri in menu bar" }).click();
  step("on again, the extra comes back", (await shown(extraSiri)) !== null);
  await prefs.getByRole("checkbox", { name: "Enable Ask Siri" }).click();
  step("Enable Ask Siri off takes Siri from the Dock", (await gone(dockSiri)) !== null);
  step("and from the menu bar", (await gone(extraSiri)) !== null);
  await shot(a, "siri-off");

  await openPane("Spotlight");
  const category = (name) => prefs.getByRole("checkbox", { name, exact: true });
  await category("Applications").click();
  await category("Calculator").click();
  await a.waitForTimeout(1_500);

  await a.reload();
  await a.locator(".mac-desktop-shell-menu-bar").waitFor();
  await a.waitForTimeout(1_000);
  step(
    "after a reload Siri is still off",
    !(await dockSiri.isVisible()) && !(await extraSiri.isVisible()),
  );

  await a.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = a.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Calendar");
  await a
    .getByRole("option", { name: /Search the Web/ })
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  step(
    "Spotlight leaves out Applications",
    (await a.getByRole("option", { name: "Calendar", exact: true }).count()) === 0,
  );
  await field.fill("12*12");
  await a.waitForTimeout(500);
  step(
    "Spotlight leaves out Calculator",
    !(await a
      .getByText("144", { exact: true })
      .first()
      .isVisible()
      .catch(() => false)),
  );
  await shot(a, "spotlight-categories");
  await field.press("Escape");
  await field.press("Escape").catch(() => {});
  await field.waitFor({ state: "detached", timeout: 3_000 });

  await openPane("Spotlight");
  await category("Applications").click();
  await a.waitForTimeout(1_000);
  await a.getByRole("menuitem", { name: "Spotlight" }).click();
  await field.fill("Calendar");
  const back = await within(
    5_000,
    async () => (await a.getByRole("option", { name: "Calendar", exact: true }).count()) > 0,
  );
  step("turned on again, Spotlight finds the application", back !== null);
});
