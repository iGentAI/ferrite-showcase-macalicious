// @vitest-environment node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { measureSizes } from "../scripts/lib/size.mjs";
import config from "../vite.config.ts";

/**
 * The size gate on what the bundler really writes. test/size.test.ts feeds the gate built
 * trees written by hand; here a small source tree goes through the bundler with the library
 * build's own options (vite.config.ts: format, target, no minification, source maps, file
 * names), one entry per component and per helper as in the library, and the gate reads the
 * result. The helpers are named as on the reviewed list (scripts/lib/shared-helpers.mjs),
 * which the gate applies to any tree.
 *
 *   alpha   uses selection (listed, shared), plain (not listed)
 *   beta    uses selection, type-select (listed, used by beta alone), plain
 *   gamma   is built from alpha
 *   delta   loads a part of its own with import()
 */
const script = path.resolve(import.meta.dirname, "../scripts/report-size.mjs");

/** A constant gzip cannot shrink (about `bytes` bytes compressed), and a use of it. */
const big = (name: string, bytes: number) =>
  `export const ${name} = "${randomBytes(bytes).toString("base64")}";\n`;

const SIZE = { alpha: 1000, beta: 900, gamma: 700, delta: 600, plain: 400, typeSelect: 500 };

function write(root: string, file: string, text: string) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
}

async function library({ selection = 1500, lazy = 800 } = {}) {
  // macOS hands out a temporary directory behind a symlink; the build reports real paths.
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "macalicious-size-build-")));
  write(root, "src/lib/selection.ts", big("selection", selection));
  write(root, "src/lib/type-select.ts", big("typeSelect", SIZE.typeSelect));
  write(root, "src/lib/plain.ts", big("plain", SIZE.plain));
  write(
    root,
    "src/components/alpha/alpha.ts",
    `import { plain } from "../../lib/plain.ts";
import { selection } from "../../lib/selection.ts";
${big("alphaOwn", SIZE.alpha)}export function Alpha() { return alphaOwn + selection + plain; }
`,
  );
  write(
    root,
    "src/components/beta/beta.ts",
    `import { plain } from "../../lib/plain.ts";
import { selection } from "../../lib/selection.ts";
import { typeSelect } from "../../lib/type-select.ts";
${big("betaOwn", SIZE.beta)}export function Beta() { return betaOwn + selection + typeSelect + plain; }
`,
  );
  write(
    root,
    "src/components/gamma/gamma.ts",
    `import { Alpha } from "../alpha/index.ts";
${big("gammaOwn", SIZE.gamma)}export function Gamma() { return gammaOwn + Alpha(); }
`,
  );
  write(root, "src/components/delta/lazy.ts", big("lazy", lazy));
  write(
    root,
    "src/components/delta/delta.ts",
    `${big("deltaOwn", SIZE.delta)}export async function Delta() { return deltaOwn + (await import("./lazy.ts")).lazy; }
`,
  );
  const components = ["alpha", "beta", "gamma", "delta"];
  for (const name of components) {
    const exported = name[0]?.toUpperCase() + name.slice(1);
    write(root, `src/components/${name}/index.ts`, `export { ${exported} } from "./${name}.ts";\n`);
  }
  const libs = ["selection", "type-select", "plain"];
  await build({
    configFile: false,
    root,
    logLevel: "silent",
    publicDir: false,
    build: {
      ...config.build,
      // The bundler names each source in a comment of the file it builds, relative to its
      // working directory. As in the library's own build, that is the root, so the sizes do
      // not depend on where the temporary directory is.
      rollupOptions: { ...config.build?.rollupOptions, cwd: root },
      outDir: path.join(root, "dist"),
      lib: {
        formats: ["es"],
        entry: {
          ...Object.fromEntries(
            components.map((name) => [
              `components/${name}`,
              path.join(root, "src/components", name, "index.ts"),
            ]),
          ),
          ...Object.fromEntries(
            libs.map((name) => [`lib/${name}`, path.join(root, "src/lib", `${name}.ts`)]),
          ),
        },
      },
    },
  });
  write(root, "dist/tokens.css", ":root{}");
  return root;
}

const report = (root: string, args: string[] = []) =>
  spawnSync(process.execPath, [script, "--root", root, ...args], {
    encoding: "utf8",
    env: { ...process.env, ENFORCE_COMPONENTS: "" },
  });
