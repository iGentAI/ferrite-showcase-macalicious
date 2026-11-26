#!/usr/bin/env node
// Structural rules that keep a dozen authors' components consistent. Run by `npm run lint`.
// Every rule here is stated in CONTRIBUTING.md; keep the two in step.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { validateVisualSpec } from "../visual/lib/spec.mjs";
import { duplicateExports } from "./lib/component-exports.mjs";
import { cssReferences } from "./lib/css-references.mjs";
import { componentNameProblem, KEBAB } from "./lib/names.mjs";
import { rawColours, readCss } from "./lib/raw-colors.mjs";
import { moduleRequests } from "./lib/registry.mjs";
import { checkTokenCss as tokenCssProblems } from "./lib/token-css.mjs";

// --root checks another tree (the tests use it on small fixture packages).
const { values: options } = parseArgs({
  options: {
    root: {
      type: "string",
      default: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    },
  },
});
const root = path.resolve(options.root);
const errors = [];
const pending = [];
// Paths are printed with forward slashes on every platform, so a message reads the same on
// Windows as in the documentation and the tests.
const shown = (file) => path.relative(root, file).split(path.sep).join("/");
const fail = (file, message) => errors.push(`${shown(file)}: ${message}`);

// ENFORCE_COMPONENTS=label,text-field: only those component folders can fail the check; the
// errors of every other component folder are printed in a section of their own. For a tree
// that holds other people's unfinished components (CONTRIBUTING.md, Commands). Unset, every
// folder is enforced. The docs build and the agent-docs tests read the same variable.
const enforced = (process.env.ENFORCE_COMPONENTS ?? "").split(/[\s,]+/).filter(Boolean);
const isEnforced = (error) => {
  const component = /^src[\\/]components[\\/]([^\\/:]+)/.exec(error)?.[1];
  return enforced.length === 0 || !component || enforced.includes(component);
};

const stripComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

