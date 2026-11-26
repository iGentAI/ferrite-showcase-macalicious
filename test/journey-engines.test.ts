// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ENGINE_NAMES,
  ENGINES,
  engineFamily,
  options,
  sameDownloadName,
} from "../ferrite-apps/desktop/e2e/journey-kit.mjs";

/*
 * The served journeys' engines (ferrite-apps/desktop/e2e/journey-kit.mjs): `--browser` takes
 * chromium (Playwright's build), chrome (Google Chrome stable, Playwright's `chrome` channel),
 * firefox and webkit, and every e2e runner takes its engine from journey-kit, so each one takes
 * all four. Launching the real Chrome is the journeys' own evidence; here Chromium's launch is
 * replaced, so this test needs no browser.
 */

const e2e = path.join(import.meta.dirname, "../ferrite-apps/desktop/e2e");

/** A browser type imported from Playwright: a runner that has one can launch past ENGINES. */
const BROWSER_TYPE_IMPORT =
  /import\s*\{[^}]*\b(chromium|firefox|webkit)\b[^}]*\}\s*from\s*"playwright"/;

/**
 * An object of per-engine values looked up by the engine's own name (`{ chromium: ... }[browserName]`):
 * Chrome has no key of its own there, so such a lookup goes through `engineFamily`.
 */
const KEYED_BY_ENGINE_NAME =
  /\}\s*\[\s*(browserName|engineName)\s*\]|\b\w+(Options|Shown|Token|DENYING)\[(browserName|engineName)\]/;

describe("the journeys' engines", () => {
  it("load no source path, which only the development front end serves", () => {
    const bySourcePath = readdirSync(e2e).filter(
      (name) =>
        name.endsWith(".mjs") && readFileSync(path.join(e2e, name), "utf8").includes("/@fs/"),
    );
    expect(bySourcePath).toEqual([]);
  });

  // vitest.config.ts restores mocks too; the spies on chromium.launch, process.exit and console.error
  // are restored here as well, so this file holds whatever the config says.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("are Chromium, Chrome, Firefox and WebKit", () => {
    expect(ENGINE_NAMES).toEqual(["chromium", "chrome", "firefox", "webkit"]);
    expect(ENGINES.chromium).toBe(chromium);
    expect(ENGINES.firefox).toBe(firefox);
    expect(ENGINES.webkit).toBe(webkit);
    expect(Object.isFrozen(ENGINES)).toBe(true);
  });

  it("launch Chrome as Chromium on the chrome channel, with the runner's own options", async () => {
    const browser = {} as Awaited<ReturnType<typeof chromium.launch>>;
    const launch = vi.spyOn(chromium, "launch").mockResolvedValue(browser);
    const args = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
    await expect(ENGINES.chrome.launch({ args, channel: "msedge" })).resolves.toBe(browser);
    expect(launch).toHaveBeenLastCalledWith({ args, channel: "chrome" });
    await ENGINES.chrome.launch();
    expect(launch).toHaveBeenLastCalledWith({ channel: "chrome" });
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it("put Chrome in Chromium's family and no unknown name in any", () => {
    expect(ENGINE_NAMES.map(engineFamily)).toEqual(["chromium", "chromium", "firefox", "webkit"]);
    for (const name of ["edge", "msedge", "Chrome", "", "constructor", "__proto__", "toString"]) {
      expect(engineFamily(name), name).toBeUndefined();
    }
  });

  it("are what --browser takes: chrome is accepted, an unknown name refused with exit 2", () => {
    const out = mkdtempSync(path.join(tmpdir(), "journey-engines-"));
    const argv = process.argv;
    try {
      process.argv = [
        "node",
        "j.mjs",
        "--browser",
        "chrome",
        "--out",
        out,
        "--url",
        "http://127.0.0.1:8080/",
      ];
      expect(options()).toEqual({ base: "http://127.0.0.1:8080", out, browserName: "chrome" });
      process.argv = ["node", "j.mjs", "--out", out];
      expect(options().browserName).toBe("chromium");
      const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit ${code}`);
      }) as never);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      for (const name of ["edge", "constructor"]) {
        process.argv = ["node", "j.mjs", "--browser", name, "--out", out];
        expect(() => options()).toThrow("exit 2");
        expect(error).toHaveBeenLastCalledWith(
          `--browser must be one of chromium, chrome, firefox, webkit, not ${name}`,
        );
      }
      expect(exit).toHaveBeenCalledTimes(2);
    } finally {
      process.argv = argv;
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("are where every e2e runner takes its engine from", () => {
    const runners = readdirSync(e2e).filter((name) => name.endsWith(".mjs"));
    expect(runners.length).toBeGreaterThan(60);
    const problems: string[] = [];
    for (const name of runners) {
      if (name === "journey-kit.mjs") continue;
      const source = readFileSync(path.join(e2e, name), "utf8");
      if (BROWSER_TYPE_IMPORT.test(source))
        problems.push(`${name} imports a browser type from playwright`);
      if (KEYED_BY_ENGINE_NAME.test(source))
        problems.push(`${name} looks up per-engine values by the engine's name, not its family`);
      // A usage line that lists the engines lists all four.
      for (const usage of source.match(/--browser [a-z|]+/g) ?? []) {
        if (usage.includes("|") && usage !== "--browser chromium|chrome|firefox|webkit")
          problems.push(`${name} documents ${usage}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

/*
 * A download's name, as the journeys check Finder's Download, Photo Booth's Export… and Preview's
 * Download as PNG: Playwright 1.64.1's WebKit 27.2 reports a name with spaces with each space as an
 * underscore (test/download-names.browser.test.ts shows it in the real engines).
 */
describe("a download's name, as the journeys check it", () => {
  const name = "Field notes 1.txt";

  it("is the name the page gave, in every engine", () => {
    for (const engine of ENGINE_NAMES) {
      expect(sameDownloadName(name, name, engine), engine).toBe(true);
    }
  });

  it("is also, in WebKit only, that name with each space an underscore", () => {
    expect(sameDownloadName("Field_notes_1.txt", name, "webkit")).toBe(true);
    for (const engine of ["chromium", "chrome", "firefox", "edge", ""]) {
      expect(sameDownloadName("Field_notes_1.txt", name, engine), engine).toBe(false);
    }
  });

  it("is never a name that differs in anything but those spaces", () => {
    for (const other of [
      "Field notes_1.txt",
      "Field_notes_2.txt",
      "Field-notes-1.txt",
      "field_notes_1.txt",
      "Field_notes_1.txt.download",
      "",
    ]) {
      expect(sameDownloadName(other, name, "webkit"), other).toBe(false);
    }
    // Underscores the page gave are not met by spaces.
    expect(sameDownloadName("Field notes 1.txt", "Field_notes_1.txt", "webkit")).toBe(false);
  });
});
