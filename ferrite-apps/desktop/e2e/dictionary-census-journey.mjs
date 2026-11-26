#!/usr/bin/env node
// Dictionary census (R3, round 3 brief section 5): search, the Words list, every source (All, Dictionary, Thesaurus,
// Apple, Wikipedia; the outside sources show their content or an honest notice), Back and Forward by button and by the
// Go menu, the text size at both ends, the person's history kept by the server (/api/dictionary/history) across a
// reload, a real same-root restart and against a second account, Go > Applications, the shared menus and the window's
// chrome, each with real input and an asserted outcome. Dictionary comes from the App Store: it is got first (setup).
//
//   node e2e/dictionary-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]
//        [--phase all|write|restart-check --state <file.json>] [--explore <seconds>] [--seed <n>] [--headed]
//   node e2e/dictionary-census-journey.mjs --emit-census <dictionary.tsv>

import {
  api,
  bringToFront,
  census,
  choose,
  explore,
  goApplicationsChecks,
  goRows,
  install,
  newAccount,
  openApp,
  R,
  standardChecks,
  standardRows,
  until,
} from "./r3-census-kit.mjs";

const FILE = "dictionary-census-journey.mjs";
const W = "Dictionary window";
const MENUS = ["Dictionary", "File", "Edit", "View", "Go", "Window", "Help"];
const SOURCES = ["All", "Dictionary", "Thesaurus", "Apple", "Wikipedia"];
const HISTORY = "/api/dictionary/history";

const rows = [
  R(
    "dictionary.window.open",
    W,
    "app",
    "Dictionary",
    "Spotlight: type Dictionary, Return",
    "the Dictionary window opens with its search field",
  ),
  R("dictionary.search", W, "searchbox", "Search", "type harbour", "the Words list offers harbour"),
  R(
    "dictionary.words.option",
    W,
    "listbox",
    "Words",
    "click a word in the Words list",
    "its entry shows",
    "none",
    "kind: the Words list; first and last offered word clicked",
  ),
  ...SOURCES.map((s) =>
    R(
      `dictionary.source.${s.toLowerCase()}`,
      W,
      "radio",
      s,
      `click ${s}`,
      `checked; the entry shows ${s === "All" ? "every source" : `the ${s} section`} or an honest notice`,
    ),
  ),
  R(
    "dictionary.back",
    W,
    "button",
    "Back",
    "after harbour then lantern (each chosen in the list), click twice",
    "first the typed search of lantern (a choice commits the typed search as its own step), then harbour's entry",
  ),
  R(
    "dictionary.forward",
    W,
    "button",
    "Forward",
    "after two Backs, click twice",
    "lantern's entry again; Forward dimmed at the newest step",
  ),
  R(
    "dictionary.text.smaller",
    W,
    "button",
    "Decrease text size",
    "click until dimmed",
    "the entry's text gets smaller; dimmed at the smallest size",
  ),
  R(
    "dictionary.text.larger",
    W,
    "button",
    "Increase text size",
    "click until dimmed",
    "the entry's text gets larger; dimmed at the largest size",
  ),
  R(
    "dictionary.history.server",
    W,
    "list",
    "history",
    "look up two words",
    "the server keeps them, newest first",
    "restart",
  ),
  R(
    "dictionary.history.reload",
    W,
    "list",
    "history",
    "reload, open Dictionary",
    "the history is still there",
    "reload",
  ),
  R(
    "dictionary.history.isolation",
    W,
    "list",
    "history",
    "a second account",
    "its history is empty",
  ),
  R(
    "dictionary.history.restart",
    W,
    "list",
    "history",
    "after a real same-root restart, sign in again",
    "the same history",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "dictionary.history.isolation-restart",
    W,
    "list",
    "history",
    "after the restart, the second account",
    "still empty",
    "restart",
    "",
    "restart-check",
  ),
  ...goRows("dictionary"),
  ...standardRows("dictionary", "Dictionary", { menus: MENUS }),
];

const S = census("Dictionary", { id: "dictionary", file: FILE, rows });

