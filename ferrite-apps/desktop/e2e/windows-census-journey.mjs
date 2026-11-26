#!/usr/bin/env node
// The desktop's window manager, census rows of app `desktop` (window chrome of every window): under `ferrite dev`, a fresh
// account opens windows from the Dock and works them with the real mouse and keyboard only. Console (resizable, at least
// 620 x 300) is moved by its title bar and resized by each of its eight edges and corners, to its smallest size and up to
// the menu bar; it is closed, minimised and brought back from the Dock, put in full screen and back, zoomed by an
// Option-click and by a double click of its title bar; two windows are stacked by clicking the one behind. Calculator, a
// fixed-size window with a further window (its Paper Tape), minimises and stays minimised; About This Mac has no resize
// handles and a dimmed zoom button. On a 420-pt-wide screen a window below its smallest width runs past the right edge and
// the page does not scroll sideways (the recorded limit). Frames are read from the window manager's own placement.
//
//   node e2e/windows-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit [--out dir]

import { census, createAccount, drag, frameOf, person } from "./r2-census-kit.mjs";

const EDGES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const V = "windows-census-journey.mjs";
const row = (id, role, name, state, how, expected, notes = "") => ({
  id: `desktop.window.${id}`,
  app: "desktop",
  window_or_state: state,
  role,
  name,
  how_reached: how,
  expected_outcome: expected,
  verified_by: `${V} ${id}`,
  persists: "none",
  notes,
});
const rows = [
  row(
    "move-title-bar",
    "drag",
    "title bar",
    "any window (Console)",
    "drag the title bar with the mouse",
    "the window moves by the pointer's distance",
  ),
  row(
    "move-stays-in-reach",
    "drag",
    "title bar",
    "any window (Console)",
    "drag the title bar up past the menu bar, then down onto the Dock",
    "the move stops with the title bar below the menu bar, and above the Dock",
  ),
  ...EDGES.map((edge) =>
    row(
      `resize-${edge}`,
      "resize-handle",
      edge,
      "resizable window (Console)",
      `drag the ${edge} edge outward by 60 pt`,
      `the window grows by 60 pt toward ${edge}; the opposite edges stay`,
    ),
  ),
  row(
    "resize-min-width",
    "resize-handle",
    "w",
    "resizable window (Console)",
    "drag the w edge inward past the smallest size",
    "the width stops at the app's smallest width (Console: 620), the right edge stays",
  ),
  row(
    "resize-min-height",
    "resize-handle",
    "s",
    "resizable window (Console)",
    "drag the s edge inward past the smallest size",
    "the height stops at the app's smallest height (Console: 300)",
  ),
  row(
    "resize-max-top",
    "resize-handle",
    "n",
    "resizable window (Console)",
    "drag the n edge up past the menu bar",
    "the top edge stops at the menu bar (the tallest the window can be made upward)",
  ),
  row(
    "close",
    "button",
    "Close",
    "any window (Console)",
    "click the red button",
    "the window closes",
  ),
  row(
    "minimize",
    "button",
    "Minimize",
    "any window (Console)",
    "click the yellow button",
    "the window goes to the Dock (minimized, inert); its Dock tile brings it back, key",
  ),
  row(
    "minimize-with-further-window",
    "button",
    "Minimize",
    "Calculator with its Paper Tape open",
    "click Calculator's yellow button",
    "Calculator goes to the Dock and stays there while focus moves to its Paper Tape",
    "R2 bundle 03",
  ),
  row(
    "full-screen",
    "button",
    "Enter Full Screen",
    "resizable window (Console)",
    "click the green button, then Exit Full Screen",
    "the window fills the screen; Exit Full Screen returns it to its frame",
  ),
  row(
    "zoom-option-click",
    "button",
    "Enter Full Screen",
    "resizable window (Console)",
    "Option-click the green button, twice",
    "the window zooms to the space between the menu bar and the Dock, then returns to its frame",
  ),
  row(
    "zoom-title-double-click",
    "drag",
    "title bar",
    "resizable window (Console)",
    "double-click the title bar, twice",
    "the window zooms, then returns to its frame",
  ),
  row(
    "stacking-click",
    "click",
    "window behind",
    "two windows (Console, System Information)",
    "click the window behind",
    "it comes to the front and becomes key; the other becomes inactive",
  ),
  row(
    "fixed-size",
    "button",
    "Zoom",
    "fixed-size window (About This Mac)",
    "look for resize edges; read the green button",
    "no resize edges; the green button is dimmed (the window has a fixed size)",
  ),
  row(
    "narrow-screen",
    "limit",
    "narrow screen",
    "420 pt wide screen",
    "open Console (smallest width 620) on a 420-pt-wide page",
    "the window runs past the right edge and the page does not scroll sideways (recorded limit, final report)",
  ),
];

