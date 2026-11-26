#!/usr/bin/env node

// Help Viewer census (R3, round 3 brief section 5): every entry of the table of contents and every topic inside each
// section, search and its results, Back and Forward by button and by the Go menu, hiding and showing the table of
// contents and dragging its divider, the Share menu's services, the last place kept per person by the server
// (/api/help-viewer/place) across a reload, a real same-root restart and against a second account, Go > Applications,
// the shared menus and the window's chrome, each with real input and an asserted outcome.
//
//   node e2e/help-viewer-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]
//        [--phase all|write|restart-check --state <file.json>] [--explore <seconds>] [--seed <n>] [--headed]
//   node e2e/help-viewer-census-journey.mjs --emit-census <help-viewer.tsv>

import { chooseMenu, editRowsOnField } from "./media-census-kit.mjs";
import {
  api,
  bringToFront,
  census,
  choose,
  explore,
  goApplicationsChecks,
  goRows,
  newAccount,
  openApp,
  R,
  standardChecks,
  standardRows,
  until,
} from "./r3-census-kit.mjs";

const FILE = "help-viewer-census-journey.mjs";
const W = "Help Viewer window";
const MENUS = ["Help Viewer", "File", "Edit", "View", "Go", "Window", "Help"];
const ENTRIES = [
  "Welcome",
  "Basics",
  "Apps",
  "Customize your Mac",
  "Files and folders",
  "Apple ID and iCloud",
  "Use Apple devices together",
  "Music, books, news, and more",
  "Privacy and security",
  "Mac hardware",
  "Resources for your Mac",
  "Resources for your Apple devices",
  "Macalicious Desktop Help",
];
const SERVICES = ["Mail", "Messages", "Notes", "Reminders", "AirDrop"];
const slug = (t) => t.toLowerCase().replace(/\W+/g, "-");
const spotlightNotes = async (page) => {
  await openApp(page, "Notes", "mac-notes");
};

