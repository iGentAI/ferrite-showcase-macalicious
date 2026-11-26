#!/usr/bin/env node
// Terminal's commands that reach beyond the files, on the desktop: who the shell is, `date`, what
// needs a real computer, `open -a`, the clipboard, `defaults` across a reload, `ps`, and `node` on
// the Script Editor module's interpreter.
//
//   node e2e/terminal-mac-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("terminal-mac", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const stamp = Date.now().toString(36);

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Terminal");
  const log = page.getByRole("log", { name: "Terminal output" }).first();
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const screen = () => log.innerText();
  const type = async (line) => {
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
    await page.waitForTimeout(200);
  };

  await type("whoami");
  step("whoami answers", (await screen()).includes("shackett"));
  await type("sudo ls");
  step("sudo says why not", (await screen()).includes("sudo: there is no root here"));
  await type("date +%Y");
  step("date formats", (await screen()).includes(String(new Date().getFullYear())));
  await type(`echo copied-${stamp} | pbcopy`);
  await type("pbpaste");
  const pasted = await screen();
  step(
    "pbcopy and pbpaste carry text through the clipboard",
    pasted.split(`copied-${stamp}`).length >= 3,
  );
  await type(`defaults write com.example.terminal mark ${stamp}`);
  await type(`node -p "6 * 7"`);
  step("node runs on the server", /\n42\s/.test(await screen()), (await screen()).slice(-120));
  const opened = page.locator('[data-window-id^="textedit"]');
  step("TextEdit is not open before `open -a`", (await opened.count()) === 0);
  await type("open -a TextEdit");
  await opened.first().waitFor({ timeout: 5_000 });
  step("open -a TextEdit opens it", await opened.first().isVisible());
  await launch(page, "Terminal");
  await page.waitForTimeout(400);
  await type("ps");
  step("ps lists the windows", /textedit\s+/.test(await screen()), (await screen()).slice(-200));
  await shot(page, path.join(out, "terminal-mac.png"));

  const finderShows = async (name) => {
    for (let tries = 0; tries < 20; tries += 1) {
      const title = await page.evaluate(
        () =>
          document.querySelector('[data-window-id^="finder"] .mac-title-bar-title-text')
            ?.textContent ?? "",
      );
      if (title.includes(name)) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  await type("open /Applications");
  step("open /Applications shows it in Finder", await finderShows("Applications"));
  await launch(page, "Terminal");
  await page.waitForTimeout(400);
  await type("open /Applications/Utilities");
  step("open of another folder moves Finder there", await finderShows("Utilities"));
  await shot(page, path.join(out, "terminal-open-folder.png"));
  await launch(page, "Terminal");
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  await launch(page, "Terminal");
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  const asked = "defaults read com.example.terminal mark";
  await type(asked);
  const answer = (await screen()).split(asked).at(-1)?.split("\n")[1]?.trim();
  step("defaults keeps its value across a reload", answer === stamp, String(answer));
});
