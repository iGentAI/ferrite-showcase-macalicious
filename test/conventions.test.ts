// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { duplicateExports } from "../scripts/lib/component-exports.mjs";
import { checkTokenCss } from "../scripts/lib/token-css.mjs";

/**
 * The convention check (`npm run lint`), run as a command on a small fixture package, for the
 * rules that keep a folder from passing while it cannot be relied on.
 */
const scripts = path.resolve(import.meta.dirname, "../scripts");

let root: string;

function write(file: string, content: string) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

const lint = () =>
  spawnSync(process.execPath, [path.join(scripts, "check-conventions.mjs"), "--root", root], {
    encoding: "utf8",
    env: { ...process.env, ENFORCE_COMPONENTS: "" },
  });

const comparison = (appearance: string) => ({
  name: `row-${appearance}`,
  example: "visual-row",
  appearance,
  reference: { file: `${appearance}.png`, crop: { x: 0, y: 0, width: 200, height: 40 } },
  budget: { "1x": 0.05, "2x": 0.01 },
  deltaBudget: { "1x": 4, "2x": 1 },
});

function component(name: string, exported = "Sample") {
  const dir = `src/components/${name}`;
  write(`${dir}/index.ts`, `export { ${exported} } from "./${name}";\n`);
  write(`${dir}/${name}.tsx`, `import "./${name}.css";\nexport const ${exported} = () => null;\n`);
  write(`${dir}/${name}.css`, `.mac-${name} {\n  color: var(--mac-color-label);\n}\n`);
  write(`${dir}/${name}.test.tsx`, "export {};\n");
  write(
    `${dir}/${name}.mdx`,
    `---\ntitle: Sample\ndescription: A sample.\n---\n\n<Example name="basic" />\n\n<PropsTable name="SampleProps" />\n`,
  );
  write(`${dir}/examples/basic.tsx`, "export default function Basic() {\n  return null;\n}\n");
  write(`${dir}/examples/visual-row.tsx`, "export default function Row() {\n  return null;\n}\n");
  write(
    `${dir}/${name}.visual.json`,
    JSON.stringify({ comparisons: [comparison("light"), comparison("dark")] }),
  );
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "macalicious-lint-"));
  component("sample");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("check-conventions", () => {
  it("passes a complete component", () => {
    const run = lint();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it.each([
    ["without a budget", { budget: undefined }, '"budget" is required'],
    ["with a misspelt budget key", { budget: undefined, budgets: {} }, 'unknown key "budgets"'],
    ["with a budget nothing can exceed", { budget: { "1x": 1, "2x": 1 } }, "above the highest"],
    [
      "with the whole crop masked",
      { masks: [{ x: 0, y: 0, width: 100, height: 20 }] },
      "masks cover 100%",
    ],
  ])("fails a comparison %s", (_, change, message) => {
    write(
      "src/components/sample/sample.visual.json",
      JSON.stringify({ comparisons: [{ ...comparison("light"), ...change }, comparison("dark")] }),
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(message);
  });

  it("fails an empty comparison list, and lists a pending one without failing", () => {
    write("src/components/sample/sample.visual.json", JSON.stringify({ comparisons: [] }));
    expect(lint().status).toBe(1);
    write(
      "src/components/sample/sample.visual.json",
      JSON.stringify({ pending: "No crop chosen yet.", comparisons: [] }),
    );
    const run = lint();
    expect(run.status).toBe(0);
    expect(run.stderr).toContain("Visual comparisons pending (1)");
    expect(run.stderr).toContain("No crop chosen yet.");
  });

  it("fails a comparison whose example does not exist", () => {
    rmSync(path.join(root, "src/components/sample/examples/visual-row.tsx"));
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('example "visual-row" not found');
  });

  it("fails a component with a reserved name", () => {
    component("tokens", "Tokens");
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"tokens" is reserved');
  });

  it("fails two components that export the same name", () => {
    component("other");
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"Sample" is exported by other and sample');
  });

  it("fails a token file that holds anything but the component's tokens", () => {
    write(
      "src/components/sample/sample.tokens.css",
      ":root { color: red; --mac-sample-fill: light-dark(#fff, #000); }\nbutton { --mac-sample-x: 1px; }\n",
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"color" is not a custom property');
    expect(run.stderr).toContain('selector "button"');
  });

  it("fails a raw colour in component CSS, marked or not, except the alpha of a mask", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  color: #ff0000;",
        "  /* raw-color-ok: private to this component */",
        "  border-color: rgb(0 0 0 / 0.2);",
        "  /* raw-color-ok: mask alpha, not a colour */",
        "  mask: linear-gradient(",
        "    #000 0 2px,",
        "    transparent 2px 3px",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sample.css: line 2: raw colour");
    expect(run.stderr).toContain("sample.css: line 4: raw colour");
    expect(run.stderr).toContain("sample.tokens.css");
    expect(run.stderr).not.toContain("line 6");
    expect(run.stderr).not.toContain("line 7");
  });

  it("fails a named colour in component CSS", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  background: red;",
        "  border-color: White;",
        "  --_edge: rebeccapurple;",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sample.css: line 2: raw colour");
    expect(run.stderr).toContain("sample.css: line 3: raw colour");
    expect(run.stderr).toContain("sample.css: line 4: raw colour");
  });

  it("reads colours and light-dark() as CSS does: any case, escapes decoded", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  color: r\\65 d;",
        "  background: r\\67 b(255 0 0);",
        "  fill: RGB(1 2 3);",
        "  outline-color: \\72",
        "ed;",
        "  stroke: LIGHT-DARK(var(--mac-color-label), var(--mac-color-label-secondary));",
        "  border-color: l\\69ght-dark(var(--mac-color-label), var(--mac-color-label-secondary));",
        "  caret-color: l\\69",
        "ght-dark(var(--mac-color-label), var(--mac-color-label-secondary));",
        "  column-rule-color: r\\65\r\nd;",
        "  text-decoration-color: r\\65\fd;",
        "}",
        ".mac-sample:where([",
        '  data-appearance="dark"]) {',
        "  margin: 0;",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sample.css: line 2: raw colour");
    expect(run.stderr).toContain("sample.css: line 3: raw colour");
    expect(run.stderr).toContain("sample.css: line 4: raw colour");
    // An escape may end with a line break; the colour is reported where it starts.
    expect(run.stderr).toContain("sample.css: line 5: raw colour");
    expect(run.stderr).toContain("sample.css: line 7: components must not test the appearance");
    expect(run.stderr).toContain("sample.css: line 8: components must not test the appearance");
    // A name split by the line break that ends an escape, and a selector split after "[".
    expect(run.stderr).toContain("sample.css: line 9: components must not test the appearance");
    expect(run.stderr).toContain("sample.css: line 15: components must not test the appearance");
    expect(run.stderr).toContain("sample.tokens.css, or ask the owner of src/styles/tokens");
    // An escape ended by CRLF, counted as one line break, and by a form feed.
    expect(run.stderr).toContain("sample.css: line 11: raw colour");
    expect(run.stderr).toContain("sample.css: line 13: raw colour");
  });

  it("does not take a name of the author's own for a colour", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  animation-name: coral;",
        "  animation: 1s linear infinite red;",
        "  grid-area: red;",
        "  -webkit-animation-name: tan;",
        "  font-family: Linen, sans-serif;",
        "  will-change: transform;",
        '  content: "r\\65 d" counter(red) c\\6f unter(coral);',
        "  view-transition-class: coral;",
        "  transition-property: red;",
        "  transition: red 1s;",
        "  list-style: coral inside;",
        "  list-style-type: coral;",
        "}",
        "",
      ].join("\n"),
    );
    expect(lint().status).toBe(0);
    // A hex colour or a colour function is still a colour there.
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  grid-area: red;",
        "  animation: #f00 1s;",
        "  list-style: linear-gradient(coral, var(--mac-color-label));",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sample.css: line 3: raw colour");
    // A list-style image holds a colour; only a bare name there is a counter style.
    expect(run.stderr).toContain("sample.css: line 4: raw colour");
    expect(run.stderr).not.toContain("line 2");
  });

  it("exempts one declaration or one colour expression, not the line it is on", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  mask: linear-gradient(#000, #000); background: #fff; /* raw-color-ok: mask alpha */",
        "  color: rgb(from var(--mac-color-label) r g b / 0.5); outline-color: #123456;",
        "  border-color: rgb(from var(--mac-color-label) r g b / 0.5) black;",
        "  fill: rgb(from red r g b / 0.5);",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    // The mark trails the background, which is not a mask, and does not reach back to the mask.
    expect(run.stderr).toContain('sample.css: line 2: raw colour; "raw-color-ok" is honoured only');
    expect(run.stderr.match(/sample\.css: line 2:/g)).toHaveLength(1);
    // The colour beside a relative colour, in another declaration and in the same one.
    expect(run.stderr).toContain("sample.css: line 3: raw colour");
    expect(run.stderr).toContain("sample.css: line 4: raw colour");
    // A relative colour that does not start from a token.
    expect(run.stderr).toContain("sample.css: line 5: raw colour");
  });

  it("does not carry a mark from the end of one declaration to the next", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  mask: linear-gradient(",
        "    #000,",
        "    #000",
        "  ); /* raw-color-ok: mask alpha */",
        "  mask-image: linear-gradient(#fff, #000);",
        "  /* raw-color-ok: mask alpha */",
        "",
        "  -webkit-mask: linear-gradient(#111, #222);",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    // The marked mask itself.
    expect(run.stderr).not.toContain("line 3");
    expect(run.stderr).not.toContain("line 4");
    // The mask that starts on the line after the mark.
    expect(run.stderr).toContain("sample.css: line 6: raw colour");
    // A mark with a blank line between it and the declaration.
    expect(run.stderr).toContain("sample.css: line 9: raw colour");
  });

  it("fails a relative colour whose origin is not a token alone", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  color: rgb(from var(--mac-color-label, #f00) r g b);",
        "  background: rgb(from var(--_fill) r g b / 0.5);",
        "  fill: rgb(from var(--mac-color-label) r g b / 0.5);",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    // A raw fallback, and an origin that is not a --mac-* token.
    expect(run.stderr).toContain("sample.css: line 2: raw colour");
    expect(run.stderr).toContain("sample.css: line 3: raw colour");
    expect(run.stderr).not.toContain("line 4");
  });

  it("accepts tokens, relative colours from a token and the keywords that are not colours", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        "  color: var(--mac-color-system-red);",
        "  background: rgb(from var(--mac-color-label) r g b / 0.5);",
        "  border: var(--mac-hairline) solid transparent;",
        "  fill: currentColor;",
        "  white-space: nowrap;",
        "  transition: color 120ms, background-color 120ms;",
        "  rotate: calc(atan2(1, 2) + tan(10deg) * 1rad);",
        '  content: "red" attr(red) attr(data-tan);',
        // Text and names that only look like an appearance test or a colour.
        '  quotes: "light-dark(" "prefers-color-scheme";',
        '  content: "a\\',
        'red" "/* not a comment */ coral";',
        "  mask-image: url(data:image/svg+xml,prefers-color-scheme);",
        "}",
        "",
        ".mac-sample:where([data-appearance-preview]) {",
        "  margin: 0;",
        "}",
        "",
        '.mac-sample-prefers-color-scheme-preview:where([data-setting="prefers-color-scheme"]) {',
        "  margin: 0;",
        "}",
        "",
        ".mac-sample:where([prefers-color-scheme], [data-prefers-color-scheme]) {",
        "  margin: 0;",
        "}",
        "",
        "@media (forced-colors: active) {",
        "  .mac-sample {",
        "    border-color: ButtonText;",
        "    color: GrayText;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("keeps strings and comments apart", () => {
    write(
      "src/components/sample/sample.css",
      [
        ".mac-sample {",
        // The string does not open a comment, so the colour after it is still read.
        '  content: "/*"; color: red; /* note */',
        // The quote in the comment does not open a string.
        "  /* it's */ background: coral;",
        "}",
        // An escaped quote opens no string, so what follows it is still read.
        ".mac-sample:where([title=it\\'s]) {",
        "  color: red;",
        "}",
        ".mac-sample::after {",
        "  content: 'x';",
        "  background: coral;",
        "}",
        "@media (prefers-color-scheme: dark) {",
        "  .mac-sample {",
        "    margin: 0;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sample.css: line 2: raw colour");
    expect(run.stderr).toContain("sample.css: line 3: raw colour");
    expect(run.stderr).toContain("sample.css: line 6: raw colour");
    expect(run.stderr).toContain("sample.css: line 10: raw colour");
    expect(run.stderr).toContain("sample.css: line 12: components must not test the appearance");
  });

  it("accepts the component's own colours in its token file", () => {
    write(
      "src/components/sample/sample.tokens.css",
      ":root {\n  --mac-sample-fill: light-dark(#ffffff, rgb(255 255 255 / 0.25));\n}\n",
    );
    write(
      "src/components/sample/sample.css",
      ".mac-sample {\n  background: var(--mac-sample-fill);\n}\n",
    );
    write(
      "src/components/sample/sample.tsx",
      'import "./sample.tokens.css";\nimport "./sample.css";\nexport const Sample = () => null;\n',
    );
    const run = lint();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("fails a token file that names a token outside the component's prefix", () => {
    write(
      "src/components/sample/sample.tokens.css",
      ":root {\n  --mac-fill: light-dark(#ffffff, #000000);\n  --mac-other-fill: #ffffff;\n}\n",
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"--mac-fill" must start with "--mac-sample-"');
    expect(run.stderr).toContain('"--mac-other-fill" must start with "--mac-sample-"');
  });

  // A token file is read as CSS too: what a value says in a string or a comment is text, and
  // the `!important` flag is a flag in every spelling CSS accepts. Run through the command.
  describe("a token file's values", () => {
    const tokens = (...declarations: string[]) => {
      write(
        "src/components/sample/sample.tokens.css",
        `:root {\n${declarations.map((line) => `  ${line}\n`).join("")}}\n`,
      );
      write(
        "src/components/sample/sample.tsx",
        'import "./sample.tokens.css";\nimport "./sample.css";\nexport const Sample = () => null;\n',
      );
      return lint();
    };

    it("accepts !important and url() of a bitmap as text in a string or a comment", () => {
      const run = tokens(
        '--mac-sample-note: "!important";',
        "--mac-sample-quote: '! IMPORTANT';",
        "/* --mac-sample-old: 1 !important; url(old.png) */",
        "--mac-sample-gap: 1px; /* not !important */",
        '--mac-sample-hint: "url(a.png)";',
        '--mac-sample-open: "/*";',
        '--mac-sample-close: "*/ !important";',
        // An escaped "!" is part of a name, not the flag.
        "--mac-sample-name: \\!important;",
        "--mac-sample-mask: url(data:image/svg+xml,!important);",
      );
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
    });

    it("accepts !important inside a function or brackets: the declaration is not important", () => {
      const run = tokens(
        "--mac-sample-a: f(!important);",
        "--mac-sample-b: var(--mac-sample-a, ! IMPORTANT);",
        "--mac-sample-c: f(g(1; 2) !important);",
        "--mac-sample-d: [!important];",
        "--mac-sample-e: f(",
        "  !important",
        ");",
      );
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
    });

    it.each([
      ["plain", "--mac-sample-x: red !important;"],
      ["with white space and in upper case", "--mac-sample-x: red ! IMPORTANT;"],
      ["with a tab and mixed case", "--mac-sample-x: red !\tImPoRtAnT;"],
      ["with a comment after the mark", "--mac-sample-x: red !/* why */important;"],
      ["with a hex escape", "--mac-sample-x: red !\\69mportant;"],
      ["with a hex escape and its space", "--mac-sample-x: red !imp\\6f rtant;"],
      ["with an escaped letter", "--mac-sample-x: red !\\important;"],
      ["after a string that holds the same text", '--mac-sample-x: "!important" !important;'],
      ["after a function that holds the same text", "--mac-sample-x: f(!important) !important;"],
      ["after a function that is closed", "--mac-sample-x: f(g(1), [2]) !important;"],
      ["after a stray closing parenthesis", "--mac-sample-x: 1) !important;"],
      ["after a bracket written as an escape", "--mac-sample-x: f\\( !important;"],
    ])("fails a real !important, %s", (_, declaration) => {
      const run = tokens("--mac-sample-a: 1;", declaration);
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(
        "sample.tokens.css: line 3: !important is not allowed in component CSS",
      );
      expect(run.stderr).not.toContain("line 2");
    });

    it("reports !important on the line of the mark, once", () => {
      const run = tokens("--mac-sample-x: red", "  ! important;", "--mac-sample-y: 1 !important;");
      expect(run.status).toBe(1);
      expect(run.stderr.match(/!important is not allowed/g)).toHaveLength(2);
      expect(run.stderr).toContain("sample.tokens.css: line 3: !important");
      expect(run.stderr).toContain("sample.tokens.css: line 4: !important");
    });

    it("reports two !important flags on one line once", () => {
      const run = tokens(
        "--mac-sample-a: 1;",
        "--mac-sample-x: red !important; --mac-sample-y: 1 ! IMPORTANT;",
      );
      expect(run.status).toBe(1);
      expect(run.stderr.match(/!important is not allowed/g)).toHaveLength(1);
      expect(run.stderr).toContain("sample.tokens.css: line 3: !important");
    });

    it("still fails a bitmap, a file reference and a property that is not the component's", () => {
      const run = tokens(
        "--mac-sample-a: url(a.png);",
        '--mac-sample-b: url("data:image/png;base64,AAAA");',
        "--mac-sample-c: url(./icon.svg);",
        "--mac-other-d: 1;",
        // The string opens no comment, so the declaration after it is still read.
        '--mac-sample-e: "/*"; color: red; /* */',
      );
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("sample.tokens.css: line 2: bitmap images are not allowed");
      expect(run.stderr).toContain("sample.tokens.css: line 3: bitmap images are not allowed");
      expect(run.stderr).toContain("sample.tokens.css: line 4: url(./icon.svg) names a file");
      expect(run.stderr).toContain('line 5: "--mac-other-d" must start with "--mac-sample-"');
      expect(run.stderr).toContain('line 6: "color" is not a custom property');
    });
  });

  it("fails a stylesheet below the top level of the folder", () => {
    write("src/components/sample/parts/part.css", ".mac-sample-part {}\n");
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("stylesheets live at the top level");
  });

  it("fails a stylesheet that no source file reached from index.ts imports", () => {
    // The package ships every top-level stylesheet; the source loads only the imported ones.
    write("src/components/sample/extra.css", ".mac-sample-extra {\n  display: none;\n}\n");
    // Imported, but only by a file that index.ts never reaches.
    write("src/components/sample/orphan.css", ".mac-sample-orphan {\n  display: none;\n}\n");
    write("src/components/sample/orphan.tsx", 'import "./orphan.css";\nexport const Orphan = 1;\n');
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("extra.css: no source file reached from index.ts imports");
    expect(run.stderr).toContain("orphan.css: no source file reached from index.ts imports");
    expect(run.stderr).not.toContain("sample.css: no source file");
  });

  it("does not count a stylesheet reached only through a type import", () => {
    // `import type` is erased when the file is compiled, so types.ts and part.css never load.
    write("src/components/sample/part.css", ".mac-sample-part {\n  display: none;\n}\n");
    write("src/components/sample/types.ts", 'import "./part.css";\nexport type Part = 1;\n');
    write(
      "src/components/sample/sample.tsx",
      'import "./sample.css";\nimport type { Part } from "./types";\nexport const Sample = (): Part => 1;\n',
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("part.css: no source file reached from index.ts imports");
  });

  it("reports a source file whose imports cannot be read, not a pass", () => {
    write(
      "src/components/sample/sample.tsx",
      'import "./sample.css";\nexport const Sample = (name: string) => import(name);\n',
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("src/components/sample/sample.tsx: cannot read its imports");
  });

  it("fails stylesheet imports the package cannot ship, in subfolders too", () => {
    write(
      "src/components/sample/sample.tsx",
      [
        'import "./sample.css";',
        'import styles from "./sample.css";',
        // Single quotes, a re-export and an import() are the same imports in other clothes.
        "import { more } from './sample.css';",
        'export * from "./sample.css";',
        'import "some-package/styles.css";',
        "import '../other/other.css';",
        'import inline from "./sample.css?inline";',
        'import { part } from "./parts/part";',
        '// import "macalicious/sample.css"; in a comment is documentation',
        'export const lazy = () => import("lazy-package/lazy.css");',
        'export const later = () => import("./sample.css");',
        "export const Sample = () => [styles, more, inline, part];",
        "",
      ].join("\n"),
    );
    write(
      "src/components/sample/parts/part.ts",
      'export const part = new URL("./icon.svg", import.meta.url);\n',
    );
    const run = lint();
    expect(run.status).toBe(1);
    const about = (text: string) => run.stderr.split("\n").filter((line) => line.includes(text));
    expect(about("sample.tsx: imports names from the stylesheet ./sample.css")).toHaveLength(3);
    expect(about("sample.tsx: re-exports from the stylesheet ./sample.css")).toHaveLength(1);
    expect(about("sample.tsx: loads the stylesheet ./sample.css as a module")).toHaveLength(1);
    expect(run.stderr).toContain('sample.tsx: imports the stylesheet "some-package/styles.css"');
    expect(run.stderr).toContain('sample.tsx: imports the stylesheet "lazy-package/lazy.css"');
    expect(run.stderr).toContain(
      'sample.tsx: imports the stylesheet "../other/other.css" from outside the component',
    );
    expect(run.stderr).not.toContain("macalicious/sample.css");
    expect(run.stderr).toContain("src/components/sample/parts/part.ts: import.meta");
  });

  it("does not count a stylesheet that only a module loaded with import() imports", () => {
    // The lazy module loads later or never; the package would ship its stylesheet at once.
    write("src/components/sample/lazy.css", ".mac-sample-lazy {\n  display: none;\n}\n");
    write("src/components/sample/lazy.tsx", 'import "./lazy.css";\nexport const Lazy = 1;\n');
    write(
      "src/components/sample/sample.tsx",
      'import "./sample.css";\nexport const Sample = () => import("./lazy");\n',
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("lazy.css: no source file reached from index.ts imports");
  });

  it("fails @import and url() of a file in component CSS", () => {
    write(
      "src/components/sample/sample.css",
      [
        '@IMPORT "./other.css";',
        ".mac-sample {",
        '  background-image: url("./icon.svg");',
        "  mask-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E\");",
        "  filter: url(#mac-sample-filter);",
        '  content: "@import url(./text.svg)";',
        "  cursor: URL( ./pointer.png ), auto;",
        "}",
        "",
      ].join("\n"),
    );
    write(
      "src/components/sample/sample.tokens.css",
      ":root {\n  --mac-sample-icon: url(./token.svg);\n}\n",
    );
    write(
      "src/components/sample/sample.tsx",
      'import "./sample.tokens.css";\nimport "./sample.css";\nexport const Sample = () => null;\n',
    );
    const run = lint();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("sample.css: line 1: @import is not supported");
    expect(run.stderr).toContain("sample.css: line 3: url(./icon.svg) names a file");
    expect(run.stderr).not.toContain("line 4");
    expect(run.stderr).not.toContain("line 5");
    expect(run.stderr).not.toContain("line 6");
    expect(run.stderr).toContain("sample.css: line 7: bitmap images are not allowed");
    expect(run.stderr).toContain("sample.tokens.css: line 2: url(./token.svg) names a file");
  });

  it("passes a stylesheet imported from a source file in a subfolder", () => {
    write("src/components/sample/part.css", ".mac-sample-part {\n  display: none;\n}\n");
    write(
      "src/components/sample/parts/part.tsx",
      'import "../part.css";\nexport const Part = 1;\n',
    );
    write(
      "src/components/sample/sample.tsx",
      'import "./sample.css";\nimport { Part } from "./parts/part";\nexport const Sample = () => Part;\n',
    );
    const run = lint();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });
});

/**
 * Every check that reads component CSS, against every place where its construct is only text.
 * Text in a string, a comment, an attribute selector's value or the contents of url() is not
 * syntax, so a stylesheet that holds the construct there and nowhere else passes; the real
 * construct fails, in its plain spelling and in a spelling with a CSS escape. An escaped
 * character is never syntax either, so the same text written as one escaped name passes too,
 * as an unquoted attribute value and inside url() after an escaped closing parenthesis. One row per
 * check: `text` is what the construct looks like (no quotes), `inUrl` the same without
 * spaces or parentheses, which unquoted url() contents cannot hold.
 */
describe("check-conventions reads CSS, not text", () => {
  const rule = (body: string) => `.mac-sample {\n  ${body}\n}\n`;
  const rows: {
    check: string;
    message: string;
    text: string;
    inUrl: string | null;
    real: Record<string, string>;
  }[] = [
    {
      check: "a raw colour",
      message: "raw colour",
      text: "red",
      inUrl: "red",
      real: { plain: rule("color: red;"), escaped: rule("color: r\\65 d;") },
    },
    {
      check: "light-dark()",
      message: "must not test the appearance",
      text: "light-dark(a, b)",
      inUrl: null,
      real: {
        plain: rule("color: light-dark(var(--mac-color-label), var(--mac-color-system-red));"),
        escaped: rule("color: l\\69ght-dark(var(--mac-color-label), var(--mac-color-system-red));"),
      },
    },
    {
      check: "prefers-color-scheme",
      message: "must not test the appearance",
      text: "(prefers-color-scheme: dark)",
      inUrl: null,
      real: {
        plain: `@media (prefers-color-scheme: dark) {\n${rule("margin: 0;")}}\n`,
        escaped: `@media (prefers-\\63olor-scheme: dark) {\n${rule("margin: 0;")}}\n`,
      },
    },
    {
      check: "[data-appearance]",
      message: "must not test the appearance",
      text: "[data-appearance]",
      inUrl: "[data-appearance]",
      real: {
        plain: '.mac-sample:where([data-appearance="dark"]) {\n  margin: 0;\n}\n',
        escaped: '.mac-sample:where([data-\\61ppearance="dark"]) {\n  margin: 0;\n}\n',
      },
    },
    {
      check: "a class of another component",
      message: 'class ".other" must be ".mac-sample"',
      text: ".other",
      inUrl: ".other",
      real: {
        plain: ".other {\n  margin: 0;\n}\n",
        escaped: ".oth\\65r {\n  margin: 0;\n}\n",
      },
    },
    {
      check: "a public custom property",
      message: '"--color" must be private',
      text: "--color: 1",
      inUrl: "--color:1",
      real: { plain: rule("--color: 1;"), escaped: rule("--c\\6flor: 1;") },
    },
    {
      check: "!important",
      message: "!important is not allowed",
      text: "!important",
      inUrl: "!important",
      real: { plain: rule("margin: 0 !important;"), escaped: rule("margin: 0 !imp\\6frtant;") },
    },
    {
      check: "transition: all",
      message: '"transition: all" animates layout properties',
      text: "transition: all 1s",
      inUrl: "transition:all",
      real: { plain: rule("transition: all 1s;"), escaped: rule("transiti\\6fn: all 1s;") },
    },
    {
      check: "@import",
      message: "@import is not supported",
      text: "@import x",
      inUrl: "@import",
      real: {
        plain: `@import "./other.css";\n${rule("margin: 0;")}`,
        escaped: `@\\69mport "./other.css";\n${rule("margin: 0;")}`,
      },
    },
    {
      check: "url() of a file",
      message: "url(icon.svg) names a file",
      text: "url(icon.svg)",
      inUrl: null,
      real: {
        plain: rule("mask-image: url(icon.svg);"),
        quoted: rule('mask-image: url("icon.svg");'),
      },
    },
    {
      check: "a bitmap",
      message: "bitmap images are not allowed",
      text: "url(data:image/png;base64,AAAA)",
      inUrl: null,
      real: {
        plain: rule("background-image: url(data:image/png;base64,AAAA);"),
        quoted: rule('background-image: url("data:image/png;base64,AAAA");'),
      },
    },
  ];

  // The same text as one CSS name, every character that is not a name character escaped:
  // what an attribute selector's value looks like without quotes, and what the contents of
  // url() look like after an escaped closing parenthesis.
  const asName = (text: string) => text.replace(/[^\w-]/g, (char) => `\\${char}`);

  describe.each(rows)("$check", ({ message, text, inUrl, real }) => {
    it("is not reported in a string, a comment, an attribute value or url() contents", () => {
      write(
        "src/components/sample/sample.css",
        [
          `.mac-sample::before {\n  content: "${text}";\n}`,
          `.mac-sample::after {\n  content: '${text}';\n}`,
          `.mac-sample {\n  /* ${text} */\n  margin: 0;\n}`,
          `.mac-sample:where([data-note="${text}"]) {\n  margin: 0;\n}`,
          `.mac-sample:where([data-note=${asName(text)}]) {\n  margin: 0;\n}`,
          `.mac-sample {\n  mask-image: url(data:text/plain,\\)${asName(text)});\n}`,
          ...(inUrl === null
            ? []
            : [`.mac-sample {\n  mask-image: url(data:text/plain,${inUrl});\n}`]),
          "",
        ].join("\n"),
      );
      const run = lint();
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
    });

    it.each(Object.entries(real))("is reported when real (%s)", (_, css) => {
      write("src/components/sample/sample.css", css);
      const run = lint();
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(message);
    });
  });
});

describe("new-component", () => {
  it.each(["tokens", "index", "styles", "lib", "fallback-font", "package"])(
    "refuses the reserved name %s",
    (name) => {
      const run = spawnSync(process.execPath, [path.join(scripts, "new-component.mjs"), name], {
        encoding: "utf8",
      });
      expect(run.status).toBe(2);
      expect(run.stderr).toContain("reserved");
      expect(existsSync(path.resolve(scripts, "../src/components", name))).toBe(false);
    },
  );
});

describe("checkTokenCss", () => {
  const messages = (css: string) => checkTokenCss(css, "box").map((problem) => problem.message);

  it("accepts token declarations on :root, [data-appearance] and [data-accent]", () => {
    expect(
      messages(`
        /* .mac-box { color: red } in a comment is not a rule */
        :root {
          --mac-box-border: light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.15));
          --mac-box-image: url("a;b{c}.svg");
        }
        :root, [data-accent] { --mac-box-accent: var(--mac-accent); }
        [data-appearance="dark"] { --mac-box-x: 1; }
        @media (prefers-contrast: more) { :root { --mac-box-border: black; } }
      `),
    ).toEqual([]);
  });

  it.each([
    [
      "a property sharing a line with a token",
      ":root { color: red; --mac-box-x: 1; }",
      /"color" is not a custom property/,
    ],
    ["a rule for an element", "button { --mac-box-x: 1; }", /selector "button"/],
    ["a rule for a class", ".mac-box { --mac-box-x: 1; }", /selector "\.mac-box"/],
    ["a descendant of :root", ":root .mac-box { --mac-box-x: 1; }", /selector ":root \.mac-box"/],
    ["another component's token", ":root { --mac-label-x: 1; }", /must start with "--mac-box-"/],
    ["a private property", ":root { --_x: 1; }", /must start with "--mac-box-"/],
    ["!important", ":root { --mac-box-x: 1 !important; }", /!important/],
    ["! IMPORTANT", ":root{--mac-box-note:red ! IMPORTANT}", /!important/],
    ["a bitmap", ":root { --mac-box-x: url(a.png); }", /bitmap images/],
    [
      "an import",
      '@import "./other.css";\n:root { --mac-box-x: 1; }',
      /not allowed in a token file/,
    ],
    [
      "an element rule inside a media query",
      "@media print { p { --mac-box-x: 1; } }",
      /selector "p"/,
    ],
  ])("rejects %s", (_, css, message) => {
    expect(messages(css).join("\n")).toMatch(message);
  });

  it("does not take text in a string or a comment for !important or a bitmap", () => {
    expect(messages(':root{--mac-box-note:"!important"}')).toEqual([]);
    expect(messages(':root { --mac-box-x: "url(a.png)"; /* 1 !important */ }')).toEqual([]);
  });

  it("takes !important for the flag only at the top level of a declaration", () => {
    expect(messages(":root { --mac-box-x: f(!important); }")).toEqual([]);
    expect(messages(":root { --mac-box-x: f(1); --mac-box-y: g(!important) }")).toEqual([]);
    // A curly block inside the function does not end the function.
    expect(messages(":root { --mac-box-x: f({!important}); }")).toEqual([]);
    expect(messages(":root { --mac-box-x: f({a} !important); }")).toEqual([]);
    // A function left open in one rule does not reach into the next.
    expect(messages(":root { --mac-box-a: f(1; }\n:root { --mac-box-x: 1 !important; }")).toContain(
      "!important is not allowed in component CSS",
    );
    expect(messages("@media (min-width: 1px) { :root { --mac-box-x: f(!important); } }")).toEqual(
      [],
    );
    // A curly block in a custom property's value is part of the value too. A block that is not
    // inside (...) or [...] still has the file refused, for the block itself, but not for a flag
    // it does not have.
    const flag = "!important is not allowed in component CSS";
    expect(messages(":root { --mac-box-x: [{!important}]; }")).toEqual([]);
    for (const value of ["{!important}", "{a; !important}", "{{!important}}"]) {
      const found = messages(`:root { --mac-box-x: ${value}; }`);
      expect(found, value).not.toContain(flag);
      expect(found, value).toContain("nested rules are not allowed in a token file");
    }
    // After the block, and after the declaration that held one, the flag is the flag again.
    expect(messages(":root { --mac-box-x: {a} !important; }")).toContain(flag);
    // A name may hold any non-ASCII character, written out or as an escape.
    expect(messages(":root { --mac-box-é: {!important}; }")).not.toContain(flag);
    expect(messages(":root { --mac-box-\\e9 : {!important}; }")).not.toContain(flag);
    expect(messages(":root { --mac-box-日本: [{!important}]; }")).toEqual([]);
    expect(messages(":root { --mac-box-é: {a} !important; }")).toContain(flag);
    expect(messages(":root { --mac-box-x: {a}; --mac-box-y: 1 !important; }")).toContain(flag);
    expect(messages(":root { --mac-box-x: {a} }\n:root { --mac-box-y: 1 !important; }")).toContain(
      flag,
    );
    // Only a custom property's value holds a block: any other `{` opens a rule.
    expect(messages("@media (min-width: 1px) { :root { --mac-box-x: 1 !important } }")).toContain(
      flag,
    );
    expect(messages(":root { color: { --mac-box-x: 1 !important } }")).toContain(flag);
    expect(messages(":root { --mac-box-x: f(!important) !important; }")).toEqual([
      "!important is not allowed in component CSS",
    ]);
    expect(messages("@media (min-width: 1px) { :root { --mac-box-x: 1 !important; } }")).toEqual([
      "!important is not allowed in component CSS",
    ]);
  });

  it("reports !important once for a line that holds two", () => {
    expect(
      checkTokenCss(":root { --mac-box-x: 1 !important; --mac-box-y: 2 !important; }", "box"),
    ).toEqual([{ line: 1, message: "!important is not allowed in component CSS" }]);
  });

  it("reports the line of the problem", () => {
    expect(checkTokenCss(":root {\n  --mac-box-x: 1;\n  color: red;\n}\n", "box")).toEqual([
      expect.objectContaining({ line: 3 }),
    ]);
  });
});

describe("duplicateExports", () => {
  it("names each export that two components share, types included", () => {
    write("src/components/other/index.ts", 'export type { Sample } from "./other";\n');
    expect(duplicateExports(root)).toEqual([expect.stringContaining('"Sample" is exported by')]);
    write("src/components/other/index.ts", 'export { Other } from "./other";\n');
    expect(duplicateExports(root)).toEqual([]);
  });
});
