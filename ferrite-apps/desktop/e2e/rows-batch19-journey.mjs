#!/usr/bin/env node
// Batch 19 on the desktop served by `ferrite dev`: TV Shows' open series and Next Episode, what Terminal draws for a paste
// with control characters in it, and the Wi-Fi and AirPlay extras. Chromium's own `navigator.connection` is read and
// compared; the second display is a stand-in PresentationRequest installed before the desktop loads, as no display
// answers in a headless browser, so that part proves the menu and not a real presentation.
//
//   node e2e/rows-batch19-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("rows-batch19", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const extraRows = async (page, name) => {
  const extra = page.getByRole("menuitem", { name, exact: true });
  await extra.click();
  const rows = page.getByRole("menu", { name }).getByRole("menuitem");
  await rows.first().waitFor();
  return rows.allInnerTexts();
};

await run(async (page) => {
  const closeMenu = async () => {
    await page.mouse.click(500, 500);
    await page.getByRole("menu").first().waitFor({ state: "hidden" });
  };
  page.setDefaultTimeout(15_000);
  await page.addInitScript(() => {
    const availability = Object.assign(new EventTarget(), { value: true });
    window.PresentationRequest = class {
      getAvailability() {
        return Promise.resolve(availability);
      }
      start() {
        const connection = new EventTarget();
        connection.terminate = () => connection.dispatchEvent(new Event("terminate"));
        window.__presented = (window.__presented ?? 0) + 1;
        return Promise.resolve(connection);
      }
    };
  });
  await openDesktop(page, base, step);

  // The extras.
  const report = await page.evaluate(() => {
    const { downlink, effectiveType, rtt } = navigator.connection;
    return { downlink, effectiveType, rtt };
  });
  const wifi = await extraRows(page, "Wi-Fi");
  const wanted = [
    "Network: Connected",
    ...(report.downlink ? [`Speed: about ${report.downlink} Mb/s`] : []),
    ...(report.rtt ? [`Round trip: about ${report.rtt} ms`] : []),
    `Quality: like ${report.effectiveType.toUpperCase()}`,
    "Turn Wi-Fi Off",
    "A web page cannot switch Wi-Fi.",
    "A web page cannot see or join Wi-Fi networks.",
    "Open Network Preferences…",
  ];
  step(
    `Wi-Fi extra states navigator.connection: ${JSON.stringify(report)}`,
    JSON.stringify(wifi) === JSON.stringify(wanted),
  );
  await shot(page, path.join(out, "wifi-extra.png"));
  await closeMenu();

  const airplay = await extraRows(page, "AirPlay");
  step(
    "AirPlay finds a display where the browser reports one",
    airplay.includes("A display is available"),
  );
  await page.getByRole("menuitem", { name: "Show Desktop on a Display…" }).click();
  await page.waitForFunction(() => window.__presented === 1);
  await page.waitForTimeout(200);
  const on = await extraRows(page, "AirPlay");
  step("AirPlay is on after Show Desktop on a Display", on.includes("AirPlay: On"));
  await shot(page, path.join(out, "airplay-on.png"));
  await page.getByRole("menuitem", { name: "Turn AirPlay Off" }).click();
  await page.waitForTimeout(200);
  const off = await extraRows(page, "AirPlay");
  step("Turn AirPlay Off ends it", off.includes("AirPlay: Off"));
  await closeMenu();

  // TV Shows.
  await launch(page, "TV");
  const tv = page.locator('[data-window-id^="tv"]').first();
  await tv.getByRole("button", { name: "TV Shows", exact: true }).click();
  for (const series of ["Caminandes", "Pepper & Carrot", "Morevna"]) {
    await tv.getByText(series, { exact: true }).first().waitFor();
  }
  await shot(page, path.join(out, "tv-shows.png"));
  await tv.getByRole("button", { name: /Pepper & Carrot 3: The Secret Ingredients/ }).click();
  await tv.getByRole("button", { name: "Next Episode", exact: true }).click();
  await tv.getByText("Pepper & Carrot 4: Stroke of Genius", { exact: true }).first().waitFor();
  await shot(page, path.join(out, "tv-episode.png"));
  step("TV Shows: three series on shelves, Next Episode goes to the next one", true);
  const windowClose = tv.getByRole("button", { name: "Close", exact: true }).first();
  await windowClose.click();

  // Terminal.
  await launch(page, "Terminal");
  const terminal = page.locator('[data-window-id^="terminal"]').first();
  const input = terminal.locator("textarea").first();
  await input.waitFor();
  await page.waitForTimeout(800);
  await input.focus();
  const paste = (text) =>
    input.evaluate((node, pasted) => {
      const data = new DataTransfer();
      data.setData("text/plain", pasted);
      node.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, text);
  const screenText = () => terminal.innerText();
  await paste("echo 'a\x1b[2Jb\tc\x07'");
  await page.waitForTimeout(300);
  const drawn = await screenText();
  step(
    "Terminal draws a pasted escape, tab and bell in caret notation, and does not obey them",
    drawn.includes("echo 'a^[[2Jb") && drawn.includes("c^G'"),
  );
  await shot(page, path.join(out, "terminal-paste.png"));
  await page.keyboard.press("Control+U");
  await paste("echo first\x1b[201~second\r");
  await page.waitForTimeout(300);
  const held = await screenText();
  step(
    "A paste holding the end marker stays one paste, and nothing runs without Return",
    held.includes("echo firstsecond") && !/\nfirstsecond/.test(held),
  );
});
