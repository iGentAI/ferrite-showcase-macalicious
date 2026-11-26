// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseSync } from "oxc-parser";
import type { BrowserType } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertEveryEngine,
  browserTestsRequired,
  ENGINES,
  INSTALL,
  installed,
  missingEngines,
  requireEveryEngine,
} from "./browser-engines";

const root = path.join(import.meta.dirname, "..");

/**
 * The folders that hold no source of this repository, by name: version control, what is
 * installed, built or checked out, and caches. Every other folder is searched, a hidden one
 * (`.storybook`) too.
 */
const NOT_SOURCE = new Set([".git", "node_modules", "dist", "work", ".cache"]);

/** Every `*.browser.test.ts(x)` under `from`, the repository unless told, wherever it is. */
function browserTestFiles(from: string = root): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(from, dir), { withFileTypes: true })) {
      const file = dir === "" ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!NOT_SOURCE.has(entry.name)) walk(file);
      } else if (/\.browser\.test\.tsx?$/.test(entry.name)) found.push(file);
    }
  };
  walk("");
  return found.sort();
}

/** What a browser test file may not say outside a comment: the helper says both for it. */
const HELPERS_OWN = ["REQUIRE_BROWSER_TESTS", "executablePath"];

/**
 * The files that run in fewer than the three engines by design, and the engines each names in
 * its call. Every other file calls the guard with what it tests and nothing else, so it is
 * held to all three: a file cannot narrow its own requirement without a line here. No file is
 * listed today.
 */
const FEWER_ENGINES: Record<string, readonly string[]> = {};

type Node = { type: string; [key: string]: unknown };

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && typeof (value as Node).type === "string";

/** Whether an import declaration, or one name of it, brings in a type and no value. */
const typeOnly = (node: unknown): boolean => isNode(node) && node.importKind === "type";

/** The pattern of a regular expression literal as it is written; undefined for another node. */
function patternOf(node: Node): string | undefined {
  if (node.type !== "Literal" || typeof node.regex !== "object" || node.regex === null) {
    return undefined;
  }
  const { pattern } = node.regex as { pattern?: unknown };
  if (typeof pattern === "string") return pattern;
  return typeof node.raw === "string" ? node.raw : undefined;
}

/**
 * Every name and every piece of text the code of `node` writes out: identifiers, string
 * literals, the fixed parts of templates and the text of JSX elements, as the parser read
 * them, so an escape in a name (`"executable\u0050ath"`) is the name it stands for. The
 * pattern of a regular expression is taken as it is written, with its escapes.
 */
function namesAndStrings(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) namesAndStrings(item, found);
  } else if (isNode(node)) {
    if (typeof node.name === "string") found.push(node.name);
    const text = node.type === "Literal" || node.type === "JSXText";
    if (text && typeof node.value === "string") found.push(node.value);
    const pattern = patternOf(node);
    if (pattern !== undefined) found.push(pattern);
    if (node.type === "TemplateElement") {
      const { cooked } = node.value as { cooked?: string | null };
      if (typeof cooked === "string") found.push(cooked);
    }
    for (const value of Object.values(node)) {
      if (typeof value === "object" && value !== null) namesAndStrings(value, found);
    }
  }
  return found;
}

/** The strings of an array of string literals, or undefined when the node is anything else. */
function stringList(node: unknown): string[] | undefined {
  if (!isNode(node) || node.type !== "ArrayExpression") return undefined;
  const strings: string[] = [];
  for (const element of node.elements as unknown[]) {
    if (!isNode(element) || element.type !== "Literal" || typeof element.value !== "string") {
      return undefined;
    }
    strings.push(element.value);
  }
  return strings;
}

/**
 * Why `source`, the browser test file at `file` (from the repository root), does not take its
 * guard from test/browser-engines; empty when it does. The file is parsed, so a comment neither
 * satisfies nor breaks a rule, and the helper's two names are found however they are spelled.
 * A name put together while the file runs (`"REQUIRE_" + "BROWSER_TESTS"`) is not found: the
 * check is there so that the files do not drift apart and no file drops an engine by accident
 * or by a plain edit, not to stop an author who sets out to defeat it. `fewerEngines` is the
 * list of files that may name engines, which the tests of that rule replace with one of their
 * own.
 */
