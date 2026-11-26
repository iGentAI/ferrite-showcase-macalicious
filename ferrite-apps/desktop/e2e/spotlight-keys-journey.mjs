#!/usr/bin/env node
// Spotlight's keys and depth: the opening key, the query kept when it closes, kinds of file as groups, a file's own
// picture or words in the preview, Command-I, -L, -B and -C, Show All in Finder, and a file dragged out.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/spotlight-keys-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spotlight-keys");
const tag = Date.now().toString(36);
const WORDS = `Periwinkle${tag}`;
const TEXT = `${WORDS} notes.txt`;
const PICTURE = `${WORDS} picture.svg`;

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, {
    parent: "documents",
    name: TEXT,
    type: "text/plain",
    text: "the words in the file",
  });
  await uploadFile(page, {
    parent: "documents",
    name: PICTURE,
    type: "image/svg+xml",
    text: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="teal"/></svg>',
  });
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  const results = page.getByRole("listbox", { name: "Results" });

  // The opening key.
  await page.keyboard.press("Control+Alt+Space");
  await field.waitFor({ timeout: 4_000 });
  step("The opening key opens Spotlight", true);

  await field.fill(WORDS);
  const picture = results.getByRole("option", { name: PICTURE });
  await picture.waitFor({ timeout: 15_000 });
  const groupOf = (option) =>
    option.evaluate(
      (element) =>
        document.getElementById(element.parentElement?.getAttribute("aria-labelledby"))
          ?.textContent,
    );
  step(
    "A picture has a group of its own",
    (await groupOf(picture)) === "Images",
    await groupOf(picture),
  );

  // The file's own picture and words.
  await picture.click();
  await page.locator(".mac-desktop-shell-spotlight-picture").waitFor({ timeout: 8_000 });
  const previewText = await page.getByRole("group", { name: "Preview" }).innerText();
  step("The preview says where it opens", previewText.includes("Opens in Preview"), previewText);
  await page.waitForTimeout(200);
  await shot(page, path.join(out, `spotlight-keys-picture-${browserName}.png`));
  await results.getByRole("option", { name: TEXT }).click();
  step(
    "A text file shows its words",
    await until(() =>
      page
        .locator(".mac-desktop-shell-spotlight-words")
        .innerText()
        .then((words) => words.includes("the words in the file"))
        .catch(() => false),
    ),
  );

  // Closed beside the window and opened again at once, the query is still there.
  await page.mouse.click(40, 500);
  await field.waitFor({ state: "detached", timeout: 4_000 });
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  step("Opened again at once the query is there", (await field.inputValue()) === WORDS);

  // Command-C copies what is selected.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await results.getByRole("option", { name: TEXT }).click();
  await field.evaluate((input) => input.setSelectionRange(0, 0));
  await page.keyboard.press("Control+C");
  step(
    "Command-C copies the result",
    await until(async () =>
      (await page.evaluate(() => navigator.clipboard.readText())).includes(TEXT),
    ),
  );

  // Command-I: its Info window in Finder.
  await page.keyboard.press("Control+I");
  const info = page.locator('[data-window-id$="info"]').first();
  step(
    "Command-I opens its Info",
    await info.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    ),
  );

  // Show All in Finder: the search in a window.
  await page.keyboard.press("Control+Alt+Space");
  await field.fill(WORDS);
  await results.getByRole("option", { name: /^Show All in Finder/ }).dblclick();
  const finder = page.locator('[data-window-id^="finder"]').first();
  step(
    "Show All in Finder lists them in a search",
    await until(async () => {
      const box = finder.getByRole("searchbox").first();
      return (await box.inputValue().catch(() => "")) === WORDS;
    }),
  );

  // Command-L and Command-B take what was typed, as on a Mac, whatever result is selected.
  await page.keyboard.press("Control+Alt+Space");
  await field.fill(WORDS);
  await results.getByRole("option", { name: TEXT }).click();
  await page.keyboard.press("Control+L");
  const dictionary = page.locator('[data-window-id^="dictionary"]').first();
  step(
    "Command-L looks up what was typed in Dictionary",
    await until(async () => {
      const box = dictionary.getByRole("searchbox", { name: "Search" });
      return (await box.inputValue().catch(() => "")) === WORDS;
    }),
  );

  await page.keyboard.press("Control+Alt+Space");
  await field.fill(WORDS);
  await results.getByRole("option", { name: TEXT }).click();
  await page.keyboard.press("Control+B");
  step(
    "Command-B searches the web for what was typed, in Safari",
    await until(() =>
      page.evaluate(async (word) => {
        const reply = await fetch("/api/safari/tabs");
        const { tabs = [] } = await reply.json();
        return tabs.some((tab) => tab.includes(`search=${word}`));
      }, WORDS),
    ),
  );

  // Dragged out: a file onto TextEdit, which opens it... or the Trash in the Dock, by the shared drag.
  await launch(page, "Finder");
  await page.keyboard.press("Control+Alt+Space");
  await field.fill(WORDS);
  const dragged = results.getByRole("option", { name: TEXT });
  await dragged.waitFor({ timeout: 10_000 });
  const from = await dragged.boundingBox();
  await page.mouse.move(from.x + 30, from.y + 8);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
  step(
    "Dragging a file takes Spotlight out of the way",
    await field.waitFor({ state: "detached", timeout: 4_000 }).then(
      () => true,
      () => false,
    ),
  );
  const image = page.locator(".mac-desktop-drag");
  step("and carries it", (await image.innerText()).includes(TEXT));
  await page.keyboard.press("Escape");
  await page.mouse.up();
});
