#!/usr/bin/env node
// A movie reaches QuickTime Player from Finder on the desktop served by `ferrite dev`: real WebMs
// recorded in the page go to the drive's Documents folder; one opens by a double-click in Finder, and
// another by a drag from Finder onto the player's window. Exits 0 only with every step passed and
// no console or HTTP error. It deletes only what it made.
//
//   node e2e/quicktime-finder-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-finder");
const tag = Date.now().toString(36);
const OPENED = `Opened ${tag}.webm`;
const DROPPED = `Dropped ${tag}.webm`;
const LIBRARY = "/api/app-store/library";

/** Records `ms` of moving colour in the page and uploads it to the drive's Documents folder. */
const uploadMovie = (page, name, ms = 1000) =>
  page.evaluate(
    async ({ name, ms }) => {
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
      while (performance.now() - started < ms) {
        context.fillStyle = `hsl(${Math.round((performance.now() - started) / 3)} 80% 50%)`;
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
      }).then((response) => response.json());
      for (let index = 0; index < uploading.pieces; index += 1) {
        const piece = blob.slice(
          index * uploading.piece_bytes,
          (index + 1) * uploading.piece_bytes,
        );
        const put = await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
        if (!put.ok) throw new Error(`piece ${index}: ${put.status}`);
      }
      const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((response) => response.json());
      return done.created[0];
    },
    { name, ms },
  );

const player = (page) =>
  page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
const titled = (page, name) =>
  page.waitForFunction(
    (name) =>
      [
        ...document.querySelectorAll(
          '.mac-managed-window[data-window-id="quicktime-player"] .mac-title-bar-title-text',
        ),
      ].some((title) => title.textContent?.includes(name)),
    name,
    { timeout: 20_000 },
  );

await run(async (page) => {
  const made = [];
  let hadPlayer = true;
  try {
    await openDesktop(page, base, step);
    const held = (await api(page, "GET", LIBRARY)).json;
    hadPlayer = (held.installed ?? []).includes("quicktime-player");
    await api(page, "PUT", LIBRARY, {
      installed: [
        ...(held.installed ?? []).filter((id) => id !== "quicktime-player"),
        "quicktime-player",
      ],
      rev: held.rev,
    });
    made.push(await uploadMovie(page, OPENED), await uploadMovie(page, DROPPED, 5000));
    step("two recorded movies are on the drive", made.every(Boolean));
    await page.reload();
    await page.getByRole("toolbar", { name: "Dock" }).waitFor({ timeout: 30_000 });

    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.getByRole("button", { name: "Finder" }).click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    await finder.getByRole("option", { name: OPENED, exact: true }).dblclick();
    await titled(page, OPENED);
    step("a double-click on a movie in Finder opens it in QuickTime Player", true);
    await page.waitForFunction(
      () =>
        (document.querySelector('[data-window-id="quicktime-player"] video')?.readyState ?? 0) >= 1,
      null,
      { timeout: 15_000 },
    );
    await shot(page, path.join(out, "quicktime-opened-from-finder.png"));
    step("the movie is loaded in the player", true);

    await dock.getByRole("button", { name: "Finder" }).click();
    const row = finder.getByRole("option", { name: DROPPED, exact: true });
    await row.waitFor({ timeout: 15_000 });
    const from = await row.boundingBox();
    const finderBox = await finder.boundingBox();
    const target = await player(page).boundingBox();
    // Finder's window covers the player but for the strip on its left.
    const spot = {
      x: (target.x + finderBox.x) / 2,
      y: Math.min(target.y + target.height / 2, 800),
    };
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, {
      steps: 4,
    });
    await page.mouse.move(spot.x, spot.y, { steps: 10 });
    const accepting = await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest(".mac-managed-window")
          ?.querySelector("[data-desktop-drop]")
          ?.getAttribute("data-desktop-drop") ??
        document.elementFromPoint(x, y)?.closest("[data-desktop-drop]")?.className,
      spot,
    );
    await shot(page, path.join(out, "quicktime-drop-from-finder.png"));
    await page.mouse.up();
    step(
      "a movie dragged from Finder is offered to the player",
      accepting === "accept",
      `${accepting}`,
    );
    await titled(page, DROPPED);
    step("a movie dropped from Finder opens in QuickTime Player", true);

    // The keys, on the window.
    const window_ = page.locator(".mac-quicktime-player").first();
    await page.waitForFunction(
      () => (document.querySelector(".mac-quicktime-player video")?.readyState ?? 0) >= 1,
    );
    await window_.click({ position: { x: 40, y: 200 } }).catch(() => {});
    await window_.focus();
    const elapsed = () => window_.locator("[data-time='elapsed']").textContent();
    const said = () => window_.getByRole("status").textContent();
    const video = (read) => window_.locator("video").evaluate(read);
    const place = () => video((each) => each.currentTime);
    await page.keyboard.press("Alt+ArrowLeft");
    await page.waitForTimeout(300);
    step("Option-Left goes to the start", (await elapsed()) === "00:00:00:00", await elapsed());
    const fromStart = await place();
    await page.keyboard.press("l");
    step("L says it fast-forwards", (await said()).includes("Fast forward 2"), await said());
    await page.waitForTimeout(500);
    const forward = await place();
    step("L moves the movie forward", forward > fromStart, `${fromStart} to ${forward}`);
    await page.keyboard.press("k");
    await page.waitForTimeout(200);
    const stopped = await place();
    await page.waitForTimeout(400);
    step(
      "K stops a moving movie",
      (await video((each) => each.paused)) && (await place()) === stopped,
      `${stopped}`,
    );
    await page.keyboard.press("Alt+ArrowRight");
    await page.waitForTimeout(300);
    step(
      "Option-Right goes to the end",
      (await elapsed()) === (await window_.locator("[data-time='duration']").textContent()),
      await elapsed(),
    );
    const fromEnd = await place();
    await page.keyboard.press("j");
    step("J says it rewinds", (await said()).includes("Rewind 2"), await said());
    await page.waitForTimeout(500);
    const backward = await place();
    step("J moves the movie backward", backward < fromEnd, `${fromEnd} to ${backward}`);
    await page.keyboard.press("k");
    await page.keyboard.press("Alt+ArrowDown");
    await page.waitForTimeout(100);
    step("Option-Down mutes", await video((each) => each.muted));
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(100);
    step("Up raises the volume", (await video((each) => each.volume)) > 0.05);
    await page.keyboard.press("Alt+ArrowUp");
    await page.waitForTimeout(100);
    step("Option-Up is full volume", (await video((each) => each.volume)) === 1);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    step("Down lowers the volume", (await video((each) => each.volume)) < 1);
    await shot(page, path.join(out, "quicktime-keys.png"));
  } finally {
    const ours = made.filter(Boolean);
    if (ours.length > 0) {
      await api(page, "POST", "/api/files/ops", {
        ops: ours.map((id) => ({ op: "delete", id })),
      }).catch(() => {});
    }
    if (!hadPlayer) {
      const left = (await api(page, "GET", LIBRARY)).json;
      await api(page, "PUT", LIBRARY, {
        installed: (left?.installed ?? []).filter((id) => id !== "quicktime-player"),
        rev: left?.rev,
      }).catch(() => {});
    }
  }
});