function guardProblems(
  file: string,
  source: string,
  fewerEngines: Record<string, readonly string[]> = FEWER_ENGINES,
): string[] {
  const parsed = parseSync(file, source);
  const [syntaxError] = parsed.errors;
  if (syntaxError) return [`does not parse: ${syntaxError.message}`];

  const problems: string[] = [];
  const relative = path
    .relative(path.dirname(file), "test/browser-engines")
    .split(path.sep)
    .join("/");
  const helper = relative.startsWith(".") ? relative : `./${relative}`;

  // The name the file knows the helper's `requireEveryEngine` by: a value it imports, since a
  // name imported as a type is gone when the file runs.
  let guard: string | undefined;
  for (const statement of parsed.program.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== helper) continue;
    if (typeOnly(statement)) continue;
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.type !== "ImportSpecifier" || typeOnly(specifier)) continue;
      const imported =
        specifier.imported.type === "Identifier"
          ? specifier.imported.name
          : specifier.imported.value;
      if (imported === "requireEveryEngine") guard = specifier.local.name;
    }
  }
  if (guard === undefined) {
    problems.push(`does not import requireEveryEngine from "${helper}"`);
  } else {
    // One call that always runs: a statement of the module, not one inside a condition.
    const calls: unknown[][] = [];
    for (const statement of parsed.program.body) {
      if (statement.type !== "ExpressionStatement") continue;
      const { expression } = statement;
      if (expression.type !== "CallExpression" || expression.callee.type !== "Identifier") continue;
      if (expression.callee.name === guard) calls.push(expression.arguments);
    }
    if (calls.length !== 1) {
      problems.push(
        `calls requireEveryEngine ${calls.length} times as a statement of the module, not once`,
      );
    }
    // Which engines the call asks for is not the file's to choose: the call is written out, a
    // string that says what the file tests and, for a listed file only, its engines.
    const [args] = calls;
    const fewer = fewerEngines[file];
    const [what] = args ?? [];
    const saysWhat = isNode(what) && what.type === "Literal" && typeof what.value === "string";
    if (args !== undefined && fewer === undefined && !(saysWhat && args.length === 1)) {
      problems.push(
        "names its own engines: only a file listed in FEWER_ENGINES may ask for fewer than all",
      );
    }
    if (args !== undefined && fewer !== undefined) {
      const named = saysWhat && args.length === 2 ? stringList(args[1]) : undefined;
      if (named?.join() !== fewer.join()) {
        problems.push(
          `does not ask for ${fewer.join(", ")}, the engines FEWER_ENGINES lists for it`,
        );
      }
    }
  }

  const said = namesAndStrings(parsed.program);
  // The helper's module is named to import from it and for nothing else: a mock of the module
  // would put another guard in its place.
  const imports = parsed.program.body.filter(
    (statement) => statement.type === "ImportDeclaration" && statement.source.value === helper,
  );
  if (said.filter((text) => text.includes("browser-engines")).length > imports.length) {
    problems.push("names the helper's module other than to import from it");
  }
  for (const word of HELPERS_OWN) {
    if (said.some((text) => text.includes(word))) {
      problems.push(`says ${word} itself, outside a comment`);
    }
  }
  return problems;
}

const only =
  (...there: string[]) =>
  (name: string) =>
    there.includes(name);

/** An engine whose browser Playwright says is at `file`. */
const engineAt = (file: string) => ({ executablePath: () => file }) as unknown as BrowserType;

const NOWHERE = path.join(root, "no-such-folder", "no-such-browser");

