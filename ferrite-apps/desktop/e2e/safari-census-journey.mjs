#!/usr/bin/env node
// Safari census (R5, round 3): one `ok`/`FAIL` line per census id of Safari, real input only (Playwright mouse
// and keyboard), against `ferrite dev --fresh` serving the packed site, signed in as a real account made at the
// login window. Reads through the app's API only to assert.
//
// Phases: `write` (and `all`) drive every control and leave a state file for `restart-check`, which runs after a
// real same-root restart of `ferrite dev` and checks that what Safari keeps (bookmarks, Reading List, tabs and
// their order, history, the downloaded file) is still there for the account and not for a second account.
//
//   node e2e/safari-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import { createHash } from "node:crypto";
import {
  accountFor,
  api,
  appWindow,
  census,
  chooseMenu,
  closeMenus,
  launchBrowser,
  loadState,
  openApp,
  openMenuTitle,
  options,
  person,
  reloadDesktop,
  saveState,
  shot,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("safari", opts);
const PAGE_MS = 20_000;
const CATALINA = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const MOJAVE = "https://en.wikipedia.org/wiki/MacOS_Mojave";
const SEARCH = "https://en.wikipedia.org/w/index.php?fulltext=1&ns0=1&search=";
const LOGO = "https://www.wikipedia.org/portal/wikipedia.org/assets/img/Wikipedia-logo-v2.png";
const BIG = "https://www.gutenberg.org/cache/epub/1342/pg1342-images.epub";
const SITES = [
  "Wikipedia",
  "Apple",
  "NPR",
  "BBC",
  "Ars Technica",
  "Hacker News",
  "MDN Web Docs",
  "Marginalia Search",
  "CNN",
  "Al Jazeera",
  "512 Pixels",
  "Daring Fireball",
];
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const safari = (page) => appWindow(page, "Safari");
const field = (page) => safari(page).getByRole("textbox", { name: "Search or enter website name" });
const frames = (page) => safari(page).locator("iframe");
const tabs = (page) => safari(page).getByRole("tab");
const bar = (page) => safari(page).getByRole("navigation", { name: "Favorites bar" });
const text = async (page) =>
  (
    await safari(page)
      .innerText()
      .catch(() => "")
  ).replace(/\s+/g, " ");

/** The next answer of the Safari module for a page (marked handled, so a step that never awaits it is fine). */
function pageAnswer(page, timeout = PAGE_MS) {
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/safari/page", {
    timeout,
  });
  answer.catch(() => {});
  return answer;
}
/** Type in the address field and press Return; resolves with the module's answer, or `{ cached: true }` when the
 * window showed the page from its own pages (one it opened before) without asking the server. */
async function go(page, typed) {
  const asked = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/safari/page", {
    timeout: 1_500,
  });
  asked.catch(() => {});
  await field(page).click();
  await field(page).fill(typed);
  await field(page).press("Enter");
  const request = await asked.catch(() => null);
  if (!request) {
    await page.waitForTimeout(300);
    return { cached: true };
  }
  const response = await request.response().catch(() => null);
  await page.waitForTimeout(300);
  return response ? await response.json().catch(() => ({})) : {};
}
/** The tab in front shows `want` (the field reads it) and has settled: a page in its frame, or Safari's own page
 * saying why it cannot (never a blank or a spinner). */
