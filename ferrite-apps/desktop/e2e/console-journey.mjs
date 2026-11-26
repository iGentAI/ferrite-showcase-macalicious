#!/usr/bin/env node
// Console on Ferrite: the device in the sidebar is the macalicious-desktop
// application, and its messages are the application's own log from
// GET /api/console/log: the boot entry, then a line for each write the
// application answered. A tape entry Calculator's route stores while the
// window is open appears without a reload, and no line carries the session's
// cookie. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/console-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("console");

const LOG = "/api/console/log";
const TAPE = "/api/calculator/tape";
/**
 * The log answers its newest 500 entries by default (src/apps/console/mod.rs). On a server that
 * has answered more writes than that since it started, the boot entry has been pushed out.
 */
const LOG_WINDOW = 500;

/** Open an application as a user does from Spotlight: type its name, then Return. */
async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const log = await api(page, "GET", LOG);
  const entries = log.json.entries ?? [];
  const booted = entries.some((e) => /started at deployment generation/.test(e.message));
  // The boot entry while the log still holds it; once later writes have filled the window it is
  // gone, and the log must then be full. That the entries are this application's own is shown
  // below, where this journey's own write appears in the window.
  step(
    "the application's log answers its own entries",
    log.status === 200 &&
      entries.length > 0 &&
      entries.every((e) => typeof e.message === "string") &&
      (booted || entries.length >= LOG_WINDOW),
    `${entries.length} entries, boot entry ${booted ? "present" : `pushed out of the newest ${LOG_WINDOW}`}`,
  );

  await openWithSpotlight(page, "Console");
  const window = page.getByRole("region", { name: /^Console/ }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const sidebar = window.getByText("macalicious-desktop", { exact: true }).first();
  step("the device in the sidebar is the application", await sidebar.isVisible());
  step("and no invented device is listed", (await window.getByText("ismh15").count()) === 0);

  const grid = window.getByRole("grid", { name: "Messages" });
  await grid
    .getByText(/started at deployment generation/)
    .last()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  const rows = await grid.innerText();
  step("the window shows the application's log", /macalicious-desktop|answered/.test(rows));
  step("and none of the invented messages", !/airportd|bluetoothd|com\.apple/.test(rows));

  // How many messages the window holds before the write: the new lines must come after them.
  const rowCount = () =>
    page.evaluate(() =>
      Number(
        document
          .querySelector('[role="grid"][aria-label="Messages"]')
          ?.getAttribute("aria-rowcount") ?? 0,
      ),
    );
  const before = await rowCount();

  // A write from this browser, as Calculator sends one, while the window is open.
  const stored = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `console-journey-${Date.now()}`,
      },
      body: JSON.stringify({ expression: "6 × 7", result: "42" }),
    });
    return response.status;
  }, TAPE);
  step("Calculator's tape stores an entry", stored === 201, `HTTP ${stored}`);
  // The table renders only the rows in view: scroll it to its end, where the newest messages
  // are, and read the last rows until the write's two lines are there, after `before` rows.
  const appeared = await page
    .waitForFunction(
      (least) => {
        const grid = document.querySelector('[role="grid"][aria-label="Messages"]');
        const viewport = grid?.querySelector(".mac-scroll-view-viewport");
        if (!grid || !viewport) return false;
        viewport.scrollTop = viewport.scrollHeight;
        if (Number(grid.getAttribute("aria-rowcount")) < least) return false;
        const rows = [...grid.querySelectorAll('[role="row"][aria-selected]')]
          .slice(-4)
          .map((row) => row.textContent ?? "");
        return (
          rows.some((text) => text.includes("POST /api/calculator/tape answered 201")) &&
          rows.some((text) => text.includes("appended an entry to a session's paper tape"))
        );
      },
      before + 2,
      { timeout: 10_000, polling: 250 },
    )
    .then(() => true)
    .catch(() => false);
  step(
    "the write's request line and Calculator's own line appear at the end, without a reload",
    appeared,
    `${before} messages before, ${await rowCount()} after`,
  );

  const cookies = await page.context().cookies();
  const secrets = cookies.map((cookie) => cookie.value).filter((value) => value.length >= 8);
  const after = await api(page, "GET", LOG);
  const text = JSON.stringify(after.json);
  step(
    "no log entry carries the session's cookie",
    secrets.length > 0 && secrets.every((value) => !text.includes(value)),
    `${secrets.length} cookie(s) checked`,
  );
  await shot(page, path.join(out, "console.png"));
});