await S.run(async ({ person, check, opts, state, saveState, problem, note, guard }) => {
  const history = async (page) => (await api(page, "GET", HISTORY)).json?.history ?? [];
  const words = (history) =>
    history.map((h) => (typeof h === "string" ? h : (h.word ?? h.headword ?? JSON.stringify(h))));
  /** The word whose entry the article shows (its first headword), lower case; "" with no entry. */
  const headword = async (win) =>
    (
      (await win
        .locator(".mac-dictionary-article .mac-dictionary-headword")
        .first()
        .innerText()
        .catch(() => "")) ?? ""
    )
      .trim()
      .toLowerCase();
  const open = async (page) => {
    const w = await openApp(page, "Dictionary");
    await w.getByRole("searchbox", { name: "Search" }).waitFor({ timeout: 15_000 });
    return w;
  };
  const lookUp = async (page, win, word) => {
    const field = win.getByRole("searchbox", { name: "Search" });
    await field.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type(word, { delay: 20 });
    const option = win
      .getByRole("listbox", { name: "Words" })
      .getByRole("option", { name: new RegExp(`^${word}\\b`, "i") })
      .first();
    await option.waitFor({ timeout: 20_000 });
    await option.click();
    return until(async () => (await headword(win)).startsWith(word.toLowerCase()), 20_000);
  };

  if (opts.phase === "restart-check") {
    const a = await person("A", { signIn: state.a });
    await open(a);
    const h = words(await history(a));
    check(
      "dictionary.history.restart",
      JSON.stringify(h) === JSON.stringify(state.history),
      `now ${JSON.stringify(h)} before ${JSON.stringify(state.history)}`,
    );
    const b = await person("B", { signIn: state.b });
    check(
      "dictionary.history.isolation-restart",
      (await history(b)).length === 0,
      `${(await history(b)).length} entries`,
    );
    return;
  }

  const aAcct = newAccount("dicta", opts.browserName);
  const bAcct = newAccount("dictb", opts.browserName);
  const page = await person("A", { create: aAcct });
  saveState({ a: aAcct, b: bAcct });
  await install(page, ["dictionary"]);
  let win = await open(page);
  const ensure = async () => {
    if ((await win.count()) > 0 && (await win.isVisible().catch(() => false)))
      await bringToFront(page, win, "Dictionary");
    else win = await open(page);
  };
  check(
    "dictionary.window.open",
    await win.getByRole("searchbox", { name: "Search" }).isVisible(),
    "search field shown",
  );

  await guard("search, sources, history", page, async () => {
    const field = win.getByRole("searchbox", { name: "Search" });
    await field.click();
    await page.keyboard.type("harbour", { delay: 20 });
    const list = win.getByRole("listbox", { name: "Words" });
    const offered = await until(
      async () =>
        (await list.getByRole("option").allInnerTexts()).some((t) => /^harbou?r/i.test(t.trim())),
      20_000,
    );
    check(
      "dictionary.search",
      !!offered,
      (await list.getByRole("option").allInnerTexts()).slice(0, 5).join("|"),
    );
    const opts2 = list.getByRole("option");
    const n = await opts2.count();
    const lastText = (await opts2.nth(Math.max(0, n - 1)).innerText()).trim().split("\n")[0];
    await opts2.nth(Math.max(0, n - 1)).click();
    const lastShown = await until(
      async () => (await headword(win)).startsWith(lastText.toLowerCase()),
      20_000,
    );
    const shownFirst = await lookUp(page, win, "harbour");
    check(
      "dictionary.words.option",
      !!shownFirst && !!lastShown,
      `first: harbour's entry ${shownFirst ? "shown" : "not shown"}; last offered: ${lastText}'s entry ${lastShown ? "shown" : `not shown (headword ${await headword(win)})`}`,
    );
    for (const s of SOURCES) {
      const radio = win.getByRole("radio", { name: s, exact: true });
      const before = await win.innerText();
      await radio.click();
      const checked = await until(
        async () =>
          (await radio.getAttribute("aria-checked")) === "true" ||
          (await radio.isChecked().catch(() => false)),
        5_000,
      );
      await page.waitForTimeout(1500);
      const after = await win.innerText();
      const honest = /unavailable|couldn.t|cannot|can.t|no entry|not found|offline|could not/i.test(
        after,
      );
      check(
        `dictionary.source.${s.toLowerCase()}`,
        !!checked && (after !== before || s === "Dictionary" || honest),
        `${checked ? "checked" : "not checked"}${honest ? "; notice shown" : ""}`,
      );
    }
    await win.getByRole("radio", { name: "All", exact: true }).click();
    await lookUp(page, win, "lantern");
    // Dictionary's history (dictionary.test.tsx pins it): the typed search is one step and choosing its word commits it
    // as another, so the first Back returns to the typed search of the same word, the second to the previous word.
    const back = win.getByRole("button", { name: "Back", exact: true });
    const fwd = win.getByRole("button", { name: "Forward", exact: true });
    const field2 = win.getByRole("searchbox", { name: "Search" });
    await back.click();
    const typedStep = await until(
      async () =>
        (await field2.inputValue()) === "lantern" && (await headword(win)).startsWith("lantern"),
      5_000,
    );
    await back.click();
    const previous = await until(async () => /^harbou?r/.test(await headword(win)), 8_000);
    check(
      "dictionary.back",
      !!typedStep && !!previous,
      `first Back: the typed search "lantern" ${typedStep ? "" : "NOT "}shown; second Back: entry ${await headword(win)}`,
    );
    await fwd.click();
    await fwd.click();
    const forward = await until(
      async () => (await headword(win)).startsWith("lantern") && (await fwd.isDisabled()),
      8_000,
    );
    check(
      "dictionary.forward",
      !!forward,
      `entry: ${await headword(win)}; Forward ${(await fwd.isDisabled()) ? "dimmed at the newest step" : "still enabled"}`,
    );
    const scale = () =>
      win.evaluate((el) =>
        getComputedStyle(el.querySelector("[style*='--mac-dictionary-text-scale']") ?? el)
          .getPropertyValue("--mac-dictionary-text-scale")
          .trim(),
      );
    const smaller = win.getByRole("button", { name: "Decrease text size" });
    const larger = win.getByRole("button", { name: "Increase text size" });
    const s0 = await scale();
    let steps = 0;
    while (!(await smaller.isDisabled()) && steps < 12) {
      await smaller.click();
      steps += 1;
    }
    const sMin = await scale();
    check(
      "dictionary.text.smaller",
      steps > 0 && (await smaller.isDisabled()) && Number(sMin) < Number(s0),
      `${s0} -> ${sMin} in ${steps} clicks, dimmed at the smallest`,
    );
    steps = 0;
    while (!(await larger.isDisabled()) && steps < 12) {
      await larger.click();
      steps += 1;
    }
    const sMax = await scale();
    check(
      "dictionary.text.larger",
      steps > 0 && (await larger.isDisabled()) && Number(sMax) > Number(s0),
      `${sMin} -> ${sMax} in ${steps} clicks, dimmed at the largest`,
    );
    // Go menu Back and Forward.
    await ensure();
    await choose(page, ["Go", "Back"]);
    await choose(page, ["Go", "Back"]);
    const goBack = await until(async () => /^harbou?r/.test(await headword(win)), 8_000);
    const afterBack = await headword(win);
    await choose(page, ["Go", "Forward"]);
    await choose(page, ["Go", "Forward"]);
    const goFwd = await until(async () => (await headword(win)).startsWith("lantern"), 8_000);
    check(
      "dictionary.menu.go.back",
      !!goBack,
      `two Backs (the typed step, then the previous word): entry ${afterBack}`,
    );
    check("dictionary.menu.go.forward", !!goFwd, `two Forwards: entry ${await headword(win)}`);
    await page.waitForTimeout(1000);
    const h = words(await history(page));
    check(
      "dictionary.history.server",
      h
        .slice(0, 2)
        .map((w) => w.toLowerCase())
        .join(",")
        .includes("lantern") && h.some((w) => /harbou?r/i.test(w)),
      JSON.stringify(h.slice(0, 5)),
    );
    saveState({ history: h });
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    win = await open(page);
    const h2 = words(await history(page));
    const recent = await until(async () => /lantern/i.test(await win.innerText()), 8_000);
    check(
      "dictionary.history.reload",
      // A later save may have moved a word up, but none is lost.
      h.every((word) => h2.includes(word)) && !!recent,
      `${JSON.stringify(h2.slice(0, 3))}; recent list ${recent ? "shows lantern" : "does not show lantern"}`,
    );
    const b = await person("B", { create: bAcct });
    check(
      "dictionary.history.isolation",
      (await history(b)).length === 0,
      `${(await history(b)).length} entries for the second account`,
    );
    await b.context().close();
  });

  await guard("Go > Applications", page, () =>
    goApplicationsChecks(page, check, "dictionary", ensure),
  );
  win = await standardChecks({
    page,
    check,
    problem,
    guard,
    slug: "dictionary",
    App: "Dictionary",
    menus: MENUS,
    open: () => open(page),
    win,
  });

  if (opts.explore > 0) {
    const g = await person("explorer");
    await install(g, ["dictionary"]);
    await open(g);
    const r = await explore(g, {
      app: "Dictionary",
      windows: g
        .locator(".mac-window")
        .filter({ has: g.getByRole("searchbox", { name: "Search" }) }),
      seconds: opts.explore,
      seed: opts.seed,
      out: opts.out,
      browserName: opts.browserName,
      reopen: () => open(g),
      menus: MENUS,
    });
    note(`exploratory pass: ${r.actions} actions, ${r.unresponsive} unresponsive, log ${r.log}`);
    console.log(
      `${r.unresponsive ? "FAIL" : "ok  "} explore (${r.actions} actions, seed ${opts.seed}, ${r.log})`,
    );
    if (r.unresponsive) problem(`exploratory pass: the UI stopped answering (${r.log})`);
  }
});