const dock = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
const managedOf = (page, id) => page.locator(`.mac-managed-window[data-window-id="${id}"]`);

/** A point in the title bar that is on screen and not a control, a resize edge or outside the frame (read only). */
async function titleBarPoint(managed) {
  const point = await managed.evaluate((root) => {
    const control =
      "button, a, input, select, textarea, [role='tab'], [role='button'], [role='combobox'], [role='searchbox']";
    const bar = root.querySelector(".mac-title-bar") ?? root.querySelector("[class*='title-bar']");
    if (!bar) return null;
    const b = bar.getBoundingClientRect();
    // A window moved mostly off screen shows only a strip of its bar: search the whole width, keep on-screen points.
    for (const fy of [0.5, 0.3, 0.7])
      for (let fx = 0.02; fx < 0.99; fx += 0.02) {
        const x = b.x + b.width * fx;
        const y = b.y + Math.min(b.height, 52) * fy;
        if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && bar.contains(hit) && !hit.closest(control) && !hit.closest("[data-edge]"))
          return { x, y };
      }
    return null;
  });
  if (!point) throw new Error("no free, on-screen point in the window's title bar");
  return point;
}

async function edgeCenter(managed, edge) {
  const box = await managed.locator(`[data-edge="${edge}"]`).boundingBox();
  return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
}

async function openFromDock(page, name, id) {
  await dock(page, name).click();
  await managedOf(page, id).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(400);
  return managedOf(page, id);
}

async function moveTo(page, managed, x, y) {
  const at = await titleBarPoint(managed);
  const before = await frameOf(managed);
  await drag(page, at.x, at.y, x - before.x, y - before.y);
  await page.waitForTimeout(150);
  return frameOf(managed);
}

const near = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance;

