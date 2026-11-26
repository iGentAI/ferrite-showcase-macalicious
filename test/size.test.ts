// @vitest-environment node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeMappings, withoutSources } from "../scripts/lib/built-sources.mjs";
import { SHARED_HELPERS } from "../scripts/lib/shared-helpers.mjs";
import { gzipSize, measureSizes, ownJavaScript } from "../scripts/lib/size.mjs";

/**
 * The size gate of `npm run build` (scripts/report-size.mjs), run for real on a built tree
 * written here. It used to add every chunk an entry imports, so a submenu was charged for the
 * menu and the menu item it is built from and failed a budget that is meant for a component's
 * own code.
 */
const script = path.resolve(import.meta.dirname, "../scripts/report-size.mjs");

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "macalicious-size-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Code that gzip cannot shrink: about `bytes` bytes after compression. */
const filler = (name: string, bytes: number) =>
  `export const ${name} = "${randomBytes(bytes).toString("base64")}";`;

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlq(value: number) {
  let rest = value < 0 ? (-value << 1) | 1 : value << 1;
  let text = "";
  do {
    const digit = rest & 31;
    rest >>>= 5;
    text += BASE64[rest > 0 ? digit | 32 : digit];
  } while (rest > 0);
  return text;
}

/**
 * Write a built file whose lines each come from one source, with a source map that says so.
 * A line with no source (an import the bundler wrote) has no mapping.
 */
function built(file: string, lines: [code: string, source?: string][]) {
  const target = path.join(root, "dist", file);
  mkdirSync(path.dirname(target), { recursive: true });
  const sources = [...new Set(lines.flatMap(([, source]) => (source ? [source] : [])))];
  let previous = 0;
  const mappings = lines
    .map(([, source]) => {
      if (!source) return "";
      const index = sources.indexOf(source);
      const segment = `A${vlq(index - previous)}AA`;
      previous = index;
      return segment;
    })
    .join(";");
  const code = lines.map(([text]) => text).join("\n");
  writeFileSync(target, code);
  writeFileSync(
    `${target}.map`,
    JSON.stringify({
      version: 3,
      sources: sources.map((source) =>
        path.relative(path.dirname(target), path.join(root, source)),
      ),
      mappings,
    }),
  );
  return gzipSync(code).length;
}

/** An entry that only passes its chunk on: no source map, as the bundler writes it. */
function entry(name: string, chunk: string) {
  const target = path.join(root, "dist/components", `${name}.js`);
  mkdirSync(path.dirname(target), { recursive: true });
  const code = `export * from "../chunks/${chunk}";\n`;
  writeFileSync(target, code);
  return gzipSync(code).length;
}

/** A menu, and a submenu built from it; each chunk is `bytes` of code plus its imports. */
function tree({ menu, submenu }: { menu: number; submenu: number }) {
  const sizes = {
    cn: built("lib/cn.js", [["export const cn = () => '';", "src/lib/cn.ts"]]),
    menuChunk: built("chunks/menu-1.js", [
      ['import { cn } from "../lib/cn.js";'],
      [filler("menu", menu / 2), "src/components/menu/menu.tsx"],
      [filler("item", menu / 2), "src/components/menu/menu-item.tsx"],
    ]),
    menuEntry: entry("menu", "menu-1.js"),
    submenuChunk: built("chunks/submenu-1.js", [
      ['import { cn } from "../lib/cn.js";'],
      ['import { menu } from "./menu-1.js";'],
      [filler("submenu", submenu), "src/components/submenu/submenu.tsx"],
    ]),
    submenuEntry: entry("submenu", "submenu-1.js"),
  };
  writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
  return sizes;
}

const report = (env: Record<string, string> = {}, args: string[] = []) =>
  spawnSync(process.execPath, [script, "--root", root, ...args], {
    encoding: "utf8",
    env: { ...process.env, ENFORCE_COMPONENTS: "", ...env },
  });
const line = (output: string, name: string) =>
  output.split("\n").find((text) => text.trimStart().startsWith(`${name} `)) ?? "";

