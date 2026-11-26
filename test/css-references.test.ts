// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cssReferences } from "../scripts/lib/css-references.mjs";

/**
 * Lint and the package build both ask this reader what a component stylesheet refers to, so
 * it has to read as CSS does: a rule in any case or through escapes is found, text inside a
 * comment, a string or a data: URI is not.
 */
describe("cssReferences", () => {
  it("finds @import in any case and through escapes, with its line", () => {
    const css = '.a {}\n@IMPORT "./a.css";\n@\\69mport url(b.css);\n@Import\turl("c.css");\n';
    expect(cssReferences(css).imports).toEqual([{ line: 2 }, { line: 3 }, { line: 4 }]);
  });

  it("does not take text for a rule or a reference", () => {
    const css = [
      '/* @import "x.css"; url(./x.svg) */',
      '.a::after { content: "@import url(./y.svg)"; }',
      '.b { mask-image: url("data:image/svg+xml,%3Csvg%3E%3Cstyle%3E@import url(z.css)%3C/style%3E%3C/svg%3E"); }',
      ".c { --mac-c-important: 1; grid-area: import; }",
    ].join("\n");
    const { imports, urls } = cssReferences(css);
    expect(imports).toEqual([]);
    expect(urls.map(({ url }) => url.slice(0, 19))).toEqual(["data:image/svg+xml,"]);
  });

  it("finds every url(), quoted or not, and the strings of image-set()", () => {
    const css = [
      '.a { background: url("./a.svg"), URL( ./b.svg ), \\75rl(./c.svg); }',
      ".b {",
      "  filter: url(#mac-b-filter);",
      '  background-image: image-set(url(./d.svg) 1x, "./e.svg" 2x, linear-gradient("x", red) 3x);',
      "  cursor: url(./f.cur) 2 2, auto;",
      "}",
    ].join("\n");
    expect(cssReferences(css).urls).toEqual([
      { url: "./a.svg", line: 1 },
      { url: "./b.svg", line: 1 },
      { url: "./c.svg", line: 1 },
      { url: "#mac-b-filter", line: 3 },
      { url: "./d.svg", line: 4 },
      { url: "./e.svg", line: 4 },
      { url: "./f.cur", line: 5 },
    ]);
  });

  it("ends at the end of a stylesheet that is cut off", () => {
    expect(cssReferences("/* open").urls).toEqual([]);
    expect(cssReferences('.a { background: url("./a.svg').urls).toEqual([
      { url: "./a.svg", line: 1 },
    ]);
    expect(cssReferences(".a { b: c\\").imports).toEqual([]);
    expect(cssReferences("@").imports).toEqual([]);
  });
});
