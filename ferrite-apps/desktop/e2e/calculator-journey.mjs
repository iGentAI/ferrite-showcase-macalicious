#!/usr/bin/env node
// Calculator on Ferrite: open Calculator from the Dock with its Paper Tape closed,
// compute 12 + 3 = 15 with the keys, stored in the session's tape through
// POST /api/calculator/tape with the browser's own idempotency-key, with the tape
// still closed. Command-T opens it and shows the calculation. A resend of that
// request with the same key records nothing new. Reload the page, open Calculator
// again, and the Paper Tape, remembered as open, still shows the calculation, and
// the display the value it showed. Closing Calculator's window takes the tape with
// it and quits; the next launch has the tape open; closing the tape is remembered.
// Exits 0 only when every step passed and the page logged no console error, page
// error, failed request or HTTP error.
//
//   ferrite dev --port 8787                       # in ferrite-apps/desktop
//   node e2e/calculator-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, openDesktop, openFromDock, reloadDesktop } from "./journey-kit.mjs";

const TAPE = "/api/calculator/tape";
const SETTINGS = "/api/system-preferences/settings";

/** Waits for the server to hold `calculator.tapeOpen` as `wanted`, and says what it holds then. */
async function storedTapeOpen(page, wanted) {
  let held;
  for (let tries = 0; tries < 40; tries += 1) {
    held = (await api(page, "GET", SETTINGS)).json?.values?.["calculator.tapeOpen"];
    if (held === wanted) break;
    await page.waitForTimeout(250);
  }
  return held;
}

await journey("calculator", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const calculator = await openFromDock(page, "Calculator");
  const tape = page.getByRole("region", { name: "Paper Tape" });
  const lines = tape.getByRole("listitem");
  await page.waitForTimeout(500);
  step("Calculator opens from the Dock with its Paper Tape closed", (await tape.count()) === 0);
  const empty = await api(page, "GET", TAPE);
  step(
    "a new session's tape is empty",
    empty.json.entries?.length === 0,
    JSON.stringify(empty.json),
  );

  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === TAPE,
    { timeout: 10_000 },
  );
  for (const name of ["1", "2", "Add", "3", "Equals"]) {
    await calculator.getByRole("button", { name, exact: true }).click();
  }
  const display = calculator.getByRole("status", { name: "Result" });
  step("12 + 3 = shows 15", (await display.innerText()).trim() === "15");

  const response = await posted;
  const request = response.request();
  const key = await request.headerValue("idempotency-key");
  step(
    "the calculation is posted to the tape and stored",
    response.status() === 201,
    `HTTP ${response.status()}`,
  );
  step(
    "the post carries the browser's own idempotency key",
    typeof key === "string" && key.length >= 1 && key.length <= 128,
    String(key),
  );
  step(
    "the post holds the calculation",
    JSON.stringify(request.postDataJSON()) ===
      JSON.stringify({ expression: "12 + 3", result: "15" }),
    request.postData() ?? "",
  );
  step("the calculation leaves the Paper Tape closed", (await tape.count()) === 0);
  await page.keyboard.press("ControlOrMeta+t");
  await tape.waitFor({ state: "visible", timeout: 10_000 });
  await lines.first().waitFor({ timeout: 10_000 });
  const opened = await storedTapeOpen(page, true);
  step("Command-T opens it, and the server keeps that", opened === true, String(opened));
  step(
    "the Paper Tape shows 12 + 3 = 15",
    (await lines.allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()).join("|") ===
      "12 + 3 = 15",
    JSON.stringify(await lines.allInnerTexts()),
  );
  step(
    "Calculator stays the key window",
    (await calculator.getAttribute("data-window-state")) === "key",
  );

  // A resend after a lost reply: same key, so nothing new is recorded.
  const resent = await page.evaluate(
    async ({ url, key }) => {
      const reply = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ expression: "12 + 3", result: "15" }),
      });
      return reply.status;
    },
    { url: TAPE, key },
  );
  const stored = await api(page, "GET", TAPE);
  step("a resend with the same key answers 200", resent === 200, `HTTP ${resent}`);
  step(
    "the session's tape holds the calculation once",
    stored.json.entries?.length === 1 &&
      stored.json.entries[0].expression === "12 + 3" &&
      stored.json.entries[0].result === "15",
    JSON.stringify(stored.json),
  );
  await page.screenshot({ path: path.join(out, "calculator-before-reload.png") });

  await reloadDesktop(page);
  const again = await openFromDock(page, "Calculator");
  await tape.waitFor({ state: "visible", timeout: 10_000 });
  await lines.first().waitFor({ timeout: 10_000 });
  const after = (await lines.allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim());
  step(
    "after a reload, the Paper Tape still shows 12 + 3 = 15, once",
    after.join("|") === "12 + 3 = 15",
    JSON.stringify(after),
  );
  // Calculator keeps the value on its display across a reload (calculator.saved, the row "Value on
  // the display" of features/calculator.md); a sum in progress does not come back.
  const shown = again.getByRole("status", { name: "Result" });
  await page
    .waitForFunction(
      () => document.querySelector('[aria-label="Result"]')?.textContent?.trim() === "15",
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});
  step(
    "Calculator comes back with the value it showed, 15",
    (await shown.innerText()).trim() === "15",
  );
  await again.getByRole("button", { name: "Add", exact: true }).click();
  await again.getByRole("button", { name: "1", exact: true }).click();
  await again.getByRole("button", { name: "Equals", exact: true }).click();
  step("and the value goes on being used: 15 + 1 = 16", (await shown.innerText()).trim() === "16");
  await page.screenshot({ path: path.join(out, "calculator.png") });

  const managed = page.locator('.mac-managed-window[data-window-id^="calculator"]');
  await again.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(600);
  step(
    "closing Calculator's window takes the Paper Tape with it",
    (await managed.count()) === 0,
    `${await managed.count()} windows`,
  );
  const kept = await storedTapeOpen(page, true);
  step("the server still holds the tape as open", kept === true, String(kept));

  const relaunched = await openFromDock(page, "Calculator");
  await tape.waitFor({ state: "visible", timeout: 10_000 });
  step("the next launch has the Paper Tape open", await tape.isVisible());
  step(
    "and Calculator is the key window",
    (await relaunched.getAttribute("data-window-state")) === "key",
  );

  await tape.getByRole("button", { name: "Close" }).click();
  const closed = await storedTapeOpen(page, false);
  step("closing the Paper Tape is kept on the server", closed === false, String(closed));
  await reloadDesktop(page);
  await openFromDock(page, "Calculator");
  await page.waitForTimeout(800);
  step("after a reload, Calculator opens with the Paper Tape closed", (await tape.count()) === 0);
});
