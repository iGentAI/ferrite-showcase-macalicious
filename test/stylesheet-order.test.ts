// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { componentStylesheets, usedComponents } from "../vite.shared";

/**
 * The order of dist/styles.css and of a docs page's stylesheet list comes from which
 * components a component imports. The registry copies source in subfolders, so an import made
 * there has to count: otherwise the borrowed component's stylesheet can load after the rules
 * that restyle it.
 */
let components: string;

function write(file: string, content: string) {
  const target = path.join(components, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

beforeEach(() => {
  components = mkdtempSync(path.join(tmpdir(), "macalicious-order-"));
  write("label/index.ts", 'export { Label } from "./label";\n');
  write("label/label.tsx", "export const Label = () => null;\n");
  write("separator/index.ts", "export const Separator = () => null;\n");
  write("box/index.ts", 'export { Box } from "./box";\n');
  write("box/box.tsx", 'import { Title } from "./parts/title";\nexport const Box = Title;\n');
});

afterEach(() => {
  rmSync(components, { recursive: true, force: true });
});

describe("usedComponents", () => {
  it("counts a component imported from a file in a subfolder", () => {
    write(
      "box/parts/title.tsx",
      'import { Label } from "../../label";\nexport const Title = Label;\n',
    );
    expect(usedComponents("box", components)).toEqual(["label"]);
  });

  it("leaves out type-only imports, examples and the component's own files", () => {
    write(
      "box/parts/title.tsx",
      'import type { Label } from "../../label";\nimport { Box } from "../box";\nexport const Title = Box as unknown as Label;\n',
    );
    write(
      "box/examples/basic.tsx",
      'import { Separator } from "../../separator";\nexport default Separator;\n',
    );
    expect(usedComponents("box", components)).toEqual([]);
  });

  it("counts a component loaded with a literal dynamic import", () => {
    write(
      "box/parts/title.tsx",
      'export const Title = () => import("../../label");\nexport const other = (name: string) => import(name);\n',
    );
    expect(usedComponents("box", components)).toEqual(["label"]);
  });
});

describe("componentStylesheets", () => {
  const names = (name: string) =>
    componentStylesheets(name, components).map((file) => path.relative(components, file));

  beforeEach(() => {
    write(
      "box/box.tsx",
      'import "./box.tokens.css";\nimport { Title } from "./parts/title";\nimport "./box.css";\nexport const Box = Title;\n',
    );
    write("box/parts/title.tsx", "export const Title = () => null;\n");
    write("box/box.css", ".mac-box {}\n");
    write("box/box.tokens.css", ":root {}\n");
    write("box/examples/demo.css", ".demo {}\n");
  });

  it("lists the stylesheets the source imports, in the order it imports them", () => {
    expect(names("box")).toEqual(
      ["box/box.tokens.css", "box/box.css"].map((file) => path.normalize(file)),
    );
  });

  it("follows the order the source imports them in, across its files", () => {
    // title.tsx is evaluated before box.tsx goes on to box.css, so z.css loads before it,
    // and a.css, imported last, loads last although its name sorts first.
    write("box/a.css", ".mac-box-a {}\n");
    write("box/z.css", ".mac-box-z {}\n");
    write("box/parts/title.tsx", 'import "../z.css";\nexport const Title = () => null;\n');
    write(
      "box/box.tsx",
      'import { Title } from "./parts/title";\nimport "./box.css";\nimport "./box.tokens.css";\nimport "./a.css";\nexport const Box = Title;\n',
    );
    expect(names("box")).toEqual(
      ["box/z.css", "box/box.css", "box/box.tokens.css", "box/a.css"].map((file) =>
        path.normalize(file),
      ),
    );
  });

  it("stops at a stylesheet in a subfolder, which the package would not ship", () => {
    // The source and a copied component would load it; the package would lose its rules.
    write("box/parts/part.css", ".mac-box-part {}\n");
    expect(() => names("box")).toThrow(/src\/components\/box\/parts\/part\.css: stylesheets live/);
  });

  it("follows an import written with its .ts or .tsx extension", () => {
    write("box/index.ts", 'export { Box } from "./box.tsx";\n');
    expect(names("box")).toEqual(
      ["box/box.tokens.css", "box/box.css"].map((file) => path.normalize(file)),
    );
  });

  it("stops at a stylesheet that no module reached from index.ts imports", () => {
    // The package would ship its rules; the source and a copied component never load it.
    write("box/a.css", ".mac-box-a {}\n");
    expect(() => names("box")).toThrow("src/components/box/a.css: no source file reached");
    // Imported, but only by a module that is reached through a type and so never loaded.
    write("box/parts/types.ts", 'import "../a.css";\nexport type A = 1;\n');
    write(
      "box/parts/title.tsx",
      'import type { A } from "./types";\nexport const Title = (): A => 1;\n',
    );
    expect(() => names("box")).toThrow("src/components/box/a.css: no source file reached");
  });

  it.each([
    ["from a package", "some-package/styles.css"],
    ["of another component", "../label/label.css"],
    ["from the shared styles", "../../styles/index.css"],
  ])("stops at an import of a stylesheet %s, which the package would drop", (_, specifier) => {
    write("label/label.css", ".mac-label {}\n");
    write(
      "box/box.tsx",
      `import "./box.tokens.css";\nimport "${specifier}";\nimport "./box.css";\nexport const Box = 1;\n`,
    );
    expect(() => names("box")).toThrow(
      `src/components/box/box.tsx: imports the stylesheet "${specifier}"`,
    );
  });

  it("stops at @import in a component stylesheet, which the joined package file would ignore", () => {
    // Text in a comment, a string or a data: URI is not a rule.
    write(
      "box/box.css",
      '/* @import in a comment */\n.mac-box::after { content: "@import url(x.css)"; }\n',
    );
    expect(names("box")).toHaveLength(2);
    write("box/box.css", '@IMPORT "./box.tokens.css";\n.mac-box {}\n');
    expect(() => names("box")).toThrow("src/components/box/box.css: @import is not supported");
  });

  it("stops at a stylesheet that only a module loaded with import() imports", () => {
    // The lazy module loads later or never; the package would ship lazy.css at once, and in a
    // place of the order that the source never gives it.
    write("box/lazy.css", ".mac-box-lazy {}\n");
    write("box/parts/lazy.tsx", 'import "../lazy.css";\nexport const Lazy = 1;\n');
    write("box/parts/title.tsx", 'export const Title = () => import("./lazy");\n');
    expect(() => names("box")).toThrow("src/components/box/lazy.css: no source file reached");
    // Imported statically as well, it has a place: the static one.
    write(
      "box/parts/title.tsx",
      'import "../lazy.css";\nexport const Title = () => import("./lazy");\n',
    );
    expect(names("box")).toEqual(
      ["box/box.tokens.css", "box/lazy.css", "box/box.css"].map((file) => path.normalize(file)),
    );
  });

  it("stops at import() of a stylesheet from a package", () => {
    write("box/parts/title.tsx", 'export const Title = () => import("some-package/x.css");\n');
    expect(() => names("box")).toThrow(
      'src/components/box/parts/title.tsx: imports the stylesheet "some-package/x.css"',
    );
  });

  it.each([
    ["written with a .js extension", 'export { Box } from "./box.js";\n', "./box.js"],
    ["of a file that does not exist", 'export { Box } from "./missing";\n', "./missing"],
    ["of a stylesheet that does not exist", 'import "./gone.css";\n', "./gone.css"],
  ])("stops at an import of its own file %s", (_, index, specifier) => {
    // Passing over it would drop box.tsx, and the stylesheets it imports with it.
    write("box/index.ts", index);
    expect(() => names("box")).toThrow(
      `src/components/box/index.ts: cannot follow the import "${specifier}"`,
    );
  });
});