const line = (output: string, name: string) =>
  output.split("\n").find((text) => text.trimStart().startsWith(`${name} `)) ?? "";
/**
 * `value` is what `bytes` of the constants above cost: base64 text compresses to a little over
 * the bytes it encodes (about 1.12 times), and each built file adds its wrapper.
 */
const within = (value: number, bytes: number) => {
  expect(value).toBeGreaterThanOrEqual(bytes * 1.05);
  expect(value).toBeLessThan(bytes * 1.2 + 400);
};

describe("the size gate on a real build", () => {
  const roots: string[] = [];
  let root: string;
  const fixture = async (options?: Parameters<typeof library>[0]) => {
    const made = await library(options);
    roots.push(made);
    return made;
  };

  beforeAll(async () => {
    root = await fixture();
  }, 60_000);

  afterAll(() => {
    for (const made of roots) rmSync(made, { recursive: true, force: true });
  });

  it("writes a source map for every file that holds code", () => {
    const chunks = ["dist/components", "dist/lib", "dist/chunks"].flatMap((dir) => {
      try {
        return readdirSync(path.join(root, dir)).map((file) => `${dir}/${file}`);
      } catch {
        return [];
      }
    });
    expect(chunks.some((file) => file.endsWith(".js.map"))).toBe(true);
    // measureSizes stops on a file with code and no map, so this is the proof.
    expect(() => measureSizes(root)).not.toThrow();
  });

  it("counts a listed helper that two components use once, under its own name", () => {
    const sizes = measureSizes(root);
    const by = Object.fromEntries(sizes.components.map((component) => [component.name, component]));
    const selection = sizes.helpers.find((helper) => helper.file === "src/lib/selection.ts");
    expect(selection).toMatchObject({ built: true, shared: true, users: ["alpha", "beta"] });
    within(selection?.size ?? 0, 1500);
    // alpha: its own code and the helper that is not on the list; not the shared one.
    within(by.alpha?.js ?? 0, SIZE.alpha + SIZE.plain);
    expect(by.alpha?.shared).toEqual(["src/lib/selection.ts"]);
    expect(by.alpha?.sharedSize).toBe(selection?.size);
    // What a page pays for alpha includes the shared helper.
    within(by.alpha?.loaded ?? 0, SIZE.alpha + SIZE.plain + 1500);
  });

  it("charges a listed helper with one user, and a helper that is not listed, in full", () => {
    const sizes = measureSizes(root);
    const beta = sizes.components.find((component) => component.name === "beta");
    expect(sizes.helpers.find((helper) => helper.file === "src/lib/type-select.ts")).toMatchObject({
      built: true,
      shared: false,
      users: ["beta"],
    });
    // beta: own code, type-select (listed, but beta's alone) and plain (not listed).
    within(beta?.js ?? 0, SIZE.beta + SIZE.typeSelect + SIZE.plain);
    expect(beta?.shared).toEqual(["src/lib/selection.ts"]);
    const result = report(root);
    expect(line(result.stdout, "src/lib/type-select.ts")).toMatch(
      /used by beta alone: not shared, charged to it$/,
    );
    expect(result.stdout).not.toContain("src/lib/plain.ts");
  });

  it("does not charge a component for the component it is built from", () => {
    const sizes = measureSizes(root);
    const gamma = sizes.components.find((component) => component.name === "gamma");
    expect(gamma?.uses).toEqual(["alpha"]);
    within(gamma?.js ?? 0, SIZE.gamma);
    // It loads alpha with everything alpha brings, the shared helper included.
    within(gamma?.loaded ?? 0, SIZE.gamma + SIZE.alpha + SIZE.plain + 1500);
    // gamma reaches selection only through alpha's code, so it is not one of its users.
    expect(gamma?.shared).toEqual([]);
  });

  it("counts what a component loads with import(), and fails when that is over the budget", async () => {
    const sizes = measureSizes(root);
    const delta = sizes.components.find((component) => component.name === "delta");
    within(delta?.js ?? 0, SIZE.delta + 800);
    expect(delta?.files.length).toBeGreaterThanOrEqual(2);
    expect(report(root).status).toBe(0);

    const over = await fixture({ lazy: 2800 });
    const result = report(over);
    expect(line(result.stdout, "delta")).toContain("OVER BUDGET");
    expect(line(result.stdout, "alpha")).not.toContain("OVER BUDGET");
    expect(result.status).toBe(1);
  }, 60_000);

  it("holds the shared helper itself to the budget", async () => {
    const over = await fixture({ selection: 3400 });
    const result = report(over);
    expect(line(result.stdout, "src/lib/selection.ts")).toContain("OVER BUDGET");
    for (const name of ["alpha", "beta", "gamma", "delta"]) {
      expect(line(result.stdout, name)).not.toContain("OVER BUDGET");
    }
    expect(result.status).toBe(1);
  }, 60_000);

  it("prints what components load together, each file once", () => {
    const sizes = measureSizes(root);
    const by = Object.fromEntries(sizes.components.map((component) => [component.name, component]));
    const together = sizes.loadedTogether(["alpha", "beta"]);
    // Less than the two added up: selection and plain are loaded once.
    expect(together).toBeLessThan((by.alpha?.loaded ?? 0) + (by.beta?.loaded ?? 0) - 1500);
    within(together, SIZE.alpha + SIZE.beta + SIZE.plain + SIZE.typeSelect + 1500);
    const result = report(root, ["--with", "alpha,beta"]);
    expect(line(result.stdout, "alpha + beta")).toContain(`${together} B`);
    expect(line(result.stdout, "all 4 components")).toContain(
      `${sizes.loadedTogether(["alpha", "beta", "gamma", "delta"])} B`,
    );
    expect(report(root, ["--with", "alpha,nothing"]).status).toBe(2);
  });

  it("charges code with no source in the shared helper's file to each component that uses it", async () => {
    const changed = await fixture();
    const before = measureSizes(changed);
    const js = (sizes: typeof before, name: string) =>
      sizes.components.find((component) => component.name === name)?.js ?? 0;
    // As the bundler writes it, the helper's file costs the components nothing: what has no
    // source there only joins files together.
    const alpha = before.components.find((component) => component.name === "alpha");
    expect(alpha?.parts.some((part) => part.code.includes("const selection"))).toBe(false);
    expect(alpha?.files.some((file) => /selection/.test(path.basename(file)))).toBe(false);
    // The file that holds the helper's code: add a line the source map knows nothing of.
    const chunk = ["dist/lib", "dist/chunks"]
      .flatMap((dir) => {
        try {
          return readdirSync(path.join(changed, dir)).map((file) => path.join(changed, dir, file));
        } catch {
          return [];
        }
      })
      .find((file) => file.endsWith(".js") && readFileSync(file, "utf8").includes("selection = "));
    expect(chunk).toBeDefined();
    appendFileSync(chunk ?? "", `\n${big("unmapped", 700)}`);
    const after = measureSizes(changed);
    expect(after.helpers.find((helper) => helper.file === "src/lib/selection.ts")).toMatchObject({
      shared: true,
    });
    for (const name of ["alpha", "beta"]) {
      expect(js(after, name) - js(before, name)).toBeGreaterThanOrEqual(700);
    }
    // gamma reaches the helper through alpha's code only, delta not at all.
    expect(js(after, "gamma")).toBe(js(before, "gamma"));
    expect(js(after, "delta")).toBe(js(before, "delta"));
  }, 60_000);

  it("charges code with no source, and stops on a chunk with no source map", async () => {
    const changed = await fixture();
    const before = measureSizes(changed);
    const alpha = before.components.find((component) => component.name === "alpha");
    // The file that holds alpha's own code: add a line the source map knows nothing of.
    const chunk = alpha?.parts.find((part) => part.code.includes("alphaOwn"))?.file ?? "";
    expect(chunk).not.toBe("");
    appendFileSync(chunk, `\n${big("unmapped", 700)}`);
    const after = measureSizes(changed).components.find((component) => component.name === "alpha");
    // Added to a file that is already compressed, 700 bytes cost a little over 700.
    const added = (after?.js ?? 0) - (alpha?.js ?? 0);
    expect(added).toBeGreaterThanOrEqual(700);
    expect(added).toBeLessThan(900);

    rmSync(`${chunk}.map`);
    const result = report(changed);
    expect(result.stderr).toMatch(/size report failed: .* holds code and has no source map/);
    expect(result.status).toBe(1);
  }, 60_000);
});
