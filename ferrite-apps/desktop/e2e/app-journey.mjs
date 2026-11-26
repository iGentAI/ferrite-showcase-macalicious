// Shared steps of the app journeys under `ferrite dev` (notes-journey.mjs,
// reminders-journey.mjs, stickies-journey.mjs): options, a step log, a watch
// on every console error, page error, failed request and HTTP error, a
// same-origin fetch from inside the page, and opening an app from the Dock.
// `--browser chromium|chrome|firefox|webkit` picks Playwright's engine (Chromium by
// default), as desktop-journey.mjs does.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cancelledFetchLine,
  closingPage,
  cutOffByReload,
  ENGINES,
  engineFamily,
  openDesktop as openKitDesktop,
  reloadDesktop,
  unprovenFetchLines,
} from "./journey-kit.mjs";

export { reloadDesktop };

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * `--url` (default http://127.0.0.1:8787), `--out` (default e2e/output) and `--browser` (default
 * chromium).
 */
export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
  };
  const base = option("--url", "http://127.0.0.1:8787").replace(/\/$/, "");
  const out = path.resolve(option("--out", path.join(here, "output")));
  mkdirSync(out, { recursive: true });
  const browserName = option("--browser", "chromium");
  if (!Object.hasOwn(ENGINES, browserName)) {
    console.error(`--browser must be one of ${Object.keys(ENGINES).join(", ")}`);
    process.exit(2);
  }
  return { base, out, browserName };
}

/**
 * Save a screenshot as evidence, not as a check. WebKit can leave `document.fonts` loading for
 * good (the library's fallback face fails there) and Playwright's screenshot waits for fonts, so a
 * timeout is logged as a warning instead of aborting the journey, as desktop-journey.mjs does.
 */
export async function shot(page, file) {
  try {
    await page.screenshot({ path: file, timeout: 15_000 });
  } catch (error) {
    console.log(`warn screenshot ${file} not saved: ${String(error.message).split("\n")[0]}`);
  }
}

/**
 * A journey's log: `step` records a check, `run` drives it and exits 0 only when all passed, and
 * `expectRefusal(status, pathname)` excuses the one refusal the next step sets out to provoke;
 * `expectConsole(words)` excuses console errors with those words, and says whether one came.
 * `launchOptions` maps an engine's name to the options its browser is launched with (for example
 * a fake camera), and `contextOptions` to further options of its browser context (for example
 * `permissions`); an engine they do not name gets none. With `ignoreOtherOrigins`, a failed
 * request, an HTTP error or a console error about a resource of another origin than the
 * desktop's (a publisher's picture, a podcast's audio) is logged as a note and not counted: the
 * app does not serve those, and the journey checks the app. `ignoreRequests(url, errorText)` says
 * whether a failed request is one the journey has traced to something harmless: it too is logged
 * as a note and not counted.
 */
