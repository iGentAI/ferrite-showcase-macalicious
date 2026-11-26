#!/usr/bin/env node

// App Store census (R5, round 3): one `ok`/`FAIL` line per census id of the App Store, real input only, against
// `ferrite dev --fresh` serving the packed site, signed in as a real account made at the login window. Every
// section of the sidebar, every category, search, Get and Install, Open, Sign In, the account page's Uninstall and
// the Store menu; the account's library is kept on the server (`/api/app-store/library`).
//
// Phases: `write` drives every control and leaves a state file; `restart-check` runs after a real same-root
// restart of `ferrite dev` and checks that the apps got are still in the library and the Dock, and that a second
// account has none of them.
//
//   node e2e/app-store-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import {
  accountFor,
  api,
  appWindow,
  census,
  chooseMenu,
  closeAppWindow,
  crawlMenus,
  dockTile,
  launchBrowser,
  loadState,
  openApp,
  options,
  person,
  reloadDesktop,
  saveState,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("app-store", opts);
const LIBRARY = "/api/app-store/library";
const SECTIONS = [
  "Discover",
  "Arcade",
  "Create",
  "Work",
  "Play",
  "Develop",
  "Categories",
  "Updates",
];
const CATEGORIES = [
  "Productivity",
  "Internet",
  "Entertainment",
  "Creativity",
  "Utilities",
  "System",
  "Games",
];
/** Apps the store sells (not preinstalled), first, middle and last of its list, got with Get and Install. */
const GOT = ["Automator", "Dictionary", "Voice Memos"];
/** Installed apps opened from the store: first, middle and last of the Updates list. */
const OPENED = ["About This Mac", "Maps", "TV"];
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const store = (page) => appWindow(page, "App Store");
const installed = async (page) => (await api(page, "GET", LIBRARY)).json?.installed ?? null;
const section = (page, name) =>
  store(page).getByRole("tree", { name: "Sections" }).getByRole("treeitem", { name, exact: true });
const ready = (page) =>
  store(page)
    .locator('.mac-app-store-page:not([aria-busy="true"])')
    .first()
    .waitFor({ timeout: 15_000 });

