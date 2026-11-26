#!/usr/bin/env node
// Terminal's `sed`, `tr`, `cut`, `which` and `env` on the desktop, on a real file of the person's drive.
//
//   node e2e/terminal-tools-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-tools");
const stamp = Date.now().toString(36);

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

  const file = `tools-${stamp}.txt`;
  await say("cd Documents");
  await say(`echo one:first > ${file}`);
  await say(`echo two:second >> ${file}`);
  step(
    "sed substitutes on a drive file",
    (await say(`sed 's/one/ONE/' ${file}`)).includes("ONE:first"),
  );
  const second = await say(`sed -n 2p ${file}`);
  step(
    "sed -n 2p takes the second line",
    second.includes("two:second") && !second.includes("one:"),
  );
  step("tr changes case in a pipe", (await say(`cat ${file} | tr a-z A-Z`)).includes("TWO:SECOND"));
  const cut = await say(`cut -d : -f 2 ${file}`);
  step("cut takes a field", cut.includes("first") && !cut.includes("one"));
  step("which names a command", (await say("which sed")).includes("/bin/sed"));
  step(
    "which says what it does not know",
    (await say("which nosuch")).includes("nosuch not found"),
  );
  step("env lists the shell's environment", (await say("env")).includes("SHELL=/bin/zsh"));
  await shot(page, path.join(out, "terminal-tools.png"));
  await say(`rm ${file}`);
});