await census("windows", rows, async ({ base, run, newPage, check }) => {
  const page = await newPage("windows");
  await createAccount(page, base, person(run, "win", "Windows"));
  const menuBarBottom =
    (await page.getByRole("menubar").first().boundingBox()).y +
    (await page.getByRole("menubar").first().boundingBox()).height;

  // Console: move.
  const consoleWin = await openFromDock(page, "Console", "console");
  {
    const at = await titleBarPoint(consoleWin);
    const before = await frameOf(consoleWin);
    await drag(page, at.x, at.y, 90, 70);
    const after = await frameOf(consoleWin);
    check(
      "desktop.window.move-title-bar",
      near(after.x, before.x + 90) &&
        near(after.y, before.y + 70) &&
        near(after.width, before.width),
      `${before.x},${before.y} -> ${after.x},${after.y}`,
    );
    // The limits a real drag reaches (the pointer stops at the viewport, and drags end on screen: Playwright's Firefox
    // delivers no moves past it): up past the menu bar, then down onto the Dock. The title bar stays within reach.
    const at2 = await titleBarPoint(consoleWin);
    await drag(page, at2.x, at2.y, 0, 3 - at2.y, 10);
    const up = await frameOf(consoleWin);
    const p = await titleBarPoint(consoleWin);
    await drag(page, p.x, p.y, 0, 897 - p.y, 12);
    const down = await frameOf(consoleWin);
    const dockTop = (await page.getByRole("toolbar", { name: "Dock" }).boundingBox()).y;
    check(
      "desktop.window.move-stays-in-reach",
      near(up.y, menuBarBottom, 2) && down.y + 22 <= dockTop + 2 && down.y < 897 - 30,
      `up: y ${up.y} (menu bar ends at ${menuBarBottom}); down: y ${down.y}, its title bar ends at ${down.y + 22}, the Dock starts at ${dockTop}`,
    );
  }

  // Console: each edge outward by 60 pt, from a frame in the middle of the screen.
  for (const edge of EDGES) {
    const f0 = await moveTo(page, consoleWin, 200, 200);
    const c = await edgeCenter(consoleWin, edge);
    const dx = edge.includes("e") ? 60 : edge.includes("w") ? -60 : 0;
    const dy = edge.includes("s") ? 60 : edge.includes("n") ? -60 : 0;
    await drag(page, c.x, c.y, dx, dy);
    const f1 = await frameOf(consoleWin);
    const want = {
      width: f0.width + Math.abs(dx),
      height: f0.height + Math.abs(dy),
      x: edge.includes("w") ? f0.x - 60 : f0.x,
      y: edge.includes("n") ? f0.y - 60 : f0.y,
    };
    check(
      `desktop.window.resize-${edge}`,
      near(f1.width, want.width) &&
        near(f1.height, want.height) &&
        near(f1.x, want.x) &&
        near(f1.y, want.y),
      `${JSON.stringify([f0.x, f0.y, f0.width, f0.height])} -> ${JSON.stringify([f1.x, f1.y, f1.width, f1.height])}`,
    );
    // Back to the default size for the next edge.
    const back = await edgeCenter(consoleWin, edge);
    await drag(page, back.x, back.y, -dx, -dy);
  }

  // Smallest width and height, and the menu bar as the limit upward (each drag ends on screen, past the limit).
  {
    const f0 = await moveTo(page, consoleWin, 200, 200);
    const w = await edgeCenter(consoleWin, "w");
    await drag(page, w.x, w.y, 600, 0, 10);
    const f1 = await frameOf(consoleWin);
    check(
      "desktop.window.resize-min-width",
      near(f1.width, 620) && near(f1.x + f1.width, f0.x + f0.width),
      `width ${f1.width}, right edge ${f1.x + f1.width} (was ${f0.x + f0.width})`,
    );
    const w2 = await edgeCenter(consoleWin, "w");
    await drag(page, w2.x, w2.y, -(f0.width - 620), 0);
    const s = await edgeCenter(consoleWin, "s");
    await drag(page, s.x, s.y, 0, -350, 10);
    const f2 = await frameOf(consoleWin);
    check(
      "desktop.window.resize-min-height",
      near(f2.height, 300) && near(f2.y, f0.y),
      `height ${f2.height}`,
    );
    const s2 = await edgeCenter(consoleWin, "s");
    await drag(page, s2.x, s2.y, 0, f0.height - 300);
    const n = await edgeCenter(consoleWin, "n");
    await drag(page, n.x, n.y, 0, 4 - n.y, 10);
    const f3 = await frameOf(consoleWin);
    check(
      "desktop.window.resize-max-top",
      near(f3.y, menuBarBottom, 2) && near(f3.y + f3.height, f0.y + f0.height),
      `top ${f3.y}, menu bar ends at ${menuBarBottom}, bottom ${f3.y + f3.height}`,
    );
  }

  // Full screen and back; zoom by Option-click and by a double click of the title bar.
  {
    const f0 = await moveTo(page, consoleWin, 180, 160);
    await consoleWin.getByRole("button", { name: "Enter Full Screen" }).click();
    await page.waitForTimeout(400);
    const full = await frameOf(consoleWin);
    await consoleWin.getByRole("button", { name: "Exit Full Screen" }).click();
    await page.waitForTimeout(400);
    const back = await frameOf(consoleWin);
    check(
      "desktop.window.full-screen",
      full.fullScreen &&
        near(full.width, 1440, 2) &&
        !back.fullScreen &&
        near(back.x, f0.x) &&
        near(back.width, f0.width),
      `full ${full.width}x${full.height}`,
    );
    await page.keyboard.down("Alt");
    await consoleWin.getByRole("button", { name: "Enter Full Screen" }).click();
    await page.keyboard.up("Alt");
    await page.waitForTimeout(300);
    const zoomed = await frameOf(consoleWin);
    await page.keyboard.down("Alt");
    await consoleWin.getByRole("button", { name: "Enter Full Screen" }).click();
    await page.keyboard.up("Alt");
    await page.waitForTimeout(300);
    const unzoomed = await frameOf(consoleWin);
    check(
      "desktop.window.zoom-option-click",
      zoomed.zoomed &&
        !zoomed.fullScreen &&
        zoomed.width > f0.width &&
        !unzoomed.zoomed &&
        near(unzoomed.width, f0.width) &&
        near(unzoomed.x, f0.x),
      `zoomed ${zoomed.width}x${zoomed.height}`,
    );
    const at = await titleBarPoint(consoleWin);
    await page.mouse.dblclick(at.x, at.y);
    await page.waitForTimeout(300);
    const z2 = await frameOf(consoleWin);
    const at2 = await titleBarPoint(consoleWin);
    await page.mouse.dblclick(at2.x, at2.y);
    await page.waitForTimeout(300);
    const u2 = await frameOf(consoleWin);
    check(
      "desktop.window.zoom-title-double-click",
      z2.zoomed && !u2.zoomed && near(u2.width, f0.width),
      `zoomed=${z2.zoomed} then ${u2.zoomed}`,
    );
  }

  // Stacking: Console placed first, then System Information opened and moved, so it is in front and key and Console is
  // behind and inactive; a click on the part of Console it does not cover brings Console forward.
  {
    await moveTo(page, consoleWin, 120, 120);
    const info = await openFromDock(page, "System Information", "system-information");
    await moveTo(page, info, 520, 300);
    const before = { console: await frameOf(consoleWin), info: await frameOf(info) };
    const behind =
      before.console.z < before.info.z &&
      before.console.state !== "key" &&
      before.info.state === "key";
    await page.mouse.click(before.console.x + 60, before.console.y + 120);
    await page.waitForTimeout(300);
    const after = { console: await frameOf(consoleWin), info: await frameOf(info) };
    check(
      "desktop.window.stacking-click",
      behind &&
        after.console.z > after.info.z &&
        after.console.state === "key" &&
        after.info.state !== "key",
      `before: z ${before.console.z}/${before.info.z} ${before.console.state}/${before.info.state}; after: z ${after.console.z}/${after.info.z} ${after.console.state}/${after.info.state}`,
    );
    // Console now covers System Information's buttons: bring it forward by its uncovered corner, then close it.
    await page.mouse.click(
      after.info.x + after.info.width - 40,
      after.info.y + after.info.height - 40,
    );
    await page.waitForTimeout(300);
    await info.getByRole("button", { name: "Close" }).click();
  }

  // Minimise to the Dock and back from its tile.
  {
    const tilesBefore = await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button")
      .allTextContents();
    await consoleWin.getByRole("button", { name: "Minimize" }).click();
    await page.waitForTimeout(600);
    const mini = await frameOf(consoleWin);
    const inert = await consoleWin.evaluate((element) => element.inert === true);
    const buttons = page.getByRole("toolbar", { name: "Dock" }).getByRole("button");
    const count = await buttons.count();
    let restored = false;
    if (count > tilesBefore.length) {
      // The minimized window's tile sits after the Dock's separator, before Downloads and the Trash.
      const names = await buttons.evaluateAll((list) =>
        list.map((b) => b.getAttribute("aria-label") || b.textContent.trim()),
      );
      const tile = names.findIndex(
        (name, at) => at >= tilesBefore.length - 2 && /Console/.test(name),
      );
      if (tile >= 0) {
        await buttons.nth(tile).click();
        await page.waitForTimeout(600);
        const back = await frameOf(consoleWin);
        restored = !back.minimized && back.state === "key";
      }
    }
    check(
      "desktop.window.minimize",
      mini.minimized && inert && restored,
      `minimized=${mini.minimized} inert=${inert} dock ${tilesBefore.length}->${count} restored=${restored}`,
    );
    await consoleWin.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(400);
    check("desktop.window.close", (await consoleWin.count()) === 0);
  }

  // Calculator: a fixed-size window whose Paper Tape is a further window of the same app.
  {
    const calculator = await openFromDock(page, "Calculator", "calculator");
    if ((await managedOf(page, "calculator:tape").count()) === 0) {
      await calculator.click({ position: { x: 100, y: 60 } });
      await page.keyboard.press("ControlOrMeta+t");
      await managedOf(page, "calculator:tape").waitFor({ timeout: 5_000 });
    }
    await calculator.getByRole("button", { name: "Minimize" }).click();
    await page.waitForTimeout(900);
    const mini = await frameOf(calculator);
    check(
      "desktop.window.minimize-with-further-window",
      mini.minimized,
      `calculator minimized=${mini.minimized} state=${mini.state}`,
    );
    for (const id of ["calculator:tape", "calculator"]) {
      const close = managedOf(page, id).getByRole("button", { name: "Close" });
      if ((await close.count()) > 0 && !(await managedOf(page, id).evaluate((e) => e.inert)))
        await close.click();
    }
  }

  // About This Mac: fixed size.
  {
    const about = await openFromDock(page, "About This Mac", "about-this-mac");
    const edges = await about.locator("[data-edge]").count();
    const zoom = about.getByRole("button", { name: "Zoom" });
    check("desktop.window.fixed-size", edges === 0 && (await zoom.isDisabled()), `edges=${edges}`);
    await about.getByRole("button", { name: "Close" }).click();
  }

  // A narrow screen: the recorded limit.
  {
    await page.setViewportSize({ width: 420, height: 800 });
    await page.waitForTimeout(400);
    const narrow = await openFromDock(page, "Console", "console");
    const f = await frameOf(narrow);
    const sideways = await page.evaluate(
      () => document.scrollingElement.scrollWidth > window.innerWidth + 1,
    );
    check(
      "desktop.window.narrow-screen",
      f.x + f.width > 420 && !sideways,
      `window ${f.x}+${f.width} on 420; page scrolls sideways: ${sideways}`,
    );
    await narrow.getByRole("button", { name: "Close" }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});