async function settled(page, want) {
  await fieldIs(page, want);
  await safari(page)
    .getByLabel("Loading page")
    .first()
    .waitFor({ state: "detached", timeout: PAGE_MS })
    .catch(() => {});
  const framed = await frames(page).count();
  const said = /Safari Can’t|Opens Outside Safari/.test(await text(page));
  return {
    ok: framed > 0 || said,
    detail: `${await field(page).inputValue()}: ${framed > 0 ? "page shown" : said ? "Safari says why" : "nothing shown"}`,
  };
}
/** Close tabs with each tab's own close control (hover, click the ×) until `n` are left. */
async function closeTabsTo(page, n) {
  for (let i = 0; i < 60 && (await tabs(page).count()) > Math.max(n, 1); i += 1) {
    const tab = tabs(page).last();
    await tab.hover();
    await tab.locator(".mac-safari-tab-bar-close").click();
    await page.waitForTimeout(120);
  }
}
/** Where each listed site ended up (its home page, a redirect's target), from the Favorites bar step. */
const landed = new Map();
/** Wait until the address field reads `value` (or matches it, a RegExp). */
async function fieldIs(page, value, timeout = PAGE_MS) {
  const end = Date.now() + timeout;
  let now = "";
  while (Date.now() < end) {
    now = await field(page)
      .inputValue()
      .catch(() => "");
    if (value instanceof RegExp ? value.test(now) : now === value) return true;
    await page.waitForTimeout(150);
  }
  throw new Error(`the address field reads "${now}", not ${value}`);
}
/** The frame of the fetched page in front, once there. */
async function pageFrame(page) {
  const frame = frames(page).first();
  await frame.waitFor({ state: "attached", timeout: PAGE_MS });
  const content = await (await frame.elementHandle()).contentFrame();
  await content.waitForLoadState("domcontentloaded").catch(() => {});
  return content;
}
/** Whether some window of the app `name` holds `needle` in its text or in a field's value. */
async function appHolds(page, name, needle) {
  return page.evaluate(
    ({ name, needle }) =>
      [...document.querySelectorAll("[aria-label]")]
        .filter(
          (e) =>
            e.getAttribute("aria-label") === name ||
            e.getAttribute("aria-label")?.startsWith(`${name} `) ||
            e.getAttribute("aria-label") === "New Message",
        )
        .some(
          (e) =>
            (e.textContent ?? "").includes(needle) ||
            [...e.querySelectorAll("input, textarea")].some((f) => f.value.includes(needle)),
        ),
    { name, needle },
  );
}
/** Close the front window of the app `name` (and a question it asks, without saving). */
async function closeApp(page, name) {
  const window = page.getByRole("region", { name }).first();
  if (await window.isVisible().catch(() => false)) {
    await window
      .getByRole("button", { name: "Close" })
      .first()
      .click()
      .catch(() => {});
    const ask = page.getByRole("alertdialog").first();
    if (await ask.isVisible({ timeout: 1_500 }).catch(() => false))
      await ask
        .getByRole("button", { name: /Don’t Save|Don't Save|Delete|Discard|Cancel/ })
        .first()
        .click()
        .catch(() => {});
  }
}
const share = async (page) => {
  await safari(page).getByRole("button", { name: "Share" }).click();
  return page.getByRole("menu").last();
};

/** Every step that drives Safari, for the account `page` is signed in to. Answers what restart-check reads. */
async function writePhase(browser, page) {
  const kept = {};
  const dialogs = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss().catch(() => {});
  });
  await openApp(page, "Safari");
  await safari(page).getByRole("link", { name: "Wikipedia" }).first().waitFor({ timeout: 15_000 });
  await c.crawl("window", safari(page));

  // ── The start page and the Favorites bar: each listed site opens in Safari ──
  for (const site of SITES) {
    await c.check(
      `safari.favorites-bar.${slug(site)}`,
      async () => {
        const answered = pageAnswer(page);
        await bar(page).getByRole("button", { name: site, exact: true }).click();
        const reply = await (await answered).json();
        await page.waitForTimeout(300);
        const shown = await text(page);
        const honest =
          reply.ok === true
            ? (await frames(page).count()) > 0
            : /Safari Can’t|Opens Outside Safari/.test(shown);
        landed.set(site, await field(page).inputValue());
        return {
          ok: honest,
          detail: `${reply.ok ? "opened" : `refused: ${reply.kind}`} ${reply.url ?? ""}`,
        };
      },
      meta(
        "window",
        "button",
        site,
        `click ${site} on the Favorites bar`,
        "the site's page opens in the tab, or Safari's page says why it cannot",
      ),
    );
  }
  for (const site of SITES) {
    await c.check(
      `safari.start-page.${slug(site)}`,
      async () => {
        await chooseMenu(page, "History", "Home");
        await safari(page).getByRole("link", { name: site }).first().waitFor({ timeout: 10_000 });
        await safari(page).getByRole("link", { name: site }).first().click();
        return settled(page, landed.get(site) ?? /./);
      },
      meta(
        "window",
        "link",
        site,
        `on the start page (History > Home), click ${site}`,
        "the site's page opens, or Safari says why it cannot",
      ),
    );
  }
  // Tabs to close, each with its own close control.
  await safari(page).getByRole("button", { name: "New Tab" }).click();
  await safari(page).getByRole("button", { name: "New Tab" }).click();
  await c.check(
    "safari.tabs.close-button",
    async () => {
      const before = await tabs(page).count();
      const first = tabs(page).first();
      await first.hover();
      await first.locator(".mac-safari-tab-bar-close").click();
      await page.waitForTimeout(400);
      const after = await tabs(page).count();
      await closeTabsTo(page, 1);
      return { ok: after === before - 1, detail: `${before} tabs -> ${after}` };
    },
    meta("tab", "button", "close (×)", "hover a tab, click its ×", "that tab closes"),
  );

  // ── The address field: every form of address, kept, normalised or refused with its reason ──
  const FORMS = [
    ["no-scheme", "en.wikipedia.org/wiki/MacOS_Catalina", { field: CATALINA, opened: true }],
    ["uppercase-host", "EN.WIKIPEDIA.ORG/wiki/MacOS_Mojave", { field: MOJAVE, opened: true }],
    ["https", CATALINA, { field: CATALINA, opened: true }],
    ["idn", "münchen.de", { field: "https://xn--mnchen-3ya.de/", says: /Opens Outside Safari/ }],
    [
      "ipv4-public",
      "1.1.1.1",
      { field: "https://1.1.1.1/", says: /Opens Outside Safari|Safari Can’t/ },
    ],
    [
      "ipv4-public-port",
      "1.1.1.1:8443",
      { field: "https://1.1.1.1:8443/", says: /only the standard web port/ },
    ],
    [
      "ipv4-private",
      "192.168.0.1",
      { field: "https://192.168.0.1/", says: /private or local network/ },
    ],
    [
      "ipv4-private-port",
      "192.168.0.1:8080",
      { says: /private or local network|only the standard web port/ },
    ],
    ["ipv6-loopback", "[::1]", { field: "https://[::1]/", says: /private or local network/ }],
    [
      "localhost-port",
      "localhost:8080",
      { says: /private or local network|only the standard web port/ },
    ],
    [
      "metadata-ip",
      "http://169.254.169.254/latest/meta-data/",
      { says: /private or local network/ },
    ],
    ["file-scheme", "file:///etc/passwd", { says: /starting with “file:”/ }],
    ["javascript-scheme", "javascript:alert(1)", { says: /starting with “javascript:”/ }],
    ["data-scheme", "data:text/html,<script>alert(1)</script>", { says: /starting with “data:”/ }],
    ["credentials", "https://user:secret@en.wikipedia.org/", { says: /user name or password/ }],
    ["malformed", "http://exa mple.com", { says: /not a valid address/ }],
    ["not-found", "no-such-host-r5-zzzz.com", { says: /Safari Can’t Find the Server/ }],
    ["search-words", "Apple Park", { starts: SEARCH, opened: true }],
    ["search-number", "1.5", { starts: SEARCH, opened: true }],
  ];
  for (const [name, typed, want] of FORMS) {
    await c.check(
      `safari.address.${name}`,
      async () => {
        const before = dialogs.length;
        const reply = await go(page, typed);
        const value = await field(page).inputValue();
        const shown = await text(page);
        const framed = await frames(page).count();
        const problems = [];
        if (want.field && value !== want.field) problems.push(`field "${value}"`);
        if (want.starts && !value.startsWith(want.starts)) problems.push(`field "${value}"`);
        // A page opened before is shown from the window's own pages, without asking the server again.
        if (want.opened && !((reply.ok === true || reply.cached) && framed > 0))
          problems.push(`not opened (${reply.kind ?? "no answer"})`);
        if (want.says && !want.says.test(shown))
          problems.push(`page says "${shown.slice(0, 160)}"`);
        if (want.says && framed > 0 && !want.opened)
          problems.push("a frame is shown for a refused address");
        if (dialogs.length > before) problems.push(`a dialog opened: ${dialogs.at(-1)}`);
        return {
          ok: problems.length === 0,
          detail:
            problems.join("; ") ||
            `${value} (${reply.ok ? "opened" : reply.cached ? "shown from the window's pages" : (reply.kind ?? "refused")})`,
        };
      },
      meta(
        "address field",
        "url",
        typed,
        `type "${typed}" in the address field and press Return`,
        want.says
          ? `refused with Safari's reason ${want.says}`
          : `opens, the field reads ${want.field ?? `${want.starts}…`}`,
      ),
    );
  }

  // ── A page: its frame, a link, Back, Forward, Reload, Stop, Reader ──
  await go(page, CATALINA);
  await c.check(
    "safari.page.never-frames-remote-origins",
    async () => {
      const content = await pageFrame(page);
      await content.locator("h1").first().waitFor({ timeout: PAGE_MS });
      const all = await page.evaluate(() =>
        [...document.querySelectorAll("iframe")].map((f) => ({
          src: f.getAttribute("src") ?? "",
          sandbox: f.getAttribute("sandbox") ?? "",
        })),
      );
      const own = new URL(base).origin;
      const remote = all.filter((f) => /^https?:/i.test(f.src) && !f.src.startsWith(own));
      const safariFrame = all.find((f) => f.sandbox !== "") ?? {};
      return {
        ok: remote.length === 0 && safariFrame.sandbox === "allow-scripts allow-forms allow-modals",
        detail: `${all.length} frames, ${remote.length} with a remote src; sandbox "${safariFrame.sandbox}"`,
      };
    },
    meta(
      "page",
      "frame",
      "page frame",
      "open Wikipedia's Catalina article",
      "the page is the server's copy in a sandboxed frame; no frame has a remote origin",
    ),
  );
  await c.crawl("page", safari(page));
  await c.check(
    "safari.page.link",
    async () => {
      const content = await pageFrame(page);
      await content.locator(`[data-safari-href="${MOJAVE}"]`).first().click();
      return settled(page, MOJAVE);
    },
    meta(
      "page",
      "link",
      "a link in the page",
      "click the Mojave link in the article",
      "Safari opens it, the field follows",
    ),
  );
  await c.check(
    "safari.toolbar.back",
    async () => {
      await safari(page).getByRole("button", { name: "Back" }).click();
      await fieldIs(page, CATALINA);
      return true;
    },
    meta("page", "button", "Back", "click Back", "the previous page and its address"),
  );
  await c.check(
    "safari.toolbar.forward",
    async () => {
      await safari(page).getByRole("button", { name: "Forward" }).click();
      await fieldIs(page, MOJAVE);
      return true;
    },
    meta("page", "button", "Forward", "click Forward", "the next page again"),
  );
  await c.check(
    "safari.toolbar.reload",
    async () => {
      const answered = pageAnswer(page);
      await safari(page).getByRole("button", { name: "Reload this page" }).click();
      return (await (await answered).json()).ok === true;
    },
    meta(
      "page",
      "button",
      "Reload this page",
      "click Reload",
      "the server is asked for the page again",
    ),
  );
  await c.check(
    "safari.toolbar.stop",
    async () => {
      await field(page).click();
      await field(page).fill("en.wikipedia.org/wiki/Linux");
      await field(page).press("Enter");
      const stop = safari(page).getByRole("button", { name: "Stop loading this page" });
      await stop.click({ timeout: 5_000 });
      await safari(page)
        .getByRole("button", { name: "Reload this page" })
        .waitFor({ timeout: 5_000 });
      await page.waitForTimeout(2_500);
      const linux = await frames(page).evaluateAll((list) =>
        list.some((f) => /Linux/.test(f.getAttribute("title") ?? "")),
      );
      return { ok: !linux, detail: `the stopped page is not shown: ${!linux}` };
    },
    meta(
      "loading",
      "button",
      "Stop loading this page",
      "press Return on an address, then click Stop while it loads",
      "loading stops; the page does not open",
    ),
  );
  await go(page, CATALINA);
  await c.check(
    "safari.toolbar.reader",
    async () => {
      await safari(page).getByRole("button", { name: "Show Reader View" }).click();
      const article = safari(page).locator("article").first();
      await article.waitFor({ timeout: 8_000 });
      const length = (await article.innerText()).length;
      await c.crawl("reader", safari(page));
      return { ok: length > 500, detail: `${length} characters` };
    },
    meta(
      "page",
      "button",
      "Show Reader View",
      "click the Reader button",
      "the article's text in Reader",
    ),
  );
  await c.check(
    "safari.reader.text-size",
    async () => {
      const sizeButton = safari(page).getByRole("button", { name: "Change Reader text size" });
      const article = safari(page).locator("article").first();
      const size = () => article.evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize));
      const first = await size();
      await sizeButton.click();
      await page.getByRole("button", { name: "Larger", exact: true }).click();
      await page.waitForTimeout(150);
      const larger = await size();
      await page.getByRole("button", { name: "Smaller", exact: true }).click();
      await page.waitForTimeout(150);
      const back = await size();
      await page.keyboard.press("Escape");
      return {
        ok: larger > first && back === first,
        detail: `${first} -> ${larger} -> ${back} px`,
      };
    },
    meta(
      "reader",
      "button",
      "Change Reader text size",
      "open the text-size button, click Larger, then Smaller",
      "Reader's text grows, then returns to its size",
    ),
  );
  await c.check(
    "safari.toolbar.reader-hide",
    async () => {
      await safari(page).getByRole("button", { name: "Hide Reader View" }).click();
      await safari(page).locator("article").first().waitFor({ state: "detached", timeout: 5_000 });
      return (await frames(page).count()) > 0;
    },
    meta("reader", "button", "Hide Reader View", "click the Reader button again", "the page again"),
  );

  // ── Share: Safari's own rows, Copy Link, and the link into Mail, Messages, Notes and Reminders ──
  await c.check(
    "safari.share.menu",
    async () => {
      const menu = await share(page);
      await c.crawl("menu:Share", menu);
      const rows = await menu.getByRole("menuitem").allInnerTexts();
      await closeMenus(page);
      return { ok: rows.length >= 6, detail: rows.map((r) => r.split("\n")[0]).join(" | ") };
    },
    meta("page", "button", "Share", "click Share", "the Share menu opens with its rows"),
  );
  await c.check(
    "safari.share.add-bookmark",
    async () => {
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/safari/bookmarks",
        { timeout: 10_000 },
      );
      await (await share(page)).getByRole("menuitem", { name: "Add Bookmark" }).click();
      await page
        .getByRole("dialog", { name: "Add this page to:" })
        .getByRole("button", { name: "Add" })
        .click();
      const status = (await saved).status();
      const title = (await frames(page).first().getAttribute("title")) ?? "";
      kept.bookmark = title;
      await bar(page).getByText(title, { exact: true }).first().waitFor({ timeout: 5_000 });
      const server = await api(page, "GET", "/api/safari/bookmarks");
      return {
        ok: status === 200 && server.text.includes(CATALINA),
        detail: `${title}; PUT ${status}`,
      };
    },
    meta(
      "menu:Share",
      "menuitem",
      "Add Bookmark",
      "Share > Add Bookmark",
      "the page joins the Favorites bar, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "safari.share.add-reading-list",
    async () => {
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          new URL(r.url()).pathname === "/api/safari/reading-list",
        { timeout: 10_000 },
      );
      await (await share(page)).getByRole("menuitem", { name: "Add to Reading List" }).click();
      const status = (await saved).status();
      const server = await api(page, "GET", "/api/safari/reading-list");
      kept.reading = CATALINA;
      return { ok: status === 200 && server.text.includes(CATALINA), detail: `PUT ${status}` };
    },
    meta(
      "menu:Share",
      "menuitem",
      "Add to Reading List",
      "Share > Add to Reading List",
      "the page is in the Reading List, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "safari.share.copy-link",
    async () => {
      await (await share(page)).getByRole("menuitem", { name: "Copy Link" }).click();
      await field(page).click();
      await field(page).fill("");
      await page.keyboard.press("Control+KeyV");
      const pasted = await field(page).inputValue();
      await field(page).press("Escape");
      return { ok: pasted === CATALINA, detail: `pasted "${pasted}"` };
    },
    meta(
      "menu:Share",
      "menuitem",
      "Copy Link",
      "Share > Copy Link, then Control+V in the address field",
      "the page's address is on the clipboard",
    ),
  );
  await c.unavailable(
    "safari.share.airdrop",
    (await share(page)).getByRole("menuitem", { name: "AirDrop" }),
    /nearby devices/,
    null,
    meta(
      "menu:Share",
      "menuitem",
      "AirDrop",
      "Share > AirDrop",
      "unavailable: dimmed, saying a web page cannot reach nearby devices",
    ),
  );
  await closeMenus(page);
  const pageTitle =
    (await frames(page)
      .first()
      .getAttribute("title")
      .catch(() => null)) ?? "macOS Catalina - Wikipedia";
  for (const [key, row, app] of [
    ["mail", "Email This Page", "Mail"],
    ["messages", "Messages", "Messages"],
    ["notes", "Notes", "Notes"],
    ["reminders", "Reminders", "Reminders"],
  ]) {
    await c.check(
      `safari.share.${key}`,
      async () => {
        await (await share(page)).getByRole("menuitem", { name: row }).click();
        let holds = false;
        let how = "";
        for (let i = 0; i < 40 && !holds; i += 1) {
          await page.waitForTimeout(250);
          if (key === "mail") {
            // Mail's New Message window is named by its subject, the page's title; its body holds the link.
            const compose = page.getByRole("region", { name: pageTitle, exact: true });
            holds =
              (await compose.count()) > 0 && (await compose.first().innerText()).includes(CATALINA);
            how = "a New Message with the page's title as its subject and its link in the body";
          } else if (key === "reminders") {
            // A new reminder named by the page's title, kept on the server with the page's address.
            const shown =
              (await appWindow(page, "Reminders").getByText(pageTitle, { exact: true }).count()) >
              0;
            const server = shown ? (await api(page, "GET", "/api/reminders/data")).text : "";
            holds = shown && server.includes(CATALINA);
            how = `a reminder "${pageTitle}" shown, its address on the server: ${server.includes(CATALINA)}`;
          } else {
            holds = await appHolds(page, app, CATALINA);
            how = `${app} shows the page's address`;
          }
        }
        await shot(page, out, `safari-share-${key}-${browserName}`);
        await closeApp(page, key === "mail" ? pageTitle : app);
        await closeApp(page, app);
        await openApp(page, "Safari");
        return { ok: holds, detail: `${how}: ${holds}` };
      },
      meta(
        "menu:Share",
        "menuitem",
        row,
        `Share > ${row}`,
        `${app} opens with the page's link in a new ${key === "mail" ? "message" : key === "notes" ? "note" : key === "reminders" ? "reminder" : "message"}`,
      ),
    );
  }
  await fieldIs(page, /./, 5_000).catch(() => {});

  // ── Tabs: new, select, close, reopen, reorder by drag, Tab Overview ──
  const tabCount = () => tabs(page).count();
  const ensureTabs = async (n) => {
    for (let i = 0; i < 10 && (await tabCount()) < n; i += 1)
      await safari(page).getByRole("button", { name: "New Tab" }).click();
  };
  await c.check(
    "safari.tabs.new-button",
    async () => {
      const before = await tabCount();
      await safari(page).getByRole("button", { name: "New Tab" }).click();
      await page.waitForTimeout(300);
      const after = await tabCount();
      return { ok: after === Math.max(before, 1) + 1, detail: `${before} -> ${after}` };
    },
    meta(
      "window",
      "button",
      "New Tab",
      "click the + button",
      "a new tab opens in front",
      "restart",
    ),
  );
  await c.check(
    "safari.menu-file.new-tab",
    async () => {
      const before = await tabCount();
      await chooseMenu(page, "File", "New Tab");
      await page.waitForTimeout(300);
      return { ok: (await tabCount()) === before + 1, detail: `${before} -> ${await tabCount()}` };
    },
    meta("menu:File", "menuitem", "New Tab", "File > New Tab", "a new tab opens"),
  );
  await c.check(
    "safari.key.new-tab",
    async () => {
      const before = await tabCount();
      await field(page).click();
      await page.keyboard.press("Control+KeyT");
      await page.waitForTimeout(300);
      return { ok: (await tabCount()) === before + 1, detail: `${before} -> ${await tabCount()}` };
    },
    meta("keyboard", "shortcut", "⌘T", "Control+T", "a new tab opens"),
  );
  // Three tabs with three pages, for selecting, reordering and the overview.
  await c.check(
    "safari.tabs.select",
    async () => {
      await closeTabsTo(page, 1);
      await go(page, CATALINA);
      await safari(page).getByRole("button", { name: "New Tab" }).click();
      await go(page, MOJAVE);
      await safari(page).getByRole("button", { name: "New Tab" }).click();
      await go(page, "en.wikipedia.org/wiki/MacOS_Big_Sur");
      await tabs(page).first().click();
      await fieldIs(page, CATALINA);
      return {
        ok: (await tabs(page).first().getAttribute("aria-selected")) === "true",
        detail: `${await tabCount()} tabs`,
      };
    },
    meta(
      "tab",
      "tab",
      "/(Favorites|.+ - Wikipedia)/",
      "click a tab",
      "the tab comes to the front with its page and address",
    ),
  );
  await c.check(
    "safari.tabs.reorder-drag",
    async () => {
      const titles = async () => (await tabs(page).allInnerTexts()).map((t) => t.trim());
      const before = await titles();
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/safari/tabs",
        { timeout: 10_000 },
      );
      saved.catch(() => {});
      const from = await tabs(page).last().boundingBox();
      const to = await tabs(page).first().boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2, { steps: 4 });
      await page.mouse.move(to.x + 8, to.y + to.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      const after = await titles();
      const server = await (await saved.catch(() => null))?.request().postDataJSON?.();
      kept.tabs = (await api(page, "GET", "/api/safari/tabs")).json?.tabs ?? null;
      return {
        ok:
          after[0] === before.at(-1) &&
          after.length === before.length &&
          Array.isArray(kept.tabs) &&
          kept.tabs[0]?.includes("Big_Sur"),
        detail: `${before.join(" | ")} -> ${after.join(" | ")}; server ${JSON.stringify(kept.tabs)}${server ? "" : ""}`,
      };
    },
    meta(
      "tab",
      "drag",
      "tab",
      "drag the last tab before the first",
      "the tabs reorder, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "safari.toolbar.tab-overview",
    async () => {
      await safari(page).getByRole("button", { name: "Show Tab Overview" }).click();
      const overview = safari(page).getByLabel("Open tabs");
      await overview.waitFor({ timeout: 5_000 });
      await c.crawl("tab overview", safari(page));
      const items = overview.getByRole("button");
      const count = await items.count();
      await items.nth(1).click();
      await overview.waitFor({ state: "hidden", timeout: 5_000 });
      return { ok: count >= 3, detail: `${count} tabs in the overview; the second chosen` };
    },
    meta(
      "window",
      "button",
      "Show Tab Overview",
      "click Tab Overview, then a tab in it",
      "every tab shows; the one chosen comes to the front",
    ),
  );
  await c.check(
    "safari.menu-view.tab-overview",
    async () => {
      await chooseMenu(page, "View", "Show Tab Overview");
      const overview = safari(page).getByLabel("Open tabs");
      await overview.waitFor({ timeout: 5_000 });
      await overview.getByRole("button").first().click();
      await overview.waitFor({ state: "hidden", timeout: 5_000 });
      return true;
    },
    meta(
      "menu:View",
      "menuitem",
      "Show Tab Overview",
      "View > Show Tab Overview",
      "the overview opens",
    ),
  );
  await c.check(
    "safari.key.tab-overview",
    async () => {
      await field(page).click();
      await page.keyboard.press("Control+Shift+Backslash");
      const overview = safari(page).getByLabel("Open tabs");
      const shown = await overview.waitFor({ timeout: 3_000 }).then(
        () => true,
        () => false,
      );
      if (shown) await page.keyboard.press("Escape");
      if (await overview.isVisible().catch(() => false))
        await overview.getByRole("button").first().click();
      return { ok: shown, detail: `Control+Shift+\\ opened the overview: ${shown}` };
    },
    meta("keyboard", "shortcut", "⇧⌘\\", "Control+Shift+\\", "the Tab Overview opens"),
  );
  await c.check(
    "safari.menu-file.close-tab",
    async () => {
      const before = await tabCount();
      await chooseMenu(page, "File", "Close Tab");
      await page.waitForTimeout(300);
      return { ok: (await tabCount()) === before - 1, detail: `${before} -> ${await tabCount()}` };
    },
    meta("menu:File", "menuitem", "Close Tab", "File > Close Tab", "the front tab closes"),
  );
  await c.check(
    "safari.menu-file.reopen-tab",
    async () => {
      const before = await tabCount();
      await chooseMenu(page, "File", "Reopen Last Closed Tab");
      await page.waitForTimeout(500);
      return { ok: (await tabCount()) === before + 1, detail: `${before} -> ${await tabCount()}` };
    },
    meta(
      "menu:File",
      "menuitem",
      "Reopen Last Closed Tab",
      "File > Reopen Last Closed Tab",
      "the closed tab opens again",
    ),
  );
  await c.check(
    "safari.key.close-tab",
    async () => {
      const before = await tabCount();
      await field(page).click();
      await page.keyboard.press("Control+KeyW");
      await page.waitForTimeout(300);
      return { ok: (await tabCount()) === before - 1, detail: `${before} -> ${await tabCount()}` };
    },
    meta("keyboard", "shortcut", "⌘W", "Control+W", "the front tab closes"),
  );
  await c.check(
    "safari.key.reopen-tab",
    async () => {
      const before = await tabCount();
      await field(page).click();
      await page.keyboard.press("Control+Shift+KeyT");
      await page.waitForTimeout(500);
      return { ok: (await tabCount()) === before + 1, detail: `${before} -> ${await tabCount()}` };
    },
    meta("keyboard", "shortcut", "⇧⌘T", "Control+Shift+T", "the closed tab opens again"),
  );
  await ensureTabs(3);
  kept.tabs = (await api(page, "GET", "/api/safari/tabs")).json?.tabs ?? null;

  // ── Sidebar: Bookmarks and Reading List, their items, the resize handle ──
  const tree = (name) => safari(page).getByRole("tree", { name, exact: true });
  const pane = () => safari(page).locator(".mac-safari-sidebar").first();
  const paneShown = () =>
    pane()
      .isVisible()
      .catch(() => false);
  await c.check(
    "safari.toolbar.sidebar",
    async () => {
      await safari(page).getByRole("button", { name: "Show Sidebar" }).click();
      await pane().waitFor({ timeout: 5_000 });
      await c.crawl("sidebar", safari(page));
      return true;
    },
    meta("window", "button", "Show Sidebar", "click the sidebar button", "the sidebar opens"),
  );
  await c.check(
    "safari.sidebar.segment-reading-list",
    async () => {
      await safari(page)
        .getByRole("radio", { name: "Reading List" })
        .or(safari(page).getByRole("button", { name: "Reading List", exact: true }))
        .first()
        .click();
      return tree("Reading List")
        .waitFor({ timeout: 5_000 })
        .then(() => true);
    },
    meta(
      "sidebar",
      "radio",
      "Reading List",
      "click the glasses segment at the top of the sidebar",
      "the sidebar lists the Reading List",
    ),
  );
  await c.check(
    "safari.sidebar.segment-bookmarks",
    async () => {
      await safari(page)
        .getByRole("radio", { name: "Bookmarks" })
        .or(safari(page).getByRole("button", { name: "Bookmarks", exact: true }))
        .first()
        .click();
      return tree("Bookmarks")
        .waitFor({ timeout: 5_000 })
        .then(() => true);
    },
    meta(
      "sidebar",
      "radio",
      "Bookmarks",
      "click the book segment at the top of the sidebar",
      "the sidebar lists the bookmarks",
    ),
  );
  await c.check(
    "safari.sidebar.reading-list-item",
    async () => {
      await chooseMenu(page, "Bookmarks", "Show Reading List");
      await tree("Reading List").waitFor({ timeout: 5_000 });
      await safari(page).getByRole("button", { name: "New Tab" }).click();
      await tree("Reading List").getByRole("treeitem").first().click();
      return settled(page, CATALINA);
    },
    meta(
      "sidebar",
      "treeitem",
      "/.+ - Wikipedia/",
      "Bookmarks > Show Reading List, click its item",
      "the saved page opens",
      "restart",
    ),
  );
  await c.check(
    "safari.sidebar.bookmark-item",
    async () => {
      await chooseMenu(page, "Bookmarks", "Show Bookmarks");
      await tree("Bookmarks").waitFor({ timeout: 5_000 });
      await tree("Bookmarks")
        .getByRole("treeitem", { name: kept.bookmark ?? "Wikipedia", exact: true })
        .first()
        .click();
      return settled(page, kept.bookmark ? CATALINA : /wikipedia\.org/);
    },
    meta(
      "sidebar",
      "treeitem",
      "/.+ - Wikipedia/",
      "Bookmarks > Show Bookmarks, click the bookmark added",
      "the bookmark opens",
      "restart",
    ),
  );
  await c.check(
    "safari.sidebar.resize",
    async () => {
      const handle = safari(page)
        .getByRole("separator", { name: "Resize sidebar" })
        .or(safari(page).locator('[aria-label="Resize sidebar"]'))
        .first();
      const before = (await pane().boundingBox()).width;
      const h = await handle.boundingBox();
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2, { steps: 8 });
      await page.mouse.up();
      const after = (await pane().boundingBox()).width;
      return {
        ok: after - before >= 40,
        detail: `${Math.round(before)} -> ${Math.round(after)} px`,
      };
    },
    meta(
      "sidebar",
      "separator",
      "Resize sidebar",
      "drag the sidebar's edge 60 px right",
      "the sidebar widens",
    ),
  );
  await c.check(
    "safari.menu-view.sidebar",
    async () => {
      await chooseMenu(page, "View", "Hide Sidebar");
      await page.waitForTimeout(300);
      const hidden = !(await paneShown());
      await chooseMenu(page, "View", "Show Sidebar");
      await page.waitForTimeout(300);
      const shown = await paneShown();
      return { ok: hidden && shown, detail: `hidden ${hidden}, shown ${shown}` };
    },
    meta(
      "menu:View",
      "menuitem",
      "/(Hide|Show) Sidebar/",
      "View > Hide Sidebar, View > Show Sidebar",
      "the sidebar hides and shows",
    ),
  );
  await c.check(
    "safari.key.sidebar",
    async () => {
      await field(page).click();
      await page.keyboard.press("Control+Shift+KeyL");
      await page.waitForTimeout(300);
      const toggled = !(await paneShown());
      await page.keyboard.press("Control+Shift+KeyL");
      await page.waitForTimeout(300);
      return {
        ok: toggled && (await paneShown()),
        detail: `Control+Shift+L hid the sidebar: ${toggled}`,
      };
    },
    meta("keyboard", "shortcut", "⇧⌘L", "Control+Shift+L, twice", "the sidebar hides and shows"),
  );
  await c.check(
    "safari.key.show-bookmarks",
    async () => {
      await chooseMenu(page, "View", "Hide Sidebar").catch(() => {});
      await field(page).click();
      await page.keyboard.press("Control+Alt+KeyB");
      const shown = await safari(page)
        .getByRole("heading", { level: 1, name: "Bookmarks" })
        .waitFor({ timeout: 3_000 })
        .then(
          () => true,
          () => false,
        );
      return { ok: shown, detail: `Control+Alt+B showed Edit Bookmarks: ${shown}` };
    },
    meta("keyboard", "shortcut", "⌥⌘B", "Control+Alt+B", "the Edit Bookmarks page shows"),
  );
  await c.na(
    "safari.key.show-reading-list",
    "⌃⌘2 names Control and Command, which match only on Apple platforms (menu-key-commands.ts); Bookmarks > Show Reading List is verified",
    meta(
      "keyboard",
      "shortcut",
      "⌃⌘2",
      "Control+Command+2",
      "the Reading List shows (Apple platforms only)",
    ),
    async () => {
      await safari(page).click({ position: { x: 300, y: 12 } });
      await page.keyboard.press("Control+Meta+Digit2");
      const tree = safari(page).getByRole("tree", { name: "Reading List", exact: true });
      return tree.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      );
    },
  );
  await chooseMenu(page, "View", "Hide Sidebar").catch(() => {});
  // With the sidebar hidden already there was no such item, and the menu is still open.
  await closeMenus(page);

  // ── Favorites bar, Bookmarks menu ──
  await c.check(
    "safari.menu-view.favorites-bar",
    async () => {
      // The menu chosen just before this one may still be fading out.
      await page.waitForTimeout(400);
      await chooseMenu(page, "View", "Hide Favorites Bar");
      const hidden = (await bar(page).count()) === 0;
      await chooseMenu(page, "View", "Show Favorites Bar");
      return { ok: hidden && (await bar(page).count()) === 1, detail: `hidden ${hidden}` };
    },
    meta(
      "menu:View",
      "menuitem",
      "Hide Favorites Bar",
      "View > Hide Favorites Bar, then Show",
      "the bar hides and shows",
    ),
  );
  await c.check(
    "safari.key.favorites-bar",
    async () => {
      await field(page).click();
      await page.keyboard.press("Control+Shift+KeyB");
      await page.waitForTimeout(300);
      const hidden = (await bar(page).count()) === 0;
      await page.keyboard.press("Control+Shift+KeyB");
      await page.waitForTimeout(300);
      return { ok: hidden && (await bar(page).count()) === 1, detail: `hidden ${hidden}` };
    },
    meta(
      "keyboard",
      "shortcut",
      "⇧⌘B",
      "Control+Shift+B, twice",
      "the Favorites bar hides and shows",
    ),
  );
  for (const site of SITES) {
    await c.check(
      `safari.menu-bookmarks.${slug(site)}`,
      async () => {
        await chooseMenu(page, "Bookmarks", site);
        return settled(page, landed.get(site) ?? /./);
      },
      meta(
        "menu:Bookmarks",
        "menuitem",
        site,
        `Bookmarks > ${site}`,
        "the bookmark opens in the tab",
      ),
    );
  }
  await go(page, CATALINA);
  await c.check(
    "safari.menu-bookmarks.add-bookmark",
    async () => {
      await go(page, MOJAVE);
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/safari/bookmarks",
        { timeout: 10_000 },
      );
      await chooseMenu(page, "Bookmarks", "Add Bookmark…");
      await page
        .getByRole("dialog", { name: "Add this page to:" })
        .getByRole("button", { name: "Add" })
        .click();
      return (
        (await saved).status() === 200 &&
        (await api(page, "GET", "/api/safari/bookmarks")).text.includes(MOJAVE)
      );
    },
    meta(
      "menu:Bookmarks",
      "menuitem",
      "Add Bookmark",
      "Bookmarks > Add Bookmark",
      "the page joins the bookmarks, on the server",
      "restart",
    ),
  );
  await c.check(
    "safari.menu-bookmarks.add-reading-list",
    async () => {
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          new URL(r.url()).pathname === "/api/safari/reading-list",
        { timeout: 10_000 },
      );
      await chooseMenu(page, "Bookmarks", "Add to Reading List");
      return (
        (await saved).status() === 200 &&
        (await api(page, "GET", "/api/safari/reading-list")).text.includes(MOJAVE)
      );
    },
    meta(
      "menu:Bookmarks",
      "menuitem",
      "Add to Reading List",
      "Bookmarks > Add to Reading List",
      "the page joins the Reading List",
      "restart",
    ),
  );
  await c.check(
    "safari.key.add-bookmark",
    async () => {
      await go(page, "en.wikipedia.org/wiki/MacOS_Big_Sur");
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/safari/bookmarks",
        { timeout: 10_000 },
      );
      await field(page).click();
      await page.keyboard.press("Control+KeyD");
      await page
        .getByRole("dialog", { name: "Add this page to:" })
        .getByRole("button", { name: "Add" })
        .click();
      return (
        (await saved).status() === 200 &&
        (await api(page, "GET", "/api/safari/bookmarks")).text.includes("Big_Sur")
      );
    },
    meta("keyboard", "shortcut", "⌘D", "Control+D", "Add Bookmark"),
  );
  await c.check(
    "safari.key.add-reading-list",
    async () => {
      const saved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          new URL(r.url()).pathname === "/api/safari/reading-list",
        { timeout: 10_000 },
      );
      await field(page).click();
      await page.keyboard.press("Control+Shift+KeyD");
      return (
        (await saved).status() === 200 &&
        (await api(page, "GET", "/api/safari/reading-list")).text.includes("Big_Sur")
      );
    },
    meta("keyboard", "shortcut", "⇧⌘D", "Control+Shift+D", "Add to Reading List"),
  );

  // ── History, Home, Back and Forward from the menu and keys ──
  await go(page, CATALINA);
  await go(page, MOJAVE);
  await c.check(
    "safari.menu-history.back",
    async () => {
      await chooseMenu(page, "History", "Back");
      await fieldIs(page, CATALINA);
      return true;
    },
    meta("menu:History", "menuitem", "Back", "History > Back", "the previous page"),
  );
  await c.check(
    "safari.menu-history.forward",
    async () => {
      await chooseMenu(page, "History", "Forward");
      await fieldIs(page, MOJAVE);
      return true;
    },
    meta("menu:History", "menuitem", "Forward", "History > Forward", "the next page"),
  );
  await c.check(
    "safari.key.back-forward",
    async () => {
      await field(page).click();
      await page.keyboard.press("Control+BracketLeft");
      await fieldIs(page, CATALINA);
      await page.keyboard.press("Control+BracketRight");
      await fieldIs(page, MOJAVE);
      return true;
    },
    meta("keyboard", "shortcut", "⌘[ ⌘]", "Control+[ then Control+]", "back, then forward"),
  );
  await c.check(
    "safari.menu-view.reload",
    async () => {
      const answered = pageAnswer(page);
      await chooseMenu(page, "View", "Reload Page");
      return (await (await answered).json()).ok === true;
    },
    meta("menu:View", "menuitem", "Reload Page", "View > Reload Page", "the page is fetched again"),
  );
  await c.check(
    "safari.key.reload",
    async () => {
      const answered = pageAnswer(page);
      await field(page).click();
      await page.keyboard.press("Control+KeyR");
      return (await (await answered).json()).ok === true;
    },
    meta("keyboard", "shortcut", "⌘R", "Control+R", "the page is fetched again"),
  );
  await c.check(
    "safari.menu-view.stop",
    async () => {
      await field(page).click();
      await field(page).fill("en.wikipedia.org/wiki/Unix");
      await field(page).press("Enter");
      await chooseMenu(page, "View", "Stop");
      await safari(page)
        .getByRole("button", { name: "Reload this page" })
        .waitFor({ timeout: 5_000 });
      return true;
    },
    meta(
      "menu:View",
      "menuitem",
      "Stop",
      "press Return on an address, then View > Stop while it loads",
      "loading stops",
    ),
  );
  await c.check(
    "safari.key.stop",
    async () => {
      await field(page).click();
      await field(page).fill("en.wikipedia.org/wiki/Plan_9_from_Bell_Labs");
      await field(page).press("Enter");
      await page.keyboard.press("Control+Period");
      await safari(page)
        .getByRole("button", { name: "Reload this page" })
        .waitFor({ timeout: 5_000 });
      return true;
    },
    meta("keyboard", "shortcut", "⌘.", "Control+. while a page loads", "loading stops"),
  );
  await go(page, MOJAVE);
  await c.check(
    "safari.menu-view.reader",
    async () => {
      await chooseMenu(page, "View", "Show Reader");
      await safari(page).locator("article").first().waitFor({ timeout: 8_000 });
      await chooseMenu(page, "View", "Hide Reader");
      await safari(page).locator("article").first().waitFor({ state: "detached", timeout: 5_000 });
      return true;
    },
    meta(
      "menu:View",
      "menuitem",
      "Show Reader",
      "View > Show Reader, then Hide Reader",
      "Reader shows and hides",
    ),
  );
  await c.check(
    "safari.key.reader",
    async () => {
      await field(page).click();
      await page.keyboard.press("Control+Shift+KeyR");
      const shown = await safari(page)
        .locator("article")
        .first()
        .waitFor({ timeout: 8_000 })
        .then(
          () => true,
          () => false,
        );
      if (shown) await page.keyboard.press("Control+Shift+KeyR");
      return { ok: shown, detail: `Control+Shift+R showed Reader: ${shown}` };
    },
    meta("keyboard", "shortcut", "⇧⌘R", "Control+Shift+R", "Reader shows"),
  );
  const historyRegion = safari(page).getByRole("region", { name: "History" });
  await c.check(
    "safari.menu-history.show-all",
    async () => {
      await chooseMenu(page, "History", "Show All History");
      await historyRegion.waitFor({ timeout: 8_000 });
      const listed = await historyRegion
        .getByText(/Catalina/)
        .first()
        .waitFor({ timeout: 8_000 })
        .then(
          () => true,
          () => false,
        );
      await c.crawl("history", safari(page));
      return { ok: listed, detail: `the Catalina visit listed: ${listed}` };
    },
    meta(
      "menu:History",
      "menuitem",
      "Show All History",
      "History > Show All History",
      "the History page lists the visits",
      "restart",
    ),
  );
  await c.check(
    "safari.history.search",
    async () => {
      await historyRegion.getByRole("searchbox", { name: "Search History" }).fill("mojave");
      // The server is asked as the words settle, and the list follows its answer.
      const titled = () => historyRegion.locator(".mac-safari-history-title").allInnerTexts();
      for (let waited = 0; waited < 5_000; waited += 200) {
        const now = await titled();
        if (now.length > 0 && now.every((t) => /mojave/i.test(t))) break;
        await page.waitForTimeout(200);
      }
      const titles = await titled();
      return {
        ok: titles.length > 0 && titles.every((t) => /mojave/i.test(t)),
        detail: titles.slice(0, 4).join(" | "),
      };
    },
    meta(
      "history",
      "searchbox",
      "Search History",
      'type "mojave" in History\'s search',
      "only matching visits remain",
    ),
  );
  await c.check(
    "safari.history.entry",
    async () => {
      await historyRegion.locator(".mac-safari-history-title").first().click();
      return settled(page, MOJAVE);
    },
    meta(
      "history",
      "link",
      "/.+ - Wikipedia/",
      "click a visit on the History page",
      "it opens in the tab",
    ),
  );
  await c.check(
    "safari.key.history",
    async () => {
      await field(page).click();
      await page.keyboard.press("Control+KeyY");
      const shown = await historyRegion.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      );
      return { ok: shown, detail: `Control+Y showed History: ${shown}` };
    },
    meta("keyboard", "shortcut", "⌘Y", "Control+Y", "the History page"),
  );
  await c.check(
    "safari.start-page.show-all-history",
    async () => {
      await safari(page).getByRole("button", { name: "New Tab" }).click();
      await safari(page).getByRole("button", { name: "Show All History" }).click();
      return historyRegion.waitFor({ timeout: 5_000 }).then(() => true);
    },
    meta(
      "window",
      "button",
      "Show All History",
      "on a new tab's start page, click Show All History",
      "the History page",
    ),
  );
  await c.check(
    "safari.menu-history.recent-visit",
    async () => {
      const menu = await openMenuTitle(page, "History");
      await c.crawl("menu:History (with visits)", menu);
      await menu
        .getByRole("menuitem", { name: /Catalina/ })
        .first()
        .click();
      return settled(page, CATALINA);
    },
    meta(
      "menu:History",
      "menuitem",
      "/.+ - Wikipedia/",
      "History > a recent visit",
      "the visit opens in the tab",
    ),
  );
  await c.check(
    "safari.menu-history.home",
    async () => {
      await chooseMenu(page, "History", "Home");
      await safari(page)
        .getByRole("link", { name: "Wikipedia" })
        .first()
        .waitFor({ timeout: 5_000 });
      return true;
    },
    meta("menu:History", "menuitem", "Home", "History > Home", "the start page"),
  );
  await c.check(
    "safari.key.home",
    async () => {
      await go(page, CATALINA);
      await field(page).click();
      await page.keyboard.press("Control+Shift+KeyH");
      const home = await safari(page)
        .getByRole("link", { name: "Wikipedia" })
        .first()
        .waitFor({ timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      return { ok: home, detail: `Control+Shift+H went home: ${home}` };
    },
    meta("keyboard", "shortcut", "⇧⌘H", "Control+Shift+H", "the start page"),
  );
  const inField = async () => {
    for (let i = 0; i < 15; i += 1) {
      const ok = await page.evaluate(() => {
        const input = document.activeElement;
        return (
          input instanceof HTMLInputElement &&
          input.getAttribute("aria-label") === "Search or enter website name" &&
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length &&
          input.value.length > 0
        );
      });
      if (ok) return true;
      await page.waitForTimeout(150);
    }
    return false;
  };
  // The window takes the keyboard from a press on a spot of it that is no control: the empty end of the
  // Favorites bar (the window itself is focusable, so the press focuses it, not the address field).
  const windowKeyboard = async () => {
    const b = await bar(page).boundingBox();
    await page.mouse.click(b.x + b.width - 6, b.y + b.height / 2);
  };
  await c.check(
    "safari.menu-file.open-location",
    async () => {
      await go(page, CATALINA);
      await windowKeyboard();
      await chooseMenu(page, "File", "Open Location");
      const ok = await inField();
      return {
        ok,
        detail: `focus on ${await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName)}`,
      };
    },
    meta(
      "menu:File",
      "menuitem",
      "Open Location…",
      "File > Open Location…",
      "the address field has the keyboard, its text selected",
    ),
  );
  await c.check(
    "safari.key.open-location",
    async () => {
      await windowKeyboard();
      const before = await page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-label") ??
          document.activeElement?.className ??
          "",
      );
      await page.keyboard.press("Control+KeyL");
      const ok = await inField();
      return {
        ok,
        detail: `keyboard on "${String(before).slice(0, 40)}" before; in the field after: ${ok}`,
      };
    },
    meta(
      "keyboard",
      "shortcut",
      "⌘L",
      "click the empty end of the Favorites bar, then Control+L",
      "the address field has the keyboard, its text selected",
    ),
  );

  // ── Download Linked File: a listed site's file into Downloads, under the 1 MiB cap ──
  await c.check(
    "safari.download.to-downloads",
    async () => {
      const before = new Set(
        ((await api(page, "GET", "/api/files")).json?.entries ?? []).map((e) => e.id),
      );
      const reply = await go(page, LOGO);
      const button = safari(page).getByRole("button", { name: "Download to Downloads Folder" });
      await button.click({ timeout: 10_000 });
      await safari(page)
        .getByText(/is in your Downloads folder/)
        .waitFor({ timeout: 20_000 });
      const entry = ((await api(page, "GET", "/api/files")).json?.entries ?? []).find(
        (e) => e.parent === "downloads" && e.kind === "file" && !before.has(e.id),
      );
      const original = Buffer.from(await (await fetch(LOGO)).arrayBuffer());
      const stored = entry
        ? await page.evaluate(
            async ({ id, version }) => [
              ...new Uint8Array(
                await (
                  await fetch(
                    `/api/files/content/${encodeURIComponent(id)}?piece=0&count=8&version=${version}`,
                  )
                ).arrayBuffer(),
              ),
            ],
            { id: entry.id, version: entry.version ?? 0 },
          )
        : [];
      const sha = (b) => createHash("sha256").update(Buffer.from(b)).digest("hex");
      kept.download = entry?.name ?? null;
      return {
        ok:
          reply.kind === "unsupported" &&
          entry?.size === original.length &&
          sha(stored) === sha(original),
        detail: `${entry?.name}, ${entry?.size} bytes, sha256 ${sha(stored).slice(0, 12)}`,
      };
    },
    meta(
      "file page",
      "button",
      "Download to Downloads Folder",
      "open a listed site's PNG, click Download to Downloads Folder",
      "the file is in Downloads, byte for byte",
      "restart",
    ),
  );
  await c.check(
    "safari.download.show-in-finder",
    async () => {
      await safari(page).getByRole("button", { name: "Show in Finder" }).click();
      const finder = page.locator(".mac-finder").first();
      await finder.waitFor({ state: "visible", timeout: 10_000 });
      await finder
        .getByText(kept.download ?? "Wikipedia-logo-v2.png", { exact: true })
        .first()
        .waitFor({ timeout: 10_000 });
      await finder.getByRole("button", { name: "Close" }).first().click();
      await openApp(page, "Safari");
      return true;
    },
    meta(
      "file page",
      "button",
      "Show in Finder",
      "click Show in Finder",
      "Finder opens Downloads with the file",
    ),
  );
  await c.check(
    "safari.download.over-cap",
    async () => {
      const reply = await go(page, BIG);
      await safari(page)
        .getByText(/larger than the 1 MB/)
        .waitFor({ timeout: 10_000 });
      const offered = await safari(page)
        .getByRole("button", { name: "Download to Downloads Folder" })
        .count();
      return {
        ok: reply.kind === "too-large" && offered === 0,
        detail: `${reply.kind}; download offered ${offered}`,
      };
    },
    meta(
      "file page",
      "url",
      BIG,
      "open a 1.8 MB file of a listed site",
      "refused: larger than the 1 MB a Ferrite application can fetch; no download offered",
    ),
  );

  // ── Preferences: a window whose panes are the tabs of the tablist "Safari preferences" ──
  const prefsTabs = page.getByRole("tablist", { name: "Safari preferences", exact: true });
  const prefs = prefsTabs.locator(
    'xpath=ancestor::*[@role="region" or @role="dialog" or contains(concat(" ", @class, " "), " mac-window ")][1]',
  );
  const PANES = [
    "General",
    "Tabs",
    "AutoFill",
    "Passwords",
    "Search",
    "Security",
    "Privacy",
    "Websites",
    "Extensions",
    "Advanced",
  ];
  for (const paneName of PANES) {
    await c.check(
      `safari.preferences.pane-${slug(paneName)}`,
      async () => {
        if (!(await prefsTabs.isVisible().catch(() => false)))
          await chooseMenu(page, "Safari", "Preferences…");
        await prefsTabs.waitFor({ timeout: 8_000 });
        const tab = prefsTabs.getByRole("tab", { name: paneName, exact: true });
        await tab.click();
        await page.waitForTimeout(200);
        const selected = (await tab.getAttribute("aria-selected")) === "true";
        await c.crawl(`preferences:${paneName}`, prefs);
        const controls =
          (await prefs.getByRole("checkbox").count()) +
          (await prefs.getByRole("combobox").count()) +
          (await prefs.getByRole("button").count());
        return { ok: selected, detail: `selected ${selected}; ${controls} controls in the pane` };
      },
      meta(
        "preferences",
        "tab",
        paneName,
        `Safari > Preferences…, click ${paneName}`,
        "the pane comes up, selected in the toolbar",
      ),
    );
  }
  await c.check(
    "safari.preferences.checkbox",
    async () => {
      await prefsTabs.getByRole("tab", { name: "General", exact: true }).click();
      const box = prefs.getByRole("checkbox").first();
      const name = (
        (await box.getAttribute("aria-label")) ??
        (await box.evaluate(
          (e) => e.closest("label")?.textContent ?? e.parentElement?.textContent ?? "",
        ))
      ).trim();
      const before = await box.isChecked();
      await box.click();
      const after = await box.isChecked();
      kept.preference = { name, checked: after };
      return { ok: after === !before, detail: `${name}: ${before} -> ${after}` };
    },
    meta(
      "preferences",
      "checkbox",
      "/.*/",
      "click the first checkbox in General",
      "it toggles and is kept",
      "restart",
    ),
  );
  await c.check(
    "safari.preferences.popup",
    async () => {
      // A pop-up that changes nothing the rest of the run reads: Safari opens with would change the restart's window.
      const popup = prefs.getByRole("combobox", { name: "Top Sites shows:", exact: true });
      if (!(await popup.isEnabled().catch(() => false))) return { ok: false, detail: "not usable" };
      // Open it and choose another item with the pointer, as a person does; the button then shows it.
      const before = (await popup.innerText()).trim();
      await popup.click();
      // Another application's list can be open behind: this one holds the choice the button shows.
      const options = page
        .getByRole("listbox")
        .filter({ has: page.getByRole("option", { name: before, exact: true }) })
        .last()
        .getByRole("option");
      await options.first().waitFor({ timeout: 5_000 });
      const names = (await options.allInnerTexts()).map((text) => text.trim());
      const other = names.find((text) => text && text !== before);
      if (other) await options.filter({ hasText: other }).first().click();
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const after = (await popup.innerText()).trim();
      return { ok: after !== "" && after !== before, detail: `${before} -> ${after}` };
    },
    meta(
      "preferences",
      "combobox",
      "/.*/",
      "choose another value in General's Top Sites pop-up",
      "the pop-up shows it",
    ),
  );
  await page.keyboard.press("Escape");
  const prefsClose = prefs.getByRole("button", { name: "Close" }).first();
  if (await prefsClose.isVisible().catch(() => false)) await prefsClose.click();

  // Preferences act: the homepage is where Home goes, and a dimmed control says why.
  const openPrefs = async (paneName) => {
    if (!(await prefsTabs.isVisible().catch(() => false)))
      await chooseMenu(page, "Safari", "Preferences…");
    await prefsTabs.waitFor({ timeout: 8_000 });
    await prefsTabs.getByRole("tab", { name: paneName, exact: true }).click();
  };
  await c.check(
    "safari.preferences.homepage-acts",
    async () => {
      await openPrefs("General");
      await prefs.getByRole("textbox", { name: "Homepage:" }).fill(MOJAVE);
      await prefs.getByRole("button", { name: "Close" }).first().click();
      await chooseMenu(page, "History", "Home");
      await frames(page).first().waitFor({ timeout: PAGE_MS });
      const shown = await field(page).inputValue();
      await openPrefs("General");
      await prefs.getByRole("textbox", { name: "Homepage:" }).fill("");
      await prefs.getByRole("button", { name: "Close" }).first().click();
      return { ok: shown === MOJAVE, detail: `Home went to ${shown}` };
    },
    meta(
      "preferences",
      "textbox",
      "Homepage:",
      "set the homepage, close, History > Home",
      "Home opens the homepage",
    ),
  );
  await c.check(
    "safari.preferences.dimmed-says-why",
    async () => {
      await openPrefs("Privacy");
      const manage = prefs.getByRole("button", { name: "Manage Website Data…" });
      const dimmed = await manage.isDisabled();
      const reason = await prefs
        .getByText("Safari here holds no website data to manage.")
        .isVisible();
      await shot(page, out, `safari-preferences-privacy-${browserName}`);
      await prefs.getByRole("button", { name: "Close" }).first().click();
      return { ok: dimmed && reason, detail: `dimmed ${dimmed}; reason shown ${reason}` };
    },
    meta(
      "preferences",
      "button",
      "Manage Website Data…",
      "Privacy pane",
      "dimmed, with its reason in the pane",
    ),
  );
  await c.check(
    "safari.edit.cut-in-the-field",
    async () => {
      await field(page).click();
      await field(page).fill("cut me");
      await field(page).selectText();
      await chooseMenu(page, "Edit", "Cut");
      await page.waitForTimeout(500);
      const left = await field(page).inputValue();
      await page.keyboard.press("Escape");
      return { ok: left === "", detail: `the field holds "${left}"` };
    },
    meta(
      "menu:Edit",
      "menuitem",
      "Cut",
      "text selected in the field, Edit > Cut",
      "it leaves the field",
    ),
  );
  await c.check(
    "safari.edit.page-in-front",
    async () => {
      await go(page, CATALINA);
      await frames(page).first().waitFor({ timeout: PAGE_MS });
      await field(page).click();
      await frames(page)
        .first()
        .click({ position: { x: 200, y: 200 } });
      const menu = await openMenuTitle(page, "Edit");
      const state = async (name) =>
        menu.getByRole("menuitem", { name, exact: true }).getAttribute("aria-disabled");
      const undo = await state("Undo");
      const why = await menu
        .getByRole("menuitem", { name: "Undo", exact: true })
        .getAttribute("title");
      const copy = await state("Copy");
      await shot(page, out, `safari-edit-menu-${browserName}`);
      await closeMenus(page);
      return {
        ok: undo === "true" && Boolean(why) && copy !== "true",
        detail: `Undo dimmed ${undo} (${why}); Copy dimmed ${copy}`,
      };
    },
    meta(
      "menu:Edit",
      "menuitem",
      "Undo",
      "click in the page, open Edit",
      "the field's rows are dimmed, saying why; Copy goes to the page",
    ),
  );
  await c.check(
    "safari.file.save-as-sheet",
    async () => {
      await go(page, CATALINA);
      await frames(page).first().waitFor({ timeout: PAGE_MS });
      await chooseMenu(page, "File", "Save As…");
      const sheet = page.getByRole("dialog").last();
      await sheet.getByRole("textbox", { name: "Save As" }).fill("Named by census");
      await shot(page, out, `safari-save-as-${browserName}`);
      await sheet.getByRole("button", { name: "Save" }).click();
      const row = page.locator(".mac-safari-downloads").getByText("Named by census.html");
      await row.waitFor({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      return { ok: true, detail: "on the Downloads list under the chosen name" };
    },
    meta(
      "menu:File",
      "menuitem",
      "Save As…",
      "File > Save As…, name it, Save",
      "the page is saved to Downloads under that name",
    ),
  );

  // ── A link from another app: News's Read Full Story opens in Safari, in a new tab in front ──
  await c.check(
    "safari.open-url.from-news",
    async () => {
      const before = await tabCount();
      const news = await openApp(page, "News");
      const lead = news.locator(".mac-news-story-link").first();
      await lead.waitFor({ timeout: 30_000 });
      await lead.click();
      await news.getByRole("button", { name: "Read Full Story" }).click();
      await safari(page).waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(1_500);
      const after = await tabCount();
      const said = await news
        .getByRole("status")
        .filter({ hasText: "Safari" })
        .innerText({ timeout: 5_000 })
        .catch(() => "");
      await closeApp(page, "News");
      await openApp(page, "Safari");
      return {
        ok: after === Math.max(before, 1) + 1 && /Safari/.test(said),
        detail: `${before} -> ${after} tabs; News says "${said}"`,
      };
    },
    meta(
      "URL dispatch",
      "url",
      "News > Read Full Story",
      "in News choose a story, click Read Full Story",
      "Safari opens the story in a new tab in front",
    ),
  );

  // ── Window chrome and the desktop-filled menu rows ──
  await commonRows(c, page, {
    id: "safari",
    name: "Safari",
    preferences: async (p) => {
      const tabsList = p.getByRole("tablist", { name: "Safari preferences", exact: true });
      const shown = await tabsList.waitFor({ timeout: 8_000 }).then(
        () => true,
        () => false,
      );
      const dialog = tabsList.locator(
        'xpath=ancestor::*[@role="region" or @role="dialog" or contains(concat(" ", @class, " "), " mac-window ")][1]',
      );
      await p.keyboard.press("Escape");
      const close = dialog.getByRole("button", { name: "Close" }).first();
      if (await close.isVisible().catch(() => false)) await close.click();
      return shown;
    },
  });
  const menus = await (async () => {
    const { crawlMenus } = await import("./r5-census-kit.mjs");
    return crawlMenus(page);
  })();
  for (const control of menus.rows) c.crawled.push(control);

  // ── After a reload: tabs, bookmarks, Reading List ──
  kept.tabs = (await api(page, "GET", "/api/safari/tabs")).json?.tabs ?? null;
  await c.check(
    "safari.persist.reload",
    async () => {
      await page.waitForTimeout(1_000);
      await reloadDesktop(page);
      await openApp(page, "Safari");
      await page.waitForTimeout(1_500);
      const tabsNow = (await api(page, "GET", "/api/safari/tabs")).json?.tabs ?? null;
      const shown = await tabCount();
      const onBar = kept.bookmark
        ? await bar(page).getByText(kept.bookmark, { exact: true }).count()
        : 0;
      return {
        ok:
          JSON.stringify(tabsNow) === JSON.stringify(kept.tabs) &&
          shown === (kept.tabs?.length ?? 0) &&
          onBar === 1,
        detail: `${shown} tabs shown, server ${JSON.stringify(tabsNow)}, bookmark on the bar ${onBar}`,
      };
    },
    meta(
      "window",
      "reload",
      "tabs, bookmarks",
      "reload the desktop, open Safari",
      "the same tabs in the same order, the bookmark on the bar",
      "reload",
    ),
  );

  // ── Another account sees none of it ──
  await isolation(browser, kept, "safari.isolation.write");
  return kept;
}

/** A second account, made now, has none of the first account's Safari data. */
async function isolation(browser, kept, id) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("safari", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account" },
      );
      try {
        const docs = {};
        for (const doc of ["bookmarks", "reading-list", "tabs", "history"])
          docs[doc] = (await api(other, "GET", `/api/safari/${doc}`)).text;
        const files = (await api(other, "GET", "/api/files")).text;
        await openApp(other, "Safari");
        const onBar = kept.bookmark
          ? await bar(other).getByText(kept.bookmark, { exact: true }).count()
          : 0;
        const leaks = Object.entries(docs)
          .filter(
            ([, body]) =>
              body.includes("MacOS_Catalina") ||
              body.includes("MacOS_Mojave") ||
              body.includes("Big_Sur"),
          )
          .map(([k]) => k);
        if (kept.download && files.includes(kept.download)) leaks.push("downloads");
        if (onBar > 0) leaks.push("favorites bar");
        return {
          ok: leaks.length === 0,
          detail: leaks.length
            ? `the second account sees: ${leaks.join(", ")}`
            : "the second account sees none of it",
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "Safari data",
      "sign up a second account in another browser context, read its Safari documents and Downloads, open Safari",
      "none of the first account's bookmarks, Reading List, tabs, history or download",
      "restart",
    ),
  );
}

/** After a real same-root restart: the account signs in again and finds what Safari kept. */
async function restartPhase(browser) {
  const state = loadState(out, "safari", browserName);
  const page = await person(browser, c, base, state.account, { create: false });
  await openApp(page, "Safari");
  await page.waitForTimeout(1_500);
  const kept = state.kept;
  await c.check(
    "safari.persist.restart.tabs",
    async () => {
      const tabsNow = (await api(page, "GET", "/api/safari/tabs")).json?.tabs ?? null;
      const shown = await tabs(page).count();
      return {
        ok:
          JSON.stringify(tabsNow) === JSON.stringify(kept.tabs) &&
          shown === (kept.tabs?.length ?? 0),
        detail: `${shown} tabs shown; server ${JSON.stringify(tabsNow)}; before ${JSON.stringify(kept.tabs)}`,
      };
    },
    meta(
      "window",
      "restart",
      "tabs",
      "restart ferrite dev on the same root, sign in, open Safari",
      "the same tabs in the same order",
      "restart",
    ),
  );
  await c.check(
    "safari.persist.restart.bookmarks",
    async () => {
      const onBar = await bar(page).getByText(kept.bookmark, { exact: true }).count();
      const server = (await api(page, "GET", "/api/safari/bookmarks")).text;
      return {
        ok: onBar === 1 && server.includes("MacOS_Mojave") && server.includes("Big_Sur"),
        detail: `on the bar ${onBar}`,
      };
    },
    meta(
      "window",
      "restart",
      "bookmarks",
      "after the restart",
      "the bookmarks are there",
      "restart",
    ),
  );
  await c.check(
    "safari.persist.restart.reading-list",
    async () => {
      await chooseMenu(page, "Bookmarks", "Show Reading List");
      const tree = safari(page).getByRole("tree", { name: "Reading List", exact: true });
      await tree.waitFor({ timeout: 5_000 });
      const items = await tree.getByRole("treeitem").count();
      return { ok: items >= 3, detail: `${items} items` };
    },
    meta(
      "sidebar",
      "restart",
      "Reading List",
      "after the restart, Bookmarks > Show Reading List",
      "the saved pages are there",
      "restart",
    ),
  );
  await c.check(
    "safari.persist.restart.history",
    async () => {
      await chooseMenu(page, "History", "Show All History");
      const region = safari(page).getByRole("region", { name: "History" });
      await region.waitFor({ timeout: 8_000 });
      return (await region.getByText(/Catalina/).count()) > 0;
    },
    meta(
      "history",
      "restart",
      "History",
      "after the restart, History > Show All History",
      "the visits are there",
      "restart",
    ),
  );
  await c.check(
    "safari.persist.restart.download",
    async () => {
      const files = (await api(page, "GET", "/api/files")).json?.entries ?? [];
      return {
        ok: files.some((e) => e.name === kept.download && e.parent === "downloads"),
        detail: kept.download,
      };
    },
    meta(
      "Downloads",
      "restart",
      "downloaded file",
      "after the restart, the account's Downloads",
      "the file is there",
      "restart",
    ),
  );
  await c.check(
    "safari.persist.restart.preference",
    async () => {
      await chooseMenu(page, "Safari", "Preferences…");
      const tabsList = page.getByRole("tablist", { name: "Safari preferences", exact: true });
      await tabsList.waitFor({ timeout: 8_000 });
      await tabsList.getByRole("tab", { name: "General", exact: true }).click();
      const prefs = tabsList.locator(
        'xpath=ancestor::*[@role="region" or @role="dialog" or contains(concat(" ", @class, " "), " mac-window ")][1]',
      );
      const checked = await prefs.getByRole("checkbox").first().isChecked();
      return {
        ok: checked === kept.preference?.checked,
        detail: `${kept.preference?.name}: ${checked}`,
      };
    },
    meta(
      "preferences",
      "restart",
      "preference",
      "after the restart, Safari > Preferences…",
      "the checkbox is as it was left",
      "restart",
    ),
  );
  await isolation(browser, kept, "safari.isolation.restart");
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("safari", "a");
    const page = await person(browser, c, base, account);
    const kept = await writePhase(browser, page);
    saveState(out, "safari", browserName, { account, kept });
  }
} catch (error) {
  c.row("safari.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();
