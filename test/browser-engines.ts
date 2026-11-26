import { existsSync } from "node:fs";
import { type BrowserType, chromium, firefox, webkit } from "playwright";
import { it } from "vitest";

/*
 * The browser engines of the `*.browser.test.tsx` files, and the one rule they share: an engine
 * that is not installed is skipped, unless REQUIRE_BROWSER_TESTS is set. Then every engine a
 * file runs in must be there, and the run fails and names each one that is missing. A required
 * run of a file that runs in the three engines therefore never passes on Chromium alone. A
 * file that runs in one engine by design names it in its call (`requireEveryEngine(what,
 * ["chromium"])`) and is held to that one.
 *
 * Every browser test file takes ENGINES and `installed` from here and calls
 * `requireEveryEngine` once. test/browser-engines.test.ts holds each file to the call: it fails
 * a file that does not import `requireEveryEngine` from here and call it once, that chooses its
 * own engines, or that names REQUIRE_BROWSER_TESTS or `executablePath` itself. That a file takes
 * ENGINES and `installed` from here too is the convention, and is not checked.
 */

/** The engines a browser test runs in, by the name Playwright gives them. */
export const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit };

/** How to install what is missing, for the message of a failed run. */
export const INSTALL = "npx playwright install --with-deps chromium firefox webkit";

/** Whether Playwright has this engine's browser on this machine. */
export function installed(engine: BrowserType): boolean {
  try {
    return existsSync(engine.executablePath());
  } catch {
    return false;
  }
}

const installedByName = (name: string) => {
  const engine = ENGINES[name];
  return engine !== undefined && installed(engine);
};

/** Whether this run must have its engines: REQUIRE_BROWSER_TESTS is set to anything but "". */
export function browserTestsRequired(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.REQUIRE_BROWSER_TESTS);
}

/**
 * The engines of `names` that are not installed, in the order given. A name that is not an
 * engine counts as missing.
 */
export function missingEngines(
  names: readonly string[] = Object.keys(ENGINES),
  isInstalled: (name: string) => boolean = installedByName,
): string[] {
  return names.filter((name) => !isInstalled(name));
}

/** Throw, naming every engine of `names` that is not installed; return when none is missing. */
export function assertEveryEngine(
  what: string,
  names: readonly string[] = Object.keys(ENGINES),
  isInstalled: (name: string) => boolean = installedByName,
): void {
  const missing = missingEngines(names, isInstalled);
  if (missing.length === 0) return;
  throw new Error(
    `REQUIRE_BROWSER_TESTS is set, and ${what} would skip ${missing.join(", ")}: ` +
      `${missing.length === 1 ? "that engine is" : "those engines are"} not installed ` +
      `(needed: ${names.join(", ")}). Install with "${INSTALL}".`,
  );
}

/**
 * Call once in a browser test file, as a statement of the module, with what the file tests
 * ("the Preview tests"). It adds one test, "has <engines> installed to run <what> in". Where
 * REQUIRE_BROWSER_TESTS is set that test fails unless every engine of `names` is installed;
 * elsewhere it is reported as skipped, and the file skips the engines that are missing.
 * `names` is every engine unless the file runs in fewer by design, and is never empty.
 */
export function requireEveryEngine(
  what: string,
  names: readonly string[] = Object.keys(ENGINES),
): void {
  if (names.length === 0) throw new Error(`requireEveryEngine: ${what} name no engine`);
  it.runIf(browserTestsRequired())(`has ${names.join(", ")} installed to run ${what} in`, () => {
    assertEveryEngine(what, names);
  });
}
