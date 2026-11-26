#!/usr/bin/env node
// Safari on Ferrite: real pages. The module fetches pages of its listed sites, with their
// pictures and stylesheets, through the application's `web` egress, and the window shows them
// in a sandboxed frame that makes no request of its own:
//
// - type an address: Wikipedia's macOS Catalina article opens with its pictures put in, its
//   frame can neither reach the desktop page nor read a cookie, it sends no request, and its
//   policy refuses one to the desktop's own (loopback) address;
// - follow a link in the page, then Back, Forward and Reload, with the address field following;
// - Reader shows the article; words typed in the field open Wikipedia's search;
// - error pages: a metadata address is refused, and an article over the 1 MiB egress reply is
//   too large;
// - a page of a site the server may not reach is not framed: Safari says it opens outside
//   Safari, and "Open in New Browser Tab" opens it in a real tab;
// - the honest outside route, through a local HTTP fixture server this script starts and the
//   browser uses as its proxy for http://www.example.org/ws2/ (a public name the server's DNS
//   check resolves; every other request passes through it unchanged): pages that refuse being
//   framed (X-Frame-Options, CSP frame-ancestors) and an embeddable one are never framed, Safari
//   says it cannot tell, and the real tab gets each with its headers; a 3-hop redirect chain is
//   followed by the tab, a loop ends in the tab's own error, and a download arrives byte for
//   byte;
// - real hosts through the module: a name that does not exist is looked up first ("Safari Can't
//   Find the Server"), a malformed address is refused, an international name is sent in its
//   ASCII form, "1.5" is a search, a redirect naming its target is followed and one that does
//   not says so;
// - Add Bookmark puts the page on the Favorites bar and Add to Reading List keeps it for later;
//   after a reload Safari opens the tabs it had, the Reading List still has the page, and History
//   finds the visits;
// - every page that opened says whether the server kept its visit (`x-safari-history`; a skipped
//   one is kept by the window), and History has every one of them.
//
// Needs `ferrite dev --egress allow` (the default denies egress, and pages then do not open).
// Exits 0 only when every step passed and the desktop page logged no console error, page error,
// failed request or HTTP error. The journey puts back the session's Favorites, Reading List and
// tabs as they were before it, even when it stops early, and checks every request of that; the
// pages it visits stay in the session's history.
//
//   ferrite dev --egress allow                       # in ferrite-apps/desktop
//   node e2e/safari-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                               [--browser chromium|chrome|firefox|webkit]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { api, launch, nextResponse, options, shot } from "./app-journey.mjs";
import { ENGINES, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const CATALINA = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const MOJAVE = "https://en.wikipedia.org/wiki/MacOS_Mojave";
const MAIN_PAGE = "https://en.wikipedia.org/wiki/Main_Page";
const KEPT = ["bookmarks", "reading-list", "tabs"];
/** How long a page may take: the module's own budget is 7 s. */
const PAGE_MS = 15_000;

const problems = [];
const steps = [];
function step(label, ok, detail = "") {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
}

const ownOrigin = new URL(base).origin;
/** Whether something happened in the desktop page itself, not in a page Safari shows. */
const desktopsOwn = (page, frame, url) =>
  frame === page.mainFrame() && (!url || url.startsWith(ownOrigin) || url.startsWith("data:"));
/** Requests a page Safari shows sent anywhere: there must be none. */
const frameRequests = [];
/** Every page the module opened in the journey: its address, and whether the server said it kept
 * the visit in the history (`kept`) or left it to the window (`skipped`). */
const openedPages = [];
/** The address the journey asks a page to load, to see its policy refuse it. */
const PROBE = `${ownOrigin}/ferrite-site.json`;

function watch(page) {
  page.on("request", (request) => {
    const url = request.url();
    if (request.frame() !== page.mainFrame() && !/^(data|about|blob):/.test(url))
      frameRequests.push(url);
  });
  page.on("console", (message) => {
    const where = message.location()?.url ?? "";
    const own = where === "" || where.startsWith(ownOrigin);
    // A page the live site was too slow for: the platform's deadline answers it, and Safari says so.
    const slowPage = where.includes("/api/safari/page") && /504/.test(message.text());
    // The probe's refusal, which WebKit logs without the frame's address.
    const probed =
      message.text().includes(PROBE) && /content.security.policy/i.test(message.text());
    if (message.type() === "error" && own && !probed && !slowPage)
      problems.push(`console: ${message.text()}`);
    else if (message.type() === "error")
      console.log(`warn page console (${where}): ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    if (
      request.url().includes("/__forge/reload") &&
      /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure)
    )
      return;
    // The desktop's own live streams (`/live/`), which a reload of the page cancels, as
    // journey-kit.mjs allows: Firefox reports NS_BINDING_ABORTED, WebKit "Load request cancelled".
    if (
      new URL(request.url()).pathname.startsWith("/live/") &&
      /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure)
    )
      return;
    // A page load the window cancels itself (Stop, another address) is not a failure.
    if (
      request.url().includes("/api/safari/page") &&
      /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure)
    )
      return;
    if (desktopsOwn(page, request.frame(), request.url())) {
      problems.push(`request failed: ${request.url()} ${failure}`);
    } else console.log(`warn page request failed: ${request.url()} ${failure}`);
  });
  page.on("response", async (response) => {
    if (response.status() < 400) return;
    const request = response.request();
    if (response.status() === 504 && new URL(response.url()).pathname === "/api/safari/page") {
      console.log("warn the platform's deadline ended a page request");
      return;
    }
    if (desktopsOwn(page, request.frame(), response.url())) {
      // The request's body names what was refused (a document the server would not keep).
      const body = (request.postData() ?? "").slice(0, 300);
      problems.push(`HTTP ${response.status()}: ${response.url()}${body ? ` ${body}` : ""}`);
    } else console.log(`warn page resource HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname !== "/api/safari/page" || response.status() !== 200)
      return;
    const history = response.headers()["x-safari-history"] ?? null;
    openedPages.push(
      response.json().then(
        (body) => (body?.ok === true ? { url: body.url, history } : null),
        () => null,
      ),
    );
  });
}

const safari = (page) => page.getByRole("region", { name: "Safari", exact: true }).first();
const field = (page) => safari(page).getByRole("textbox", { name: "Search or enter website name" });

/**
 * What the module answered to the page request `act` starts: `null` when none came, as when the
 * window gave up on the request at its own deadline.
 */
function pageAnswer(page, act) {
  const isPage = (url) => new URL(url).pathname === "/api/safari/page";
  const answered = new Promise((resolve) => {
    const done = (value) => {
      clearTimeout(timer);
      page.off("response", onResponse);
      page.off("requestfailed", onFailed);
      resolve(value);
    };
    const onResponse = (response) => {
      if (isPage(response.url())) {
        response.json().then(done, () => done(null));
      }
    };
    const onFailed = (request) => {
      if (isPage(request.url())) done(null);
    };
    const timer = setTimeout(() => done(null), PAGE_MS);
    page.on("response", onResponse);
    page.on("requestfailed", onFailed);
  });
  return act().then(() => answered);
}

/** Whether the wait is the live site's or the sandbox's, not Safari's: asking again may do. */
const slow = (reply) => reply === null || reply.kind === "timeout";

/** Type in the address field and press Return; resolves with the module's answer. */
async function go(page, text) {
  let reply = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    reply = await pageAnswer(page, async () => {
      await field(page).click();
      await field(page).fill(text);
      await field(page).press("Enter");
    });
    if (!slow(reply)) return reply;
    console.log(`warn ${text} was slow to answer: asking again`);
  }
  throw new Error(`no answer for ${text} in four tries`);
}