describe("the size gate", () => {
  it("does not charge a component for the components it is built from", () => {
    // Together 2400 + 1500 bytes are over the budget of 3072; each on its own is within it.
    const sizes = tree({ menu: 2400, submenu: 1500 });
    const own = ownJavaScript("submenu", root);
    expect(own.uses).toEqual(["menu"]);
    expect(own.files.map((file) => path.relative(root, file)).sort()).toEqual([
      path.join("dist", "chunks", "submenu-1.js"),
      path.join("dist", "components", "submenu.js"),
      path.join("dist", "lib", "cn.js"),
    ]);
    // The helper counts for both: it belongs to no component.
    expect(gzipSize(own.parts)).toBe(sizes.submenuEntry + sizes.submenuChunk + sizes.cn);
    expect(gzipSize(ownJavaScript("menu", root).parts)).toBe(
      sizes.menuEntry + sizes.menuChunk + sizes.cn,
    );
    expect(sizes.menuChunk + sizes.submenuChunk).toBeGreaterThan(3072);

    const result = report();
    expect(result.stdout).toContain("size (gzip, own code):");
    expect(line(result.stdout, "submenu")).toMatch(/uses menu$/);
    expect(result.stdout).not.toContain("OVER BUDGET");
    expect(result.status).toBe(0);
  });

  it("counts only a component's own part of a chunk it shares with another", () => {
    // The bundler may put the modules of two components into one chunk. The submenu's part
    // is 1500 bytes; with the menu's 2400 in the same file the whole chunk is over the budget.
    const menuCode = filler("menu", 2400);
    const submenuCode = filler("submenu", 1500);
    const helper = "const cn = () => '';";
    const chunk = built("chunks/menus-1.js", [
      [helper, "src/lib/cn.ts"],
      [menuCode, "src/components/menu/menu.tsx"],
      [submenuCode, "src/components/submenu/submenu.tsx"],
    ]);
    const submenuEntry = entry("submenu", "menus-1.js");
    entry("menu", "menus-1.js");
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    expect(chunk).toBeGreaterThan(3072);

    const submenu = ownJavaScript("submenu", root);
    expect(submenu.uses).toEqual(["menu"]);
    const part = submenu.parts.find((item) => item.file.endsWith("menus-1.js"));
    // The helper and the submenu's own line stay; the menu's line is left out.
    expect(part?.code).toBe([helper, "", submenuCode].join("\n"));
    expect(gzipSize(submenu.parts)).toBe(submenuEntry + gzipSync(part?.code ?? "").length);
    expect(gzipSize(submenu.parts)).toBeLessThan(3072);
    const menu = ownJavaScript("menu", root);
    expect(menu.uses).toEqual(["submenu"]);
    expect(menu.parts.find((item) => item.file.endsWith("menus-1.js"))?.code).toBe(
      [helper, menuCode, ""].join("\n"),
    );

    const result = report();
    expect(line(result.stdout, "submenu")).toMatch(/uses menu$/);
    expect(result.stdout).not.toContain("OVER BUDGET");
    expect(result.status).toBe(0);
  });

  it("counts a helper that sits in another component's chunk when the component imports it", () => {
    // The bundler put a helper only the menu used into the menu's chunk. A submenu that
    // imports the helper by name is charged for it; one that takes only the menu is not.
    const helper = filler("roving", 400).replace("export ", "");
    const menuCode = filler("menu", 2400).replace("export ", "");
    built("chunks/menu-1.js", [
      [helper, "src/lib/roving.ts"],
      [menuCode, "src/components/menu/menu.tsx"],
      ["export { menu, roving as r };"],
    ]);
    entry("menu", "menu-1.js");
    const submenuEntry = entry("submenu", "submenu-1.js");
    const chunk = (names: string) =>
      built("chunks/submenu-1.js", [
        [`import { ${names} } from "./menu-1.js";`],
        [filler("submenu", 1500), "src/components/submenu/submenu.tsx"],
      ]);

    const without = chunk("menu");
    let own = ownJavaScript("submenu", root);
    expect(own.uses).toEqual(["menu"]);
    expect(own.files.some((file) => file.endsWith(`${path.sep}menu-1.js`))).toBe(false);
    expect(gzipSize(own.parts)).toBe(submenuEntry + without);

    const withHelper = chunk("menu, r");
    own = ownJavaScript("submenu", root);
    expect(own.uses).toEqual(["menu"]);
    const part = own.parts.find((item) => item.file.endsWith(`${path.sep}menu-1.js`));
    // The helper's line and the export the bundler wrote stay; the menu's line is left out.
    expect(part?.code).toBe([helper, "", "export { menu, roving as r };"].join("\n"));
    expect(gzipSize(own.parts)).toBe(submenuEntry + withHelper + gzipSync(part?.code ?? "").length);
    // A name the chunk does not declare cannot be placed, so it counts.
    chunk("menu, unknown");
    expect(
      ownJavaScript("submenu", root).files.some((file) => file.endsWith(`${path.sep}menu-1.js`)),
    ).toBe(true);
  });

  it("counts a component's own code that it loads with import()", () => {
    // 1500 bytes in the chunk and 2000 more loaded on demand: over the budget together.
    built("chunks/panel-1.js", [
      ['const more = () => import("./panel-more-1.js");'],
      [filler("panel", 1500), "src/components/panel/panel.tsx"],
    ]);
    const lazy = built("chunks/panel-more-1.js", [
      [filler("more", 2000), "src/components/panel/more.tsx"],
    ]);
    entry("panel", "panel-1.js");
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");

    const own = ownJavaScript("panel", root);
    expect(own.files.some((file) => file.endsWith("panel-more-1.js"))).toBe(true);
    expect(lazy).toBeLessThan(3072);
    expect(gzipSize(own.parts)).toBeGreaterThan(3072);
    const result = report();
    expect(result.status).toBe(1);
  });

  it.each([
    ["a path with a dollar sign", 'import("./panel$more-1.js")', "panel$more-1.js"],
    ["a path with an escape", 'import("./panel\\u002dmore-1.js")', "panel-more-1.js"],
    ["a path with the other quote in it", `import("./panel'more-1.js")`, "panel'more-1.js"],
    ["a template literal without expressions", "import(`./panel-more-1.js`)", "panel-more-1.js"],
  ])("follows import() of %s, and fails when the file is missing", (_, call, file) => {
    built("chunks/panel-1.js", [
      [`const more = () => ${call};`],
      [filler("panel", 500), "src/components/panel/panel.tsx"],
    ]);
    built(`chunks/${file}`, [[filler("more", 2000), "src/components/panel/more.tsx"]]);
    entry("panel", "panel-1.js");
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    const own = ownJavaScript("panel", root);
    expect(own.files.some((item) => item.endsWith(file))).toBe(true);
    expect(own.js).toBeGreaterThan(500 + 2000);
    expect(own.loaded).toBeGreaterThan(500 + 2000);

    rmSync(path.join(root, "dist/chunks", file));
    const result = report();
    expect(result.stderr).toContain("which is not in the build");
    expect(result.status).toBe(1);
  });

  it("does not follow import() of a path worked out when the code runs", () => {
    built("chunks/panel-1.js", [
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the built code under test
      ["const more = (name) => import(`./${name}.js`);"],
      [filler("panel", 500), "src/components/panel/panel.tsx"],
    ]);
    entry("panel", "panel-1.js");
    expect(ownJavaScript("panel", root).files).toHaveLength(2);
  });

  it("does not take the text of an import in a string for an import", () => {
    built("chunks/panel-1.js", [
      ["export const note = 'import(\"./panel-more-1.js\")';", "src/components/panel/panel.tsx"],
    ]);
    built("chunks/panel-more-1.js", [[filler("more", 2000), "src/components/panel/more.tsx"]]);
    entry("panel", "panel-1.js");
    expect(
      ownJavaScript("panel", root).files.some((file) => file.endsWith("panel-more-1.js")),
    ).toBe(false);
  });

  it("counts a listed helper once when two components use it, and prints what each loads", () => {
    // Two views of 2000 bytes each use a selection helper of 1500: charged to both, each
    // would be over the budget.
    const helper = built("lib/selection.js", [[filler("selection", 1500), "src/lib/selection.ts"]]);
    const view = (name: string) => {
      const chunk = built(`chunks/${name}-1.js`, [
        ['import { selection } from "../lib/selection.js";'],
        [filler(name, 2000), `src/components/${name}/${name}.tsx`],
      ]);
      return chunk + entry(name, `${name}-1.js`);
    };
    const list = view("list");
    const table = view("table");
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    expect(list + helper).toBeGreaterThan(3072);

    const sizes = measureSizes(root);
    const [listed, tabled] = sizes.components;
    expect(listed).toMatchObject({
      name: "list",
      js: list,
      shared: ["src/lib/selection.ts"],
      sharedSize: helper,
      loaded: list + helper,
    });
    expect(tabled).toMatchObject({ name: "table", js: table, loaded: table + helper });
    expect(sizes.helpers.find((item) => item.file === "src/lib/selection.ts")).toMatchObject({
      built: true,
      shared: true,
      size: helper,
      users: ["list", "table"],
    });
    // A page with both loads the helper once.
    expect(sizes.loadedTogether(["list", "table"])).toBe(list + table + helper);

    const result = report({}, ["--with", "list,table"]);
    expect(result.status).toBe(0);
    expect(line(result.stdout, "list")).toContain(`shared ${helper} B (selection)`);
    expect(line(result.stdout, "list")).toContain(`loads ${list + helper} B`);
    expect(line(result.stdout, "src/lib/selection.ts")).toMatch(/used by 2: list, table$/);
    expect(line(result.stdout, "all 2 components")).toContain(`${list + table + helper} B`);
    expect(line(result.stdout, "list + table")).toContain(`${list + table + helper} B`);
  });

  it("charges a listed helper to the one component that uses it", () => {
    // On the list, and used by one component only: not shared, so no way round the budget.
    const helper = built("lib/selection.js", [[filler("selection", 1500), "src/lib/selection.ts"]]);
    const chunk = built("chunks/list-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      [filler("list", 2000), "src/components/list/list.tsx"],
    ]);
    const own = chunk + entry("list", "list-1.js") + helper;
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");

    const sizes = measureSizes(root);
    expect(sizes.components[0]).toMatchObject({ js: own, shared: [], sharedSize: 0, loaded: own });
    expect(sizes.helpers[0]).toMatchObject({ shared: false, users: ["list"] });
    const result = report();
    expect(line(result.stdout, "list")).toContain("OVER BUDGET");
    expect(line(result.stdout, "src/lib/selection.ts")).toMatch(
      /used by list alone: not shared, charged to it$/,
    );
    expect(result.status).toBe(1);
  });

  it("charges a helper that is not on the list to every component that uses it", () => {
    // Two users do not make a helper shared: only the reviewed list does.
    const helper = built("lib/rows.js", [[filler("rows", 1500), "src/lib/rows.ts"]]);
    for (const name of ["list", "table"]) {
      built(`chunks/${name}-1.js`, [
        ['import { rows } from "../lib/rows.js";'],
        [filler(name, 2000), `src/components/${name}/${name}.tsx`],
      ]);
      entry(name, `${name}-1.js`);
    }
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    const sizes = measureSizes(root);
    for (const component of sizes.components) {
      expect(component.shared).toEqual([]);
      expect(component.js).toBeGreaterThan(2000 + helper);
    }
    const result = report();
    expect(result.stdout).not.toContain("helpers counted once");
    expect(line(result.stdout, "list")).toContain("OVER BUDGET");
    expect(line(result.stdout, "table")).toContain("OVER BUDGET");
    expect(result.status).toBe(1);
  });

  it("holds a helper that is counted once to the budget", () => {
    built("lib/selection.js", [[filler("selection", 3400), "src/lib/selection.ts"]]);
    for (const name of ["list", "table"]) {
      built(`chunks/${name}-1.js`, [
        ['import { selection } from "../lib/selection.js";'],
        [filler(name, 500), `src/components/${name}/${name}.tsx`],
      ]);
      entry(name, `${name}-1.js`);
    }
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    const result = report();
    expect(line(result.stdout, "list")).not.toContain("OVER BUDGET");
    expect(line(result.stdout, "src/lib/selection.ts")).toContain("OVER BUDGET");
    expect(result.stderr).toContain("a helper that is counted once, is over the budget");
    expect(result.status).toBe(1);
    // Enforcing a component that does not use it leaves the helper out; one that does, not.
    built("chunks/other-1.js", [[filler("other", 500), "src/components/other/other.tsx"]]);
    entry("other", "other-1.js");
    expect(report({ ENFORCE_COMPONENTS: "other" }).status).toBe(0);
    expect(report({ ENFORCE_COMPONENTS: "table" }).status).toBe(1);
  });

  it("charges code that a source map gives no source for, even beside a shared helper", () => {
    const helperCode = filler("selection", 1500).replace("export ", "");
    const stray = filler("stray", 900).replace("export ", "");
    // One chunk: the shared helper, a line with no source, and nothing of a component.
    built("chunks/shared-1.js", [
      [helperCode, "src/lib/selection.ts"],
      [stray],
      ["export { selection };"],
    ]);
    const own = ["list", "table"].map((name) => {
      const chunk = built(`chunks/${name}-1.js`, [
        ['import { selection } from "./shared-1.js";'],
        [filler(name, 500), `src/components/${name}/${name}.tsx`],
      ]);
      return chunk + entry(name, `${name}-1.js`);
    });
    const sizes = measureSizes(root);
    // The helper's file is counted once, but the stray line is not known to be the helper's:
    // it is charged to both components. The list of exports only joins files, and is not.
    expect(sizes.helpers[0]).toMatchObject({ shared: true, users: ["list", "table"] });
    const strayCost = gzipSync(stray).length;
    expect(strayCost).toBeGreaterThan(900);
    expect(sizes.components.map((component) => component.js)).toEqual(
      own.map((size) => size + strayCost),
    );
    expect(sizes.components[0]?.parts.map((part) => part.code)).toContain(stray);

    // Without the stray line the helper's file costs the components nothing.
    built("chunks/shared-1.js", [
      ['"use client";'],
      ["// a comment the bundler wrote"],
      [helperCode, "src/lib/selection.ts"],
      ["export { selection };"],
    ]);
    expect(measureSizes(root).components.map((component) => component.js)).toEqual(own);
    built("chunks/shared-1.js", [
      [helperCode, "src/lib/selection.ts"],
      [stray],
      ["export { selection };"],
    ]);

    // The same stray line in a chunk that also holds a component's code is charged to it.
    const withStray = built("chunks/list-1.js", [
      ['import { selection } from "./shared-1.js";'],
      [filler("list", 500), "src/components/list/list.tsx"],
      [stray],
    ]);
    expect(measureSizes(root).components[0]?.js).toBe(
      withStray + entry("list", "list-1.js") + strayCost,
    );
    expect(withStray).toBeGreaterThan(500 + 900);
  });

  it("gives a listed helper that is not counted once no budget of its own", () => {
    // On the list, built as an entry of the library, over the budget, and used by nobody: no
    // component loads it, so there is nothing to hold to a budget.
    built("lib/selection.js", [[filler("selection", 3400), "src/lib/selection.ts"]]);
    built("chunks/list-1.js", [[filler("list", 500), "src/components/list/list.tsx"]]);
    entry("list", "list-1.js");
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    const unused = report();
    expect(line(unused.stdout, "src/lib/selection.ts")).toContain("used by no component");
    expect(unused.stdout).not.toContain("OVER BUDGET");
    expect(unused.status).toBe(0);

    // With one user it is that component's code: the component fails, the helper line does not.
    built("chunks/list-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      [`${filler("list", 500)} export const s = selection;`, "src/components/list/list.tsx"],
    ]);
    const alone = report();
    expect(line(alone.stdout, "list")).toContain("OVER BUDGET");
    expect(line(alone.stdout, "src/lib/selection.ts")).not.toContain("OVER BUDGET");
    expect(alone.status).toBe(1);
  });

  it("fails when a built file imports a local file that is not in the build", () => {
    tree({ menu: 1000, submenu: 1000 });
    rmSync(path.join(root, "dist/lib/cn.js"));
    const result = report();
    expect(result.stderr).toMatch(
      /size report failed: dist\/chunks\/menu-1\.js imports dist\/lib\/cn\.js, which is not in the build/,
    );
    expect(result.status).toBe(1);
  });

  it("does not make a component a user of what only the other side of a shared chunk imports", () => {
    // The bundler put the list and the cell it is built from into one chunk. Only the cell
    // uses the selection helper (listed) and the big helper (not listed).
    const selection = built("lib/selection.js", [
      [filler("selection", 1500), "src/lib/selection.ts"],
    ]);
    const big = built("lib/big.js", [[filler("big", 2500), "src/lib/big.ts"]]);
    // The list's own code names both helpers in a string and in a comment, and reads a
    // property called `selection`: none of that is a use of the import.
    const listCode = `${filler("list", 800).replace("export ", "")} const note = "selection + big"; /* selection, big */ const size = note.selection;`;
    const cellCode = `${filler("cell", 800).replace("export ", "")} const both = selection + big;`;
    built("chunks/list-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      ['import { big } from "../lib/big.js";'],
      [listCode, "src/components/list/list.tsx"],
      [cellCode, "src/components/cell/cell.tsx"],
      ["export { list, cell };"],
    ]);
    entry("list", "list-1.js");
    entry("cell", "list-1.js");
    // A table uses the selection helper too, so with the list it would have had two users.
    built("chunks/table-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      [`${filler("table", 500)} export const t = selection;`, "src/components/table/table.tsx"],
    ]);
    entry("table", "table-1.js");
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");

    const sizes = measureSizes(root);
    const by = Object.fromEntries(sizes.components.map((item) => [item.name, item]));
    expect(sizes.helpers[0]).toMatchObject({ users: ["cell", "table"], shared: true });
    // The list: its own 800 bytes, and neither helper. The cell: its own, and the big helper.
    expect(by.list?.files.some((file) => file.includes(`${path.sep}lib${path.sep}`))).toBe(false);
    expect(by.list?.shared).toEqual([]);
    expect(by.list?.js).toBeLessThan(1400);
    expect(by.cell?.shared).toEqual(["src/lib/selection.ts"]);
    expect(by.cell?.js).toBeGreaterThan(800 + big);
    expect(selection).toBeGreaterThan(1500);

    // Without the table the helper has one user, the cell: it is not counted once.
    rmSync(path.join(root, "dist/components/table.js"));
    const alone = measureSizes(root);
    expect(alone.helpers[0]).toMatchObject({ users: ["cell"], shared: false });
    const cell = alone.components.find((item) => item.name === "cell");
    expect(cell?.js).toBeGreaterThan(800 + big + selection);
  });

  it("takes a name the chunk declares again for a doubt: charged, and no proof of a user", () => {
    const selection = built("lib/selection.js", [
      [filler("selection", 1500), "src/lib/selection.ts"],
    ]);
    const big = built("lib/big.js", [[filler("big", 2500), "src/lib/big.ts"]]);
    // The list's own code has parameters with the names of the two imports. Whether the uses
    // inside are of the parameters or of the imports is not worked out.
    const listCode = `${filler("list", 800).replace("export ", "")} const pick = (selection, big) => selection + big;`;
    const cellCode = `${filler("cell", 800).replace("export ", "")} const both = selection + big;`;
    built("chunks/list-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      ['import { big } from "../lib/big.js";'],
      [listCode, "src/components/list/list.tsx"],
      [cellCode, "src/components/cell/cell.tsx"],
      ["export { list, cell };"],
    ]);
    entry("list", "list-1.js");
    entry("cell", "list-1.js");
    const sizes = measureSizes(root);
    const by = Object.fromEntries(sizes.components.map((item) => [item.name, item]));
    // No proof for either side of the chunk that it uses the listed helper, so it has no
    // certain user and is not counted once; the doubt charges both helpers to both.
    expect(sizes.helpers[0]).toMatchObject({ users: [], shared: false });
    expect(by.list?.js).toBeGreaterThan(800 + big + selection);
    expect(by.cell?.js).toBeGreaterThan(800 + big + selection);
  });

  it("takes a use in code without a source for a doubt too: charged, and no proof of a user", () => {
    const selection = built("lib/selection.js", [
      [filler("selection", 1500), "src/lib/selection.ts"],
    ]);
    // The only use of the import in the chunk of the list and the cell is on a line the source
    // map gives no source for: it may be either's.
    built("chunks/list-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      [filler("list", 800).replace("export ", ""), "src/components/list/list.tsx"],
      [filler("cell", 800).replace("export ", ""), "src/components/cell/cell.tsx"],
      ["const glue = selection;"],
      ["export { list, cell };"],
    ]);
    entry("list", "list-1.js");
    entry("cell", "list-1.js");
    built("chunks/table-1.js", [
      ['import { selection } from "../lib/selection.js";'],
      [`${filler("table", 500)} export const t = selection;`, "src/components/table/table.tsx"],
    ]);
    entry("table", "table-1.js");
    const sizes = measureSizes(root);
    const by = Object.fromEntries(sizes.components.map((item) => [item.name, item]));
    // The table is the one proven user, so the helper is not counted once, and it is charged
    // to the list and the cell as well as to the table.
    expect(sizes.helpers[0]).toMatchObject({ users: ["table"], shared: false });
    expect(by.list?.js).toBeGreaterThan(800 + selection);
    expect(by.cell?.js).toBeGreaterThan(800 + selection);
    expect(by.table?.js).toBeGreaterThan(500 + selection);
  });

  it("charges code without a source in the chunk of a component it is built from", () => {
    const stray = filler("stray", 900).replace("export ", "");
    built("chunks/menu-1.js", [[filler("menu", 1000), "src/components/menu/menu.tsx"], [stray]]);
    entry("menu", "menu-1.js");
    const own =
      built("chunks/submenu-1.js", [
        ['import { menu } from "./menu-1.js";'],
        [filler("submenu", 500), "src/components/submenu/submenu.tsx"],
      ]) + entry("submenu", "submenu-1.js");
    const submenu = ownJavaScript("submenu", root);
    // The menu's code is the menu's. The line nothing vouches for is charged here as well.
    expect(submenu.js).toBe(own + gzipSync(stray).length);
    expect(submenu.uses).toEqual(["menu"]);
    expect(ownJavaScript("menu", root).js).toBeGreaterThan(1000 + 900);
  });

  it("follows what a shared chunk imports for its effects, and makes nobody a user by it", () => {
    // Nothing in the code says which side of the chunk the import is for.
    const helper = built("lib/selection.js", [[filler("selection", 1500), "src/lib/selection.ts"]]);
    built("chunks/list-1.js", [
      ['import "../lib/selection.js";'],
      [filler("list", 800).replace("export ", ""), "src/components/list/list.tsx"],
      [filler("cell", 800).replace("export ", ""), "src/components/cell/cell.tsx"],
      ["export { list, cell };"],
    ]);
    entry("list", "list-1.js");
    entry("cell", "list-1.js");
    const sizes = measureSizes(root);
    expect(sizes.helpers[0]).toMatchObject({ users: [], shared: false });
    for (const component of sizes.components) {
      expect(component.js).toBeGreaterThan(800 + helper);
    }
  });

  it("does not count once a listed helper the bundler put into a component's chunk", () => {
    const helperCode = filler("selection", 1500).replace("export ", "");
    built("chunks/list-1.js", [
      [helperCode, "src/lib/selection.ts"],
      [filler("list", 800).replace("export ", ""), "src/components/list/list.tsx"],
      ["export { list, selection };"],
    ]);
    entry("list", "list-1.js");
    for (const name of ["table", "grid"]) {
      built(`chunks/${name}-1.js`, [
        ['import { selection } from "./list-1.js";'],
        [`${filler(name, 500)} export const s = selection;`, `src/components/${name}/${name}.tsx`],
      ]);
      entry(name, `${name}-1.js`);
    }
    writeFileSync(path.join(root, "dist/tokens.css"), ":root{}");
    const sizes = measureSizes(root);
    expect(sizes.helpers[0]).toMatchObject({ bundled: true, shared: false });
    // Charged to each of the three.
    for (const component of sizes.components) expect(component.js).toBeGreaterThan(500 + 1500);
    expect(line(report().stdout, "src/lib/selection.ts")).toContain(
      "bundled with a component's code: not counted once",
    );
  });

  it("fails when there is no built component to measure", () => {
    const result = report();
    expect(result.stderr).toMatch(/size report failed: no built component in .*dist.components/);
    expect(result.status).toBe(1);
  });

  it("keeps the list of helpers counted once to named files in src/lib", () => {
    expect(SHARED_HELPERS.length).toBeGreaterThan(0);
    for (const helper of SHARED_HELPERS) {
      expect(helper.file).toMatch(/^src\/lib\/[a-z0-9-]+\.ts$/);
      expect(helper.why.length).toBeGreaterThan(10);
    }
    expect(new Set(SHARED_HELPERS.map((helper) => helper.file)).size).toBe(SHARED_HELPERS.length);
  });

  it("still fails a component whose own code is over the budget", () => {
    tree({ menu: 1000, submenu: 3400 });
    const result = report();
    expect(line(result.stdout, "submenu")).toContain("OVER BUDGET");
    expect(line(result.stdout, "menu")).not.toContain("OVER BUDGET");
    expect(result.stderr).toContain("is over the budget of 3072 B");
    expect(result.status).toBe(1);
  });

  it("fails the component that is used, not the one that uses it", () => {
    tree({ menu: 3400, submenu: 500 });
    const result = report();
    expect(line(result.stdout, "menu")).toContain("OVER BUDGET");
    expect(line(result.stdout, "submenu")).not.toContain("OVER BUDGET");
    expect(result.status).toBe(1);
  });

  it("reports an overrun without failing for a component that is not enforced", () => {
    tree({ menu: 1000, submenu: 3400 });
    const result = report({ ENFORCE_COMPONENTS: "menu" });
    expect(line(result.stdout, "submenu")).toContain("over budget, not enforced");
    expect(result.status).toBe(0);
  });

  it("fails when a chunk has code and no source map", () => {
    // Without the map nothing says whose the code is; counting it all, or none, would be a guess.
    tree({ menu: 1000, submenu: 1000 });
    rmSync(path.join(root, "dist/chunks/menu-1.js.map"));
    const result = report();
    expect(result.stderr).toMatch(
      /size report failed: .*menu-1\.js holds code and has no source map/,
    );
    expect(result.status).toBe(1);
  });
});

describe("source map reading", () => {
  it("decodes segments, relative to the one before, across lines", () => {
    // Line 1: columns 0 and 4 from source 0; line 2: nothing; line 3: column 2 from source 1,
    // then a segment with no source at column 6.
    expect(decodeMappings("AAAA,IAAC;;ECAA,I")).toEqual([
      [
        { column: 0, source: 0 },
        { column: 4, source: 0 },
      ],
      [],
      [
        { column: 2, source: 1 },
        { column: 6, source: -1 },
      ],
    ]);
  });

  it("removes the code of the named sources and keeps what has no source", () => {
    const code = "abcdEFGH\nimport x;\n..IJKLmnop";
    const map = { mappings: "AAAA,ICAA;;ECAA,IDAA" };
    // Line 1: abcd from source 0, EFGH from source 1. Line 3: IJKL from source 2 (after two
    // unmapped characters), mnop from source 1.
    expect(withoutSources(code, map, (index: number) => index === 1)).toBe(
      "abcd\nimport x;\n..IJKL",
    );
    expect(withoutSources(code, map, () => false)).toBe(code);
  });
});
