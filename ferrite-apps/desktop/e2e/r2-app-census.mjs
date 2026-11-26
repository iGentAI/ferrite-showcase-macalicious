// R2's census engine for an application window (diagnosis-free, real input): every control the window shows, from R2's
// crawl and app discovery, is pressed with the real mouse (or typed into) on the window opened afresh from the Dock, and
// its outcome is asserted by the control's own `verify`; then the window's chrome: close, minimize and back from its Dock
// tile, and the green button (full screen and back for a resizable window; dimmed with "This window has a fixed size" for a
// fixed one). One `ok`/`FAIL` line per census id, through r2-census-kit.mjs's `census`.

import {
  census,
  closeAll,
  createAccount,
  frameOf,
  openFromDock,
  person,
  slug,
} from "./r2-census-kit.mjs";

/** Waits up to `ms` for `fn` to answer true. */
export async function until(page, fn, ms = 3_000) {
  for (let waited = 0; waited <= ms; waited += 200) {
    if (await fn().catch(() => false)) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

/**
 * Runs the census of the window `windowId` of the application `app` (Dock item `name`). `controls`: `{ id, role, name,
 * expected, how?, state?, notes?, unavailable?, verify({ page, win, target }) -> [ok, detail] }`, `target` being the
 * control (its role and exact name, or a RegExp name) and `state` the window or state it is in (the window by default).
 * `fixed`: the window has a fixed size. `noMinimize`: the window cannot be minimized (its yellow button is dimmed).
 */
export async function appCensus({
  suite,
  app,
  name,
  windowId,
  fixed = false,
  noMinimize = false,
  controls,
}) {
  const file = `${suite}-census-journey.mjs`;
  const row = (id, role, label, how, expected, notes = "", state = `window:${name}`) => ({
    id: `${app}.${id}`,
    app,
    window_or_state: state,
    role,
    name: label instanceof RegExp ? `/${label.source}/` : label,
    how_reached: how,
    expected_outcome: expected,
    verified_by: `${file} ${app}.${id}`,
    persists: "none",
    notes,
  });
  const rows = [
    ...controls.map((c) =>
      row(
        c.id,
        c.role,
        c.name,
        c.how ??
          `${name} from the Dock; ${c.role === "searchbox" || c.role === "textbox" ? "typed into" : "clicked"} with the ${c.role === "searchbox" || c.role === "textbox" ? "keyboard" : "mouse"}`,
        c.expected,
        c.notes ?? "",
        c.state,
      ),
    ),
    row("chrome.close", "button", "Close", "its close button", "the window closes"),
    noMinimize
      ? row(
          "chrome.minimize",
          "button",
          "Minimize",
          "its yellow button read",
          "unavailable:this window cannot be minimized",
        )
      : row(
          "chrome.minimize",
          "button",
          "Minimize",
          "its minimize button, then its Dock tile",
          "the window goes to the Dock and its tile brings it back",
        ),
    fixed
      ? row(
          "chrome.zoom",
          "button",
          "Zoom",
          "its green button read",
          "unavailable:This window has a fixed size",
        )
      : row(
          "chrome.full-screen",
          "button",
          "Enter Full Screen",
          "its green button, then again (Exit Full Screen)",
          "the window fills the screen, and comes back to its frame",
        ),
  ];
  await census(suite, rows, async ({ base, run, newPage, check, skip }) => {
    const page = await newPage(suite);
    await createAccount(page, base, person(run, slug(suite).slice(0, 12), `${name} Census`));
    const fresh = async () => {
      await closeAll(page);
      return openFromDock(page, name, windowId);
    };
    for (const c of controls) {
      const id = `${app}.${c.id}`;
      let ok = false;
      let detail = "";
      try {
        const win = await fresh();
        const target = win
          .getByRole(
            c.role,
            c.name instanceof RegExp ? { name: c.name } : { name: c.name, exact: true },
          )
          .first();
        [ok, detail = ""] = await c.verify({ page, win, target });
      } catch (error) {
        detail = String(error.message).split("\n").slice(0, 4).join(" | ");
      }
      if (c.unavailable) skip(id, c.expected, ok);
      else check(id, ok, detail);
    }
    {
      const win = await fresh();
      await win.getByRole("button", { name: "Close" }).first().click();
      check(`${app}.chrome.close`, await until(page, async () => (await win.count()) === 0));
    }
    {
      const win = await fresh();
      if (noMinimize) {
        skip(
          `${app}.chrome.minimize`,
          "unavailable:this window cannot be minimized",
          await win.getByRole("button", { name: "Minimize" }).first().isDisabled(),
        );
      } else {
        await win.getByRole("button", { name: "Minimize" }).first().click();
        await page.waitForTimeout(500);
        const mini = (await frameOf(win)).minimized;
        await page
          .getByRole("toolbar", { name: "Dock" })
          .getByRole("button", { name: /minimized window$/ })
          .first()
          .click();
        await page.waitForTimeout(500);
        const back = !(await frameOf(win)).minimized;
        check(`${app}.chrome.minimize`, mini && back, `minimized=${mini}, back=${back}`);
      }
    }
    {
      const win = await fresh();
      if (fixed) {
        const zoom = win.getByRole("button", { name: /^(Zoom|Enter Full Screen)$/ }).first();
        skip(
          `${app}.chrome.zoom`,
          "unavailable:This window has a fixed size",
          (await zoom.isDisabled()) &&
            (await zoom.getAttribute("title")) === "This window has a fixed size",
        );
      } else {
        await win.getByRole("button", { name: "Enter Full Screen" }).first().click();
        await page.waitForTimeout(500);
        const full = (await frameOf(win)).fullScreen;
        await win.getByRole("button", { name: "Exit Full Screen" }).first().click();
        await page.waitForTimeout(500);
        const back = !(await frameOf(win)).fullScreen;
        check(`${app}.chrome.full-screen`, full && back, `full=${full}, back=${back}`);
      }
    }
    await closeAll(page);
  });
}

/** `verify` for a list, tree or grid item: pressed, it is the selected one. */
export const selects = async ({ page, target }) => {
  await target.click();
  const ok = await until(page, async () => (await target.getAttribute("aria-selected")) === "true");
  return [ok, ok ? "selected" : `aria-selected ${await target.getAttribute("aria-selected")}`];
};

/** `verify` for a control that changes what the window shows: its text differs after the press. */
export const changesWindow = async ({ page, win, target }) => {
  const before = await win.innerText();
  await target.click();
  const ok = await until(page, async () => (await win.innerText()) !== before);
  return [ok, ok ? "the window shows something else" : "the window shows the same"];
};
