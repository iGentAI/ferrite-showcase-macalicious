#!/usr/bin/env node
// Automator census (R3, round 3 brief section 5): the library (every category and every action, its description), search,
// the toolbar (Library, Media, Record, Step, Stop, Run, Action, Hide Description), the workflow document (name, type and
// its refused types, New, Save, Open, Delete), a text workflow run end to end, Run JavaScript and its bound (an endless
// loop is stopped by the server's fuel and time limits and the log says so), Stop during a run, the Log and Runs views,
// the four splitters, saved workflows and runs kept by the server across a reload, a real same-root restart and against
// a second account, and the shared menus and the window's chrome, each with real input and an asserted outcome.
// Automator comes from the App Store: it is got first (setup).
//
//   node e2e/automator-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]
//        [--phase all|write|restart-check --state <file.json>] [--explore <seconds>] [--seed <n>] [--headed]
//   node e2e/automator-census-journey.mjs --emit-census <automator.tsv>

import {
  api,
  bringToFront,
  census,
  choose,
  explore,
  install,
  menuItems,
  menuState,
  newAccount,
  openApp,
  R,
  standardChecks,
  standardRows,
  until,
} from "./r3-census-kit.mjs";

const FILE = "automator-census-journey.mjs";
const APP = "Automator";
const W = "Automator window";
const MENUS = ["Automator", "File", "Edit", "View", "Action", "Workflow", "Window", "Help"];
const CATEGORIES = [
  "Calendar",
  "Contacts",
  "Developer",
  "Files & Folders",
  "Fonts",
  "Internet",
  "Mail",
  "Movies",
  "Music",
  "PDFs",
  "Photos",
  "Text",
  "Utilities",
];
const ACTIONS = [
  "Change Case of Text",
  "Change System Appearance",
  "Combine Text",
  "Complete Reminders Item",
  "Filter Items",
  "Find Calendar Events",
  "Find People in Contacts",
  "Find Reminders",
  "Get Folder Contents",
  "Get Notes",
  "Get Specified Text",
  "Get Stickies",
  "Launch Application",
  "New Calendar Event",
  "New Note",
  "New Reminders Item",
  "New Sticky Note",
  "New Text File",
  "Read Text Files",
  "Run JavaScript",
  "Send Message",
];
const DIVIDERS = [
  "Resize the categories",
  "Resize the description",
  "Resize the library",
  "Resize the log",
];
const WORKFLOWS = "/api/automator/workflows";
const slug = (t) => t.toLowerCase().replace(/\W+/g, "-");

