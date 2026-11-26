// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `npm run visual -- --out <dir>` run for real, up to the point where it needs a browser.
 * The runner used to delete the whole output directory before a run, so a mistyped --out
 * removed whatever was there. It may only remove what an earlier run wrote.
 */
const runner = path.resolve(import.meta.dirname, "../visual/run.mjs");

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), "macalicious-visual-"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function run(...args: string[]) {
  return spawnSync(process.execPath, [runner, ...args], {
    encoding: "utf8",
    // No browser here: the run prepares the output directory and then stops at the launch,
    // the same on a machine that has one installed.
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(sandbox, "no-browsers") },
  });
}

describe("visual runner --out", () => {
  it("keeps every file it did not write, and clears its own stale images", () => {
    const out = path.join(sandbox, "documents");
    const keep = {
      "thesis.txt": "precious",
      "photos/holiday.png": "not ours",
      "push-button/notes.txt": "mine",
      "push-button/Screenshot 2019.png": "mine too",
      "other-folder/old@2x.actual.png": "another folder's results",
    };
    const stale = ["push-button/gone@2x.actual.png", "push-button/gone@1x.diff.png", "report.html"];
    for (const [file, content] of [...Object.entries(keep), ...stale.map((f) => [f, "stale"])]) {
      mkdirSync(path.dirname(path.join(out, file as string)), { recursive: true });
      writeFileSync(path.join(out, file as string), content as string);
    }

    const result = run("push-button/dialog-buttons-light-bezel", "--scale", "2", "--out", out);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Could not launch chromium");
    for (const [file, content] of Object.entries(keep)) {
      expect(readFileSync(path.join(out, file), "utf8")).toBe(content);
    }
    for (const file of stale) expect(existsSync(path.join(out, file))).toBe(false);
  }, 60_000);

  it("refuses an --out that is a file", () => {
    const file = path.join(sandbox, "report.txt");
    writeFileSync(file, "keep");
    const result = run("push-button/dialog-buttons-light-bezel", "--out", file);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("is not a directory");
    expect(readFileSync(file, "utf8")).toBe("keep");
  }, 60_000);

  it("rejects an unknown scale before doing anything", () => {
    const out = path.join(sandbox, "out");
    const result = run("push-button", "--scale", "3", "--out", out);
    expect(result.status).toBe(2);
    expect(existsSync(out)).toBe(false);
  });
});