const rows = [
  R(
    "help-viewer.window.open",
    W,
    "app",
    "Help Viewer",
    "Spotlight: type Help Viewer, Return",
    "the macOS User Guide opens at Welcome",
  ),
  ...ENTRIES.map((e) =>
    R(
      `help-viewer.toc.${slug(e)}`,
      W,
      "gridcell",
      e,
      `click ${e} in the table of contents`,
      `the page of ${e} shows`,
    ),
  ),
  ...ENTRIES.map((e) =>
    R(
      `help-viewer.toc-row.${slug(e)}`,
      W,
      "row",
      e,
      `the row of ${e}`,
      "selected when its page shows",
    ),
  ),
  R(
    "help-viewer.topics.all",
    W,
    "treeitem/row",
    "/.+/ (topics inside the sections)",
    "expand each section, click each topic",
    "every topic's page shows its title",
    "none",
    "kind: topic rows inside a section, revealed by its disclosure triangle; every one clicked",
  ),
  R(
    "help-viewer.search",
    W,
    "searchbox",
    "Search",
    "type Wi-Fi",
    "results from the guide and other apps' guides",
  ),
  R(
    "help-viewer.search.result",
    W,
    "link/button",
    "a result",
    "click the first result",
    "its topic page shows",
  ),
  R("help-viewer.back", W, "button", "Back", "after two pages, click", "the previous page"),
  R("help-viewer.forward", W, "button", "Forward", "after Back, click", "the next page"),
  R(
    "help-viewer.toc.hide",
    W,
    "button",
    "Hide Table of Contents",
    "click",
    "the table of contents hides",
  ),
  R(
    "help-viewer.toc.show",
    W,
    "button",
    "Table of Contents",
    "click",
    "the table of contents shows and hides again",
  ),
  R(
    "help-viewer.toc.divider",
    W,
    "separator",
    "Resize the table of contents",
    "drag the divider right",
    "the table of contents gets wider",
  ),
  R("help-viewer.share", W, "button", "Share", "click", "the Share menu opens with its services"),
  ...SERVICES.map((s) =>
    R(
      `help-viewer.share.${slug(s)}`,
      "menu: Share",
      "menuitem",
      s,
      `look at ${s}`,
      s === "AirDrop"
        ? "dimmed; the row's help tag says a web page can't reach nearby devices"
        : `${s} comes forward with the page's link`,
    ),
  ),
  R(
    "help-viewer.share.reason",
    "menu: Share",
    "menuitem",
    "Copy Link",
    "open Share",
    "the page's address can be copied: the row is on, above the services",
  ),
  R(
    "help-viewer.link.copy",
    W,
    "menuitem",
    "Copy Link",
    "right-click a link on Basics, Copy Link; read the clipboard",
    "the clipboard holds the desktop's address with #help=use-the-dock",
  ),
  R(
    "help-viewer.link.window",
    W,
    "menuitem",
    "Open in New Window",
    "right-click a link, Open in New Window",
    "another window shows the link's page; the first stays on Basics",
  ),
  R(
    "help-viewer.feedback",
    W,
    "button",
    "Yes",
    "answer Was this page helpful?",
    "the reply says the answer stays with the desktop",
  ),
  R(
    "help-viewer.link.pane",
    W,
    "button",
    "Open Dock preferences",
    "click it on Use the Dock",
    "System Preferences comes forward on Dock",
  ),
  R(
    "help-viewer.file.new-window",
    "menu: File",
    "menuitem",
    "New Window",
    "choose it",
    "another Help Viewer window opens",
  ),
  R(
    "help-viewer.guide.book",
    W,
    "combobox",
    "Book: Notes Help",
    "choose it",
    "the guide's page shows, with its topics",
  ),
  R(
    "help-viewer.link.app",
    W,
    "button",
    "Open Notes",
    "click it on a topic of the guide",
    "Notes comes forward",
  ),
  R(
    "help-viewer.guide.help-row",
    "menu: Help",
    "menuitem",
    "Notes Help",
    "in Notes, choose it",
    "Help Viewer comes forward on the guide",
  ),
  R(
    "help-viewer.drag.notes",
    W,
    "link",
    "a topic link",
    "drag it into a new note",
    "the note holds a link to the topic's address",
  ),
  R(
    "help-viewer.view.toolbar",
    "menu: View",
    "menuitem",
    "Hide Toolbar, Show Toolbar",
    "choose each",
    "the toolbar goes and comes back",
  ),
  R(
    "help-viewer.view.customize",
    "menu: View",
    "menuitem",
    "Customize Toolbar…",
    "choose it, untick Share, tick it again, Done",
    "the Share button goes and comes back",
  ),
  R(
    "help-viewer.link.follow",
    W,
    "page",
    "#help=use-the-dock",
    "go to the desktop's address with that fragment",
    "Help Viewer shows the page and the address loses the fragment",
  ),
  R(
    "help-viewer.place.server",
    W,
    "page",
    "last place",
    "open a topic",
    "the server keeps the person's place",
    "restart",
  ),
  R(
    "help-viewer.place.reload",
    W,
    "page",
    "last place",
    "reload, open Help Viewer",
    "it opens where the person was",
    "reload",
  ),
  R(
    "help-viewer.place.isolation",
    W,
    "page",
    "last place",
    "a second account opens Help Viewer",
    "it opens at Welcome",
  ),
  R(
    "help-viewer.place.restart",
    W,
    "page",
    "last place",
    "after a real same-root restart, sign in, open Help Viewer",
    "the same place",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "help-viewer.place.isolation-restart",
    W,
    "page",
    "last place",
    "after the restart, the second account",
    "still at Welcome",
    "restart",
    "",
    "restart-check",
  ),
  ...goRows("help-viewer"),
  ...standardRows("help-viewer", "Help Viewer", {
    menus: MENUS,
    windowItem: "Help Viewer",
  }),
  R(
    "help-viewer.edit.field",
    W,
    "menuitem",
    "Undo, Redo, Cut, Copy, Paste, Select All",
    "type in Search, then each of Select All, Cut, Paste, Select All, Copy, Paste, Undo, Redo from the Edit menu",
    "each acts on the search field's text, read back from the field",
  ),
  R(
    "help-viewer.edit.page",
    W,
    "menuitem",
    "Select All, Copy",
    "click the page, Edit > Select All, Edit > Copy; read the clipboard",
    "the page's words are selected, and the clipboard holds them",
  ),
];

const S = census("Help Viewer", { id: "help-viewer", file: FILE, rows });

