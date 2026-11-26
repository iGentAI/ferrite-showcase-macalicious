#!/usr/bin/env node
// Terminal's file patterns on the desktop: `*`, `?` and `[...]` on real drive names, a quoted one as
// text, a pattern that matches nothing, and `rm` taking only what a pattern names.
//
//   node e2e/terminal-patterns-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-patterns");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Terminal");
  const log = page.getByRole("log", { name: "Terminal output" }).first();
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  /** Types a line and answers what the screen shows after it. */
  const say = async (line) => {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        /%\s*$/.test(
          document.querySelector('[role="log"][aria-label="Terminal output"]')?.innerText ?? "",
        ),
      undefined,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(250);
    return (await log.innerText()).split(line).at(-1) ?? "";
  };

  const folder = `patterns-${Date.now().toString(36)}`;
  await say(`mkdir Documents/${folder}`);
  await say(`cd Documents/${folder}`);
  await say("touch one.txt two.txt notes.md");
  step("* takes the names it matches", (await say("echo *.txt")).includes("one.txt two.txt"));
  step("? takes one letter", (await say("echo ???.txt")).includes("one.txt two.txt"));
  step("[...] takes one of its letters", (await say("echo [nx]*")).includes("notes.md"));
  step("a quoted pattern is text", /\n\*\.txt\s/.test(await say("echo '*.txt'")));
  const none = await say("echo *.nothing; echo after");
  step(
    "a pattern that matches nothing ends the line",
    none.includes("no matches found: *.nothing") && !none.includes("\nafter"),
  );
  await say("rm *.txt");
  const left = await say("ls");
  step("rm takes what the pattern names", left.includes("notes.md") && !left.includes("one.txt"));
  await shot(page, path.join(out, "terminal-patterns.png"));
  await say("rm notes.md");
  await say("cd ..");
  await say(`rmdir ${folder}`);
});