async function writePhase(browser, page) {
  const kept = {};
  await openApp(page, "App Store");
  await ready(page);
  await c.crawl("window", store(page));

  for (const name of SECTIONS) {
    await c.check(
      `app-store.sidebar.${name.toLowerCase()}`,
      async () => {
        // On the desktop Arcade is dimmed: nothing here costs money, and its row says so.
        if ((await section(page, name).getAttribute("aria-disabled")) === "true") {
          const why = (await section(page, name).getAttribute("title")) ?? "";
          return { ok: why.length > 0, detail: `dimmed: ${why}` };
        }
        await section(page, name).click();
        const heading = store(page).getByRole("heading", { level: 1, name, exact: true });
        const shown = await heading.waitFor({ timeout: 10_000 }).then(
          () => true,
          () => false,
        );
        const selected = await section(page, name).getAttribute("aria-selected");
        await c.crawl(`treeitem:${name}`, store(page));
        const items = await store(page)
          .getByRole("button", { name: /^(Get|Open), / })
          .count();
        return {
          ok: shown && selected === "true" && (items > 0 || name === "Categories"),
          detail: `heading ${shown}; selected ${selected}; ${items} apps offered`,
        };
      },
      meta(
        "window",
        "treeitem",
        name,
        `click ${name} in the sidebar`,
        "the section's page, with its apps",
      ),
    );
  }
  for (const name of CATEGORIES) {
    await c.check(
      `app-store.category.${name.toLowerCase()}`,
      async () => {
        await section(page, "Categories").click();
        const button = store(page).getByRole("button", {
          name: new RegExp(`^${name} (\\d+) apps?$`),
        });
        const count = Number(
          ((await button.getAttribute("aria-label")) ?? (await button.innerText())).match(
            /(\d+) app/,
          )?.[1],
        );
        await button.click();
        // A category is shown as the store's results for its name.
        await store(page)
          .getByRole("heading", { level: 1, name: `Results for “${name}”` })
          .waitFor({ timeout: 10_000 });
        const apps = await store(page)
          .getByRole("button", { name: /^(Get|Open), / })
          .count();
        await store(page)
          .getByRole("button", { name: "Clear" })
          .click()
          .catch(() => {});
        return { ok: apps === count, detail: `${apps} apps listed; the category says ${count}` };
      },
      meta(
        "Categories",
        "button",
        `/${name} \\d+ apps?/`,
        `Categories, click ${name}`,
        "the category's apps, as many as it says",
      ),
    );
  }

  // ── Sign In first: the account page lists the apps got while signed in, each with Uninstall ──
  await c.check(
    "app-store.sign-in",
    async () => {
      await store(page).getByRole("button", { name: "Sign In" }).click();
      await store(page)
        .getByRole("button", { name: "Sign In" })
        .waitFor({ state: "detached", timeout: 5_000 })
        .catch(() => {});
      const account = store(page)
        .getByRole("button", { pressed: false })
        .filter({ hasNotText: /^(Get|Open|Clear|Close|Minimize|Enter Full Screen)$/ });
      const names = (await account.allInnerTexts())
        .map((t) => t.trim())
        .filter((t) => t && !/^(Get|Open)$/.test(t));
      // Signing in opens the Account page (the account button pressed): its line names the account.
      const line = await store(page)
        .getByText(/^Signed in as .+\.$/)
        .first()
        .innerText({ timeout: 5_000 })
        .catch(() => "");
      kept.accountButton =
        line.match(/^Signed in as (.+)\.$/)?.[1] ??
        names.find((t) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(t) && !/^Sign (In|Out)$/.test(t)) ??
        "";
      return {
        ok:
          kept.accountButton !== "" &&
          (await store(page).getByRole("button", { name: "Sign In" }).count()) === 0,
        detail: `the Sign In button became "${kept.accountButton}"`,
      };
    },
    meta("window", "button", "Sign In", "click Sign In", "signed in: the button names the account"),
  );

  // ── Get and Install (first, middle and last of the apps the store sells) ──
  for (const name of GOT) {
    await c.check(
      `app-store.app.get-${name.toLowerCase().replace(/\s+/g, "-")}`,
      async () => {
        await section(page, "Discover").click();
        await ready(page);
        const id = name.toLowerCase().replace(/\s+/g, "-");
        const saved = page.waitForResponse(
          (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === LIBRARY,
          { timeout: 15_000 },
        );
        saved.catch(() => {});
        await store(page)
          .getByRole("button", { name: `Get, ${name}` })
          .first()
          .click();
        await store(page)
          .getByRole("button", { name: `Install, ${name}` })
          .first()
          .click();
        await store(page)
          .getByRole("button", { name: `Open, ${name}` })
          .first()
          .waitFor({ timeout: 20_000 });
        const status = (await saved.catch(() => null))?.status();
        const docked = await dockTile(page, name)
          .first()
          .waitFor({ timeout: 10_000 })
          .then(
            () => true,
            () => false,
          );
        const library = await installed(page);
        return {
          ok: status === 200 && docked && library?.includes(id),
          detail: `PUT ${status}; in the Dock ${docked}; library ${JSON.stringify(library)}`,
        };
      },
      meta(
        "window",
        "button",
        "/Get, .+/",
        `click Get, then Install, on ${name}`,
        "the app joins the library on the server and the Dock; the store offers Open",
        "restart",
      ),
    );
  }
  kept.got = GOT.map((n) => n.toLowerCase().replace(/\s+/g, "-"));
  for (const name of OPENED) {
    await c.check(
      `app-store.app.open-${name.toLowerCase().replace(/\s+/g, "-")}`,
      async () => {
        await section(page, "Updates").click();
        await store(page)
          .getByRole("button", { name: `Open, ${name}`, exact: true })
          .click();
        const window = appWindow(page, name);
        const shown = await window.waitFor({ state: "visible", timeout: 15_000 }).then(
          () => true,
          () => false,
        );
        if (shown) await closeAppWindow(page, name).catch(() => {});
        await openApp(page, "App Store");
        return { ok: shown, detail: `${name}'s window opened ${shown}` };
      },
      meta("Updates", "button", "/Open, .+/", `in Updates, click Open on ${name}`, "the app opens"),
    );
  }

  // ── Search and Clear ──
  await c.check(
    "app-store.search",
    async () => {
      const search = store(page).getByRole("searchbox", { name: "Search" });
      await search.fill("dictionary");
      await search.press("Enter");
      await store(page)
        .getByRole("heading", { level: 1, name: /Results for “dictionary”/ })
        .waitFor({ timeout: 10_000 });
      const apps = (
        await store(page)
          .getByRole("button", { name: /^(Get|Open), / })
          .allInnerTexts()
      ).length;
      const found = await store(page).getByRole("button", { name: "Open, Dictionary" }).count();
      return {
        ok: apps >= 1 && found === 1,
        detail: `${apps} results; Dictionary among them ${found === 1}`,
      };
    },
    meta(
      "window",
      "searchbox",
      "Search",
      'type "dictionary" in Search, press Return',
      "the results name Dictionary",
    ),
  );
  await c.check(
    "app-store.search.clear",
    async () => {
      await store(page).getByRole("button", { name: "Clear" }).click();
      const value = await store(page).getByRole("searchbox", { name: "Search" }).inputValue();
      const results = await store(page)
        .getByRole("heading", { name: /Results for/ })
        .count();
      return {
        ok: value === "" && results === 0,
        detail: `field "${value}"; results heading ${results}`,
      };
    },
    meta(
      "search",
      "button",
      "Clear",
      "click the search field's Clear button",
      "the field empties and the results go",
    ),
  );

  // ── The account page and Uninstall; the Store menu ──
  await c.check(
    "app-store.account.uninstall",
    async () => {
      await store(page).getByRole("button", { name: kept.accountButton, exact: true }).click();
      const uninstall = store(page).getByRole("button", { name: "Uninstall Dictionary" });
      await uninstall.waitFor({ timeout: 10_000 });
      await c.crawl("account", store(page));
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === LIBRARY,
        { timeout: 15_000 },
      );
      await uninstall.click();
      const status = (await saved).status();
      const library = await installed(page);
      const undocked = await dockTile(page, "Dictionary")
        .first()
        .waitFor({ state: "detached", timeout: 10_000 })
        .then(
          () => true,
          () => false,
        );
      kept.got = kept.got.filter((x) => x !== "dictionary");
      return {
        ok: status === 200 && !library?.includes("dictionary") && undocked,
        detail: `PUT ${status}; library ${JSON.stringify(library)}; Dock tile gone ${undocked}`,
      };
    },
    meta(
      "account",
      "button",
      "/Uninstall .+/",
      "click the account's name, then Uninstall Dictionary",
      "the app leaves the library on the server and the Dock",
    ),
  );
  await c.check(
    "app-store.menu-store.show-updates",
    async () => {
      await chooseMenu(page, "Store", "Show Updates");
      const selected = await section(page, "Updates").getAttribute("aria-selected");
      return { ok: selected === "true", detail: `Updates selected ${selected}` };
    },
    meta("menu:Store", "menuitem", "Show Updates", "Store > Show Updates", "the Updates section"),
  );
  await c.check(
    "app-store.menu-store.sign-in",
    async () => {
      const menu = await (await import("./r5-census-kit.mjs")).openMenuTitle(page, "Store");
      const row = menu
        .getByRole("menuitem")
        .filter({ hasText: /Sign (In|Out)|View My Account/ })
        .first();
      const label = (await row.innerText()).split("\n")[0].trim();
      await row.click();
      await page.waitForTimeout(600);
      const account = await store(page).getByRole("heading", { level: 1, name: "Account" }).count();
      const signIn = await store(page).getByRole("button", { name: "Sign In" }).count();
      return {
        ok: /Sign In/.test(label) ? signIn === 0 : account > 0,
        detail: `Store > ${label}: the Account page ${account > 0}, Sign In shown ${signIn > 0}`,
      };
    },
    meta(
      "menu:Store",
      "menuitem",
      "/Sign In|Sign Out|View My Account/",
      "Store > the account row",
      "signs in, or shows the account",
    ),
  );

  await commonRows(c, page, {
    id: "app-store",
    name: "App Store",
    hasFileClose: false,
    viewMenu: false,
  });
  for (const control of (await crawlMenus(page)).rows) c.crawled.push(control);

  await c.check(
    "app-store.persist.reload",
    async () => {
      await reloadDesktop(page);
      return persisted(page, kept);
    },
    meta(
      "desktop",
      "reload",
      "library",
      "reload the desktop",
      "the apps got are in the library and the Dock; Dictionary is not",
      "reload",
    ),
  );
  await isolation(browser, "app-store.isolation.write");
  return kept;
}