/** Press Reload until the module answers; `enough` may ask for more than an answer. */
async function reloadPage(page, enough = () => true) {
  let reply = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    reply = await pageAnswer(page, () =>
      safari(page).getByRole("button", { name: "Reload this page" }).click(),
    );
    if (!slow(reply) && enough(reply)) return reply;
    console.log("warn the page was slow to answer: reloading again");
    await safari(page)
      .getByRole("button", { name: "Reload this page" })
      .waitFor({ timeout: PAGE_MS });
  }
  return reply;
}

/** The frame of the server-fetched page in front, once it shows `title`, reloaded if it was slow. */
async function fetchedFrame(page, title) {
  const frame = safari(page).locator(`iframe[title="${title}"]`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = await frame.waitFor({ state: "attached", timeout: PAGE_MS }).then(
      () => true,
      () => false,
    );
    if (shown) break;
    console.log(`warn ${title} did not open: reloading`);
    await reloadPage(page);
  }
  await frame.waitFor({ state: "attached", timeout: PAGE_MS });
  return frame;
}

async function waitForField(page, value) {
  await page.waitForFunction(
    ({ value }) =>
      document.querySelector(
        '[aria-label="Safari"] input[aria-label="Search or enter website name"]',
      )?.value === value,
    { value },
    { timeout: PAGE_MS },
  );
}

/** The honest-route fixtures, answered by the local fixture server below. */
const fixture = (name) => `http://www.example.org/ws2/${name}`;
const TITLES = {
  "refuses-xfo": "Refuses by X-Frame-Options",
  "refuses-csp": "Refuses by frame-ancestors",
  embeddable: "Embeddable",
  landed: "Landed",
};
const CSV = "symbol,price\nAAPL,339.50\n";
/** How often each fixture path was asked for, and the headers each fixture response had. */
const served = new Map();
const arrived = new Map();

/**
 * The local HTTP fixture server, which the journey's browser uses as its proxy. It answers
 * http://www.example.org/ws2/<name> itself, with real HTTP: refusal headers, 302 redirects
 * (followed by the browser, which Playwright's `route.fulfill` cannot do in every engine), a
 * redirect loop and an attachment. Every other request passes through unchanged: plain HTTP is
 * forwarded, HTTPS is tunnelled. The desktop itself (127.0.0.1) bypasses it.
 */
function answerFixture(name, res) {
  const html = (title, headers = {}) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...headers });
    res.end(`<!doctype html><title>${title}</title><h1>${title}</h1>`);
  };
  const hop = (to) => {
    res.writeHead(302, { location: to, "content-length": "0" });
    res.end();
  };
  if (name === "refuses-xfo") return html(TITLES[name], { "x-frame-options": "DENY" });
  if (name === "refuses-csp")
    return html(TITLES[name], { "content-security-policy": "frame-ancestors 'none'" });
  if (name === "embeddable" || name === "landed") return html(TITLES[name]);
  if (name === "hop1") return hop("/ws2/hop2");
  if (name === "hop2") return hop("/ws2/hop3");
  if (name === "hop3") return hop("/ws2/landed");
  if (name === "loop") return hop("/ws2/loop");
  if (name === "report.csv") {
    // application/octet-stream: WebKit shows a text/csv attachment in the tab instead of
    // downloading it (campaign/ws2/probe-download-webkit.mjs).
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-disposition": 'attachment; filename="report.csv"',
    });
    return res.end(CSV);
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("no such fixture");
}
const proxySockets = new Set();
const proxy = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (url.host === "www.example.org" && url.pathname.startsWith("/ws2/")) {
    served.set(url.pathname, (served.get(url.pathname) ?? 0) + 1);
    answerFixture(url.pathname.slice("/ws2/".length), res);
    return;
  }
  const upstream = http.request(url, { method: req.method, headers: req.headers }, (answer) => {
    res.writeHead(answer.statusCode ?? 502, answer.headers);
    answer.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});
