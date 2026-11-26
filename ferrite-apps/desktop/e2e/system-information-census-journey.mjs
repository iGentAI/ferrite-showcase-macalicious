#!/usr/bin/env node
// System Information's census (app `system-information`), real input on a served desktop (r2-app-census.mjs).
//   node e2e/system-information-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import { appCensus, selects, until } from "./r2-app-census.mjs";

const REPORT = "Ferrite Application report";
/** A category row: selected, and the report shows it (its name changes with the category). */
const category = (name) => ({
  id: `category.${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  role: "row",
  name,
  expected: `selects ${name}; the report shows it`,
  verify: async ({ page, win, target }) => {
    const [ok] = await selects({ page, target });
    const report = win.getByRole("textbox").first();
    const shows = await until(page, async () =>
      ((await report.getAttribute("aria-label")) ?? "").startsWith(name),
    );
    return [ok && shows, `report "${await report.getAttribute("aria-label")}"`];
  },
});

await appCensus({
  suite: "system-information",
  app: "system-information",
  name: "System Information",
  windowId: "system-information",
  controls: [
    ...[
      "Browser",
      "Display",
      "Storage",
      "Ferrite Application",
      "App Modules",
      "Session Storage",
    ].map(category),
    {
      id: "report",
      role: "textbox",
      name: REPORT,
      expected: "the report of the selected category, read only: typing changes nothing",
      verify: async ({ page, win, target }) => {
        // The report is named by its category, and the window opens on the one it was left on.
        await win.getByRole("row", { name: "Ferrite Application", exact: true }).click();
        // A read-only rich-text view (role textbox), not an input: its text is what it shows.
        const before = await target.innerText();
        await target.click();
        await page.keyboard.type("x");
        await page.waitForTimeout(200);
        const after = await target.innerText();
        return [before.length > 0 && after === before, after === before ? "unchanged" : "changed"];
      },
    },
  ],
});
