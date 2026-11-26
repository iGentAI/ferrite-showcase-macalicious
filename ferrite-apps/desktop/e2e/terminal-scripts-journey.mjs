#!/usr/bin/env node
// Terminal's scripts on the desktop, on the real drive: a script written with a here-document, made
// runnable with chmod and run by its path and with sh and source; a loop, a substitution, an alias
// and a job; and a mode and ~/.zshrc kept after a reload.
//
//   node e2e/terminal-scripts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-scripts");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Terminal");
  const log = page.getByRole("log", { name: "Terminal output" }).first();
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  /** Types a line and answers what the screen shows after it, once a prompt is back. */
  const say = async (line) => {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        /(%|>)\s*$/.test(
          document.querySelector('[role="log"][aria-label="Terminal output"]')?.innerText ?? "",
        ),
      undefined,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(350);
    return (await log.innerText()).split(line).at(-1) ?? "";
  };

  const name = `run-${Date.now().toString(36)}.sh`;
  await say("cd Documents");
  await say(`cat > ${name} <<'END'`);
  await say("#!/bin/sh");
  await say('echo "hello $1 from $0"');
  await say('for n in 1 2 3; do echo "n=$n"; done');
  await say("cd /");
  await say("exit 4");
  await say("END");
  step(
    "a here-document wrote the script to the drive",
    (await say(`cat ${name}`)).includes("n=$n"),
  );
  step("a file runs only once it may", (await say(`./${name} x`)).includes("permission denied"));
  await say(`chmod +x ${name}`);
  step("ls -l shows the new mode", (await say(`ls -l ${name}`)).includes("-rwxr-xr-x"));
  const ran = await say(`./${name} world`);
  step(
    "the script ran with its argument and its loop",
    ran.includes(`hello world from ./${name}`) && ran.includes("n=3"),
  );
  step("its exit is its status, and the shell lives", (await say("echo $?")).includes("4"));
  step("its cd stayed in the script", (await say("pwd")).includes("/Documents"));

  const set = `set-${Date.now().toString(36)}.sh`;
  await say(`echo 'KEPT=from-source' > ${set}`);
  await say(`source ${set}`);
  step("source keeps what it sets", (await say("echo $KEPT")).includes("from-source"));

  await say("alias hi='echo hello alias'");
  step("an alias stands for its command", (await say("hi")).includes("hello alias"));
  step(
    "$(...) and $((...)) work",
    (await say("echo $(basename $PWD) $((6 * 7))")).includes("Documents 42"),
  );
  const started = await say("sleep 1 &");
  step("& gives the job a number", /\[1\] \d+/.test(started));
  step("jobs lists it", (await say("jobs")).includes("running"));
  await page.waitForTimeout(1300);
  step("the prompt says when it ended", (await say("echo after")).includes("done"));

  await say("echo 'export FROM_RC=yes' > ~/.zshrc");
  await shot(page, path.join(out, "terminal-scripts.png"));
  await page.waitForTimeout(1500);

  await page.reload();
  await openDesktop(page, base, step);
  await launch(page, "Terminal");
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  step(
    "~/.zshrc ran in the new shell, after a reload",
    (await say("echo $FROM_RC")).includes("yes"),
  );
  await say("cd Documents");
  step("the mode stays after a reload", (await say(`ls -l ${name}`)).includes("-rwxr-xr-x"));
  await say(`rm ${name} ${set}`);
  await say(": > ~/.zshrc");
});
