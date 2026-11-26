#!/usr/bin/env node
// QuickTime Player's Float on Top on the desktop served by `ferrite dev`, with Mission Control and full screen. A
// floating movie stays over Finder in front; Mission Control shows both side by side and gives the float back on
// leaving; the movie's own full screen covers the screen and gives the float back on leaving; Finder in full screen is
// a Space the movie is not on, and the float comes back with the first Space. Exits 0 only with every step passed and
// no console or HTTP error. The movie is a WebM recorded in the page.
//
//   node e2e/quicktime-float-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-float");
const NAME = `Float ${Date.now().toString(36)}.webm`;
const LIBRARY = "/api/app-store/library";

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("quicktime-player")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "quicktime-player"],
      rev: held.rev,
    });
  }
  await page.evaluate(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const parts = [];
    recorder.ondataavailable = (event) => parts.push(event.data);
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    const started = performance.now();
    while (performance.now() - started < 2000) {
      context.fillStyle = "#1050c0";
      context.fillRect(0, 0, 320, 240);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(parts, { type: "video/webm" });
    const json = { "content-type": "application/json" };
    const uploading = await fetch("/api/files/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: JSON.stringify({
        parent: "documents",
        name,
        size: blob.size,
        type: blob.type,
        existing: "fail",
      }),
    }).then((reply) => reply.json());
    for (let index = 0; index < uploading.pieces; index += 1) {
      const piece = blob.slice(index * uploading.piece_bytes, (index + 1) * uploading.piece_bytes);
      await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: await piece.arrayBuffer(),
      });
    }
    await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    });
  }, NAME);
  await reloadDesktop(page);

  const dock = page.getByRole("toolbar", { name: "Dock" });
  const bar = page.getByRole("menubar").first();
  const frame = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  const finderWindow = page.locator(".mac-window.mac-finder").first();
  const toFront = async (name) => {
    await dock.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(400);
  };
  await toFront("Finder");
  await finderWindow.waitFor({ timeout: 10_000 });
  await finderWindow.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await finderWindow.getByRole("option", { name: NAME, exact: true }).first().dblclick();
  await page.locator(".mac-quicktime-player video").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const overlap = async () => {
    const a = await frame.boundingBox();
    const b = await finderWindow.boundingBox();
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null;
  };
  const onTopAt = (point) =>
    page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element?.closest(".mac-quicktime-player")
        ? "quicktime"
        : element?.closest(".mac-finder")
          ? "finder"
          : String(element?.className ?? "nothing");
    }, point);
  const shows = (locator) =>
    locator.evaluate((each) => {
      const box = each.getBoundingClientRect();
      const style = getComputedStyle(each);
      return box.width > 0 && style.visibility !== "hidden" && style.display !== "none";
    });

  await toFront("Finder");
  const spot = await overlap();
  step("Finder and the movie overlap", Boolean(spot), JSON.stringify(spot));
  step("without Float on Top, Finder covers the movie", (await onTopAt(spot)) === "finder");
  await toFront("QuickTime Player");
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Float on Top", exact: true }).first().click();
  await page.waitForTimeout(200);
  await toFront("Finder");
  step("Float on Top: the movie stays over Finder in front", (await onTopAt(spot)) === "quicktime");
  const floated = await frame.boundingBox();

  // Mission Control.
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  await page.keyboard.press("F3");
  step("Mission Control opens", await until(() => overview.isVisible()));
  await page.waitForTimeout(700);
  const spreadA = await frame.boundingBox();
  const spreadB = await finderWindow.boundingBox();
  const apart =
    spreadA.x + spreadA.width <= spreadB.x ||
    spreadB.x + spreadB.width <= spreadA.x ||
    spreadA.y + spreadA.height <= spreadB.y ||
    spreadB.y + spreadB.height <= spreadA.y;
  step("it shows the floating movie and Finder apart", apart, JSON.stringify({ spreadA, spreadB }));
  await shot(page, path.join(out, "quicktime-float-mission-control.png"));
  await page.mouse.click(spreadB.x + spreadB.width / 2, spreadB.y + spreadB.height / 2);
  step("choosing Finder leaves it", await until(async () => !(await overview.isVisible())));
  await page.waitForTimeout(700);
  step(
    "and the movie is back where it was",
    JSON.stringify(await frame.boundingBox()) === JSON.stringify(floated),
  );
  step("and still floats over Finder", (await onTopAt(spot)) === "quicktime");

  await page.keyboard.press("F3");
  const reopened = await until(() => overview.isVisible());
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  const closed = await until(async () => !(await overview.isVisible()));
  await page.waitForTimeout(700);
  step(
    "Escape from Mission Control also leaves it floating",
    reopened &&
      closed &&
      JSON.stringify(await frame.boundingBox()) === JSON.stringify(floated) &&
      (await onTopAt(spot)) === "quicktime",
  );

  // The movie's own full screen.
  await toFront("QuickTime Player");
  const enterFullScreen = async () => {
    await bar.getByRole("menuitem", { name: "View", exact: true }).click();
    await page
      .getByRole("menuitem", { name: /^Enter Full Screen/ })
      .first()
      .click();
  };
  const green = (where, name) => where.getByRole("button", { name, exact: true }).first().click();
  await enterFullScreen();
  const covers = async () => {
    const box = await frame.boundingBox();
    return box.x === 0 && box.y === 0 && box.width === 1440 && box.height === 900;
  };
  step(
    "Enter Full Screen covers the screen",
    await until(covers),
    JSON.stringify(await frame.boundingBox()),
  );
  step(
    "Dock and menu bar are under it",
    await until(() =>
      page.evaluate(() =>
        [
          [720, 890],
          [720, 5],
        ].every(
          ([x, y]) =>
            document
              .elementFromPoint(x, y)
              ?.closest(".mac-managed-window")
              ?.getAttribute("data-window-id") === "quicktime-player",
        ),
      ),
    ),
  );
  await page.waitForTimeout(700);
  await shot(page, path.join(out, "quicktime-float-full-screen.png"));
  await green(frame, "Exit Full Screen");
  step(
    "Exit Full Screen gives the frame back",
    await until(async () => JSON.stringify(await frame.boundingBox()) === JSON.stringify(floated)),
  );
  await page.waitForTimeout(700);
  await toFront("Finder");
  step("and the movie still floats over Finder", (await onTopAt(spot)) === "quicktime");

  // Finder in full screen is a Space the movie is not on.
  await enterFullScreen();
  const finderFrame = page.locator(".mac-managed-window", { has: finderWindow }).first();
  step(
    "Finder's full screen covers the screen",
    await until(async () => {
      const box = await finderFrame.boundingBox();
      return box.width === 1440 && box.height === 900;
    }),
  );
  await page.waitForTimeout(900);
  step(
    "the floating movie is not on Finder's full-screen Space",
    (await onTopAt(spot)) === "finder" && !(await shows(frame).catch(() => false)),
    await onTopAt(spot),
  );
  await shot(page, path.join(out, "quicktime-float-finder-full-screen.png"));
  await green(finderWindow, "Exit Full Screen");
  step("leaving it brings the movie back", await until(() => shows(frame)));
  await page.waitForTimeout(900);
  await toFront("Finder");
  step("floating over Finder still", (await onTopAt(spot)) === "quicktime");

  await toFront("QuickTime Player");
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Float on Top", exact: true }).first().click();
  await page.waitForTimeout(200);
  await toFront("Finder");
  step("turned off, Finder covers the movie again", (await onTopAt(spot)) === "finder");
});