export function journey(
  name,
  {
    launchOptions = {},
    contextOptions = {},
    ignoreOtherOrigins = false,
    ignoreRequests = () => false,
  } = {},
) {
  const problems = [];
  const steps = [];
  /** Refusals a step set out to provoke: each excuses one answer and its console line. */
  const expected = [];
  const expectedAnswer = (url, status, part) => {
    let pathname = "";
    try {
      pathname = new URL(url).pathname;
    } catch {
      return false;
    }
    const found = expected.find(
      (each) => each[part] && each.status === status && each.pathname === pathname,
    );
    if (found) found[part] = false;
    return Boolean(found);
  };
  const expectRefusal = (status, pathname) =>
    expected.push({ status, pathname, answer: true, console: true });
  /** Console errors a step set out to provoke, by their words: `seen` says whether each came. */
  const expectedLines = [];
  const expectConsole = (words) => {
    const line = { words, seen: false };
    expectedLines.push(line);
    return line;
  };
  const step = (label, ok, detail = "") => {
    steps.push(label);
    console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
    if (!ok) problems.push(label);
    return ok;
  };
  const foreign = (page, url) => {
    if (!ignoreOtherOrigins || !url) return false;
    try {
      return new URL(url).origin !== new URL(page.url()).origin;
    } catch {
      return false;
    }
  };
  const note = (page, url, problem) => {
    if (foreign(page, url)) console.log(`note (other origin, not counted): ${problem}`);
    else problems.push(problem);
  };
  /** Collect every console error, page error, failed request and HTTP error of a page. */
  const watch = (page) => {
    page.on("console", (message) => {
      if (message.type() === "error") {
        const status = /status of (\d+)/.exec(message.text())?.[1];
        if (status && expectedAnswer(message.location()?.url, Number(status), "console")) return;
        const line = expectedLines.find((each) => message.text().includes(each.words));
        if (line) {
          line.seen = true;
          return;
        }
        note(page, message.location()?.url, `console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      if (!cancelledFetchLine(page, error)) problems.push(`page error: ${error.message}`);
    });
    page.on("requestfailed", (request) => {
      // `ferrite dev`'s own live-reload stream and the desktop's live streams (`/live/`: the
      // person's notifications, a Messages room), closed by the page on a reload or at the end of
      // the run, are not failures of the app (Firefox: NS_BINDING_ABORTED, WebKit: cancelled);
      // nor is a `blob:` read of the page's own memory that a media element let go of (Music
      // reading a song's length, or moving on to another song), nor the read of a file's content
      // for a view that has moved on to another file, nor a read the page had under way when the
      // journey reloaded or closed it. The last is asked first: every read the reload cut off is
      // evidence for WebKit's log line, whichever rule excuses it.
      const cutOff = cutOffByReload(page, request);
      if (
        (request.url().includes("/__forge/reload") ||
          request.url().startsWith("blob:") ||
          new URL(request.url()).pathname.startsWith("/api/files/content/") ||
          new URL(request.url()).pathname.startsWith("/live/") ||
          cutOff) &&
        /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(
          request.failure()?.errorText ?? "",
        )
      )
        return;
      if (ignoreRequests(request.url(), request.failure()?.errorText ?? "")) {
        console.log(`note (traced, not counted): ${request.url()} ${request.failure()?.errorText}`);
        return;
      }
      note(
        page,
        request.url(),
        `request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`,
      );
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !expectedAnswer(response.url(), response.status(), "answer"))
        note(page, response.url(), `HTTP ${response.status()}: ${response.url()}`);
    });
  };
  const run = async (body) => {
    const { browserName } = options();
    console.log(`${name} in ${browserName}`);
    const browser = await ENGINES[browserName].launch(
      launchOptions[engineFamily(browserName)] ?? {},
    );
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        // The browser's local day and hour are the machine's, as the journeys compute them.
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...contextOptions[engineFamily(browserName)],
      });
      const page = await context.newPage();
      watch(page);
      await body(page);
      closingPage(page);
      await context.close();
      for (const line of unprovenFetchLines(page)) problems.push(`page error: ${line}`);
    } catch (error) {
      problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
    } finally {
      await browser.close();
    }
    if (problems.length > 0) {
      console.error(
        `\n${name}: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
      );
      process.exit(1);
    }
    console.log(`\n${name}: all ${steps.length} steps passed with no console errors`);
  };
  return { step, run, expectRefusal, expectConsole };
}

/**
 * What the clipboard holds. WebKit refuses a script's `readText` without a click on its own paste
 * prompt, so there it is read as a person would: pasted with the key into a field of the journey's.
 */
export async function clipboardText(page) {
  if (options().browserName !== "webkit") {
    return page.evaluate(() => navigator.clipboard.readText());
  }
  const field = await page.evaluateHandle(() => {
    const input = document.createElement("input");
    input.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483647";
    document.body.append(input);
    input.focus();
    return input;
  });
  await page.keyboard.press("Control+v");
  return field.evaluate((input) => {
    const pasted = input.value;
    input.remove();
    return pasted;
  });
}

/** `fetch` from inside the page, so the browser's own cookie and headers apply. */
export function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json() };
    },
    { method, url, body },
  );
}

/**
 * Load the desktop with journey-kit's `openDesktop` (not "networkidle": `ferrite dev` keeps its
 * live-reload stream open) and check that it is the build the Ferrite app published.
 */
export async function openDesktop(page, base, step) {
  await openKitDesktop(page, base);
  const marker = await api(page, "GET", "/ferrite-site.json");
  step("the desktop is served from the site blob the app published", marker.status === 200);
}

/** Click an app's Dock tile. */
export async function launch(page, name) {
  await page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first()
    .click();
}

/** Resolves with the next answer of `method` to `url` (a path). */
export function nextResponse(page, method, url) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method && new URL(response.url()).pathname === url,
    { timeout: 10_000 },
  );
}
