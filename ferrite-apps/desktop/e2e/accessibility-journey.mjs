#!/usr/bin/env node
// Accessibility on a served desktop: Display's settings change the page and last through a reload, the
// Speech settings ask the browser to speak (the sound itself is not checked), the flash goes with an
// alert sound, and the categories below Captions are in the list.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/accessibility-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("accessibility");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;

await run({}, {}, async ({ person }) => {
  const a = await person("ana", { name: `acana-${id}`, fullName: `Ana ${id}`, password });
  await person("other", { name: `acother-${id}`, fullName: `Other ${id}`, password });
  const openPane = async (name) => {
    await a
      .locator('[data-window-id="system-preferences"]')
      .or(a.getByRole("button", { name: /^System Preferences$/ }))
      .first()
      .waitFor();
    if ((await a.locator('[data-window-id="system-preferences"]').count()) === 0)
      await a
        .getByRole("button", { name: /^System Preferences$/ })
        .first()
        .click();
    const window = a.locator('[data-window-id="system-preferences"]');
    await window.waitFor();
    await window
      .getByRole("button", { name: "Show All" })
      .click()
      .catch(() => {});
    await window
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .first()
      .click();
    return window;
  };
  let window = await openPane("Accessibility");
  await shot(a, "accessibility-open");
  const category = (name) => window.getByRole("option", { name: new RegExp(`^${name}`) }).first();

  await category("Voice Control").waitFor();
  step("the Motor and General categories are listed", await category("Shortcut").isVisible());
  await category("Voice Control").click();
  step(
    "Voice Control says what a page can do",
    await window.getByText(/A web page cannot turn it on/).isVisible(),
  );

  await category("Display").click();
  await window.getByRole("checkbox", { name: "Use grayscale" }).click();
  const filter = () => a.evaluate(() => getComputedStyle(document.documentElement).filter);
  step(
    "Use grayscale filters the page",
    (await within(3_000, async () => (await filter()) === "grayscale(1)")) !== null,
    await filter(),
  );
  await window.getByRole("checkbox", { name: "Reduce motion" }).click();
  await window.getByRole("checkbox", { name: "Reduce transparency" }).click();
  const reduced = await a.evaluate(() => ({
    motion: document.documentElement.hasAttribute("data-mac-reduce-motion"),
    material: getComputedStyle(document.documentElement)
      .getPropertyValue("--mac-material-filter-dock")
      .trim(),
  }));
  step(
    "Reduce motion and transparency restyle the page",
    reduced.motion && reduced.material === "none",
    JSON.stringify(reduced),
  );
  await shot(a, "accessibility-display");

  await a.waitForTimeout(1_500);
  await a.reload();
  await a.locator(".mac-desktop-shell-menu-bar").waitFor();
  const kept = await within(10_000, async () => (await filter()) === "grayscale(1)");
  step("they are still on after a reload", kept !== null, await filter());

  window = await openPane("Accessibility");
  await category("Display").click();
  await window.getByRole("checkbox", { name: "Use grayscale" }).click();
  step(
    "turned off, the filter goes",
    (await within(3_000, async () => (await filter()) === "none")) !== null,
    await filter(),
  );

  await category("Audio").click();
  await window.getByRole("checkbox", { name: /Flash the screen/ }).click();
  await a.evaluate(() => {
    window.__flashed = 0;
    new MutationObserver((changes) => {
      for (const change of changes)
        for (const node of change.addedNodes)
          if (node.classList?.contains("mac-system-preferences-page-flash")) window.__flashed += 1;
    }).observe(document.body, { childList: true });
  });
  const sound = await openPane("Sound");
  await a.waitForTimeout(1_000);
  await sound.getByRole("row", { name: "Glass" }).click();
  const flashed = await within(3_000, async () => (await a.evaluate(() => window.__flashed)) === 1);
  step("an alert sound flashes the screen", flashed !== null);

  await openPane("Accessibility");
  await a.evaluate(() => {
    window.__spoken = [];
    const speak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (utterance) => {
      window.__spoken.push({ text: utterance.text, rate: utterance.rate });
      speak(utterance);
    };
  });
  await category("Speech").click();
  await window.getByRole("button", { name: "Play", exact: true }).click();
  await window.getByRole("checkbox", { name: /Speak selected text/ }).click();
  const search = window.getByRole("searchbox").or(window.getByRole("combobox")).first();
  await search.fill("read this");
  await search.selectText();
  await a.waitForTimeout(1_000);
  await a.keyboard.press("Alt+Escape");
  const spoken = await within(
    3_000,
    async () => (await a.evaluate(() => window.__spoken.length)) >= 2,
  );
  step(
    "Play and Option-Escape ask the browser to speak",
    spoken !== null,
    JSON.stringify(await a.evaluate(() => window.__spoken)),
  );
});
