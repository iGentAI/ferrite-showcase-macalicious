#!/usr/bin/env node
// Activity Monitor's census (app `activity-monitor`), real input on a served desktop (r2-app-census.mjs). Quit Process is
// pressed with Calculator running and selected: its sheet asks, Cancel keeps Calculator, Quit quits it.
//   node e2e/activity-monitor-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import { appCensus, selects, until } from "./r2-app-census.mjs";
import { clickOwn, dockButton, managedOf } from "./r2-census-kit.mjs";

const ASKS = "Are you sure you want to quit this process?";
const sortOf = (target) =>
  target.evaluate(
    (e) =>
      e.closest('[role="columnheader"]')?.getAttribute("aria-sort") ?? e.getAttribute("aria-sort"),
  );
const sorts = async ({ page, target }) => {
  const before = await sortOf(target);
  await target.click();
  const ok = await until(page, async () => {
    const now = await sortOf(target);
    return Boolean(now) && now !== "none" && now !== before;
  });
  return [ok, `sort ${before} then ${await sortOf(target)}`];
};
const segment = async ({ page, target }) => {
  await target.click();
  const ok = await until(page, async () =>
    ["true"].includes(
      (await target.getAttribute("aria-pressed")) ??
        (await target.getAttribute("aria-selected")) ??
        "",
    ),
  );
  return [ok, `pressed ${await target.getAttribute("aria-pressed")}`];
};
/** Calculator opened from the Dock, Activity Monitor brought back in front, and Calculator's row selected. */
async function calculatorSelected(page, win) {
  await dockButton(page, "Calculator").click();
  await managedOf(page, "calculator").waitFor({ state: "visible", timeout: 8_000 });
  await clickOwn(page, win);
  const row = win.getByRole("row", { name: /^Calculator/ }).first();
  await row.waitFor({ timeout: 5_000 });
  await row.click();
  return row;
}
/** Quit Process pressed: its sheet, found by its question and naming Calculator. */
async function askToQuit(page, win) {
  await win.getByRole("button", { name: "Quit Process", exact: true }).click();
  const sheet = page.getByRole("dialog").filter({ hasText: ASKS }).last();
  await sheet.waitFor({ timeout: 4_000 });
  return sheet;
}
const calculatorRunning = async (page, win) =>
  (await managedOf(page, "calculator").count()) > 0 &&
  (await win.getByRole("row", { name: /^Calculator/ }).count()) > 0;

await appCensus({
  suite: "activity-monitor",
  app: "activity-monitor",
  name: "Activity Monitor",
  windowId: "activity-monitor",
  controls: [
    {
      id: "quit-process",
      role: "button",
      name: "Quit Process",
      how: "Activity Monitor from the Dock, then Calculator from the Dock; Calculator's row selected, Quit Process clicked",
      expected: `dimmed while no application it can quit is selected; with Calculator selected, enabled, and asks in a sheet "${ASKS}" naming Calculator`,
      verify: async ({ page, win, target }) => {
        const dimmed = await target.isDisabled();
        await calculatorSelected(page, win);
        const enabled = await until(page, async () => !(await target.isDisabled()));
        const sheet = await askToQuit(page, win);
        const names = ((await sheet.textContent()) ?? "").includes("Calculator");
        await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
        return [
          dimmed && enabled && names,
          `dimmed first=${dimmed}, enabled=${enabled}, the sheet names Calculator=${names}`,
        ];
      },
    },
    {
      id: "quit-sheet.cancel",
      role: "button",
      name: "Cancel",
      state: `sheet:${ASKS}`,
      how: "Quit Process with Calculator selected; Cancel in the sheet clicked",
      expected: "the sheet closes and Calculator keeps running (its window and its row stay)",
      verify: async ({ page, win }) => {
        await calculatorSelected(page, win);
        const sheet = await askToQuit(page, win);
        await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
        const closed = await until(
          page,
          async () => (await sheet.count()) === 0 || !(await sheet.isVisible()),
        );
        const running = await calculatorRunning(page, win);
        return [closed && running, `sheet closed=${closed}, Calculator running=${running}`];
      },
    },
    {
      id: "quit-sheet.quit",
      role: "button",
      name: "Quit",
      state: `sheet:${ASKS}`,
      how: "Quit Process with Calculator selected; Quit in the sheet clicked",
      expected: "Calculator quits: its window closes and its row leaves the list",
      verify: async ({ page, win }) => {
        await calculatorSelected(page, win);
        const sheet = await askToQuit(page, win);
        await sheet.getByRole("button", { name: "Quit", exact: true }).click();
        const quit = await until(
          page,
          async () =>
            (await managedOf(page, "calculator").count()) === 0 &&
            (await win.getByRole("row", { name: /^Calculator/ }).count()) === 0,
          5_000,
        );
        return [
          quit,
          quit
            ? "Calculator's window closed and its row left the list"
            : "Calculator still running",
        ];
      },
    },
    {
      id: "view.ferrite",
      role: "button",
      name: "Ferrite",
      expected: "the Ferrite view (the application's requests), its segment pressed",
      verify: segment,
    },
    {
      id: "view.network",
      role: "button",
      name: "Network",
      expected: "the Network view, its segment pressed",
      verify: segment,
    },
    // Last of the views: the chosen view is kept, and the rows below read Applications.
    {
      id: "view.applications",
      role: "button",
      name: "Applications",
      expected: "the Applications view, its segment pressed",
      verify: segment,
    },
    {
      id: "search",
      role: "searchbox",
      name: "Search",
      expected: "the list keeps only the applications whose name holds what is typed",
      verify: async ({ page, win, target }) => {
        await target.click();
        await page.keyboard.type("Finder");
        const ok = await until(
          page,
          async () =>
            (await win.getByRole("row", { name: /^Activity Monitor/ }).count()) === 0 &&
            (await win.getByRole("row", { name: /^Finder/ }).count()) === 1,
        );
        return [ok, ok ? "Finder only" : "the list did not narrow"];
      },
    },
    {
      id: "column.application-name",
      role: "button",
      name: "Application Name",
      expected: "sorts the list by that column (the column's sort changes)",
      verify: sorts,
    },
    {
      id: "column.windows",
      role: "button",
      name: "Windows",
      expected: "sorts the list by that column",
      verify: sorts,
    },
    {
      id: "column.minimized",
      role: "button",
      name: "Minimized",
      expected: "sorts the list by that column",
      verify: sorts,
    },
    {
      id: "column.on-quit",
      role: "button",
      name: "On Quit",
      expected: "sorts the list by that column",
      verify: sorts,
    },
    {
      id: "row.application",
      role: "row",
      name: /^Activity Monitor/,
      expected: "selects Activity Monitor's own row",
      notes: "kind: Activity Monitor's own row",
      verify: selects,
    },
    {
      id: "row.finder",
      role: "row",
      name: /^Finder/,
      expected: "selects Finder's row",
      notes: "kind: Finder's row",
      verify: selects,
    },
    {
      id: "row.header",
      role: "row",
      name: /^Application Name/,
      expected: "the column titles' row; a press on a title sorts (rows above)",
      notes: "kind: the header row",
      verify: async ({ target }) => [await target.isVisible(), "shown"],
    },
  ],
});
