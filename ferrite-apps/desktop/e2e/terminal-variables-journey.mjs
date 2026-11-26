#!/usr/bin/env node
// Terminal's variables on the desktop: set, read, exported, written to a file named by one, and the
// last command's status.
//
//   node e2e/terminal-variables-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-variables");

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

  step("$HOME is the home folder", /\/Users\//.test(await say("echo $HOME")));
  await say("GREETING='hello there'");
  step(
    "a variable keeps what it was set to",
    (await say('echo "$GREETING!"')).includes("hello there!"),
  );
  const file = `variables-${Date.now().toString(36)}.txt`;
  await say(`NAME=${file}`);
  await say("cd Documents");
  step("$PWD follows cd", (await say("echo $PWD")).includes("/Documents"));
  await say("echo kept > $NAME");
  step("a redirection takes a file from a variable", (await say(`cat ${file}`)).includes("kept"));
  step(
    "$? is the last command's status",
    (await say("cat nosuchfile; echo status $?")).includes("status 1"),
  );
  await say("export GREETING");
  step(
    "export puts it in env",
    (await say("env | grep GREETING")).includes("GREETING=hello there"),
  );
  await say("unset GREETING");
  step("unset takes it away", (await say('echo "[$GREETING]"')).includes("[]"));
  step(
    "a command after an assignment is refused, saying so",
    (await say("A=1 pwd")).includes("not here yet"),
  );
  await say(`rm ${file}`);
  await shot(page, path.join(out, "terminal-variables.png"));
});