async function folders(base) {
  const dir = path.join(root, base);
  if (!existsSync(dir)) return [];
  return (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * `<name>.tokens.css` is the component's own token file: the appearance-dependent values that
 * only this component uses. It is the one place in a component folder where `light-dark()`,
 * appearance selectors and raw colours are allowed, and it may hold nothing but declarations
 * of `--mac-<name>-*` custom properties (CONTRIBUTING.md, "Component token files"). The file
 * is parsed as CSS in scripts/lib/token-css.mjs.
 */
async function checkTokenCss(file, name) {
  const css = await readFile(file, "utf8");
  for (const { line, message } of tokenCssProblems(css, name)) {
    fail(file, `line ${line}: ${message}`);
  }
  checkCssReferences(file, css, { imports: false });
}

const BITMAP =
  /^data:image\/(png|jpe?g|gif|webp|avif|bmp)|\.(png|jpe?g|gif|webp|avif|bmp)([?#]|$)/i;

/**
 * What a component stylesheet may refer to. Read with scripts/lib/css-references.mjs, as CSS
 * reads it: `@IMPORT` counts, an `@import` inside a string or a data: URI does not.
 */
function checkCssReferences(file, css, { imports = true } = {}) {
  const references = cssReferences(css);
  // The package joins a component's stylesheets into one file, where an @import is no longer
  // first and is ignored; the registry copies the files the code imports, not the ones a
  // stylesheet names. (A token file reports @import itself.)
  for (const { line } of imports ? references.imports : []) {
    fail(
      file,
      `line ${line}: @import is not supported in component CSS; import the other stylesheet from the component's code`,
    );
  }
  for (const { url, line } of references.urls) {
    if (BITMAP.test(url)) {
      // No bitmap chrome.
      fail(
        file,
        `line ${line}: bitmap images are not allowed in component CSS; draw with CSS or inline SVG`,
      );
    } else if (url !== "" && !/^(data:|#)/i.test(url)) {
      // A file named by url() is shipped by neither the package nor the registry.
      fail(
        file,
        `line ${line}: url(${url}) names a file, which neither the package nor a copied component ships; draw with CSS or inline an SVG as a data: URI`,
      );
    }
  }
}

async function checkCss(file, name) {
  const raw = await readFile(file, "utf8");
  // Every check below reads the stylesheet through readCss (scripts/lib/raw-colors.mjs), and
  // the references through cssReferences: text in a string, a comment, the contents of url()
  // or an attribute value is not syntax, and escapes are decoded, so the checks see what CSS
  // sees. These problems are reported in line order, once per line and message.
  const css = readCss(raw);
  const problems = new Map();
  const report = (line, message) => problems.set(`${line}\n${message}`, { line, message });

  // Colours come from tokens. Read as declarations, so an exemption covers one declaration or
  // one colour expression and not its line.
  for (const { line, marked } of rawColours(raw)) {
    report(
      line,
      marked
        ? `raw colour; "raw-color-ok" is honoured only for the alpha of a mask or mask-image. Use a token, or put a colour of the component's own in ${name}.tokens.css`
        : `raw colour; use a token, or put a colour of the component's own in ${name}.tokens.css (CONTRIBUTING, "Component token files")`,
    );
  }

  // Appearance comes from tokens.
  for (const { line } of css.matches(
    /\(\s*prefers-color-scheme(?![\w-])|\[\s*data-appearance(?![\w-])|(?<![\w-])light-dark\(/gi,
  )) {
    report(
      line,
      `components must not test the appearance; use a token, put a value of the component's own in ${name}.tokens.css, or ask the owner of src/styles/tokens for a shared one (CONTRIBUTING, "Component token files")`,
    );
  }

  // Class names are namespaced by component. (The lookbehind skips decimals.)
  for (const { line, match } of css.matches(/(?<![\w-])\.([a-zA-Z_][\w-]*)/g)) {
    const cls = match[1];
    if (cls !== `mac-${name}` && !cls.startsWith(`mac-${name}-`)) {
      report(line, `class ".${cls}" must be ".mac-${name}" or start with ".mac-${name}-"`);
    }
  }
  // Public custom properties are tokens and live in src/styles/tokens.
  for (const { line, match } of css.matches(/(?<![\w-])(--[a-zA-Z][\w-]*)\s*:/g)) {
    if (!match[1].startsWith("--_") && !match[1].startsWith(`--mac-${name}-`)) {
      report(
        line,
        `"${match[1]}" must be private ("--_name"), a component hook ("--mac-${name}-*") or a token in src/styles/tokens`,
      );
    }
  }
  for (const { line } of css.matches(/!\s*important(?![\w-])/gi)) {
    report(line, "!important is not allowed in component CSS");
  }
  for (const { line } of css.matches(/(?<![\w-])transition\s*:\s*all(?![\w-])/gi)) {
    report(line, '"transition: all" animates layout properties; list the properties');
  }

  for (const { line, message } of [...problems.values()].sort((a, b) => a.line - b.line)) {
    fail(file, `line ${line}: ${message}`);
  }

  checkCssReferences(file, raw);
}

/**
 * A visual comparison file must be able to fail a run: the rules are in visual/lib/spec.mjs,
 * which the runner applies too. Here they are joined by what only the tree can tell: that the
 * example and the screenshot exist.
 */
async function checkVisual(file, dir) {
  let spec;
  try {
    spec = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    return fail(file, `invalid JSON: ${error.message}`);
  }
  for (const error of validateVisualSpec(spec)) fail(file, error);
  if (typeof spec?.pending === "string") {
    pending.push(`${shown(file)}: ${spec.pending.trim()}`);
  }
  const comparisons = Array.isArray(spec?.comparisons) ? spec.comparisons : [];
  // Reference screenshots are fetched, not committed; only check when the folder exists.
  const screenshots = path.join(root, "reference/screenshots");
  for (const comparison of comparisons) {
    if (typeof comparison !== "object" || comparison === null) continue;
    const label = comparison.name ?? "(unnamed)";
    if (
      typeof comparison.example === "string" &&
      !existsSync(path.join(dir, "examples", `${comparison.example}.tsx`))
    ) {
      fail(file, `comparison "${label}": example "${comparison.example}" not found in examples/`);
    }
    const reference = comparison.reference;
    if (
      typeof reference?.file === "string" &&
      existsSync(screenshots) &&
      !existsSync(path.join(screenshots, reference.file))
    ) {
      fail(file, `comparison "${label}": reference/screenshots/${reference.file} does not exist`);
    }
  }
}

/**
 * The stylesheets a component's source loads when it is imported: its modules are followed
 * from index.ts through the static imports that exist at run time, and the .css files they
 * import are collected. A module reached through `import type` alone is never loaded, and a
 * module loaded with `import()` is loaded later or not at all, while the package ships a
 * component's stylesheets at once and in one order: neither counts. `requestsOf` holds the
 * requests of every source file that could be read; undefined is returned when a reached file
 * is not among them (it was reported as unreadable), because the stylesheets behind it cannot
 * be told.
 */
function loadedStylesheets(dir, requestsOf) {
  const loaded = new Set();
  const seen = new Set();
  const queue = [path.join(dir, "index.ts")];
  for (let file = queue.pop(); file; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    const requests = requestsOf.get(file);
    if (!requests) return undefined;
    for (const { specifier, form, erased } of requests) {
      if (form === "dynamic" || erased || !specifier.startsWith(".")) continue;
      const target = path.resolve(path.dirname(file), specifier);
      if (!target.startsWith(dir + path.sep)) continue;
      if (target.endsWith(".css")) {
        loaded.add(target);
        continue;
      }
      const module = [target, `${target}.ts`, `${target}.tsx`]
        .concat(["index.ts", "index.tsx"].map((index) => path.join(target, index)))
        .find((candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate));
      if (module) queue.push(module);
    }
  }
  return loaded;
}

async function checkFolder(base, name, { component }) {
  const dir = path.join(root, base, name);
  const nameProblem = component ? componentNameProblem(name) : undefined;
  if (nameProblem) fail(dir, nameProblem);
  else if (!KEBAB.test(name)) fail(dir, "folder name must be kebab-case");
  const files = await readdir(dir);
  // The build ships <name>.css and <name>.tokens.css from the top of the folder; a stylesheet
  // deeper down would be copied by `macalicious add` but missing from the package.
  if (component) {
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      const inFolder = path.relative(dir, entry.parentPath);
      if (entry.isFile() && entry.name.endsWith(".css") && inFolder !== "") {
        if (inFolder.split(path.sep)[0] === "examples") continue;
        fail(
          path.join(entry.parentPath, entry.name),
          "stylesheets live at the top level of the component folder",
        );
      }
    }
  }

  const required = component
    ? [
        "index.ts",
        `${name}.tsx`,
        `${name}.css`,
        `${name}.test.tsx`,
        `${name}.mdx`,
        `${name}.visual.json`,
      ]
    : [`${name}.mdx`];
  for (const file of required) {
    if (!files.includes(file)) fail(dir, `missing ${file}`);
  }
  const examples = existsSync(path.join(dir, "examples"))
    ? (await readdir(path.join(dir, "examples"))).filter((f) => f.endsWith(".tsx"))
    : [];
  if (examples.length === 0) fail(dir, "needs at least one example in examples/");
  for (const example of examples) {
    const file = path.join(dir, "examples", example);
    if (!KEBAB.test(example.slice(0, -4))) fail(file, "example file names must be kebab-case");
    if (!/export default function \w+/.test(await readFile(file, "utf8"))) {
      fail(file, "an example must `export default function Name()`");
    }
  }

  for (const file of files) {
    const full = path.join(dir, file);
    if (file === `${name}.tokens.css`) await checkTokenCss(full, name);
    else if (file.endsWith(".css")) await checkCss(full, name);
    if (file.endsWith(".visual.json")) await checkVisual(full, dir);
    if (file.endsWith(".mdx")) {
      const text = await readFile(full, "utf8");
      if (!/^---\n[\s\S]*?^title:\s*\S/m.test(text)) fail(full, "needs frontmatter with a title");
      if (!/^description:\s*\S/m.test(text)) fail(full, "needs a description in its frontmatter");
      for (const match of text.matchAll(/<Example\s+name="([^"]+)"/g)) {
        if (!examples.includes(`${match[1]}.tsx`))
          fail(full, `<Example name="${match[1]}"> has no examples/${match[1]}.tsx`);
      }
      if (component) {
        if (!/<Example\s/.test(text)) fail(full, "needs at least one <Example>");
        if (!/<PropsTable\s/.test(text)) fail(full, "needs a <PropsTable>");
      }
    }
  }

  // The component's source: every .ts and .tsx file of the folder, in subfolders too, because
  // the package and the registry ship those as well. Examples and tests are not source.
  const sources = component
    ? (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter((entry) => {
          const [top] = path.relative(dir, entry.parentPath).split(path.sep);
          return (
            entry.isFile() &&
            top !== "examples" &&
            top !== "__tests__" &&
            /\.tsx?$/.test(entry.name) &&
            !/\.test\.tsx?$/.test(entry.name) &&
            !entry.name.endsWith(".d.ts")
          );
        })
        .map((entry) => path.join(entry.parentPath, entry.name))
        .sort()
    : [];
  const requestsOf = new Map();
  for (const full of sources) {
    const code = await readFile(full, "utf8");
    if (/^export default /m.test(code))
      fail(full, "use named exports (default exports are for examples only)");
    if (/from "macalicious(\/|")/.test(code))
      fail(
        full,
        'library source imports siblings relatively ("../other-component", "../../lib/x"), not through "macalicious/*"',
      );
    if (/from "@base-ui\/react"/.test(code))
      fail(
        full,
        'import Base UI by subpath ("@base-ui/react/button") so only the used primitive is bundled',
      );
    if (/\bforwardRef\(/.test(code))
      fail(full, "React 19: take `ref` as a prop instead of forwardRef");
    // Imports are read from the syntax tree, so quotes, layout and comments do not matter.
    let parsed;
    try {
      parsed = moduleRequests(full, code);
    } catch (error) {
      const reason = String(error.message).replace(`${full}: `, "");
      fail(full, `cannot read its imports, so which stylesheets it loads is unknown: ${reason}`);
      continue;
    }
    const computed = parsed.requests.filter((request) => request.specifier === undefined);
    for (const { text } of computed) {
      fail(
        full,
        `cannot read its imports, so which stylesheets it loads is unknown: import(${text}) has a computed path; import a literal path`,
      );
    }
    if (computed.length === 0) requestsOf.set(full, parsed.requests);
    // The package ships stylesheets as files of their own, at once and in one order, and
    // replaces every stylesheet import in the code with nothing. So only a relative import of
    // the component's own stylesheet, made for its side effect, works in the package, the
    // source and a copied component alike.
    for (const { specifier, form, names } of parsed.requests) {
      if (specifier === undefined || !/\.css([?#]|$)/.test(specifier)) continue;
      const target = path.resolve(path.dirname(full), specifier);
      if (!specifier.startsWith(".")) {
        fail(
          full,
          `imports the stylesheet "${specifier}" from a package; the package build would drop it. Put the rules the component needs in ${name}.css`,
        );
      } else if (form === "import" && names) {
        fail(
          full,
          `imports names from the stylesheet ${specifier}; the package has no CSS modules, so import a stylesheet for its side effect only (import "${specifier}")`,
        );
      } else if (form !== "import" || !specifier.endsWith(".css")) {
        fail(
          full,
          `${form === "dynamic" ? "loads" : form === "export" ? "re-exports from" : "imports"} the stylesheet ${specifier} as a module; the package ships a component's stylesheets at once and as plain CSS, so import a stylesheet for its side effect only (import "./${name}.css")`,
        );
      } else if (!target.startsWith(dir + path.sep)) {
        fail(
          full,
          `imports the stylesheet "${specifier}" from outside the component; the package build would drop it. Use another component through its folder, and put the rules this one needs in ${name}.css`,
        );
      } else if (!existsSync(target)) {
        fail(full, `imports missing stylesheet ${specifier}`);
      }
    }
    if (parsed.importMetas > 0) {
      fail(
        full,
        "import.meta ties the module to its file (import.meta.url) or to one bundler (import.meta.env), which neither the package build nor the registry follows; import the file, or inline its content",
      );
    }
  }

  // The package ships every stylesheet at the top of the folder, while the source and a copied
  // component load only the ones the code imports: one that nothing imports would style the
  // package alone.
  if (component && files.includes("index.ts")) {
    const loaded = loadedStylesheets(dir, requestsOf);
    for (const file of files) {
      if (loaded && file.endsWith(".css") && !loaded.has(path.join(dir, file))) {
        fail(
          path.join(dir, file),
          "no source file reached from index.ts imports this stylesheet (a type-only import or an import() does not count), so the package would ship rules that the source and a copied component do not load with the component; import it, or remove it",
        );
      }
    }
  }

  if (component && files.includes("index.ts")) {
    const index = await readFile(path.join(dir, "index.ts"), "utf8");
    if (/export \* from/.test(index))
      fail(
        path.join(dir, "index.ts"),
        "list the exports by name; `export *` hides the public surface",
      );
  }
}

for (const name of await folders("src/components"))
  await checkFolder("src/components", name, { component: true });
for (const name of await folders("demos")) await checkFolder("demos", name, { component: false });

// No shared, hand-maintained index: every list is generated.
for (const file of ["src/index.ts", "src/index.tsx", "src/components/index.ts"]) {
  if (existsSync(path.join(root, file)))
    fail(
      path.join(root, file),
      "do not add a hand-maintained barrel; the root entry is generated by the build",
    );
}

// The generated root entry re-exports every component, so an exported name belongs to one.
for (const message of duplicateExports(root)) errors.push(`src/components: ${message}`);

// Token files: every token is --mac-*.
const tokenDir = path.join(root, "src/styles/tokens");
for (const file of existsSync(tokenDir)
  ? (await readdir(tokenDir)).filter((f) => f.endsWith(".css"))
  : []) {
  const css = stripComments(await readFile(path.join(tokenDir, file), "utf8"));
  for (const match of css.matchAll(/(?<![\w-])(--[a-zA-Z_][\w-]*)\s*:/g)) {
    if (!match[1].startsWith("--mac-"))
      fail(path.join(tokenDir, file), `token "${match[1]}" must start with --mac-`);
  }
}

const failing = errors.filter(isEnforced);
const others = errors.filter((error) => !isEnforced(error));
if (pending.length > 0) {
  console.error(
    `Visual comparisons pending (${pending.length}): these folders are not compared with a screenshot yet.\n`,
  );
  for (const line of pending) console.error(`  ${line}`);
  console.error("");
}
if (others.length > 0) {
  console.error(
    `Conventions, not enforced (${others.length}): ENFORCE_COMPONENTS=${enforced.join(",")} leaves these folders out. They fail the check without it.\n`,
  );
  for (const error of others) console.error(`  ${error}`);
  console.error("");
}
if (failing.length > 0) {
  console.error(`Convention check failed (${failing.length}):\n`);
  for (const error of failing) console.error(`  ${error}`);
  console.error("\nSee CONTRIBUTING.md.");
  process.exit(1);
}
console.log(enforced.length > 0 ? `conventions: ok for ${enforced.join(", ")}` : "conventions: ok");
