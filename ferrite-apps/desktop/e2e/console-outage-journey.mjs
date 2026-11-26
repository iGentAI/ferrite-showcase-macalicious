#!/usr/bin/env node
// Console while its server log is out, on a served desktop: rows already read stay, and a genuine uncaught error and an
// unhandled rejection of this page still appear, with the log answering 503 and then unreachable. Not on journey-kit's
// journey(), which counts those very errors and the 503 as failures: this runner fails on its own steps and on any
// other page error. Exits 0 only when every step passed.
//
//   node e2e/console-outage-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { ENGINES, openDesktop, options } from "./journey-kit.mjs";

const RUN = Date.now().toString(36);
const THROWN = `console-outage thrown ${RUN}`;
const REJECTED = `console-outage rejected ${RUN}`;
const PENDING = `console-outage pending ${RUN}`;
const LOG = /\/api\/console\/log(\?|$)/;
const { base, out, browserName } = options();
const browser = await ENGINES[browserName].launch();
const failures = [];
const step = (title, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${title}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(title);
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    if (!error.message.includes(RUN)) failures.push(`page error: ${error.message}`);
  });
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^Console$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="console"]');
  await window.waitFor({ timeout: 10_000 });
  const title = async () => Number((await window.innerText()).match(/\((\d+) messages?\)/)?.[1]);
  const row = (text) =>
    window
      .getByRole("grid", { includeHidden: true })
      .locator('[role="row"]')
      .filter({ hasText: text });
  await page.waitForFunction(
    () => /\(\d*[1-9]\d* messages?\)/.test(document.body.innerText),
    null,
    {
      timeout: 8_000,
    },
  );
  const before = await title();

  let answered = 0;
  const failed = page.waitForResponse(
    (response) => response.url().includes("/api/console/log") && response.status() === 503,
    { timeout: 8_000 },
  );
  await page.route(LOG, (route) => {
    answered += 1;
    return route.fulfill({ status: 503, body: "" });
  });
  await failed;
  await page.evaluate((message) => {
    setTimeout(() => {
      throw new Error(message);
    }, 0);
  }, THROWN);
  await row(THROWN).first().waitFor({ timeout: 8_000 });
  await page.screenshot({ path: path.join(out, "console-outage.png") });
  step("with the log answering 503, an uncaught error appears", answered > 0, `${answered} reads`);
  step(
    "and the rows already read stay",
    (await title()) >= before + 1,
    `${before} then ${await title()}`,
  );

  await page.unroute(LOG);
  await page.route(LOG, (route) => route.abort());
  await page.evaluate((message) => {
    void Promise.reject(new Error(message));
  }, REJECTED);
  await row(REJECTED).first().waitFor({ timeout: 8_000 });
  step("with the log unreachable, an unhandled rejection appears", (await title()) >= before + 2);
  await page.unroute(LOG);

  const held = [];
  await page.route(LOG, (route) => {
    held.push(route);
  });
  await page.waitForTimeout(2_500);
  await page.evaluate((message) => {
    setTimeout(() => {
      throw new Error(message);
    }, 0);
  }, PENDING);
  await row(PENDING).first().waitFor({ timeout: 1_500 });
  step("with a read of the log left unanswered, a new error still appears", held.length > 0);
  for (const route of held) await route.abort();
  await page.unroute(LOG);

  const flood = (from) =>
    page.evaluate(
      ({ from, run }) => {
        for (let n = from; n < from + 105; n += 1)
          window.dispatchEvent(new ErrorEvent("error", { message: `flood ${run} ${n}` }));
      },
      { from, run: RUN },
    );
  await flood(0);
  await page.waitForTimeout(2_500);
  await flood(105);
  await page.waitForTimeout(2_500);
  await window.locator("input").first().fill('process:"This Page"');
  await page.waitForTimeout(500);
  step(
    "210 errors over two reads leave this page's newest 200 listed",
    (await title()) === 200,
    String(await title()),
  );
  await window.locator("input").first().fill(`flood ${RUN} 0`);
  await page.waitForTimeout(300);
  step("the oldest is gone from the list", (await row(`flood ${RUN} 0`).count()) === 0);
  await window.locator("input").first().fill(`flood ${RUN} 209`);
  await page.waitForTimeout(300);
  step("the newest is there", (await row(`flood ${RUN} 209`).count()) === 1);
  await context.close();
} catch (error) {
  failures.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(
    `\nconsole-outage: ${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`,
  );
  process.exit(1);
}
console.log("\nconsole-outage: every step passed");
