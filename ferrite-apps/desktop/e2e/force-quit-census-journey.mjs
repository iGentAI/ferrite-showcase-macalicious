#!/usr/bin/env node
// Force Quit Applications' census (app `force-quit`), real input on a served desktop (r2-app-census.mjs): the list, and
// its button pressed through its sheet for Finder (Relaunch) and for Calculator (Force Quit): Cancel keeps the app, the
// sheet's action relaunches Finder (its windows close, it stays listed) or quits Calculator.
//   node e2e/force-quit-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import { appCensus, selects, until } from "./r2-app-census.mjs";
import { clickOwn, dockButton, managedOf } from "./r2-census-kit.mjs";

/** `app` running (opened from the Dock when it is not Finder), Force Quit in front, and `app` selected in its list. */
async function selected(page, win, app, windowId) {
  await dockButton(page, app).click();
  await managedOf(page, windowId).waitFor({ state: "visible", timeout: 8_000 });
  // Force Quit back in front: a click on a point of its own, or, when the app's window covers it entirely (a Finder
  // window does), its Dock item, which focuses the window of a running app.
  await clickOwn(page, win).catch(() => dockButton(page, "Force Quit Applications").click());
  await page.waitForTimeout(300);
  const option = win.getByRole("option", { name: new RegExp(`^${app}`) }).first();
  await option.click();
  return option;
}
/** The button (`Relaunch` or `Force Quit`) pressed: its sheet, found by naming the selected app and offering `action`. */
async function ask(page, win, button, app, action) {
  await win.getByRole("button", { name: button, exact: true }).click();
  const sheet = page
    .getByRole("dialog")
    .filter({ hasText: app })
    .filter({ has: page.getByRole("button", { name: action, exact: true }) })
    .last();
  await sheet.waitFor({ timeout: 4_000 });
  return sheet;
}
const listed = (win, app) => win.getByRole("option", { name: new RegExp(`^${app}`) });

await appCensus({
  suite: "force-quit",
  app: "force-quit",
  name: "Force Quit Applications",
  windowId: "force-quit",
  fixed: true,
  noMinimize: true,
  controls: [
    {
      id: "applications",
      role: "listbox",
      name: "Applications",
      expected: "lists the running applications, Finder last",
      verify: async ({ target }) => {
        const options = (await target.getByRole("option").allTextContents()).map((t) => t.trim());
        return [options.at(-1)?.startsWith("Finder") ?? false, options.join(", ")];
      },
    },
    {
      id: "application.finder",
      role: "option",
      name: /^Finder/,
      expected: "selects Finder; the button reads Relaunch",
      notes: "kind: Finder in the list",
      verify: async ({ page, win, target }) => {
        const [ok] = await selects({ page, target });
        const relaunch = await win
          .getByRole("button", { name: "Relaunch", exact: true })
          .isEnabled();
        return [ok && relaunch, `selected=${ok}, Relaunch enabled=${relaunch}`];
      },
    },
    {
      id: "application.other",
      role: "option",
      name: /^Calculator/,
      how: "Force Quit from the Dock, Calculator from the Dock; Calculator selected in the list",
      expected: "selects the application; the button reads Force Quit",
      notes: "kind: an application other than Finder (Calculator)",
      verify: async ({ page, win }) => {
        const option = await selected(page, win, "Calculator", "calculator");
        const ok = await until(
          page,
          async () => (await option.getAttribute("aria-selected")) === "true",
        );
        const button = await win
          .getByRole("button", { name: "Force Quit", exact: true })
          .isEnabled();
        return [ok && button, `selected=${ok}, Force Quit enabled=${button}`];
      },
    },
    {
      id: "relaunch",
      role: "button",
      name: "Relaunch",
      how: "Finder selected; Relaunch clicked",
      expected: "asks in a sheet whether to relaunch Finder, with Cancel and Relaunch",
      verify: async ({ page, win }) => {
        await listed(win, "Finder").first().click();
        const sheet = await ask(page, win, "Relaunch", "Finder", "Relaunch");
        const text = ((await sheet.textContent()) ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
        await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
        return [true, text];
      },
    },
    {
      id: "relaunch-sheet.cancel",
      role: "button",
      name: "Cancel",
      state: "sheet:Relaunch Finder",
      how: "a Finder window open, Finder selected, Relaunch; Cancel in the sheet clicked",
      expected: "the sheet closes; Finder's window stays and Finder stays listed",
      verify: async ({ page, win }) => {
        await selected(page, win, "Finder", "finder");
        const sheet = await ask(page, win, "Relaunch", "Finder", "Relaunch");
        await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
        const closed = await until(
          page,
          async () => (await sheet.count()) === 0 || !(await sheet.isVisible()),
        );
        const kept =
          (await managedOf(page, "finder").count()) > 0 &&
          (await listed(win, "Finder").count()) > 0;
        return [closed && kept, `sheet closed=${closed}, Finder kept=${kept}`];
      },
    },
    {
      id: "relaunch-sheet.relaunch",
      role: "button",
      name: "Relaunch",
      state: "sheet:Relaunch Finder",
      how: "a Finder window open, Finder selected, Relaunch; Relaunch in the sheet clicked",
      expected: "Finder relaunches: its window closes and Finder stays listed",
      verify: async ({ page, win }) => {
        await selected(page, win, "Finder", "finder");
        const sheet = await ask(page, win, "Relaunch", "Finder", "Relaunch");
        await sheet.getByRole("button", { name: "Relaunch", exact: true }).click();
        const closed = await until(
          page,
          async () => (await managedOf(page, "finder").count()) === 0,
          5_000,
        );
        const still = (await listed(win, "Finder").count()) > 0;
        return [closed && still, `Finder's window closed=${closed}, Finder listed=${still}`];
      },
    },
    {
      id: "force-quit",
      role: "button",
      name: "Force Quit",
      how: "Calculator open and selected; Force Quit clicked, then Force Quit in the sheet",
      expected:
        "asks in a sheet naming Calculator; its Force Quit quits Calculator (its window closes, it leaves the list)",
      verify: async ({ page, win }) => {
        await selected(page, win, "Calculator", "calculator");
        const sheet = await ask(page, win, "Force Quit", "Calculator", "Force Quit");
        await sheet.getByRole("button", { name: "Force Quit", exact: true }).click();
        const quit = await until(
          page,
          async () =>
            (await managedOf(page, "calculator").count()) === 0 &&
            (await listed(win, "Calculator").count()) === 0,
          5_000,
        );
        return [quit, quit ? "Calculator quit" : "Calculator still running"];
      },
    },
  ],
});
