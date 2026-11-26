#!/usr/bin/env node
// Terminal's less and man on the desktop: a real file a page at a time on the alternate screen, its
// keys, the prompt back as it was, and a manual page.
//
//   node e2e/terminal-pager-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-pager");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Terminal");
  const log = page.getByRole("log", { name: "Terminal output" }).first();
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const atPrompt = () =>
    page.waitForFunction(
      () =>
        /%\s*$/.test(
          document.querySelector('[role="log"][aria-label="Terminal output"]')?.innerText ?? "",
        ),
      undefined,
      { timeout: 15_000 },
    );
  const say = async (line) => {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
    await atPrompt();
    await page.waitForTimeout(250);
  };
  const shows = (text) =>
    page
      .waitForFunction(
        (wanted) =>
          document
            .querySelector('[role="log"][aria-label="Terminal output"]')
            ?.innerText.includes(wanted),
        text,
        { timeout: 8_000 },
      )
      .then(
        () => true,
        () => false,
      );

  const file = `pager-${Date.now().toString(36)}.txt`;
  const gone = (text) =>
    page
      .waitForFunction(
        (wanted) =>
          !document
            .querySelector('[role="log"][aria-label="Terminal output"]')
            ?.innerText.includes(wanted),
        text,
        { timeout: 8_000 },
      )
      .then(
        () => true,
        () => false,
      );
  await say("cd Documents");
  await say(`echo first > ${file}`);
  for (let at = 0; at < 6; at += 1) {
    await say(`cat ${file} ${file} > ${file}.more; cat ${file}.more > ${file}; rm ${file}.more`);
  }
  await say(`echo last >> ${file}`);
  await page.keyboard.type(`less ${file}`);
  await page.keyboard.press("Enter");
  step("less takes the screen", await gone("% cd Documents"));
  step("less shows the file", await shows("first"));
  step("its last line says what is shown", await shows(file));
  await page.keyboard.press("Space");
  await page.keyboard.press("G");
  step("G goes to the end", await shows("last"));
  step("the end says so", await shows("(END)"));
  await shot(page, path.join(out, "terminal-pager.png"));
  await page.keyboard.press("q");
  await atPrompt();
  step("q brings back the prompt and what was on the screen", await shows("% cd Documents"));
  await page.keyboard.type("man grep");
  await page.keyboard.press("Enter");
  step("man shows a page", await shows("SYNOPSIS"));
  await shot(page, path.join(out, "terminal-man.png"));
  await page.keyboard.press("q");
  await atPrompt();
  await say(`rm ${file}`);
});
