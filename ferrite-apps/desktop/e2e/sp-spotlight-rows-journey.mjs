#!/usr/bin/env node
// Spotlight's partial rows on a served desktop. Allow Spotlight Suggestions is dimmed with a reason, kept dimmed across a
// reload. Keyboard Shortcuts says the real key, and the journey presses it. About Search & Privacy says where a query goes,
// and the journey reads the page's requests while typing: search and Dictionary on the desktop's own server, Dictionary
// only with Definition on. Requests the server makes in turn are not visible from a page; they are read from
// `src/apps/dictionary/mod.rs`, not driven. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/sp-spotlight-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { launch } from "./app-journey.mjs";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

await journey("sp-spotlight-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const categories = prefs.getByRole("grid", { name: "Categories" });
  const openPane = async () => {
    await launch(page, "System Preferences");
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await categories.count()) === 0)
      await prefs.getByRole("button", { name: "Spotlight", exact: true }).first().click();
    await categories.waitFor({ timeout: 8_000 });
  };
  const suggestions = prefs.getByRole("checkbox", {
    name: "Allow Spotlight Suggestions in Look up",
  });
  const seeSuggestions = async (when) => {
    const why = await suggestions.evaluate(
      (element) => element.closest("[title]")?.getAttribute("title") ?? "",
    );
    step(
      `Allow Spotlight Suggestions is dimmed, off and says why ${when}`,
      (await suggestions.isDisabled()) &&
        (await suggestions.getAttribute("aria-checked")) === "false" &&
        /no Spotlight Suggestions/.test(why),
      why,
    );
  };

  await openPane();
  await seeSuggestions("at first");
  step(
    "The pane's words promise no suggestions from the Internet",
    (await prefs.getByText("movie showtimes").count()) === 0 &&
      (await prefs
        .getByText("Spotlight helps you quickly find things on this desktop")
        .isVisible()),
  );
  await page.screenshot({ path: path.join(out, "spotlight-pane.png") });

  const says = async (button, title, words) => {
    await prefs.getByRole("button", { name: button }).click();
    const popover = page.getByRole("dialog", { name: title });
    await popover.waitFor({ timeout: 5_000 });
    const text = await popover.innerText();
    step(`${button} says what is true here`, words.test(text), text.replace(/\s+/g, " "));
    await page.screenshot({ path: path.join(out, `spotlight-${title.split(" ")[0]}.png`) });
    await page.keyboard.press("Escape");
    await popover.waitFor({ state: "detached", timeout: 3_000 });
  };
  await says("Keyboard Shortcuts…", "Spotlight's keys", /Control-Space opens Spotlight/);
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await page.keyboard.press("Control+Space");
  await field.waitFor({ timeout: 4_000 });
  step("and that key opens Spotlight", true);
  await page.keyboard.press("Escape");
  await field.waitFor({ state: "detached", timeout: 4_000 });

  await says("About Search & Privacy…", "About Search & Privacy", /Wiktionary.*unless Definition/);

  const typed = async (word) => {
    const asked = [];
    const home = new URL(base).origin;
    const fromHome = (url) => new URL(url).origin === home;
    // Every request of the page that carries the word in its address or body, and every request
    // that leaves this desktop whatever it carries.
    const listen = (request) => {
      const url = request.url();
      if (!/^https?:/.test(url)) return;
      const carries = url.includes(encodeURIComponent(word)) || request.postData()?.includes(word);
      if (carries || !fromHome(url)) asked.push(url);
    };
    page.on("request", listen);
    await page.keyboard.press("Control+Space");
    await field.waitFor({ timeout: 4_000 });
    await field.fill(word);
    await page.waitForTimeout(1_500);
    // The first Escape empties the field and the second closes Spotlight, as on a Mac.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await field.waitFor({ state: "detached", timeout: 4_000 });
    page.off("request", listen);
    return asked;
  };
  const asked = await typed("lantern");
  step(
    "A word goes to this desktop's search and to Dictionary, and from the page nowhere else",
    asked.some((url) => url.includes("/api/spotlight/search")) &&
      asked.some((url) => url.includes("/api/dictionary/entry")) &&
      asked.every((url) => new URL(url).origin === new URL(base).origin),
    asked.map((url) => new URL(url).pathname).join(", "),
  );

  const saved = nextSave(page, SETTINGS);
  await categories.getByRole("checkbox", { name: "Definition" }).click();
  await saved;
  const quiet = await typed("meadow");
  step(
    "With Definition off, a word does not go to Dictionary",
    quiet.some((url) => url.includes("/api/spotlight/search")) &&
      !quiet.some((url) => url.includes("/api/dictionary/entry")),
    quiet.map((url) => new URL(url).pathname).join(", "),
  );

  await reloadDesktop(page);
  await openPane();
  await seeSuggestions("after a reload");
  const values = (await api(page, "GET", SETTINGS)).json.values;
  step(
    "Definition is still off after a reload",
    values?.["spotlight.excluded"]?.includes("Definition") &&
      (await categories
        .getByRole("checkbox", { name: "Definition" })
        .getAttribute("aria-checked")) === "false",
  );
});