async function persisted(page, kept) {
  const library = (await installed(page)) ?? [];
  const docked = [];
  for (const name of ["Automator", "Voice Memos", "Dictionary"])
    docked.push([name, await dockTile(page, name).count()]);
  const ok =
    kept.got.every((id) => library.includes(id)) &&
    !library.includes("dictionary") &&
    docked.every(([n, k]) => (n === "Dictionary" ? k === 0 : k > 0));
  return {
    ok,
    detail: `library ${JSON.stringify(library)}; Dock ${docked.map(([n, k]) => `${n} ${k}`).join(", ")}`,
  };
}

async function isolation(browser, id) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("store", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account" },
      );
      try {
        const library = await api(other, "GET", LIBRARY);
        const docked = await dockTile(other, "Automator").count();
        return {
          ok:
            library.status === 200 &&
            !(library.json?.installed ?? []).some((x) =>
              ["automator", "voice-memos"].includes(x),
            ) &&
            docked === 0,
          detail: `their library ${JSON.stringify(library.json?.installed ?? null)}; Automator docked ${docked}`,
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "library",
      "sign up a second account, read its library and Dock",
      "none of the first account's apps",
      "restart",
    ),
  );
}

async function restartPhase(browser) {
  const state = loadState(out, "app-store", browserName);
  const page = await person(browser, c, base, state.account, { create: false });
  await c.check(
    "app-store.persist.restart",
    async () => persisted(page, state.kept),
    meta(
      "desktop",
      "restart",
      "library",
      "restart ferrite dev on the same root, sign in",
      "the apps got are in the library and the Dock",
      "restart",
    ),
  );
  await isolation(browser, "app-store.isolation.restart");
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("store", "a");
    const page = await person(browser, c, base, account);
    const kept = await writePhase(browser, page);
    saveState(out, "app-store", browserName, { account, kept });
  }
} catch (error) {
  c.row("app-store.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();