const rows = [
  R(
    "automator.window.open",
    W,
    "app",
    APP,
    "Spotlight: type Automator, Return",
    "the window opens with the library and an untitled workflow",
  ),
  R(
    "automator.library.all",
    W,
    "gridcell",
    "Library",
    "click Library in the categories",
    "every action is listed",
  ),
  ...CATEGORIES.map((c) =>
    R(
      `automator.category.${slug(c)}`,
      W,
      "gridcell",
      c,
      `click ${c}`,
      `the Actions list shows ${c}'s actions only`,
    ),
  ),
  ...ACTIONS.map((a) =>
    R(
      `automator.action.${slug(a)}`,
      W,
      "gridcell",
      a,
      `click ${a}`,
      `the Description pane describes ${a}`,
    ),
  ),
  R(
    "automator.action.add",
    W,
    "gridcell",
    "an action (double-click)",
    "double-click Get Specified Text",
    "it is added to the workflow as a step",
  ),
  R(
    "automator.search",
    W,
    "searchbox",
    "Search",
    "type Text",
    "the Actions list shows only matching actions",
  ),
  R(
    "automator.scope.actions",
    W,
    "radio",
    "Actions",
    "click",
    "checked; the library lists actions",
  ),
  R(
    "automator.scope.variables",
    W,
    "radio",
    "Variables",
    "look",
    "dimmed with its reason, or lists variables",
  ),
  R(
    "automator.toolbar.library",
    W,
    "button",
    "Library",
    "click twice",
    "the library hides and shows again",
  ),
  R(
    "automator.toolbar.media",
    W,
    "button",
    "Media",
    "click",
    "a media browser shows, or dimmed with its reason",
  ),
  R("automator.toolbar.record", W, "button", "Record", "look", "works, or dimmed with its reason"),
  R(
    "automator.toolbar.step",
    W,
    "button",
    "Step",
    "with steps in the workflow",
    "runs one step, or dimmed with its reason",
  ),
  R(
    "automator.toolbar.stop",
    W,
    "button",
    "Stop",
    "look, idle and during a run of an endless loop",
    "dimmed with its reason shown: the server runs a workflow as a whole",
  ),
  R(
    "automator.toolbar.run",
    W,
    "button",
    "Run",
    "with a text workflow, click",
    "the workflow runs; the log shows each step",
  ),
  R(
    "automator.toolbar.action",
    W,
    "button",
    "Action",
    "click",
    "its menu opens, or it does what it shows",
  ),
  R(
    "automator.toolbar.description",
    W,
    "button",
    "Hide Description",
    "click twice",
    "the Description pane hides and shows again",
  ),
  R(
    "automator.document.name",
    W,
    "textbox",
    "Workflow name",
    "type a name",
    "the workflow is saved under it",
  ),
  R(
    "automator.document.type",
    W,
    "combobox",
    "Workflow type",
    "open it",
    "Workflow; Print Plugin and Image Capture Plugin are listed as not available yet",
  ),
  R(
    "automator.document.type-refused",
    W,
    "option",
    "/^(Print Plugin|Image Capture Plugin) \\(not available yet\\)$/",
    "choose one",
    "refused with its reason; the type stays Workflow",
    "none",
    "kind: the workflow types a person cannot start; both checked",
  ),
  R(
    "automator.document.new",
    W,
    "button",
    "New Workflow",
    "click",
    "an untitled workflow with no steps",
  ),
  R(
    "automator.document.save",
    W,
    "button",
    "Save Workflow",
    "click",
    "the server keeps the workflow",
    "restart",
  ),
  R(
    "automator.document.open",
    W,
    "combobox",
    "Open Workflow",
    "choose the saved workflow",
    "its steps show again",
  ),
  R(
    "automator.document.delete",
    W,
    "button",
    "Delete Workflow",
    "click on a saved workflow",
    "it leaves the server and the Open menu",
  ),
  R(
    "automator.run.text",
    W,
    "workflow",
    "Get Specified Text, Change Case of Text",
    "Run",
    "the log shows both steps and the text in upper case",
  ),
  R(
    "automator.js.result",
    W,
    "step",
    "Run JavaScript",
    "code returning a value, Run",
    "the log shows the value",
  ),
  R(
    "automator.js.bounded",
    W,
    "step",
    "Run JavaScript",
    "an endless loop, Run",
    "the server stops it at its limit; the log says the step was stopped and why",
  ),
  R("automator.view.log", W, "button", "Log", "click", "the Log shows the run's steps"),
  R("automator.view.runs", W, "button", "Runs", "click", "the Runs view lists the runs", "restart"),
  ...DIVIDERS.map((d) =>
    R(
      `automator.divider.${slug(d)}`,
      W,
      "separator",
      d,
      "drag it",
      "the panes on either side change size",
    ),
  ),
  R(
    "automator.menu.action",
    "menu:Action",
    "menuitem",
    "Disable, Delete, Move Up, Move Down",
    "open Action",
    "the commands on a selected step are listed",
  ),
  R(
    "automator.menu.workflow.run",
    "menu:Workflow",
    "menuitem",
    "Run",
    "choose with a workflow of steps",
    "the workflow runs; dimmed with no steps",
  ),
  R(
    "automator.persist.reload",
    W,
    "workflow",
    "the saved workflow",
    "reload, open Automator, Open Workflow",
    "listed with its steps",
    "reload",
  ),
  R(
    "automator.isolation",
    W,
    "workflow",
    "the saved workflow",
    "a second account",
    "no workflows of the first account, on the server too",
  ),
  R(
    "automator.persist.restart",
    W,
    "workflow",
    "the saved workflow",
    "after a real same-root restart, sign in",
    "the workflow and its run are still there",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "automator.isolation-restart",
    W,
    "workflow",
    "the saved workflow",
    "after the restart, the second account",
    "still none",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "automator.menu.new-chooser",
    "menu:File",
    "menuitem",
    "New",
    "choose it, then Choose",
    "a sheet lists the eight document types, Print Plugin and Image Capture Plugin dimmed with a reason, Dictation Command too where the browser has no recognizer; Choose starts an empty workflow",
  ),
  R(
    "automator.stepped-stop",
    W,
    "button",
    "Stop",
    "Step once on a text workflow, then Stop",
    "the first action ran and handed on; Stop ends it and the log says before which action",
  ),
  R(
    "automator.stepped-run",
    W,
    "button",
    "Step",
    "Step twice on Get Specified Text, Change Case of Text",
    "the second action works on the first one's real items: the text in upper case in the log",
  ),
  R(
    "automator.rename-action",
    "menu:Action",
    "menuitem",
    "Rename Action…",
    "rename a step, save, reopen, run",
    "the name stays with the saved step, and the server accepts and runs it",
  ),
  R(
    "automator.library-menu",
    W,
    "menuitem",
    "Add to Workflow",
    "secondary-click a library row",
    "its menu adds the action as a step",
  ),
  R(
    "automator.customize-toolbar",
    "menu:View",
    "menuitem",
    "Customize Toolbar…",
    "turn Media off, reload",
    "Media leaves the toolbar and stays away after a reload",
    "reload",
  ),
  ...standardRows("automator", APP, { menus: MENUS, windowItem: "Automator" }),
];