await S.run(async ({ person, check, opts, state, saveState, problem, note, guard }) => {
  const place = async (page) => (await api(page, "GET", "/api/help-viewer/place")).json;
  const open = async (page) => {
    const w = await openApp(page, "Help Viewer", "mac-help-viewer");
    await w.getByRole("searchbox", { name: "Search" }).waitFor({ timeout: 15_000 });
    await until(async () => (await w.getAttribute("aria-busy")) !== "true", 10_000);
    return w;
  };
  const pageText = async (win) =>
    (
      await win
        .locator(".mac-help-viewer-pane")
        .innerText()
        .catch(() => "")
    ).replace(/\s+/g, " ");
  /** The title of the page shown (its h1): a topic's or section's title, "macOS User Guide" on the welcome page. */
  const heading = async (win) =>
    (
      (await win
        .locator(".mac-help-viewer-pane h1")
        .first()
        .innerText()
        .catch(() => "")) ?? ""
    ).trim();
  const toc = (win) =>
    win
      .getByRole("grid", { name: "Table of Contents" })
      .or(win.getByRole("treegrid", { name: "Table of Contents" }))
      .first();

  if (opts.phase === "restart-check") {
    const a = await person("A", { signIn: state.a });
    const w = await open(a);
    const shows = await until(async () => (await pageText(w)).includes(state.topic), 10_000);
    check(
      "help-viewer.place.restart",
      !!shows && JSON.stringify(await place(a)) === JSON.stringify(state.place),
      `${shows ? "opens at" : "does not open at"} ${state.topic}`,
    );
    const b = await person("B", { signIn: state.b });
    const wb = await open(b);
    const welcome = await until(
      async () => (await pageText(wb)).includes("for macOS 10.15"),
      10_000,
    );
    check(
      "help-viewer.place.isolation-restart",
      !!welcome && !(await pageText(wb)).includes(state.topic),
      (await pageText(wb)).slice(0, 80),
    );
    return;
  }

  const aAcct = newAccount("helpa", opts.browserName);
  const bAcct = newAccount("helpb", opts.browserName);
  const page = await person("A", { create: aAcct });
  saveState({ a: aAcct, b: bAcct });
  let win = await open(page);
  const ensure = async () => {
    if ((await win.count()) > 0 && (await win.isVisible().catch(() => false)))
      await bringToFront(page, win, "Help Viewer");
    else win = await open(page);
  };
  check(
    "help-viewer.window.open",
    /Welcome|macOS User Guide/.test(await pageText(win)),
    (await pageText(win)).slice(0, 80),
  );

  await guard("table of contents and topics", page, async () => {
    for (const e of ENTRIES) {
      const cell = toc(win).getByRole("gridcell", { name: e, exact: true }).first();
      await cell.click();
      const shown = await until(
        async () => (await pageText(win)).includes(e === "Welcome" ? "macOS User Guide" : e),
        8_000,
      );
      check(`help-viewer.toc.${slug(e)}`, !!shown, (await pageText(win)).slice(0, 80));
      const row = toc(win).getByRole("row", { name: e, exact: true }).first();
      check(
        `help-viewer.toc-row.${slug(e)}`,
        (await row.getAttribute("aria-selected")) === "true",
        `selected ${await row.getAttribute("aria-selected")}`,
      );
    }
    // Every topic inside every section: expand with the keyboard (Right) on the section's row, click each child.
    let topics = 0;
    const failed = [];
    for (const e of ENTRIES) {
      const row = toc(win).getByRole("row", { name: e, exact: true }).first();
      if ((await row.getAttribute("aria-expanded")) === null) continue;
      if ((await row.getAttribute("aria-expanded")) !== "true") {
        await row.click();
        await page.keyboard.press("ArrowRight");
        await until(async () => (await row.getAttribute("aria-expanded")) === "true", 3_000);
      }
      const level = Number((await row.getAttribute("aria-level")) ?? "1");
      const children = await toc(win)
        .getByRole("row")
        .evaluateAll((rs, l) => {
          const out = [];
          let inside = false;
          for (const r of rs) {
            const lv = Number(r.getAttribute("aria-level") ?? "1");
            if (r.getAttribute("data-r3") === "x") inside = true;
            if (lv <= l) inside = false;
            if (inside && lv === l + 1) out.push(r.textContent.trim());
          }
          return out;
        }, level);
      void children;
      const names = await toc(win)
        .getByRole("row")
        .evaluateAll(
          (rs, args) => {
            const [name, l] = args;
            const out = [];
            let inside = false;
            for (const r of rs) {
              const lv = Number(r.getAttribute("aria-level") ?? "1");
              const t = (r.textContent ?? "").trim();
              if (lv === l && t === name) {
                inside = true;
                continue;
              }
              if (inside && lv <= l) break;
              if (inside && lv === l + 1) out.push(t);
            }
            return out;
          },
          [e, level],
        );
      for (const t of names) {
        await toc(win).getByRole("row", { name: t, exact: true }).first().click();
        const ok = await until(async () => (await pageText(win)).includes(t), 8_000);
        topics += 1;
        if (!ok) failed.push(t);
      }
    }
    check(
      "help-viewer.topics.all",
      topics > 0 && failed.length === 0,
      `${topics} topics opened${failed.length ? `; not shown: ${failed.join(", ")}` : ""}`,
    );
  });

  await guard("search, history, sidebar, share", page, async () => {
    await ensure();
    const field = win.getByRole("searchbox", { name: "Search" });
    await field.click();
    await page.keyboard.type("Wi-Fi", { delay: 20 });
    await page.keyboard.press("Enter");
    const results = win
      .locator(".mac-help-viewer-pane")
      .getByRole("link")
      .or(win.locator(".mac-help-viewer-pane").getByRole("button"));
    const got = await until(async () => (await results.count()) > 0, 10_000);
    check("help-viewer.search", !!got, `${await results.count()} results`);
    const first = (
      (await results
        .first()
        .innerText()
        .catch(() => "")) ?? ""
    )
      .split("\n")[0]
      .trim();
    await results.first().click();
    check(
      "help-viewer.search.result",
      !!first && !!(await until(async () => (await pageText(win)).includes(first), 8_000)),
      first,
    );
    await page.keyboard.press("Escape");
    await toc(win)
      .getByRole("gridcell", { name: "Basics", exact: true })
      .first()
      .click()
      .catch(() => {});
    await until(async () => (await heading(win)) === "Basics", 8_000);
    await toc(win).getByRole("gridcell", { name: "Apps", exact: true }).first().click();
    await until(async () => (await heading(win)) === "Apps", 8_000);
    await win.getByRole("button", { name: "Back", exact: true }).click();
    check(
      "help-viewer.back",
      !!(await until(async () => (await heading(win)) === "Basics", 8_000)),
      `page: ${await heading(win)}`,
    );
    await win.getByRole("button", { name: "Forward", exact: true }).click();
    check(
      "help-viewer.forward",
      !!(await until(async () => (await heading(win)) === "Apps", 8_000)),
      `page: ${await heading(win)}`,
    );
    await ensure();
    await choose(page, ["Go", "Back"]);
    check(
      "help-viewer.menu.go.back",
      !!(await until(async () => (await heading(win)) === "Basics", 8_000)),
      `page: ${await heading(win)}`,
    );
    await choose(page, ["Go", "Forward"]);
    check(
      "help-viewer.menu.go.forward",
      !!(await until(async () => (await heading(win)) === "Apps", 8_000)),
      `page: ${await heading(win)}`,
    );
    const onScreen = await page
      .locator('[role="menu"]')
      .evaluateAll((ms) =>
        ms
          .filter((m) => m.getBoundingClientRect().width > 0)
          .map(
            (m) =>
              `opacity ${getComputedStyle(m).opacity}: ${(m.textContent ?? "").replace(/\s+/g, " ").slice(0, 40)}`,
          ),
      );
    note(`menus on screen after Go > Forward: ${onScreen.join(" | ") || "none"}`);
    // Sidebar: hide, show, divider.
    await win.getByRole("button", { name: "Hide Table of Contents" }).click();
    const hidden = await until(
      async () => (await toc(win).count()) === 0 || !(await toc(win).isVisible()),
      5_000,
    );
    check("help-viewer.toc.hide", !!hidden, hidden ? "hidden" : "still shown");
    await win
      .getByRole("button", { name: /^(Table of Contents|Show Table of Contents)$/ })
      .first()
      .click();
    const shown = await until(async () => toc(win).isVisible(), 5_000);
    check("help-viewer.toc.show", !!shown, shown ? "shown again" : "still hidden");
    const divider = win.getByRole("separator", { name: "Resize the table of contents" }).first();
    const w0 = (await toc(win).boundingBox())?.width ?? 0;
    const box = await divider.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    const w1 = (await toc(win).boundingBox())?.width ?? 0;
    check("help-viewer.toc.divider", w1 > w0 + 20, `${Math.round(w0)} -> ${Math.round(w1)}`);
    // Share: the services must do what they say, or show why not. The Share menu is the visible menu that offers the
    // services: a menu-bar menu chosen just before can still be on screen while it mounts.
    const shareMenu = () =>
      page
        .locator('[role="menu"]:visible')
        .filter({ has: page.getByRole("menuitem", { name: /^Mail\b/ }) })
        .last();
    await win.getByRole("button", { name: "Share" }).click();
    const menu = shareMenu();
    const opened = await until(() => menu.isVisible(), 5_000);
    const items = opened
      ? (await menu.getByRole("menuitem").allInnerTexts()).map((t) => t.trim())
      : [
          `no menu offering the services; menus on screen: ${(await page.locator('[role="menu"]:visible').allInnerTexts()).map((t) => t.replace(/\s+/g, " ")).join(" / ")}`,
        ];
    check(
      "help-viewer.share",
      !!opened && SERVICES.every((s) => items.some((i) => i.startsWith(s))),
      items.join("|"),
    );
    check(
      "help-viewer.share.reason",
      items.some((i) => i === "Copy Link"),
      items.join("|"),
    );
    await page.keyboard.press("Escape");
    for (const s of SERVICES) {
      await ensure();
      await win.getByRole("button", { name: "Share" }).click();
      const m = shareMenu();
      await m.waitFor({ timeout: 5_000 });
      const item = m.getByRole("menuitem", { name: new RegExp(`^${s}`) }).first();
      const disabled = (await item.getAttribute("aria-disabled")) === "true";
      const text = (await item.getAttribute("title")) ?? "";
      if (disabled) {
        await page.keyboard.press("Escape");
        check(
          `help-viewer.share.${slug(s)}`,
          /can.t/i.test(text),
          `dimmed; the row says: ${text.slice(0, 120)}`,
        );
        continue;
      }
      const topic = (
        (await win
          .locator(".mac-help-viewer-pane h1, .mac-help-viewer-pane h2")
          .first()
          .innerText()
          .catch(() => "")) ?? ""
      ).trim();
      await item.click();
      // Delivered: the receiving app comes forward (the menu bar names it) and its new window carries the topic.
      const went = await until(async () => {
        const app = (
          (
            await page
              .getByRole("menubar")
              .first()
              .getByRole("menuitem")
              .allInnerTexts()
              .catch(() => [])
          )[1] ?? ""
        ).trim();
        if (app !== s) return false;
        return (
          (await page
            .locator('.mac-window[data-window-state="key"]')
            .filter({ hasText: topic || "Help" })
            .count()) > 0
        );
      }, 6_000);
      check(
        `help-viewer.share.${slug(s)}`,
        !!went,
        went
          ? `${s} came forward with "${topic}"`
          : `choosing ${s} closed the menu; ${s} did not receive "${topic}"`,
      );
      if (went) await page.keyboard.press("Control+Alt+KeyW");
    }
  });

  await guard("links, windows, guides, toolbar", page, async () => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.keyboard.press("Escape");
    await until(async () => (await page.locator('[role="menu"]:visible').count()) === 0, 3_000);
    await ensure();
    const front = async () =>
      (
        (
          await page
            .getByRole("menubar")
            .first()
            .getByRole("menuitem")
            .allInnerTexts()
            .catch(() => [])
        )[1] ?? ""
      ).trim();
    const others = page.locator('.mac-managed-window[data-window-id^="help-viewer:"]');
    const closeOthers = async () => {
      while ((await others.count()) > 0) {
        await others.first().getByRole("button", { name: "Close" }).click();
        await page.waitForTimeout(400);
      }
    };
    await toc(win).getByRole("gridcell", { name: "Basics", exact: true }).first().click();
    const link = win.locator("article").getByRole("link", { name: "Use the Dock" });
    await link.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Copy Link" }).click();
    let clipboard = "";
    const copied = await until(async () => {
      clipboard = await page.evaluate(() =>
        navigator.clipboard.readText().catch((e) => `refused: ${e}`),
      );
      return clipboard.endsWith("#help=use-the-dock");
    }, 5_000);
    check("help-viewer.link.copy", !!copied, clipboard.slice(0, 120));

    await link.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Open in New Window" }).click();
    const second = others.first();
    const opened = await until(
      async () =>
        (await second
          .locator("h1")
          .first()
          .innerText()
          .catch(() => "")) === "Use the Dock",
      8_000,
    );
    const firstStays = (await win.locator("article h1").first().innerText()) === "Basics";
    check(
      "help-viewer.link.window",
      !!opened && firstStays,
      `opened ${!!opened}, first stays ${firstStays}`,
    );

    await second.getByRole("button", { name: "Yes" }).click();
    const reply = await second.getByRole("status").last().innerText();
    check("help-viewer.feedback", /not sent anywhere/.test(reply), reply);

    await second.getByRole("button", { name: "Open Dock preferences" }).click();
    const pane = await until(async () => (await front()) === "System Preferences", 8_000);
    const dock = await until(
      async () =>
        (await page.locator('.mac-window[data-window-state="key"]').innerText()).includes("Dock"),
      5_000,
    );
    check(
      "help-viewer.link.pane",
      !!pane && !!dock,
      `front ${await front()}, Dock shown ${!!dock}`,
    );
    await page.keyboard.press("Control+Alt+KeyW");
    await closeOthers();

    await ensure();
    await choose(page, ["File", "New Window"]);
    check(
      "help-viewer.file.new-window",
      !!(await until(async () => (await others.count()) === 1, 8_000)),
      `${await others.count()} more window`,
    );
    await closeOthers();

    await ensure();
    await win.getByRole("combobox", { name: "Book" }).click();
    await page.getByRole("option", { name: "Notes Help" }).click();
    const guide = await until(
      async () =>
        (await win
          .locator("article h1")
          .first()
          .innerText()
          .catch(() => "")) === "Notes Help",
      5_000,
    );
    const topic = win.locator("article").getByRole("link", { name: "Write a note" });
    check("help-viewer.guide.book", !!guide && (await topic.isVisible()), `guide shown ${!!guide}`);
    await topic.click();
    await win.getByRole("button", { name: "Open Notes" }).click();
    check(
      "help-viewer.link.app",
      !!(await until(async () => (await front()) === "Notes", 8_000)),
      `front ${await front()}`,
    );

    await choose(page, ["Help", "Notes Help"]);
    const onGuide = await until(
      async () =>
        (await front()) === "Help Viewer" &&
        (await win
          .locator("article h1")
          .first()
          .innerText()
          .catch(() => "")) === "Notes Help",
      8_000,
    );
    check("help-viewer.guide.help-row", !!onGuide, `front ${await front()}`);

    // The viewer moves aside to show the note under it; the link stays in view.
    await ensure();
    await spotlightNotes(page);
    await choose(page, ["File", "New Note"]);
    const note = page
      .locator('.mac-managed-window[data-window-id="notes"] .mac-notes-text:visible')
      .first();
    await note.waitFor({ timeout: 5_000 });
    await ensure();
    const bar = (await win.locator("[data-window-drag-region]").first().boundingBox()) ?? {
      x: 0,
      y: 0,
    };
    await page.mouse.move(bar.x + 300, bar.y + 8);
    await page.mouse.down();
    await page.mouse.move(bar.x + 300 + 520, bar.y + 8, { steps: 8 });
    await page.mouse.up();
    const from = await topic.boundingBox();
    const to = await note.boundingBox();
    if (from && to) {
      await page.mouse.move(from.x + 10, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + 20, to.y + 30, { steps: 12 });
      await page.mouse.up();
    }
    const dropped = await until(
      async () => (await note.evaluate((element) => element.innerHTML)).includes("#help="),
      4_000,
    );
    check(
      "help-viewer.drag.notes",
      !!dropped,
      (await note.evaluate((element) => element.innerHTML)).slice(0, 160),
    );

    // Back where it was: the standard window rows need room around the window.
    await ensure();
    const moved = (await win.locator("[data-window-drag-region]").first().boundingBox()) ?? bar;
    await page.mouse.move(moved.x + 300, moved.y + 8);
    await page.mouse.down();
    await page.mouse.move(moved.x + 300 - 520, moved.y + 8, { steps: 8 });
    await page.mouse.up();

    await ensure();
    await choose(page, ["View", "Hide Toolbar"]);
    const search = win.getByRole("searchbox", { name: "Search" });
    const gone = await until(async () => (await search.count()) === 0, 3_000);
    await choose(page, ["View", "Show Toolbar"]);
    const back = await until(async () => (await search.count()) === 1, 3_000);
    check("help-viewer.view.toolbar", !!gone && !!back, `gone ${!!gone}, back ${!!back}`);

    await choose(page, ["View", "Customize Toolbar…"]);
    const share = win.getByRole("button", { name: "Share" });
    const box = page.getByRole("checkbox", { name: "Share" });
    await box.click();
    const hidden = await until(async () => (await share.count()) === 0, 3_000);
    await box.click();
    const shown = await until(async () => (await share.count()) === 1, 3_000);
    await page.getByRole("button", { name: "Done" }).click();
    check(
      "help-viewer.view.customize",
      !!hidden && !!shown,
      `hidden ${!!hidden}, shown ${!!shown}`,
    );

    await page.evaluate(() => {
      location.hash = "#help=use-the-dock";
    });
    const followed = await until(
      async () =>
        (await win
          .locator("article h1")
          .first()
          .innerText()
          .catch(() => "")) === "Use the Dock",
      8_000,
    );
    const clean = await page.evaluate(() => location.hash === "");
    check("help-viewer.link.follow", !!followed && clean, `page ${!!followed}, clean ${clean}`);
  });

  await guard("place kept", page, async () => {
    await ensure();
    await toc(win)
      .getByRole("gridcell", { name: "Privacy and security", exact: true })
      .first()
      .click();
    await until(async () => (await pageText(win)).includes("Privacy and security"), 8_000);
    await page.waitForTimeout(1500);
    const p = await place(page);
    check(
      "help-viewer.place.server",
      !!p && JSON.stringify(p).toLowerCase().includes("privacy"),
      JSON.stringify(p).slice(0, 160),
    );
    saveState({ place: p, topic: "Privacy and security" });
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    win = await open(page);
    check(
      "help-viewer.place.reload",
      !!(await until(async () => (await pageText(win)).includes("Privacy and security"), 10_000)),
      (await pageText(win)).slice(0, 80),
    );
    const b = await person("B", { create: bAcct });
    const wb = await open(b);
    const welcome = await until(
      async () => (await pageText(wb)).includes("for macOS 10.15"),
      10_000,
    );
    check(
      "help-viewer.place.isolation",
      !!welcome && !(await pageText(wb)).includes("Privacy and security"),
      (await pageText(wb)).slice(0, 80),
    );
    await b.context().close();
  });

  await guard("Edit menu on the field and the page", page, async () => {
    await ensure();
    const edited = await editRowsOnField(
      page,
      win.getByRole("searchbox", { name: "Search" }),
      win.getByRole("alert").filter({ hasText: "Command-V" }),
    );
    check("help-viewer.edit.field", edited.ok, edited.detail);
    await win.locator(".mac-help-viewer-pane h1").first().click();
    await chooseMenu(page, "Edit", "Select All");
    const words = await until(
      async () =>
        await page.evaluate(() => (document.getSelection()?.toString() ?? "").length > 40),
      5_000,
    );
    // The keyboard comes back to the page once the menu has faded out (`menu.css`: 0.25 s).
    await page.waitForTimeout(600);
    await chooseMenu(page, "Edit", "Copy");
    const shown = (await heading(win)) || "macOS User Guide";
    const copied = await until(
      async () =>
        (await page.evaluate(() => navigator.clipboard.readText().catch(() => ""))).includes(shown),
      5_000,
    );
    check(
      "help-viewer.edit.page",
      !!words && !!copied,
      `selected ${!!words}, clipboard holds "${shown}" ${!!copied}`,
    );
  });

  await guard("Go > Applications", page, () =>
    goApplicationsChecks(page, check, "help-viewer", ensure),
  );
  win = await standardChecks({
    page,
    check,
    problem,
    guard,
    slug: "help-viewer",
    App: "Help Viewer",
    menus: MENUS,
    open: () => open(page),
    win,
    windowItem: "Help Viewer",
  });

  if (opts.explore > 0) {
    const g = await person("explorer");
    await open(g);
    const r = await explore(g, {
      app: "Help Viewer",
      windows: g.locator(".mac-window.mac-help-viewer"),
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