/** Make Playwright say that the engines of `there` are installed and the others are not. */
function pretendInstalled(...there: string[]) {
  for (const [name, engine] of Object.entries(ENGINES)) {
    vi.spyOn(engine, "executablePath").mockReturnValue(
      there.includes(name) ? process.execPath : NOWHERE,
    );
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the browser engines of the browser tests", () => {
  it("are Chromium, Firefox and WebKit", () => {
    expect(Object.keys(ENGINES)).toEqual(["chromium", "firefox", "webkit"]);
  });

  it("requires them only where REQUIRE_BROWSER_TESTS is set", () => {
    expect(browserTestsRequired({})).toBe(false);
    expect(browserTestsRequired({ REQUIRE_BROWSER_TESTS: "" })).toBe(false);
    expect(browserTestsRequired({ REQUIRE_BROWSER_TESTS: "1" })).toBe(true);
  });

  it("calls an engine installed when the file Playwright names for it exists", () => {
    expect(installed(engineAt(process.execPath))).toBe(true);
    expect(installed(engineAt(NOWHERE))).toBe(false);
    const unsupported = {
      executablePath: () => {
        throw new Error("Unsupported platform");
      },
    } as unknown as BrowserType;
    expect(installed(unsupported)).toBe(false);
  });

  it("lists the engines that are not installed, in order", () => {
    const all = Object.keys(ENGINES);
    expect(missingEngines(all, only("chromium", "firefox", "webkit"))).toEqual([]);
    expect(missingEngines(all, only("chromium"))).toEqual(["firefox", "webkit"]);
    expect(missingEngines(all, only("firefox", "webkit"))).toEqual(["chromium"]);
    expect(missingEngines(all, only())).toEqual(all);
    // A file that runs in one engine asks for that one only.
    expect(missingEngines(["chromium"], only("chromium"))).toEqual([]);
  });

  it("asks Playwright what is installed when it is not told", () => {
    pretendInstalled("chromium", "firefox", "webkit");
    expect(missingEngines()).toEqual([]);
    expect(() => assertEveryEngine("the tests")).not.toThrow();

    pretendInstalled("chromium");
    expect(missingEngines()).toEqual(["firefox", "webkit"]);
    expect(() => assertEveryEngine("the tests")).toThrowError(
      "would skip firefox, webkit: those engines are not installed",
    );
    expect(() => assertEveryEngine("the tests", ["chromium"])).not.toThrow();
  });

  it("counts a name that is not an engine as missing", () => {
    pretendInstalled("chromium", "firefox", "webkit");
    expect(missingEngines(["chromium", "netscape"])).toEqual(["netscape"]);
  });

  it("passes when every engine is installed", () => {
    expect(() =>
      assertEveryEngine("the tests", Object.keys(ENGINES), only("chromium", "firefox", "webkit")),
    ).not.toThrow();
  });

  it("fails with Chromium alone, and names Firefox and WebKit", () => {
    expect(() =>
      assertEveryEngine("the Preview tests", Object.keys(ENGINES), only("chromium")),
    ).toThrowError(
      "REQUIRE_BROWSER_TESTS is set, and the Preview tests would skip firefox, webkit: " +
        "those engines are not installed (needed: chromium, firefox, webkit). " +
        `Install with "${INSTALL}".`,
    );
  });

  it.each(["chromium", "firefox", "webkit"])(
    "fails when only %s is missing, and names it",
    (gone) => {
      const there = Object.keys(ENGINES).filter((name) => name !== gone);
      let message = "";
      try {
        assertEveryEngine("the tests", Object.keys(ENGINES), only(...there));
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain(`would skip ${gone}: that engine is not installed`);
      for (const name of there) expect(message).not.toContain(`skip ${name}`);
    },
  );
});

describe("requireEveryEngine", () => {
  /** Stand in for `it.runIf`, and keep what the helper registers and on which condition. */
  function registrations() {
    const kept: { condition: unknown; name: string; run: () => void }[] = [];
    const runIf = ((condition: unknown) => (name: string, run: () => void) => {
      kept.push({ condition, name, run });
    }) as unknown as typeof it.runIf;
    vi.spyOn(it, "runIf").mockImplementation(runIf);
    return kept;
  }

  it("registers a test that fails and names the engines that are missing", () => {
    vi.stubEnv("REQUIRE_BROWSER_TESTS", "1");
    pretendInstalled("chromium");
    const kept = registrations();
    requireEveryEngine("the Preview tests");
    expect(kept).toHaveLength(1);
    expect(kept[0]?.condition).toBe(true);
    expect(kept[0]?.name).toBe(
      "has chromium, firefox, webkit installed to run the Preview tests in",
    );
    expect(kept[0]?.run).toThrowError(
      "the Preview tests would skip firefox, webkit: those engines are not installed",
    );
  });

  it("registers a test that passes when the engines are there", () => {
    vi.stubEnv("REQUIRE_BROWSER_TESTS", "1");
    pretendInstalled("chromium", "firefox", "webkit");
    const kept = registrations();
    requireEveryEngine("the Preview tests");
    expect(kept[0]?.run).not.toThrow();
  });

  it("asks only for the engines a file names", () => {
    vi.stubEnv("REQUIRE_BROWSER_TESTS", "1");
    pretendInstalled("chromium");
    const kept = registrations();
    requireEveryEngine("the Thing tests", ["chromium"]);
    expect(kept[0]?.name).toBe("has chromium installed to run the Thing tests in");
    expect(kept[0]?.run).not.toThrow();
  });

  it("registers the test as skipped where the variable is not set", () => {
    vi.stubEnv("REQUIRE_BROWSER_TESTS", "");
    const kept = registrations();
    requireEveryEngine("the Preview tests");
    expect(kept).toHaveLength(1);
    expect(kept[0]?.condition).toBe(false);
  });

  it("refuses a list of no engines, which would require nothing", () => {
    const kept = registrations();
    expect(() => requireEveryEngine("the Preview tests", [])).toThrowError(
      "requireEveryEngine: the Preview tests name no engine",
    );
    expect(kept).toHaveLength(0);
  });
});

describe("the search for browser test files", () => {
  it("looks in every folder, a hidden one too, but not in what is installed, built or checked out", () => {
    const tree = mkdtempSync(path.join(tmpdir(), "browser-test-files-"));
    try {
      const files = [
        ".storybook/thing.browser.test.tsx",
        "src/.hidden/deep/thing.browser.test.ts",
        "src/components/thing/thing.browser.test.tsx",
        "thing.browser.test.ts",
        // Not browser test files.
        "src/components/thing/thing.test.tsx",
        "src/components/thing/thing.browser.test.tsx.snap",
        // Not source.
        ".git/hooks/thing.browser.test.ts",
        "node_modules/package/thing.browser.test.ts",
        "docs/dist/thing.browser.test.ts",
        "work/copy/src/thing.browser.test.ts",
        ".cache/thing.browser.test.ts",
      ];
      for (const file of files) {
        mkdirSync(path.join(tree, path.dirname(file)), { recursive: true });
        writeFileSync(path.join(tree, file), "");
      }
      expect(browserTestFiles(tree)).toEqual(files.slice(0, 4));
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  });
});

describe("the check of a browser test file", () => {
  const FILE = "src/components/thing/thing.browser.test.tsx";
  const IMPORT =
    'import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";';
  const good = `${IMPORT}\nrequireEveryEngine("the Thing tests");\n`;

  it("accepts a file that imports the guard and calls it once", () => {
    expect(guardProblems(FILE, good)).toEqual([]);
    // Under another name, and from a demo's folder.
    expect(
      guardProblems(
        "demos/thing/thing.browser.test.tsx",
        'import { requireEveryEngine as guard } from "../../test/browser-engines";\n' +
          'guard("the Thing tests");\n',
      ),
    ).toEqual([]);
    // Beside a name that is imported as a type.
    expect(
      guardProblems(
        FILE,
        'import { type ENGINES, requireEveryEngine } from "../../../test/browser-engines";\n' +
          'requireEveryEngine("the Thing tests");\n',
      ),
    ).toEqual([]);
  });

  it("finds the helper from a file beside it and from the repository root", () => {
    const from = (helper: string) =>
      `import { requireEveryEngine } from "${helper}";\nrequireEveryEngine("the Thing tests");\n`;
    expect(guardProblems("test/thing.browser.test.ts", from("./browser-engines"))).toEqual([]);
    expect(guardProblems("thing.browser.test.ts", from("./test/browser-engines"))).toEqual([]);
    expect(guardProblems("test/thing.browser.test.ts", from("browser-engines"))).toEqual([
      'does not import requireEveryEngine from "./browser-engines"',
      "names the helper's module other than to import from it",
    ]);
  });

  describe("of a file that runs in fewer engines by design", () => {
    // No file of the repository is listed, so the rule is tested with a list of one made-up
    // file.
    const ONE = "demos/thing/thing.browser.test.tsx";
    const LISTED = { [ONE]: ["chromium"] };
    const call = (args: string) =>
      `import { requireEveryEngine } from "../../test/browser-engines";\nrequireEveryEngine(${args});\n`;
    const wrong = ["does not ask for chromium, the engines FEWER_ENGINES lists for it"];

    it("is no file of the repository: every one runs in the three engines", () => {
      expect(FEWER_ENGINES).toEqual({});
    });

    it("accepts the engines listed for it", () => {
      expect(guardProblems(ONE, call('"the Thing tests", ["chromium"]'), LISTED)).toEqual([]);
    });

    it("holds a file that is not listed to all three", () => {
      expect(guardProblems(ONE, call('"the Thing tests", ["chromium"]'))).toEqual([
        "names its own engines: only a file listed in FEWER_ENGINES may ask for fewer than all",
      ]);
    });

    it.each([
      ["no engines, as if it ran in all three", '"the Thing tests"'],
      ["other engines", '"the Thing tests", ["firefox"]'],
      ["no engine at all", '"the Thing tests", []'],
      ["engines that are not written out", '"the Thing tests", engines'],
      ["its arguments spread from a list", '...["the Thing tests", ["chromium"]]'],
      ["an engine spread into its list", '"the Thing tests", [...["chromium"]]'],
    ])("rejects a call with %s", (_how, args) => {
      expect(guardProblems(ONE, call(args), LISTED)).toEqual(wrong);
    });
  });

  it("lets a comment say what the code may not", () => {
    const commented =
      "/* Set REQUIRE_BROWSER_TESTS=1 where the engines must be there (“é”, 中). */\n" +
      `${good}// executablePath() is the helper's to call.\n`;
    expect(guardProblems(FILE, commented)).toEqual([]);
  });

  const missingImport = 'does not import requireEveryEngine from "../../../test/browser-engines"';
  const notOnce = (count: number) =>
    `calls requireEveryEngine ${count} times as a statement of the module, not once`;
  const says = (word: string) => `says ${word} itself, outside a comment`;
  const ownEngines =
    "names its own engines: only a file listed in FEWER_ENGINES may ask for fewer than all";

  it.each([
    ["has no guard", 'import { it } from "vitest";\n', [missingImport]],
    [
      "defines a guard of its own with the helper's name",
      'function requireEveryEngine(what: string) {}\nrequireEveryEngine("the Thing tests");\n',
      [missingImport],
    ],
    [
      "imports the guard from another module",
      'import { requireEveryEngine } from "./my-engines";\nrequireEveryEngine("the Thing tests");\n',
      [missingImport],
    ],
    [
      "imports the guard as a type, which is gone when the file runs",
      'import type { requireEveryEngine } from "../../../test/browser-engines";\nrequireEveryEngine("the Thing tests");\n',
      [missingImport],
    ],
    [
      "imports the guard as a type among the names it takes",
      'import { ENGINES, type requireEveryEngine } from "../../../test/browser-engines";\nrequireEveryEngine("the Thing tests");\n',
      [missingImport],
    ],
    [
      "mentions the helper's path in a comment only",
      '// from "../../../test/browser-engines"\nrequireEveryEngine("the Thing tests");\n',
      [missingImport],
    ],
    ["imports the guard and never calls it", `${IMPORT}\n`, [notOnce(0)]],
    [
      "calls the guard in a block comment only",
      `${IMPORT}\n/*\nrequireEveryEngine("the Thing tests");\n*/\n`,
      [notOnce(0)],
    ],
    [
      "calls the guard in a line comment only",
      `${IMPORT}\n// requireEveryEngine("the Thing tests");\n`,
      [notOnce(0)],
    ],
    [
      "calls the guard under a condition",
      `${IMPORT}\nif (process.env.CI) requireEveryEngine("the Thing tests");\n`,
      [notOnce(0)],
    ],
    [
      "calls the guard inside a function that nothing has to call",
      `${IMPORT}\nconst guard = () => {\nrequireEveryEngine("the Thing tests");\n};\n`,
      [notOnce(0)],
    ],
    ["calls the guard twice", `${good}requireEveryEngine("the other tests");\n`, [notOnce(2)]],
    [
      "asks for Chromium alone",
      `${IMPORT}\nrequireEveryEngine("the Thing tests", ["chromium"]);\n`,
      [ownEngines],
    ],
    [
      "asks for the engines of a list of its own",
      `${IMPORT}\nconst mine = ["chromium"];\nrequireEveryEngine("the Thing tests", mine);\n`,
      [ownEngines],
    ],
    [
      "asks for all three by name, which the helper does for it",
      `${IMPORT}\nrequireEveryEngine("the Thing tests", ["chromium", "firefox", "webkit"]);\n`,
      [ownEngines],
    ],
    [
      "puts a guard of its own in the helper's place, by the file's full name",
      `${good}vi.mock("../../../test/browser-engines.ts", () => ({ requireEveryEngine() {} }));\n`,
      ["names the helper's module other than to import from it"],
    ],
    ["calls the guard with nothing", `${IMPORT}\nrequireEveryEngine();\n`, [ownEngines]],
    [
      "spreads what it tests and Chromium alone into the call",
      `${IMPORT}\nrequireEveryEngine(...["the Thing tests", ["chromium"]]);\n`,
      [ownEngines],
    ],
    [
      "spreads a list of its own into the call",
      `${IMPORT}\nconst mine = ["the Thing tests", ["chromium"]] as const;\nrequireEveryEngine(...mine);\n`,
      [ownEngines],
    ],
    [
      "says what it tests with a name, which could be anything",
      `${IMPORT}\nconst what = "the Thing tests";\nrequireEveryEngine(what);\n`,
      [ownEngines],
    ],
    [
      "puts a guard of its own in the helper's place",
      `${good}vi.mock("../../../test/browser-engines", () => ({ requireEveryEngine() {} }));\n`,
      ["names the helper's module other than to import from it"],
    ],
    [
      "reads the variable by member",
      `${good}const required = Boolean(process.env.REQUIRE_BROWSER_TESTS);\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "reads the variable by string",
      `${good}const required = process.env["REQUIRE_BROWSER_TESTS"];\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "reads the variable with spaces around the dot",
      `${good}const required = process.env . REQUIRE_BROWSER_TESTS;\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "reads the variable by a string with an escape in it",
      `${good}const required = process.env["REQUIRE_\\u0042ROWSER_TESTS"];\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "reads the variable by a template",
      `${good}const required = process.env[\`REQUIRE_BROWSER_TESTS\`];\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "reads the variable by destructuring",
      `${good}const { REQUIRE_BROWSER_TESTS: required } = process.env;\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "finds the variable with a regular expression",
      `${good}const names = Object.keys(process.env).filter((name) => /^REQUIRE_BROWSER_TESTS$/.test(name));\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "says the variable in the text of an element",
      `${good}const label = <p>Set REQUIRE_BROWSER_TESTS to 1</p>;\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "says the variable in an attribute of an element",
      `${good}const label = <p title="REQUIRE_BROWSER_TESTS" />;\n`,
      [says("REQUIRE_BROWSER_TESTS")],
    ],
    [
      "asks Playwright what is installed",
      `${good}const there = existsSync(chromium.executablePath());\n`,
      [says("executablePath")],
    ],
    [
      "asks Playwright what is installed, with a space before the call",
      `${good}const there = existsSync(chromium.executablePath ());\n`,
      [says("executablePath")],
    ],
    [
      "asks Playwright what is installed, by string",
      `${good}const there = existsSync(chromium["executablePath"]());\n`,
      [says("executablePath")],
    ],
    [
      "asks Playwright what is installed, by a string with an escape in it",
      `${good}const there = existsSync(chromium["executable\\u0050ath"]());\n`,
      [says("executablePath")],
    ],
    [
      "asks Playwright what is installed, by a name with an escape in it",
      `${good}const there = existsSync(chromium.executable\\u0050ath());\n`,
      [says("executablePath")],
    ],
    [
      "asks Playwright what is installed, by a name found with a regular expression",
      `${good}const probe = Object.keys(chromium).find((key) => /^executablePath$/.test(key));\n`,
      [says("executablePath")],
    ],
    [
      "says what Playwright is asked in the text of an element",
      `${good}const label = <code>chromium.executablePath</code>;\n`,
      [says("executablePath")],
    ],
    ["does not parse", `${good}const = ;\n`, [expect.stringMatching(/^does not parse: /)]],
  ])("rejects a file that %s", (_how, source, problems) => {
    expect(guardProblems(FILE, source)).toEqual(problems);
  });
});

describe("every browser test file", () => {
  const files = browserTestFiles();

  it("is found, in src and in demos", () => {
    expect(files.some((file) => file.startsWith("src/components/"))).toBe(true);
    expect(files.some((file) => file.startsWith("demos/"))).toBe(true);
  });

  it.each(files)("%s takes its guard from test/browser-engines", (file) => {
    expect(guardProblems(file, readFileSync(path.join(root, file), "utf8"))).toEqual([]);
  });
});