const S = census(APP, { id: "automator", file: FILE, rows });

await S.run(async ({ person, check, allow, opts, state, saveState, problem, note, guard }) => {
  // Refusing a document type that cannot run is an answer the suite provokes.
  allow(/HTTP 4\d\d: PUT .*\/api\/automator\/workflows/);
  const workflows = async (page) => (await api(page, "GET", WORKFLOWS)).json ?? {};
  const named = (wf) =>
    (wf.library?.workflows ?? wf.workflows ?? wf.items ?? []).map((w) => w.name);
  const open = async (page) => {
    await openApp(page, APP, "mac-automator");
    // New Workflow remounts the window, which gives it a new generated label: the class stays.
    const w = page.locator('.mac-window[role="region"].mac-automator').first();
    await w.getByRole("searchbox", { name: "Search" }).waitFor({ timeout: 15_000 });
    return w;
  };
  const actionsList = (win) =>
    win
      .getByRole("grid", { name: "Actions" })
      .or(win.getByRole("listbox", { name: "Actions" }))
      .first();
  const categories = (win) =>
    win
      .getByRole("grid", { name: "Action categories" })
      .or(win.getByRole("treegrid", { name: "Action categories" }))
      .first();
  const listed = async (win) =>
    (
      await actionsList(win)
        .getByRole("gridcell")
        .allInnerTexts()
        .catch(() => [])
    )
      .map((t) => t.trim())
      .filter(Boolean);
  const description = (win) =>
    win
      .getByRole("region", { name: "Description" })
      .or(win.locator('section[aria-label="Description"]'))
      .first();
  const workflowPane = (win) => win.locator('section[aria-label="Workflow"]').first();
  const logText = async (win) =>
    (
      await win
        .getByRole("grid", { name: "Log", exact: true })
        .innerText()
        .catch(() => "")
    ).replace(/\s+/g, " ");
  const add = async (_page, win, title) => {
    await actionsList(win).getByText(title, { exact: true }).first().dblclick();
    const group = workflowPane(win).getByRole("group", { name: title, exact: true }).last();
    await group.waitFor({ timeout: 8_000 });
    return group;
  };
  const button = (win, name) => win.getByRole("button", { name, exact: true }).first();

  if (opts.phase === "restart-check") {
    const a = await person("A", { signIn: state.a });
    await install(a, ["automator"]);
    const win = await open(a);
    const kept = named(await workflows(a)).includes(state.workflow);
    await button(win, "Runs").click();
    const runs = await until(
      async () =>
        (
          await win
            .getByRole("grid", { name: "Runs", exact: true })
            .innerText()
            .catch(() => "")
        ).includes(state.workflow),
      8_000,
    );
    check(
      "automator.persist.restart",
      kept && !!runs,
      `workflow ${kept ? "kept" : "missing"}; run ${runs ? "listed" : "missing"}`,
    );
    const b = await person("B", { signIn: state.b });
    check(
      "automator.isolation-restart",
      !named(await workflows(b)).includes(state.workflow),
      JSON.stringify(named(await workflows(b))),
    );
    return;
  }

  const aAcct = newAccount("auta", opts.browserName);
  const bAcct = newAccount("autb", opts.browserName);
  const NAME = `R3 workflow ${aAcct.name}`;
  const page = await person("A", { create: aAcct });
  saveState({ a: aAcct, b: bAcct, workflow: NAME });
  await install(page, ["automator"]);
  let win = await open(page);
  check("automator.window.open", await workflowPane(win).isVisible(), "workflow pane shown");

  await guard("library, actions, search", page, async () => {
    await categories(win).getByRole("gridcell", { name: "Library", exact: true }).first().click();
    await page.waitForTimeout(300);
    const all = await listed(win);
    check(
      "automator.library.all",
      ACTIONS.every((a) => all.includes(a)),
      `${all.length} actions`,
    );
    for (const c of CATEGORIES) {
      await categories(win).getByRole("gridcell", { name: c, exact: true }).first().click();
      await page.waitForTimeout(300);
      const some = await listed(win);
      check(
        `automator.category.${slug(c)}`,
        some.length > 0 && some.length < all.length,
        `${some.length}: ${some.slice(0, 3).join(", ")}`,
      );
    }
    await categories(win).getByRole("gridcell", { name: "Library", exact: true }).first().click();
    for (const a of ACTIONS) {
      await actionsList(win).getByRole("gridcell", { name: a, exact: true }).first().click();
      const described = await until(
        async () =>
          (
            await description(win)
              .innerText()
              .catch(() => "")
          ).includes(a),
        4_000,
      );
      check(
        `automator.action.${slug(a)}`,
        !!described,
        described
          ? "described"
          : (
              await description(win)
                .innerText()
                .catch(() => "")
            ).slice(0, 80),
      );
    }
    await win.getByRole("searchbox", { name: "Search" }).click();
    await page.keyboard.type("Text");
    await page.waitForTimeout(500);
    const found = await listed(win);
    check(
      "automator.search",
      found.length > 0 && found.every((t) => /text/i.test(t)),
      found.join(", "),
    );
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    const actionsRadio = win.getByRole("radio", { name: "Actions", exact: true });
    await actionsRadio.click();
    check(
      "automator.scope.actions",
      (await actionsRadio.getAttribute("aria-checked")) === "true" ||
        (await actionsRadio.isChecked().catch(() => false)),
      "checked",
    );
    const vars = win.getByRole("radio", { name: "Variables", exact: true });
    const varsDimmed =
      (await vars.getAttribute("aria-disabled")) === "true" ||
      (await vars.isDisabled().catch(() => false));
    const why =
      `${(await vars.getAttribute("title")) ?? ""} ${(await vars.getAttribute("aria-description")) ?? ""}`.trim();
    check(
      "automator.scope.variables",
      varsDimmed ? why.length > 0 : true,
      varsDimmed ? (why ? `dimmed: ${why}` : "dimmed, no reason shown") : "enabled",
    );
  });

  await guard("toolbar and splitters", page, async () => {
    for (const [id, name, hidden] of [
      [
        "automator.toolbar.library",
        "Library",
        () =>
          categories(win)
            .isVisible()
            .then((v) => !v),
      ],
      [
        "automator.toolbar.description",
        "Hide Description",
        () =>
          description(win)
            .isVisible()
            .then((v) => !v),
      ],
    ]) {
      const b = button(win, name);
      await b.click();
      const off = await until(hidden, 4_000);
      const b2 = win
        .getByRole("button", {
          name: name === "Hide Description" ? /^(Show|Hide) Description$/ : name,
        })
        .first();
      await b2.click();
      const on = await until(async () => !(await hidden()), 4_000);
      check(id, !!off && !!on, `hidden ${!!off}, shown again ${!!on}`);
    }
    for (const [id, name] of [
      ["automator.toolbar.media", "Media"],
      ["automator.toolbar.record", "Record"],
    ]) {
      const b = button(win, name);
      if (await b.isDisabled()) {
        const why =
          `${(await b.getAttribute("title")) ?? ""} ${(await b.getAttribute("aria-description")) ?? ""}`.trim();
        check(id, why.length > 0, why ? `dimmed: ${why}` : "dimmed, no reason shown");
        continue;
      }
      const before = (await win.innerText()).length;
      await b.click();
      await page.waitForTimeout(800);
      const changed =
        (await b.getAttribute("aria-pressed")) !== null ||
        (await win.innerText()).length !== before ||
        (await page.getByRole("dialog").count()) > 0;
      check(id, changed, changed ? "something shows" : "clicked; nothing visible happened");
      await page.keyboard.press("Escape");
      if ((await b.getAttribute("aria-pressed")) === "true" && name === "Media") await b.click();
    }
    const actionBtn = button(win, "Action");
    await actionBtn.click();
    const menu = page.getByRole("menu").last();
    const opened = await until(() => menu.isVisible(), 3_000);
    check(
      "automator.toolbar.action",
      !!opened,
      opened ? `menu: ${(await menu.innerText()).replace(/\s+/g, " ").slice(0, 100)}` : "no menu",
    );
    await page.keyboard.press("Escape");
    for (const d of DIVIDERS) {
      const sep = win.getByRole("separator", { name: d }).first();
      const box = await sep.boundingBox();
      const snap = async () =>
        win.evaluate((el) =>
          [...el.querySelectorAll('[role="separator"]')]
            .map((s) => Math.round(s.getBoundingClientRect().x + s.getBoundingClientRect().y))
            .join(","),
        );
      const before = await snap();
      if (box) {
        const vertical = box.height > box.width;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2 + (vertical ? 30 : 0),
          box.y + box.height / 2 + (vertical ? 0 : 30),
          { steps: 6 },
        );
        await page.mouse.up();
      }
      check(
        `automator.divider.${slug(d)}`,
        !!box && (await snap()) !== before,
        box ? "moved" : "not shown",
      );
    }
  });

  await guard("workflow: type, steps, run, JavaScript, stop", page, async () => {
    const type = win.getByRole("combobox", { name: "Workflow type", exact: true });
    await type.click();
    const alarm = page.getByRole("option", { name: "Print Plugin (not available yet)" });
    // The pop-up's options mount as it opens: counting them at once can find none.
    await alarm.waitFor({ timeout: 5_000 }).catch(() => {});
    const folder = page.getByRole("option", { name: "Image Capture Plugin (not available yet)" });
    check(
      "automator.document.type",
      (await alarm.count()) > 0 &&
        (await folder.count()) > 0 &&
        (await page.getByRole("option", { name: /^Workflow/ }).count()) > 0,
      "Workflow, and the two types not available yet",
    );
    const refusedDimmed =
      (await alarm.getAttribute("aria-disabled")) === "true" &&
      (await folder.getAttribute("aria-disabled")) === "true";
    if (!refusedDimmed) await alarm.click().catch(() => {});
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const stays =
      /^Workflow/.test(((await type.innerText().catch(() => "")) ?? "").trim()) || refusedDimmed;
    check(
      "automator.document.type-refused",
      stays,
      refusedDimmed
        ? "both dimmed, each naming why: not available yet"
        : `after choosing Print Plugin the type reads ${(await type.innerText().catch(() => "")).trim()}`,
    );
    await page.keyboard.press("Escape");
    // A text workflow, from nothing: rows above may have added steps, and the window asks about them.
    await button(win, "New Workflow").click();
    const dontSave = page.getByRole("button", { name: /Don.t Save/ }).first();
    if (await until(() => dontSave.isVisible(), 1_500)) await dontSave.click();
    await until(async () => (await workflowPane(win).getByRole("group").count()) === 0, 5_000);
    await win.getByRole("textbox", { name: "Workflow name", exact: true }).fill("");
    await win.getByRole("textbox", { name: "Workflow name", exact: true }).click();
    await page.keyboard.type(NAME);
    check(
      "automator.document.name",
      (await win.getByRole("textbox", { name: "Workflow name", exact: true }).inputValue()) ===
        NAME,
      "typed",
    );
    const text = await add(page, win, "Get Specified Text");
    check("automator.action.add", await text.isVisible(), "a step");
    await text.getByRole("textbox").first().fill(`quiet harbour ${aAcct.name}`);
    await add(page, win, "Change Case of Text");
    const stepBtn = button(win, "Step");
    if (await stepBtn.isDisabled()) {
      const why =
        `${(await stepBtn.getAttribute("title")) ?? ""} ${(await stepBtn.getAttribute("aria-description")) ?? ""}`.trim();
      check(
        "automator.toolbar.step",
        why.length > 0,
        why ? `dimmed: ${why}` : "dimmed with steps in the workflow, no reason shown",
      );
    } else {
      await stepBtn.click();
      check(
        "automator.toolbar.step",
        !!(await until(async () => (await logText(win)).includes("Get Specified Text"), 8_000)),
        (await logText(win)).slice(0, 100),
      );
    }
    await until(async () => !(await logText(win)).includes("on the server…"), 10_000);
    const runMenu = await menuState(page, ["Workflow", "Run"]);
    await button(win, "Run").click();
    const ran = await until(async () => /Change Case of Text/.test(await logText(win)), 15_000);
    const upper = (await logText(win)).includes(`QUIET HARBOUR`);
    check("automator.toolbar.run", !!ran, (await logText(win)).slice(0, 120));
    check(
      "automator.run.text",
      !!ran && upper,
      upper ? "QUIET HARBOUR in the log" : (await logText(win)).slice(0, 160),
    );
    await button(win, "Log").click();
    check(
      "automator.view.log",
      (await logText(win)).includes("Get Specified Text"),
      "steps listed",
    );
    await bringToFront(page, win, APP);
    // A fresh marker: the menu's run must log this text upper-cased, so an earlier run's log cannot pass.
    const marker = `menu run ${Date.now().toString(36)}`;
    await text.getByRole("textbox").first().fill(marker);
    await choose(page, ["Workflow", "Run"]);
    const ranAgain = await until(
      async () => (await logText(win)).includes(marker.toUpperCase()),
      15_000,
    );
    check(
      "automator.menu.workflow.run",
      !runMenu.disabled && !!ranAgain,
      runMenu.disabled
        ? "dimmed with steps in the workflow"
        : ranAgain
          ? `ran: ${marker.toUpperCase()} in the log`
          : "no new run in the log",
    );
    const actionItems = (await menuItems(page, ["Action"])).map((item) => item.label);
    check(
      "automator.menu.action",
      ["Disable", "Delete", "Move Up", "Move Down"].every((name) => actionItems.includes(name)),
      actionItems.join("|"),
    );
    // Save, then reload and open it.
    const saved = page
      .waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === WORKFLOWS,
        { timeout: 10_000 },
      )
      .catch(() => null);
    await button(win, "Save Workflow").click();
    const reply = await saved;
    check(
      "automator.document.save",
      reply?.status() === 200 && named(await workflows(page)).includes(NAME),
      `HTTP ${reply?.status()}`,
    );
    // Run JavaScript: a value, then an endless loop stopped by its bound, and Stop.
    await button(win, "New Workflow").click();
    const empty = await until(
      async () => (await workflowPane(win).getByRole("group").count()) === 0,
      5_000,
    );
    check(
      "automator.document.new",
      !!empty &&
        (await win.getByRole("textbox", { name: "Workflow name", exact: true }).inputValue()) !==
          NAME,
      "untitled, no steps",
    );
    const js = await add(page, win, "Run JavaScript");
    await js.getByRole("textbox").first().fill("return 6 * 7 + ' from R3';");
    await button(win, "Run").click();
    check(
      "automator.js.result",
      !!(await until(async () => (await logText(win)).includes("42 from R3"), 15_000)),
      (await logText(win)).slice(0, 160),
    );
    await js.getByRole("textbox").first().fill("while (true) {}");
    const stopBefore = await button(win, "Stop").isDisabled();
    const t0 = Date.now();
    await button(win, "Run").click();
    const stopped = await until(
      async () =>
        /fuel|budget|time|limit|stopped|too long|deadline|exceeded/i.test(await logText(win)),
      20_000,
    );
    const took = Date.now() - t0;
    check(
      "automator.js.bounded",
      !!stopped && took < 20_000,
      `${Math.round(took / 1000)} s: ${(await logText(win)).slice(0, 200)}`,
    );
    await button(win, "Run").click();
    // The server runs a workflow as a whole: Stop is dimmed while idle and while a run is under way, its reason shown.
    const stopButton = button(win, "Stop");
    const stopWhy = ((await stopButton.getAttribute("title")) ?? "").trim();
    const stopRunning = await stopButton.isDisabled();
    await until(async () => !/Running the workflow/.test(await logText(win)), 20_000);
    check(
      "automator.toolbar.stop",
      stopBefore && stopRunning && stopWhy.length > 0,
      `dimmed when idle ${stopBefore}, while running ${stopRunning}; reason: ${stopWhy || "none shown"}`,
    );
    await button(win, "Runs").click();
    check(
      "automator.view.runs",
      !!(await until(
        async () =>
          (
            await win
              .getByRole("grid", { name: "Runs", exact: true })
              .innerText()
              .catch(() => "")
          ).includes(NAME),
        8_000,
      )),
      "the saved workflow's run listed",
    );
  });

  await guard("new chooser, Step and Stop, rename, library menu, toolbar", page, async () => {
    const clean = async () => {
      await button(win, "New Workflow").click();
      const dontSave = page.getByRole("button", { name: /Don.t Save/ }).first();
      if (await until(() => dontSave.isVisible(), 1_500)) await dontSave.click();
      await until(async () => (await workflowPane(win).getByRole("group").count()) === 0, 5_000);
    };
    await bringToFront(page, win, APP);
    await clean();
    await choose(page, ["File", "New"]);
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.waitFor({ timeout: 5_000 });
    const dimmed = await sheet
      .getByRole("radio")
      .evaluateAll(
        (radios) => radios.filter((radio) => radio.getAttribute("aria-disabled") === "true").length,
      );
    const types = await sheet.getByRole("radio").count();
    await sheet.getByRole("button", { name: "Choose" }).click();
    const sheetGone = await until(async () => (await sheet.count()) === 0, 4_000);
    const hears = await page.evaluate(
      () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    );
    check(
      "automator.menu.new-chooser",
      types === 8 && dimmed === (hears ? 2 : 3) && !!sheetGone,
      `${types} types, ${dimmed} dimmed`,
    );

    const text = await add(page, win, "Get Specified Text");
    await text.getByRole("textbox").first().fill("quiet harbour");
    await add(page, win, "Change Case of Text");
    await button(win, "Step").click();
    await until(async () => !(await button(win, "Stop").isDisabled()), 8_000);
    await until(async () => (await logText(win)).includes("Get Specified Text completed"), 8_000);
    await button(win, "Stop").click();
    const said = await until(
      async () => (await logText(win)).includes("Stopped before Change Case of Text"),
      4_000,
    );
    check("automator.stepped-stop", !!said, (await logText(win)).slice(0, 160));

    await button(win, "Step").click();
    await until(async () => (await logText(win)).includes("Get Specified Text completed"), 8_000);
    await until(async () => !(await button(win, "Step").isDisabled()), 8_000);
    await button(win, "Step").click();
    const upper = await until(async () => (await logText(win)).includes("QUIET HARBOUR"), 8_000);
    check("automator.stepped-run", !!upper, (await logText(win)).slice(0, 200));

    const RENAMED = `Named ${aAcct.name}`;
    await text.getByText("Get Specified Text", { exact: true }).click();
    await choose(page, ["Action", "Rename Action…"]);
    const renameSheet = page.getByRole("dialog", { name: /Rename the action/ });
    await renameSheet.getByRole("textbox").fill("Say it");
    await renameSheet.getByRole("button", { name: "Rename" }).click();
    await win.getByRole("textbox", { name: "Workflow name", exact: true }).fill(RENAMED);
    await button(win, "Save Workflow").click();
    const kept = await until(
      async () =>
        (await workflows(page)).library?.workflows?.find((each) => each.name === RENAMED)?.steps[0]
          ?.params?.step_name === "Say it",
      8_000,
    );
    await button(win, "Run").click();
    const ranNamed = await until(async () => /Say it completed/.test(await logText(win)), 10_000);
    check(
      "automator.rename-action",
      !!kept && !!ranNamed,
      `kept ${!!kept}: ${(await logText(win)).slice(-160)}`,
    );

    await clean();
    await actionsList(win)
      .getByText("New Note", { exact: true })
      .first()
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Workflow" }).click();
    const added = await until(
      async () =>
        (await workflowPane(win).getByRole("group", { name: "New Note", exact: true }).count()) ===
        1,
      4_000,
    );
    check("automator.library-menu", !!added, added ? "a step" : "no step");

    await choose(page, ["View", "Customize Toolbar…"]);
    const custom = page.getByRole("dialog", { name: /items the toolbar shows/ });
    await custom.getByRole("checkbox", { name: "Media" }).click();
    await custom.getByRole("button", { name: "Done" }).click();
    const gone = await until(
      async () => (await win.getByRole("button", { name: "Media", exact: true }).count()) === 0,
      3_000,
    );
    await page.waitForTimeout(1_500);
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    win = await open(page);
    const stayedAway =
      (await win.getByRole("button", { name: "Media", exact: true }).count()) === 0;
    await choose(page, ["View", "Customize Toolbar…"]);
    await custom.getByRole("checkbox", { name: "Media" }).click();
    await custom.getByRole("button", { name: "Done" }).click();
    check(
      "automator.customize-toolbar",
      !!gone && stayedAway,
      `gone ${!!gone}, after a reload ${stayedAway}`,
    );
  });

  await guard("open, delete, persistence, isolation", page, async () => {
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    win = await open(page);
    const openBox = win.getByRole("combobox", { name: "Open Workflow", exact: true });
    await openBox.click();
    const opt = page.getByRole("option", { name: NAME });
    const offered = await until(async () => (await opt.count()) > 0, 5_000);
    if (offered) await opt.first().click();
    // The steps the window kept from before the reload are unsaved, and it asks about them first.
    const dontSave = page.getByRole("button", { name: /Don.t Save/ }).first();
    if (await until(() => dontSave.isVisible(), 1_500)) await dontSave.click();
    const steps = await until(
      async () =>
        (await workflowPane(win).getByRole("group", { name: "Change Case of Text" }).count()) > 0,
      8_000,
    );
    check(
      "automator.document.open",
      !!offered && !!steps,
      `offered ${!!offered}, its steps shown ${!!steps}`,
    );
    check(
      "automator.persist.reload",
      !!offered && !!steps && named(await workflows(page)).includes(NAME),
      "kept",
    );
    const b = await person("B", { create: bAcct });
    check(
      "automator.isolation",
      !named(await workflows(b)).includes(NAME),
      JSON.stringify(named(await workflows(b))),
    );
    await b.context().close();
    // A second workflow to delete (the first is kept for the restart).
    const DOOMED = `${NAME} to delete`;
    const offeredByOpen = async () => {
      await openBox.click();
      // The pop-up's list mounts as it opens. Escape only once it has opened and taken the keyboard: pressed in
      // the instant it is still opening, Escape finds nothing to close and the open list then covers the toolbar.
      const opened = await page
        .getByRole("option")
        .filter({ visible: true })
        .first()
        .waitFor({ timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      if (!opened)
        throw new Error(
          "the Open Workflow pop-up did not open (it always lists the kept workflow)",
        );
      await until(
        () =>
          page.evaluate(
            () => !!document.activeElement?.closest('[role="listbox"], [role="option"]'),
          ),
        2_000,
      );
      const n = await page.getByRole("option", { name: DOOMED, exact: true }).count();
      await page.keyboard.press("Escape");
      const listOpen = () => page.getByRole("option").filter({ visible: true }).count();
      if (!(await until(async () => (await listOpen()) === 0, 2_000))) {
        await page.keyboard.press("Escape");
        if (!(await until(async () => (await listOpen()) === 0, 2_000)))
          throw new Error("the Open Workflow pop-up stayed open after Escape twice");
      }
      return n > 0;
    };
    await button(win, "New Workflow").click();
    await win.getByRole("textbox", { name: "Workflow name", exact: true }).fill(DOOMED);
    await add(page, win, "Get Specified Text");
    await button(win, "Save Workflow").click();
    const created = await until(async () => named(await workflows(page)).includes(DOOMED), 8_000);
    const listedBefore = created ? await offeredByOpen() : false;
    await button(win, "Delete Workflow").click();
    const confirm = page.getByRole("dialog").or(page.getByRole("alertdialog")).last();
    if (await until(() => confirm.isVisible(), 2_000))
      await confirm
        .getByRole("button", { name: /^Delete/ })
        .first()
        .click();
    const gone =
      created && (await until(async () => !named(await workflows(page)).includes(DOOMED), 8_000));
    const listedAfter = await offeredByOpen();
    check(
      "automator.document.delete",
      !!created &&
        listedBefore &&
        !!gone &&
        !listedAfter &&
        named(await workflows(page)).includes(NAME),
      `saved ${!!created}, offered before ${listedBefore}; gone from the server ${!!gone}, from Open Workflow ${!listedAfter}; the kept workflow remains ${named(await workflows(page)).includes(NAME)}`,
    );
  });

  win = await standardChecks({
    page,
    check,
    problem,
    guard,
    slug: "automator",
    App: APP,
    menus: MENUS,
    open: () => open(page),
    win,
    windowItem: "Automator",
  });

  if (opts.explore > 0) {
    const g = await person("explorer");
    await install(g, ["automator"]);
    await open(g);
    const r = await explore(g, {
      app: APP,
      windows: g.locator(".mac-window.mac-automator"),
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
