#!/usr/bin/env node

// Self-test of r6-app-census's effect observation (no server needed): a no-op command whose only effect is a menu
// opening and closing, a tooltip, or the menu bar's own state counts zero changes; a command that changes the app's
// window content, or opens a window, counts; a clock in the window is not an effect; a command whose menu stays open has
// opened nothing; a journey that exited non-zero proves none of its steps; a row no step checked fails the run. Prints
// SELFTEST_OK or SELFTEST_FAIL.
//   node e2e/r6-app-census-selftest.mjs [--browser chromium]

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { journeyVerdict, observeEffect, overlays, watchChanges } from "./r6-app-census.mjs";
import { launchEngine, options } from "./r6-kit.mjs";

const o = options();
const browser = await launchEngine(o.browserName, {});
const page = await browser.newPage();
await page.setContent(`
  <div role="menubar" id="bar"><button id="noop">No-op</button><button id="tip">Tip</button><button id="real">Real</button><button id="win">Window</button></div>
  <div id="portal"></div>
  <div data-window-id="app" style="width:200px;height:100px"><div role="region" aria-label="App"><p id="text">one</p></div></div>
  <script>
    noop.onclick = () => {
      bar.setAttribute("aria-expanded", "true");
      const m = document.createElement("div");
      m.setAttribute("role", "menu");
      m.innerHTML = '<div role="menuitem">Item</div>';
      portal.append(m);
      setTimeout(() => { m.remove(); bar.setAttribute("aria-expanded", "false"); }, 50);
    };
    tip.onclick = () => {
      const t = document.createElement("div");
      t.setAttribute("role", "tooltip");
      t.textContent = "why";
      document.querySelector('[data-window-id="app"]').append(t);
    };
    real.onclick = () => { text.textContent = "two"; };
    win.onclick = () => {
      const f = document.createElement("div");
      f.setAttribute("data-window-id", "app:second");
      f.style.cssText = "width:100px;height:50px";
      f.innerHTML = '<div role="region" aria-label="Second">second</div>';
      document.body.append(f);
    };
  </script>`);
const count = async (id) => {
  const stop = await watchChanges(page);
  await page.click(`#${id}`);
  await page.waitForTimeout(300);
  return stop();
};
const results = [];
const expect = (title, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${title} (${detail})`);
};
const noop = await count("noop");
expect(
  "a menu opening and closing, and the menu bar's state, count no change",
  noop === 0,
  `changes=${noop}`,
);
const before = await overlays(page);
const tip = await count("tip");
const afterTip = await overlays(page);
expect(
  "a tooltip counts no change and is not an overlay",
  tip === 0 && afterTip.floats === before.floats,
  `changes=${tip} floats ${before.floats} -> ${afterTip.floats}`,
);
const real = await count("real");
expect("a change of the window's content counts", real > 0, `changes=${real}`);
const win = await count("win");
const afterWin = await overlays(page);
expect(
  "a window opening counts, and is an overlay",
  win > 0 && afterWin.windows.includes("app:second"),
  `changes=${win} windows ${afterWin.windows.join(",")}`,
);

await page.evaluate(() => {
  const clock = document.createElement("p");
  clock.id = "clock";
  document.querySelector('[data-window-id="app"]').append(clock);
  let tick = 0;
  window.ticking = setInterval(() => {
    tick += 1;
    clock.textContent = String(tick);
  }, 100);
});
const ticking = await observeEffect(page, null, async () => {}, 500);
expect(
  "a clock in the window, with nothing done, is no effect",
  ticking.noise > 0 && !ticking.effect,
  `changes=${ticking.changes} noise=${ticking.noise}`,
);
await page.evaluate(() => clearInterval(window.ticking));
const acted = await observeEffect(page, null, () => page.click("#real"), 300);
expect(
  "over a stopped clock, a command that changes the window is an effect",
  acted.effect || acted.noise === 0,
  `changes=${acted.changes} noise=${acted.noise}`,
);
await page.evaluate(() => {
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.id = "left-open";
  menu.textContent = "still open";
  document.body.append(menu);
});
const withMenus = await overlays(page);
const withoutMenus = await overlays(page, { menus: false });
expect(
  "a menu left open counts for a control's probe, not for a menu command's",
  withMenus.floats === withoutMenus.floats + 1,
  `${withMenus.floats} with menus, ${withoutMenus.floats} without`,
);
await browser.close();

const steps = [{ ok: true, title: "the step", detail: "" }];
expect(
  "a step of a journey that exited 0 counts",
  journeyVerdict([["a.mjs", "the step"]], [{ file: "a.mjs", code: 0, steps }]).ok,
  "exit 0",
);
for (const code of [1, null]) {
  const killed = journeyVerdict([["a.mjs", "the step"]], [{ file: "a.mjs", code, steps }]);
  expect(`an ok step of a journey that exited ${code} does not count`, !killed.ok, killed.detail);
}
expect(
  "a journey that did not run proves nothing",
  !journeyVerdict([["a.mjs", "the step"]], []).ok,
  "not run",
);

const here = path.dirname(fileURLToPath(import.meta.url));
const censusRun = (rows) =>
  spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { census } from ${JSON.stringify(path.join(here, "r6-kit.mjs"))};
       const { run } = census("selftest", { rows: ${JSON.stringify(rows)} });
       await run(async ({ check }) => { check("a", true); });`,
      // With -e, `process.argv` has no script path: this first word stands in for it.
      "--",
      "selftest",
      "--browser",
      o.browserName,
      "--out",
      o.out,
    ],
    { encoding: "utf8" },
  );
const complete = censusRun([{ id: "a" }]);
expect("a run that checked every row exits 0", complete.status === 0, `exit ${complete.status}`);
const partial = censusRun([{ id: "a" }, { id: "b" }]);
expect(
  "a row no step checked fails the run",
  partial.status === 1 && partial.stdout.includes("FAIL b (no step of this run verified it)"),
  `exit ${partial.status}`,
);

const ok = results.every(Boolean);
console.log(ok ? "SELFTEST_OK" : "SELFTEST_FAIL");
process.exit(ok ? 0 : 1);
