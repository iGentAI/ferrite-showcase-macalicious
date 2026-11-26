#!/usr/bin/env node
// Terminal's kill and top on the desktop: ps numbers a window, kill closes that application, kill
// refuses Terminal itself, and top shows the desktop's own server figures until q.
//
//   node e2e/terminal-kill-top-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-kill-top");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Calculator");
  const calculator = page.locator('.mac-managed-window[data-window-id="calculator"]');
  await calculator.waitFor({ timeout: 10_000 });
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
    return (await log.innerText()).split(line).at(-1) ?? "";
  };

  await say("ps");
  const listed = await log.innerText();
  const pid = /(\d+) calculator/.exec(listed)?.[1];
  const own = /(\d+) terminal/.exec(listed)?.[1];
  step("ps numbers each window", Boolean(pid) && Boolean(own));
  step("kill refuses Terminal itself", (await say(`kill ${own}`)).includes("is Terminal"));
  step("kill -0 only checks", (await say(`kill -0 ${pid}; echo status $?`)).includes("status 0"));
  step("Calculator is still open after that", (await calculator.count()) === 1);
  await say(`kill ${pid}`);
  step(
    "kill quits the application",
    await calculator.waitFor({ state: "detached", timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  step("its number is gone", (await say(`kill ${pid}`)).includes("no such process"));
  await page.keyboard.type("top");
  await page.keyboard.press("Enter");
  step(
    "top shows the modules' figures",
    await page
      .waitForFunction(
        () =>
          document
            .querySelector('[role="log"][aria-label="Terminal output"]')
            ?.innerText.includes("REQUESTS"),
        undefined,
        { timeout: 8_000 },
      )
      .then(
        () => true,
        () => false,
      ),
  );
  step("top has the alternate screen", !(await log.innerText()).includes("% ps"));
  await shot(page, path.join(out, "terminal-top.png"));
  await page.keyboard.press("q");
  await atPrompt();
  step("q brings the prompt back", (await log.innerText()).includes("% ps"));
});
