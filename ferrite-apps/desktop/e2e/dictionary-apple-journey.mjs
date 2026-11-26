#!/usr/bin/env node
// Dictionary's Apple scope on the served desktop: a term written for it is listed and shown under
// Apple, and a word that is not one still comes from the other sources under All. Exits 0 only when
// every step passed with no console error, page error or failed request.
//
//   node e2e/dictionary-apple-journey.mjs --url http://127.0.0.1:8787

import { api, journey, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("dictionary-apple", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "dictionary"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const spotlight = page.getByRole("combobox", { name: "Spotlight Search" });
  await spotlight.fill("Dictionary");
  await spotlight.press("Enter");
  const window = page.locator('.mac-managed-window[data-window-id^="dictionary"]').first();
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.waitFor({ state: "visible", timeout: 10_000 });
  const scope = (name) =>
    window.getByRole("radiogroup", { name: "Source" }).getByRole("radio", { name });
  await scope("Apple").click({ force: true });
  await field.click();
  await page.keyboard.type("airp");
  const words = window.getByRole("listbox", { name: "Words" });
  await words.getByRole("option", { name: "AirPlay" }).waitFor({ timeout: 10_000 });
  step(
    "Apple lists the terms the typing begins",
    (await words.getByRole("option", { name: /^AirP/ }).count()) === 2,
  );
  await words.getByRole("option", { name: "AirPlay" }).click();
  const shown = window.getByRole("region", { name: /Entry for AirPlay/i });
  await shown.getByText(/sending sound, video or a screen/).waitFor({ timeout: 15_000 });
  step("its entry shows under Apple, whatever the other sources answer", true);

  await field.fill("");
  await field.click();
  await page.keyboard.type("serendipity");
  await scope("All").click({ force: true });
  await window
    .getByRole("region", { name: /Entry for serendipity/i })
    .getByText(/discovery|chance|fortunate/i)
    .first()
    .waitFor({ timeout: 30_000 });
  step("another word still comes from the other sources", true);
  await scope("Apple").click({ force: true });
  const listed = window
    .getByRole("listbox", { name: "Words" })
    .getByRole("option", { name: "serendipity" });
  const gone = await listed
    .waitFor({ state: "hidden", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  const entries = await window.getByRole("listbox", { name: "Words" }).innerText();
  step("and is not listed under Apple", gone, entries.slice(0, 80));
});