proxy.on("connection", (socket) => {
  proxySockets.add(socket);
  socket.on("close", () => proxySockets.delete(socket));
});
proxy.on("connect", (req, socket, head) => {
  const [host, port] = req.url.split(":");
  const upstream = net.connect(Number(port) || 443, host, () => {
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  proxySockets.add(upstream);
  upstream.on("close", () => proxySockets.delete(upstream));
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const proxyServer = `http://127.0.0.1:${proxy.address().port}`;

/** Put one kept document back as it was (`null`: it did not exist); throws on any HTTP
 * status but 200. */
async function restore(page, document, kept) {
  const url = `/api/safari/${document}`;
  if (kept) {
    const current = await api(page, "GET", url);
    if (current.status !== 200) throw new Error(`GET HTTP ${current.status}`);
    const put = await api(page, "PUT", url, { ...kept, rev: current.json.rev });
    if (put.status !== 200) throw new Error(`PUT HTTP ${put.status}`);
  } else {
    const deleted = await api(page, "DELETE", url);
    if (deleted.status !== 200) throw new Error(`DELETE HTTP ${deleted.status}`);
  }
}
console.log(`safari in ${browserName}`);
const browser = await ENGINES[browserName].launch({
  proxy: { server: proxyServer, bypass: "127.0.0.1,localhost" },
});
/** The page, and what the session kept before the journey, restored at the end whatever
 * happens: the journey never deletes data it did not write. */
let page;
const before = new Map();
/** The file the journey downloaded into Downloads, deleted in the teardown whatever happens. */
let downloadedId = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // "Open in New Browser Tab" opens a real tab; this site is answered here, not fetched. The
  // honest-route fixtures are http://www.example.org/ws2/, answered by the fixture server.
  await context.route("https://www.example.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>Example</title>" }),
  );
  context.on("response", (response) => {
    if (response.url().startsWith(fixture(""))) arrived.set(response.url(), response.headers());
  });
  page = await context.newPage();
  watch(page);
  await openDesktop(page, base);
  const marker = await api(page, "GET", "/ferrite-site.json");
  step("the desktop is served from the site blob the app published", marker.status === 200);
  for (const document of KEPT) {
    const { status, json } = await api(page, "GET", `/api/safari/${document}`);
    if (status !== 200) throw new Error(`reading ${document} before the journey: HTTP ${status}`);
    const { rev: _rev, session: _session, ...fields } = json;
    before.set(document, Object.keys(fields).length > 0 ? fields : null);
  }

  await launch(page, "Safari");
  await safari(page).waitFor({ state: "visible", timeout: 10_000 });
  await safari(page).getByRole("link", { name: "Wikipedia" }).first().waitFor({ timeout: 10_000 });
  step(
    "Safari opens on Favorites, with the listed sites on the page and the Favorites bar",
    (await safari(page)
      .getByRole("navigation", { name: "Favorites bar" })
      .getByText("Wikipedia")
      .count()) > 0,
  );

  // ── A real page, in its sandbox ──
  let catalina = await go(page, "en.wikipedia.org/wiki/MacOS_Catalina");
  // A page answered near the module's budget goes without its pictures, by design.
  const hasPictures = (reply) => /<img[^>]+src="data:image\//.test(reply.html ?? "");
  if (catalina.ok === true && !hasPictures(catalina)) {
    await fetchedFrame(page, catalina.title);
    catalina = await reloadPage(page, hasPictures);
  }
  step(
    "the module fetched Wikipedia's article",
    catalina.ok === true && catalina.status === 200,
    `${catalina.title}, ${catalina.html?.length} characters`,
  );
  let frame = await fetchedFrame(page, catalina.title);
  const sandbox = await frame.getAttribute("sandbox");
  step(
    "the page is in a sandboxed frame without allow-same-origin",
    sandbox === "allow-scripts allow-forms allow-modals",
    sandbox ?? "none",
  );
  let content = await (await frame.elementHandle()).contentFrame();
  await content.locator("h1").first().waitFor({ timeout: PAGE_MS });
  step(
    "the article renders inside the Safari window",
    (await content.locator("h1").first().innerText()).includes("Catalina"),
    await content.locator("h1").first().innerText(),
  );
  const reach = await content.evaluate(() => {
    const tryIt = (f) => {
      try {
        f();
        return "reached";
      } catch {
        return "blocked";
      }
    };
    // A cookie: Chromium and Firefox throw in an opaque origin; WebKit reads ""
    // and drops what is written. Either way nothing of the desktop's is there.
    let cookie;
    try {
      // biome-ignore lint/suspicious/noDocumentCookie: the probe writes a cookie on purpose, to show the frame cannot.
      document.cookie = "safari_probe=1; path=/";
      cookie = document.cookie === "" ? "empty" : `read ${document.cookie}`;
    } catch {
      cookie = "blocked";
    }
    return {
      desktop: tryIt(() => window.parent.document.title),
      cookie,
      storage: tryIt(() => window.localStorage.length),
    };
  });
  const desktopCookies = await page.evaluate(() => document.cookie);
  step(
    "the page cannot reach the desktop page, its cookie or its storage",
    reach.desktop === "blocked" &&
      (reach.cookie === "blocked" || reach.cookie === "empty") &&
      reach.storage === "blocked" &&
      !desktopCookies.includes("safari_probe"),
    JSON.stringify(reach),
  );
  step(
    "the address field shows the page's address",
    (await field(page).inputValue()) === CATALINA,
    await field(page).inputValue(),
  );
  const pictures = await content.evaluate(() => ({
    inlined: [...document.images].filter((image) => image.src.startsWith("data:image/")).length,
    shown: [...document.images].filter(
      (image) => image.src.startsWith("data:image/") && image.complete && image.naturalWidth > 0,
    ).length,
    styles: document.querySelectorAll("style").length,
  }));
  step(
    "the article's pictures and stylesheets were fetched by the server and put in the page",
    pictures.inlined > 0 && pictures.shown > 0 && pictures.styles > 0,
    JSON.stringify(pictures),
  );
  step(
    "the page in Safari sent no request of its own",
    frameRequests.length === 0,
    frameRequests.slice(0, 3).join(", "),
  );
  // The policy refuses even the desktop's own address, which under `ferrite dev` is loopback.
  // (Chromium lists the refused attempt as a failed request; it is left out below.)
  const refused = await content.evaluate(
    (target) =>
      new Promise((resolve) => {
        const seen = [];
        document.addEventListener("securitypolicyviolation", (event) => {
          seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
        });
        const image = new Image();
        image.onload = () => resolve({ image: "loaded", seen });
        image.onerror = () => setTimeout(() => resolve({ image: "blocked", seen }), 200);
        image.src = target;
      }),
    PROBE,
  );
  step(
    "the page's policy refuses a picture from the desktop's own loopback address",
    refused.image === "blocked" && refused.seen.some((line) => line.startsWith("img-src")),
    JSON.stringify(refused),
  );
  await shot(page, path.join(out, `safari-wikipedia-${browserName}.png`));

  // ── A link in the page, Back, Forward, Reload ──
  let mojave = await pageAnswer(page, () =>
    content
      .locator('[data-safari-href="https://en.wikipedia.org/wiki/MacOS_Mojave"]')
      .first()
      .click(),
  );
  if (slow(mojave)) mojave = await reloadPage(page);
  await waitForField(page, MOJAVE);
  frame = await fetchedFrame(page, mojave.title);
  content = await (await frame.elementHandle()).contentFrame();
  await content.locator("h1").first().waitFor({ timeout: PAGE_MS });
  step(
    "a link in the page opens its page in Safari",
    (await content.locator("h1").first().innerText()).includes("Mojave"),
    mojave.title,
  );

  await safari(page).getByRole("button", { name: "Back" }).click();
  await waitForField(page, CATALINA);
  await fetchedFrame(page, catalina.title);
  step("Back returns to the article and its address", true);
  await safari(page).getByRole("button", { name: "Forward" }).click();
  await waitForField(page, MOJAVE);
  await fetchedFrame(page, mojave.title);
  step("Forward goes to the linked page again", true);
  const reloaded = await reloadPage(page);
  step("Reload asks the server for the page again", reloaded?.ok === true);
  await fetchedFrame(page, mojave.title);

  await safari(page).getByRole("button", { name: "Show Reader View" }).click();
  const reader = safari(page).locator("article").first();
  await reader.waitFor({ timeout: 5_000 });
  step(
    "Reader shows the article's text",
    (await reader.innerText()).length > 500,
    `${(await reader.innerText()).length} characters`,
  );
  await safari(page).getByRole("button", { name: "Hide Reader View" }).click();

  // ── An image map: a click on a region, and Return on it, open its link in Safari ──
  // The map has the shape the rewriter writes (rewrite.rs,
  // `image_maps_keep_their_regions_and_send_them_to_safari`); Wikipedia's article has none.
  const mapOn = async (title) => {
    const holder = await fetchedFrame(page, title);
    const inside = await (await holder.elementHandle()).contentFrame();
    await inside.evaluate((target) => {
      const svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='100'><rect width='200' height='100' fill='teal'/></svg>";
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;background:#fff";
      wrap.innerHTML = `<img id="journey-map" usemap="#journey" alt="map" width="200" height="100" src="data:image/svg+xml,${encodeURIComponent(svg)}"><map name="journey"><area id="journey-area" shape="rect" coords="0,0,100,100" data-safari-href="${target}" alt="Open the article" href="#"></map>`;
      document.body.append(wrap);
    }, CATALINA);
    const image = inside.locator("#journey-map");
    await image.waitFor({ timeout: 5_000 });
    return { inside, image };
  };
  let map = await mapOn(mojave.title);
  await map.image.click({ position: { x: 40, y: 50 } });
  await waitForField(page, CATALINA);
  await fetchedFrame(page, catalina.title);
  step("a click on an image map's region opens its link in Safari", true);
  await safari(page).getByRole("button", { name: "Back" }).click();
  await waitForField(page, MOJAVE);
  map = await mapOn(mojave.title);
  await map.inside.locator("#journey-area").focus();
  await map.inside.locator("#journey-area").press("Enter");
  await waitForField(page, CATALINA);
  await fetchedFrame(page, catalina.title);
  step("Return on an image map's region opens its link in Safari", true);

  // ── Search ──
  const search = await go(page, "Apple Park");
  step(
    "words typed in the field open Wikipedia's search",
    search.ok === true &&
      (await field(page).inputValue()).startsWith("https://en.wikipedia.org/w/index.php?"),
    search.title,
  );

  // ── Error pages ──
  const metadata = await go(page, "http://169.254.169.254/latest/meta-data/");
  await safari(page)
    .getByText(/is on a private or local network/)
    .waitFor({ timeout: 5_000 });
  step(
    "a metadata address is refused with Safari's error page",
    metadata.ok === false && metadata.kind === "private",
  );
  await shot(page, path.join(out, `safari-error-${browserName}.png`));
  const large = await go(page, "en.wikipedia.org/wiki/United_States");
  await safari(page)
    .getByText(/larger than the 1 MB/)
    .waitFor({ timeout: 5_000 });
  step(
    "a page over the egress reply cap gets the too-large page",
    large.ok === false && large.kind === "too-large",
    large.kind,
  );
  const missing = await go(page, "en.wikipedia.org:8443/");
  step("a page on another port is refused", missing.ok === false && missing.kind === "port");

  // ── A page the server may not reach: not framed, offered in a browser tab ──
  const outside = await go(page, "https://www.example.org/");
  const heading = safari(page).getByRole("heading", { name: "This Page Opens Outside Safari" });
  await heading.waitFor({ timeout: 5_000 });
  const offer = safari(page).getByRole("button", { name: "Open in New Browser Tab" });
  step(
    "a page off the list is not framed: Safari says it opens outside, with a browser tab on offer",
    outside.kind === "not-listed" &&
      (await safari(page).locator("iframe").count()) === 0 &&
      (await offer.count()) === 1,
    `${outside.kind}, ${await safari(page).locator("iframe").count()} frames`,
  );
  await shot(page, path.join(out, `safari-outside-${browserName}.png`));
  const opened = page.context().waitForEvent("page", { timeout: 10_000 });
  const remembered = nextResponse(page, "POST", "/api/safari/history");
  await offer.click();
  const tab = await opened;
  await tab.waitForURL("https://www.example.org/", { timeout: 10_000 });
  // Opener isolation: the tab cannot reach back into the desktop page (`noopener`).
  const opener = await tab.evaluate(() => window.opener === null);
  step(
    "Open in New Browser Tab opens the page in a real tab and adds it to the history",
    tab.url() === "https://www.example.org/" && (await remembered).status() === 200,
    tab.url(),
  );
  step("the browser tab Safari opened has no opener to reach the desktop through", opener);
  await tab.close();

  // ── The honest outside route, through the fixtures: whatever a site says about being
  // shown inside another page, Safari never frames it and says it cannot tell; the real tab
  // gets the page as the site serves it ──
  const note = safari(page).getByText(/can’t tell whether another site allows being shown inside/);
  /** Ask for an address, wait for the outside page, and open its offer in a real tab. */
  async function outsideTab(address) {
    const reply = await go(page, address);
    await heading.waitFor({ timeout: 8_000 });
    const frames = await safari(page).locator("iframe").count();
    const noted = (await note.count()) === 1;
    const tabOpened = page.context().waitForEvent("page", { timeout: 10_000 });
    await offer.click();
    return { reply, frames, noted, tab: await tabOpened };
  }
  for (const [name, header, value] of [
    ["refuses-xfo", "x-frame-options", "DENY"],
    ["refuses-csp", "content-security-policy", "frame-ancestors 'none'"],
    ["embeddable", null, null],
  ]) {
    const shown = await outsideTab(fixture(name));
    await shown.tab.waitForLoadState("domcontentloaded");
    const title = await shown.tab.title();
    const headers = arrived.get(fixture(name)) ?? {};
    step(
      `${name}: not framed, Safari says it cannot tell, the name was checked, and the real tab gets the page${header ? ` with its ${header}` : ""}`,
      shown.reply.kind === "not-listed" &&
        shown.reply.checked === true &&
        shown.frames === 0 &&
        shown.noted &&
        title === TITLES[name] &&
        (header === null || headers[header] === value),
      `${shown.reply.kind}, checked ${shown.reply.checked}, ${shown.frames} frames, "${title}"`,
    );
    await shown.tab.close();
  }
  await shot(page, path.join(out, `safari-outside-note-${browserName}.png`));
  const chain = await outsideTab(fixture("hop1"));
  await chain.tab.waitForURL(fixture("landed"), { timeout: 10_000 });
  step(
    "a 3-hop redirect chain is followed by the real tab to the page it ends at",
    ["hop1", "hop2", "hop3", "landed"].every((hop) => (served.get(`/ws2/${hop}`) ?? 0) >= 1) &&
      (await chain.tab.title()) === TITLES.landed,
    chain.tab.url(),
  );
  await chain.tab.close();
  const loopsBefore = served.get("/ws2/loop") ?? 0;
  const loop = await outsideTab(fixture("loop"));
  const loops = () => (served.get("/ws2/loop") ?? 0) - loopsBefore;
  for (let waited = 0; loops() < 5 && waited < 10_000; waited += 200) {
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(500);
  const loopTitle = await loop.tab.title().catch(() => "");
  step(
    "a redirect loop ends in the real tab's own error, never in a page",
    loops() >= 5 && !Object.values(TITLES).includes(loopTitle) && loopTitle !== "Example",
    `${loops()} hops, "${loopTitle}"`,
  );
  await loop.tab.close().catch(() => {});
  // The engines report a download that a noopener tab starts on the page that opened it
  // (Chromium, Firefox and WebKit alike; campaign/ws2/probe-download.mjs), so it is taken from
  // the desktop page, or from the tab if an engine reports it there.
  const downloaded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no download within 10 s")), 10_000);
    const take = (download) => {
      clearTimeout(timer);
      resolve(download);
    };
    page.once("download", take);
    page.context().once("page", (popup) => popup.once("download", take));
  });
  const fileTab = await outsideTab(fixture("report.csv"));
  const download = await downloaded;
  const savedFile = path.join(out, `report-${browserName}.csv`);
  await download.saveAs(savedFile);
  const bytes = readFileSync(savedFile, "utf8");
  step(
    "a download opened in the real tab arrives in the browser, byte for byte",
    download.suggestedFilename() === "report.csv" && bytes === CSV,
    `${download.suggestedFilename()}, ${bytes.length} bytes`,
  );
  await fileTab.tab.close().catch(() => {});

  // ── Real hosts through the module ──
  const nowhere = await go(page, "no-such-host-ws2-zzzz.com");
  await safari(page)
    .getByRole("heading", { name: "Safari Can’t Find the Server" })
    .waitFor({ timeout: 8_000 });
  step(
    "a name that does not exist is looked up before a tab is offered: Safari can't find the server",
    nowhere.kind === "not-found" && (await offer.count()) === 0,
    nowhere.kind,
  );
  const malformed = await go(page, "http://exa mple.com");
  await safari(page)
    .getByText(/because it is not a valid address/)
    .waitFor({ timeout: 5_000 });
  step("a malformed address gets Safari's not-a-valid-address page", malformed.kind === "invalid");
  const international = await go(page, "münchen.de");
  await heading.waitFor({ timeout: 8_000 });
  step(
    "an international name is sent in its ASCII form and checked: münchen.de is xn--mnchen-3ya.de",
    (await field(page).inputValue()) === "https://xn--mnchen-3ya.de/" &&
      international.kind === "not-listed" &&
      international.checked === true,
    `${await field(page).inputValue()}, checked ${international.checked}`,
  );
  const number = await go(page, "1.5");
  step(
    "a number with a dot is a search, not an address",
    number.ok === true &&
      (await field(page).inputValue()).startsWith("https://en.wikipedia.org/w/index.php?"),
    await field(page).inputValue(),
  );
  const named = await go(page, "wikipedia.org");
  step(
    "a redirect whose page names its target is followed: wikipedia.org opens the Main Page",
    named.ok === true && named.url === MAIN_PAGE,
    named.url,
  );
  const unnamed = await go(page, "https://en.wikipedia.org/wiki/Special:Random");
  await safari(page)
    .getByText(/sent it to another address without naming it/)
    .waitFor({ timeout: 5_000 });
  step(
    "a redirect that does not name its target says so (an app gets no response headers)",
    unnamed.kind === "redirect",
    unnamed.message,
  );

  // ── Download Linked File: a listed site's file, saved into the person's Downloads folder ──
  // A small picture on a listed site (www.wikipedia.org): gnu.org, used first, began refusing
  // connections from the test host mid-run (TLS alert 80), so it is not a dependable fixture.
  const FILE = "https://www.wikipedia.org/portal/wikipedia.org/assets/img/Wikipedia-logo-v2.png";
  const fileReply = await go(page, FILE);
  const downloadButton = safari(page).getByRole("button", {
    name: "Download to Downloads Folder",
  });
  await downloadButton.waitFor({ timeout: 8_000 });
  // The entries already there: the file this run downloads is the new one (Downloads renames a
  // second file of the same name, so its name alone does not say which file is this run's).
  const entriesBefore = new Set(
    ((await api(page, "GET", "/api/files")).json.entries ?? []).map((entry) => entry.id),
  );
  await downloadButton.click();
  await safari(page)
    .getByText(/is in your Downloads folder/)
    .waitFor({ timeout: 20_000 });
  const driveNow = (await api(page, "GET", "/api/files")).json;
  const downloadEntry = (driveNow.entries ?? []).find(
    (entry) =>
      entry.parent === "downloads" && entry.kind === "file" && !entriesBefore.has(entry.id),
  );
  downloadedId = downloadEntry?.id ?? null;
  const stored = downloadEntry
    ? await page.evaluate(
        async ({ id, version }) => {
          const response = await fetch(
            `/api/files/content/${encodeURIComponent(id)}?piece=0&count=8&version=${version}`,
            { credentials: "same-origin" },
          );
          return [...new Uint8Array(await response.arrayBuffer())];
        },
        { id: downloadEntry.id, version: downloadEntry.version ?? 0 },
      )
    : [];
  const original = Buffer.from(await (await fetch(FILE)).arrayBuffer());
  const sha = (bytes) => createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  step(
    "Download to Downloads Folder saves a listed site's file into the Downloads folder, byte for byte",
    fileReply.kind === "unsupported" &&
      /^Wikipedia-logo-v2( \d+)?\.png$/.test(downloadEntry?.name ?? "") &&
      downloadEntry?.size === original.length &&
      sha(stored) === sha(original),
    `${downloadEntry?.name}, ${downloadEntry?.size} bytes, sha256 ${sha(stored).slice(0, 12)}`,
  );
  await safari(page).getByRole("button", { name: "Show in Finder" }).click();
  const finder = page.locator(".mac-finder").first();
  await finder.waitFor({ state: "visible", timeout: 10_000 });
  await finder
    .getByText(downloadEntry?.name ?? "Wikipedia-logo-v2.png", { exact: true })
    .first()
    .waitFor({ timeout: 10_000 });
  step("Show in Finder opens Finder on the Downloads folder with the file in it", true);
  await shot(page, path.join(out, `safari-download-finder-${browserName}.png`));
  await launch(page, "Safari");
  await safari(page).waitFor({ state: "visible", timeout: 10_000 });
  // Another person (a new session) does not have the file.
  const otherContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const other = await otherContext.newPage();
    await openDesktop(other, base);
    const otherDrive = (await api(other, "GET", "/api/files")).json;
    step(
      "another person's Downloads folder does not have the file",
      Array.isArray(otherDrive.entries) &&
        !otherDrive.entries.some((entry) => entry.name === downloadEntry?.name),
      `${otherDrive.entries?.length} entries`,
    );
  } finally {
    await otherContext.close();
  }
  // Over the platform's cap: refused with the reason, and nothing offered.
  const big = await go(page, "https://www.gutenberg.org/cache/epub/1342/pg1342-images.epub");
  await safari(page)
    .getByText(/larger than the 1 MB/)
    .waitFor({ timeout: 10_000 });
  step(
    "a file over the 1 MB a Ferrite application can fetch is refused with that reason, and no download is offered",
    big.kind === "too-large" && (await downloadButton.count()) === 0,
    big.kind,
  );

  // ── Bookmarks, tabs and history, kept on the server ──
  // The article was opened before: the window shows it again from its own pages.
  await field(page).click();
  await field(page).fill(CATALINA);
  await field(page).press("Enter");
  await fetchedFrame(page, catalina.title);
  const savedFavorites = page.waitForResponse(
    (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/safari/bookmarks",
    { timeout: 10_000 },
  );
  await safari(page).getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Add Bookmark" }).click();
  await page
    .getByRole("dialog", { name: "Add this page to:" })
    .getByRole("button", { name: "Add" })
    .click();
  step("Add Bookmark saves the Favorites", (await savedFavorites).status() === 200);
  const bar = safari(page).getByRole("navigation", { name: "Favorites bar" });
  step("the page is on the Favorites bar", (await bar.getByText(catalina.title).count()) === 1);
  const savedReading = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/safari/reading-list",
    { timeout: 10_000 },
  );
  await safari(page).getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Add to Reading List" }).click();
  step("Add to Reading List saves the Reading List", (await savedReading).status() === 200);
  // ── Share > Copy Link puts the page's address on the clipboard; each service that cannot take
  // a link yet is dimmed with its reason (desktop-share-link.tsx) ──
  await safari(page).getByRole("button", { name: "Share" }).click();
  const shareMail = page.getByRole("menuitem", { name: "Email This Page" });
  await shareMail.waitFor({ timeout: 5_000 });
  const mailRow = {
    disabled: await shareMail.getAttribute("aria-disabled"),
    reason: await shareMail.getAttribute("title"),
  };
  const airdropReason = await page.getByRole("menuitem", { name: "AirDrop" }).getAttribute("title");
  await page.getByRole("menuitem", { name: "Copy Link" }).click();
  // Pasted into the address field, the clipboard's text is the page's address.
  await field(page).click();
  await field(page).fill("");
  await page.keyboard.press("Control+KeyV");
  const pasted = await field(page).inputValue();
  step(
    "Share > Copy Link puts the page's address on the clipboard (pasted back into the address field)",
    pasted === CATALINA,
    pasted,
  );
  step(
    "Share > AirDrop is dimmed with its reason, and Email This Page is enabled or dimmed with its reason",
    (mailRow.disabled !== "true" || /can’t take a shared link/.test(mailRow.reason ?? "")) &&
      /nearby devices/.test(airdropReason ?? ""),
    `${mailRow.disabled === "true" ? mailRow.reason : "Email This Page enabled"}; ${airdropReason}`,
  );
  // Let the tabs document catch up with the last address before the reload.
  await page.waitForTimeout(1_000);

  await reloadDesktop(page);
  await launch(page, "Safari");
  await safari(page).waitFor({ state: "visible", timeout: 10_000 });
  await waitForField(page, CATALINA);
  await fetchedFrame(page, catalina.title);
  step("after a reload Safari opens the tab it had, and the page in it", true);
  await bar.getByText(catalina.title).waitFor({ timeout: 10_000 });
  step("the bookmark is still on the Favorites bar", true);

  // ── Safari's own commands in the menu bar, and their keys ──
  // (On Linux a menu's Command key is Control: `matchesMenuKeyEquivalent`.)
  const menuBar = page.getByRole("menubar").first();
  const openMenu = () => page.getByRole("menu").first();
  const startsWith = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  /** Open a menu of the menu bar and choose an item in it. */
  async function choose(title, item) {
    await menuBar.getByRole("menuitem", { name: title, exact: true }).first().click();
    await openMenu().waitFor({ timeout: 5_000 });
    await openMenu()
      .getByRole("menuitem", { name: startsWith(item) })
      .first()
      .click();
  }
  /** The rows of a menu of the menu bar, by their first line. */
  async function rowsOf(title) {
    await menuBar.getByRole("menuitem", { name: title, exact: true }).first().click();
    await openMenu().waitFor({ timeout: 5_000 });
    const texts = await openMenu().getByRole("menuitem").allInnerTexts();
    await page.keyboard.press("Escape");
    await openMenu().waitFor({ state: "detached", timeout: 5_000 });
    return texts.map((text) => text.split(/[\n\t]/)[0].trim());
  }
  // The History menu lists the ten most recent visits: the Main Page, opened in the honest-route
  // steps above, is among them (Mojave, opened early, may have dropped off the list).
  const historyRows = await rowsOf("History");
  step(
    "the History menu has Safari's commands and the recent visits, and no dimmed placeholder",
    ["Show All History", "Back", "Forward", "Home"].every((name) => historyRows.includes(name)) &&
      historyRows.includes(named.title) &&
      !historyRows.some((row) => /has no .* commands/.test(row)),
    historyRows.join(" | "),
  );
  const bookmarkRows = await rowsOf("Bookmarks");
  step(
    "the Bookmarks menu has its commands and the Favorites, the new bookmark among them",
    ["Show Bookmarks", "Show Reading List", "Add Bookmark…", "Add to Reading List"].every((name) =>
      bookmarkRows.includes(name),
    ) &&
      bookmarkRows.includes(catalina.title) &&
      !bookmarkRows.some((row) => /has no .* commands/.test(row)),
    bookmarkRows.join(" | "),
  );
  await choose("History", named.title);
  await waitForField(page, MAIN_PAGE);
  await fetchedFrame(page, named.title);
  step("a visit chosen in the History menu opens in the tab", true);
  await choose("History", "Back");
  await waitForField(page, CATALINA);
  step("History > Back goes back", true);
  await field(page).click();
  await page.keyboard.press("Control+BracketRight");
  await waitForField(page, MAIN_PAGE);
  await page.keyboard.press("Control+BracketLeft");
  await waitForField(page, CATALINA);
  step("the Forward and Back keys go forward and back", true);
  // Open Location from the window, with the keyboard elsewhere in it.
  await safari(page).locator(".mac-safari-toolbar-lead").click();
  await page.keyboard.press("Control+KeyL");
  const located = await page.evaluate(() => {
    const input = document.activeElement;
    return (
      input instanceof HTMLInputElement &&
      input.getAttribute("aria-label") === "Search or enter website name" &&
      input.selectionStart === 0 &&
      input.selectionEnd === input.value.length
    );
  });
  step("Open Location's key puts the keyboard in the address field, its text selected", located);
  const tabCount = () => safari(page).getByRole("tab").count();
  await choose("File", "New Tab");
  const afterNew = await tabCount();
  await choose("File", "Close Tab");
  const afterClose = await tabCount();
  await choose("File", "Reopen Last Closed Tab");
  const afterReopen = await tabCount();
  await choose("File", "Close Tab");
  await waitForField(page, CATALINA);
  step(
    "File > New Tab, Close Tab and Reopen Last Closed Tab",
    afterNew === 2 && afterClose === 0 && afterReopen === 2 && (await tabCount()) === 0,
    `${afterNew}, ${afterClose}, ${afterReopen}`,
  );
  await choose("View", "Hide Favorites Bar");
  const hidden = await bar.count();
  await choose("View", "Show Favorites Bar");
  step(
    "View > Hide and Show Favorites Bar",
    hidden === 0 && (await bar.count()) === 1,
    `${hidden} bar(s) while hidden`,
  );
  const list = (name) => safari(page).getByRole("tree", { name, exact: true });
  await choose("Bookmarks", "Show Reading List");
  await list("Reading List").waitFor({ timeout: 5_000 });
  // The page added to the Reading List before the reload is there, read back from the server.
  await list("Reading List").getByText(catalina.title).first().waitFor({ timeout: 5_000 });
  await choose("Bookmarks", "Show Bookmarks");
  await list("Bookmarks").waitFor({ timeout: 5_000 });
  await choose("View", "Hide Sidebar");
  await list("Bookmarks").waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Bookmarks > Show Reading List (with the page added before the reload) and Show Bookmarks, View > Hide Sidebar",
    true,
  );
  // Asked again from the menu itself: a retry from the toolbar would pass with the menu row broken.
  let reloadedFromMenu = null;
  for (let attempt = 0; attempt < 4 && slow(reloadedFromMenu); attempt += 1) {
    reloadedFromMenu = await pageAnswer(page, () => choose("View", "Reload Page"));
  }
  step("View > Reload Page asks the server for the page again", reloadedFromMenu?.ok === true);
  await fetchedFrame(page, catalina.title);
  await shot(page, path.join(out, `safari-menus-${browserName}.png`));

  await safari(page).getByRole("button", { name: "New Tab" }).click();
  await safari(page).getByRole("button", { name: "Show All History" }).click();
  const history = safari(page).getByRole("region", { name: "History" });
  await history.getByText(catalina.title).first().waitFor({ timeout: 10_000 });
  await history.getByRole("searchbox", { name: "Search History" }).fill("mojave");
  await history.getByText(mojave.title).first().waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    ({ title }) =>
      ![...document.querySelectorAll(".mac-safari-history-title")].some(
        (e) => e.textContent === title,
      ),
    { title: catalina.title },
    { timeout: 10_000 },
  );
  step("History lists the visits and its search finds one", true);
  await shot(page, path.join(out, `safari-history-${browserName}.png`));

  // ── A link from another app: News's Read Full Story opens in the open Safari window ──
  // (`openStoryLink` in news-live.ts dispatches `macalicious:open-url`; Safari takes it through
  // `desktop-open-url.ts` and opens it in a new tab in front, kept with the others.)
  const tabs = safari(page).getByRole("tab");
  const tabsBefore = await tabs.count();
  await launch(page, "News");
  const news = page.getByRole("region", { name: "News", exact: true }).first();
  await news.waitFor({ state: "visible", timeout: 15_000 });
  const lead = news.locator(".mac-news-story-link").first();
  await lead.waitFor({ timeout: 30_000 });
  await lead.click();
  const keptTab = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      new URL(r.url()).pathname === "/api/safari/tabs" &&
      (JSON.parse(r.request().postData() ?? "{}").tabs?.length ?? 0) === tabsBefore + 1,
    { timeout: 15_000 },
  );
  await news.getByRole("button", { name: "Read Full Story" }).click();
  const said = await news.getByRole("status").innerText();
  const keptBody = JSON.parse((await keptTab).request().postData() ?? "{}");
  step(
    "News's Read Full Story opens the story in the open Safari window, in a new tab in front",
    /in Safari\.$/.test(said) &&
      (await tabs.count()) === tabsBefore + 1 &&
      keptBody.active === tabsBefore,
    `${said}; ${keptBody.tabs?.at(-1)}`,
  );
  // Let any final address (a redirect, a site's home page) be saved before the reload.
  await page.waitForTimeout(1_500);
  const beforeReload = await api(page, "GET", "/api/safari/tabs");
  await reloadDesktop(page);
  await launch(page, "Safari");
  await safari(page).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll('[aria-label="Safari"] [role="tablist"] [role="tab"]').length ===
      count,
    beforeReload.json.tabs?.length ?? -1,
    { timeout: 10_000 },
  );
  const afterReload = await api(page, "GET", "/api/safari/tabs");
  step(
    "after a reload Safari still has the story's tab, kept on the server",
    JSON.stringify(afterReload.json.tabs) === JSON.stringify(beforeReload.json.tabs) &&
      afterReload.json.tabs?.length === tabsBefore + 1,
    JSON.stringify(afterReload.json.tabs),
  );
  await shot(page, path.join(out, `safari-from-news-${browserName}.png`));
  // Every page that opened in the journey is in History: kept by the server within its reply's
  // budget, or by the window when the reply said the server had no time to.
  await page.waitForTimeout(500);
  const pagesOpened = (await Promise.all(openedPages)).filter(Boolean);
  const visited = new Set(
    ((await api(page, "GET", "/api/safari/history")).json.history ?? []).map((visit) => visit.url),
  );
  const unsaid = pagesOpened.filter((p) => p.history !== "kept" && p.history !== "skipped");
  const missingVisits = pagesOpened.filter((p) => !visited.has(p.url));
  step(
    "every page that opened says whether the server kept its visit, and History has every one",
    pagesOpened.length >= 5 && unsaid.length === 0 && missingVisits.length === 0,
    `${pagesOpened.length} pages, ${pagesOpened.filter((p) => p.history === "skipped").length} kept by the window, ${unsaid.length} without the header, missing: ${missingVisits
      .map((p) => p.url)
      .slice(0, 3)
      .join(", ")}`,
  );
  const sent = frameRequests.filter((url) => url !== PROBE);
  step(
    "no page Safari showed in the journey sent a request of its own",
    sent.length === 0,
    sent.slice(0, 3).join(", "),
  );
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  // Put back what the session kept before the journey: its Favorites and bookmarks, Reading
  // List and tabs. Each document is restored on its own, every request's status is checked,
  // and success is reported only when all of them worked. (The pages it visited stay in the
  // session's history: the server keeps no way to remove single visits, and the journey never
  // clears a history it did not write.)
  if (page && before.size === KEPT.length) {
    const failed = [];
    for (const document of KEPT) {
      try {
        await restore(page, document, before.get(document));
      } catch (error) {
        failed.push(`${document}: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (failed.length === 0) console.log("restored the session's Favorites, Reading List and tabs");
    else problems.push(`could not restore the session's Safari data: ${failed.join("; ")}`);
  } else if (page) {
    problems.push("the session's Safari data was not read before the journey, so not restored");
  }
  // The file the journey downloaded goes, whichever step stopped it.
  if (page && downloadedId) {
    try {
      const removed = await api(page, "POST", "/api/files/ops", {
        ops: [{ op: "delete", id: downloadedId }],
      });
      if (removed.status !== 200)
        problems.push(`could not delete the downloaded file: HTTP ${removed.status}`);
    } catch (error) {
      problems.push(
        `could not delete the downloaded file: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  await browser.close();
  for (const socket of proxySockets) socket.destroy();
  proxy.close();
}

console.log(`screenshots in ${out}`);
if (problems.length > 0) {
  console.error(
    `\nsafari: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\nsafari: all ${steps.length} steps passed with no console errors`);
