#!/usr/bin/env node
// Stickies' Font menu past the styles and sizes: Outline, Kern, Ligatures, Baseline, Copy Style and
// Paste Style, each read from the note's text as the browser computes it, then from the stored note
// and again after a reload. Exits 0 only when every step passed with no console error, page error
// or failed request.
//
//   node e2e/stickies-font-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("stickies-font");
const tag = Date.now().toString(36).replace(/\d/g, "q");
const WORDS = {
  a: `alpha${tag}`,
  b: `beta${tag}`,
  c: `gamma${tag}`,
  d: `delta${tag}`,
  e: `omega${tag}`,
};

const textNode = (word) => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.data.includes(word) && node.parentElement.closest(".mac-stickies-note-text")) {
      return node;
    }
  }
  return null;
};

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Stickies");
  await page.locator('[data-window-id^="stickies"]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const bar = page.getByRole("menubar");
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(200);
  await page
    .getByRole("menuitem", { name: /^New Note/ })
    .last()
    .click();
  await page.waitForTimeout(400);
  await page.keyboard.type(`${WORDS.a} ${WORDS.b} ${WORDS.c} ${WORDS.d} ${WORDS.e}`);
  await page.waitForTimeout(300);

  const select = (word) =>
    page.evaluate(
      ([source, each]) => {
        const find = new Function(`return (${source})`)();
        const node = find(each);
        const at = node.data.indexOf(each);
        node.parentElement.closest(".mac-stickies-note-text").focus();
        document.getSelection().setBaseAndExtent(node, at, node, at + each.length);
      },
      [textNode.toString(), word],
    );
  const computed = (word, property) =>
    page.evaluate(
      ([source, each, name]) => {
        const find = new Function(`return (${source})`)();
        return getComputedStyle(find(each).parentElement).getPropertyValue(name);
      },
      [textNode.toString(), word, property],
    );
  const font = () => bar.getByRole("menuitem", { name: "Font", exact: true }).click();
  const choose = async (word, submenu, item) => {
    await select(word);
    await page.waitForTimeout(100);
    await font();
    await page.waitForTimeout(200);
    if (submenu) {
      await page.getByRole("menuitem", { name: submenu, exact: true }).last().hover();
      await page.waitForTimeout(250);
    }
    await page.getByRole("menuitem", { name: item }).last().click();
    await page.waitForTimeout(400);
  };
  const checks = async (when) => {
    step(
      `Kern > Loosen spaces the letters ${when}`,
      Number.parseFloat(await computed(WORDS.b, "letter-spacing")) > 0,
      await computed(WORDS.b, "letter-spacing"),
    );
    step(
      `Baseline > Superscript raises the word ${when}`,
      (await computed(WORDS.c, "vertical-align")) === "super",
    );
    step(
      `Outline draws the word's outline ${when}`,
      Number.parseFloat(await computed(WORDS.d, "-webkit-text-stroke-width")) > 0,
    );
    step(
      `Ligatures > Use None turns them off ${when}`,
      (await computed(WORDS.d, "font-variant-ligatures")) === "none",
    );
    step(
      `Paste Style gives the copied style ${when}`,
      Number.parseFloat(await computed(WORDS.a, "letter-spacing")) > 0,
    );
  };

  await font();
  await page.waitForTimeout(200);
  const paste = page.getByRole("menuitem", { name: /^Paste Style/ }).last();
  step(
    "Paste Style is dimmed until a style is copied",
    (await paste.getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await choose(WORDS.b, "Kern", "Loosen");
  await choose(WORDS.c, "Baseline", "Superscript");
  await choose(WORDS.d, null, /^Outline/);
  await choose(WORDS.d, "Ligatures", "Use None");
  await choose(WORDS.b, null, /^Copy Style/);
  await choose(WORDS.a, null, /^Paste Style/);
  await shot(page, path.join(out, "stickies-font-extras.png"));
  await checks("in the note");

  await select(WORDS.b);
  await page.keyboard.press("ControlOrMeta+Alt+KeyC");
  await select(WORDS.e);
  await page.keyboard.press("ControlOrMeta+Alt+KeyV");
  await page.waitForTimeout(300);
  step(
    "the keys copy and paste a style",
    Number.parseFloat(await computed(WORDS.e, "letter-spacing")) > 0,
  );

  let html = "";
  for (let tries = 0; tries < 12 && !html.includes("-webkit-text-stroke"); tries += 1) {
    await page.waitForTimeout(500);
    const notes = (await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? [];
    html = notes.find((note) => note.text.includes(WORDS.a))?.html ?? "";
  }
  step(
    "the server keeps them",
    ["letter-spacing", "vertical-align", "font-variant-ligatures", "-webkit-text-stroke"].every(
      (name) => html.includes(name),
    ),
    html.slice(0, 200),
  );

  await reloadDesktop(page);
  await page.locator(".mac-stickies-note-text", { hasText: WORDS.a }).waitFor({ timeout: 10_000 });
  await checks("after a reload");
});
