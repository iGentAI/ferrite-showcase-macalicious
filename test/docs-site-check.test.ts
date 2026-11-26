// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import mdx from "@mdx-js/rollup";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkLinks,
  coverage,
  readMarkdown,
  readSite,
  renderCoverage,
} from "../docs/site-check.mjs";
import { rehypeHeadingIds, slug } from "../docs/slug.mjs";

/*
 * The site check (docs/site-check.mjs) is what makes `npm run docs:build` fail on a link that
 * leads nowhere and what writes the coverage report. The real site has no broken link, so the
 * build alone never shows that the check can find one: these tests give it small built sites
 * that have.
 */

const temp = mkdtempSync(path.join(tmpdir(), "docs-site-check-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function write(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return root;
}

const shell = (route: string, article: string, sidebar: string[] = []) =>
  `<!doctype html><html><body><div id="root" data-path="${route}">
  <nav class="docs-sidebar"><ul>${sidebar.map((href) => `<li><a href="${href}">x</a></li>`).join("")}</ul></nav>
  <article class="docs-article">${article}</article></div></body></html>`;

describe("checkLinks", () => {
  const outDir = write(path.join(temp, "links"), {
    "index.html": shell(
      "/",
      `<h2 id="start">Start</h2>
       <a href="/guide">page</a> <a href="/guide/">page, trailing slash</a>
       <a href="/guide/../sibling">page, by a path a browser shortens</a>
       <a href="/guide#there">anchor</a> <a href="#start">own anchor</a>
       <a href="/guide#older">anchor by name</a> <a href="/guide#field">anchor by id</a>
       <a href="/guide#unnamed">a form field's name, which is no anchor</a>
       <a href="/llms.txt">file</a> <a href="https://example.org/nowhere">external</a>
       <a href="/llms-full.txt#guide-1">a repeated heading of the bundle</a>
       <a href="/llms-full.txt#nonexistent">missing anchor of the bundle</a>
       <a href="mailto:someone@example.org">mail</a>
       <a href="/guide#nowhere">missing anchor</a> <a href="/missing">missing page</a>
       <a href="#gone">missing own anchor</a> <img src="/screenshots/absent.png" alt="" />
       <div class="docs-preview"><a href="/inside-an-example">an example's own link</a></div>`,
    ),
    "guide/index.html": shell(
      "/guide",
      `<h2 id="there">There</h2><a name="older"></a><a href="sibling">relative</a>
       <input id="field" name="unnamed" />`,
    ),
    "sibling/index.html": shell("/sibling", ""),
    "llms.txt": "# Site\n\n- [Guide](guide.md)\n- [Gone](gone.md)\n",
    // Every page in one file: a heading that pages share is there once per page.
    "llms-full.txt":
      "# All\n\n## Guide\n\n[first](#guide), [second](#guide-1), [gone](#nope).\n\n## Guide\n",
    "index.md": "# Home\n",
    "notes_(old).md": "# Notes\n",
    "guide.md": [
      "# Guide",
      "",
      "## The `code` section",
      "",
      "[home](index.md), [section](#the-code-section), [missing section](index.md#nope).",
      "Written as code, so not a link: `[x](inline.md)`.",
      "",
      "Every way of writing a link: [parentheses](notes_(old).md), [angle](<index.md>),",
      '[titled](index.md "Home"), [by reference][home], [collapsed][], <https://example.org/auto>,',
      '![picture](picture-gone.png), <a href="html-gone.md">HTML</a>, [broken reference][lost].',
      "",
      "[home]: index.md",
      "[collapsed]: index.md#home",
      "[lost]: reference-gone.md",
      "",
      '<a id="details"></a><a id="new" name="old"></a><input id="field" name="unnamed">',
      "",
      "An anchor written as HTML is a destination too: [details](#details), [by id](#new),",
      "[by name](#old), [a field's id](#field); a field's name is not: [no anchor](#unnamed).",
      "",
      "```md",
      "[in a fence](fenced.md)",
      "```",
      "",
    ].join("\n"),
  });

  it("reports the links that lead nowhere, and only those", () => {
    const problems = checkLinks(readSite(outDir)).map(({ file, link }) => `${file} ${link}`);
    expect(problems.sort()).toEqual([
      "guide.md #unnamed",
      "guide.md html-gone.md",
      "guide.md index.md#nope",
      "guide.md picture-gone.png",
      "guide.md reference-gone.md",
      // A relative link in a page means another page at /guide than at /guide/.
      "guide/index.html sibling",
      "index.html #gone",
      "index.html /guide#nowhere",
      "index.html /guide#unnamed",
      "index.html /llms-full.txt#nonexistent",
      "index.html /missing",
      "index.html /screenshots/absent.png",
      "llms-full.txt #nope",
      "llms.txt gone.md",
    ]);
  });

  it("holds links to the base path the site was built for", () => {
    const problems = checkLinks(readSite(outDir), { base: "/sub/" });
    expect(problems.map(({ file, link }) => `${file} ${link}`)).toContain("index.html /guide");
  });

  it("exempts only the full-window desktop page's own output, not the rest of desktop/", () => {
    const site = write(path.join(temp, "desktop"), {
      "index.html": shell(
        "/",
        `<a href="/desktop/">page</a> <a href="/desktop">page</a> <a href="/desktop/index.html">page</a>
         <a href="/desktop/assets/app.js">built asset</a>
         <a href="/desktop/other">other</a> <a href="/desktop/assets">assets folder</a>
         <a href="/desktopish">sibling</a>`,
      ),
    });
    expect(
      checkLinks(readSite(site))
        .map(({ link }) => link)
        .sort(),
    ).toEqual(["/desktop/assets", "/desktop/other", "/desktopish"]);
  });

  it("checks an absolute link to the site itself, and no other absolute link", () => {
    const site = write(path.join(temp, "absolute"), {
      "index.html": shell("/", ""),
      "guide.md": "# Guide\n",
      "llms.txt": [
        "[here](https://docs.example/mac/guide.md) [anchor](https://docs.example/mac/guide.md#guide)",
        "[gone](https://docs.example/mac/gone.md) [no anchor](https://docs.example/mac/guide.md#nope)",
        "[another site](https://example.org/mac/gone.md) [same host, another path](https://docs.example/other/gone.md)",
        "[host only](//docs.example/mac/guide.md) [host only, gone](//docs.example/mac/gone-too.md)",
      ].join("\n"),
    });
    const options = { base: "/mac/", siteUrl: "https://docs.example/mac" };
    expect(checkLinks(readSite(site), options).map(({ link }) => link)).toEqual([
      "https://docs.example/mac/gone.md",
      "https://docs.example/mac/guide.md#nope",
      "//docs.example/mac/gone-too.md",
    ]);
    // Without the site's URL nothing says which absolute links are its own.
    expect(checkLinks(readSite(site), { base: "/mac/" })).toEqual([]);
  });
});

describe("heading anchors", () => {
  it("reserves every id it hands out, as GitHub does", () => {
    const seen = new Map<string, number>();
    expect(
      ["Foo", "Foo", "Foo 1", "Foo", "Token tags: `[measured]`", "Tab\there, two  spaces"].map(
        (t) => slug(t, seen),
      ),
    ).toEqual(["foo", "foo-1", "foo-1-1", "foo-2", "token-tags-measured", "tabhere-two--spaces"]);
  });

  it("gives a page's headings the anchors its Markdown twin has, at every level", () => {
    const titles = ["One", "Two", "Three", "Four", "Five", "Six", "Six"];
    const level = (index: number) => Math.min(index + 1, 6);
    const tree = {
      type: "root",
      children: titles.map((title, index) => ({
        type: "element",
        tagName: `h${level(index)}`,
        properties: {} as Record<string, unknown>,
        children: [{ type: "text", value: title }],
      })),
    };
    rehypeHeadingIds()(tree);
    const markdown = titles.map((title, index) => `${"#".repeat(level(index))} ${title}\n`);
    expect(tree.children.map((heading) => heading.properties.id)).toEqual([
      ...readMarkdown(markdown.join("\n")).anchors,
    ]);
    expect(tree.children.at(-1)?.properties.id).toBe("six-1");
  });

  it("does not repeat an id a heading was given by hand", () => {
    const heading = (title: string, id?: string) => ({
      type: "element",
      tagName: "h2",
      properties: (id ? { id } : {}) as Record<string, unknown>,
      children: [{ type: "text", value: title }],
    });
    // The hand-written id comes later on the page than the heading that would generate it.
    const tree = { type: "root", children: [heading("Foo"), heading("Other", "foo")] };
    rehypeHeadingIds()(tree);
    expect(tree.children.map((node) => node.properties.id)).toEqual(["foo-1", "foo"]);
  });

  it("does not repeat an id that an element other than a heading has", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "h2",
          properties: {} as Record<string, unknown>,
          children: [{ type: "text", value: "Foo" }],
        },
        {
          type: "element",
          tagName: "div",
          properties: {} as Record<string, unknown>,
          children: [{ type: "element", tagName: "a", properties: { id: "foo" }, children: [] }],
        },
      ],
    };
    rehypeHeadingIds()(tree);
    expect(tree.children[0]?.properties.id).toBe("foo-1");
  });

  it("gives a Markdown heading the id the site gives it when that id is taken", () => {
    const { anchors } = readMarkdown('## Foo\n\nA place <a id="foo"></a> in a line.\n\n## Bar\n');
    expect([...anchors].sort()).toEqual(["bar", "foo", "foo-1"]);
  });

  it("does not repeat an id that an element written as JSX in a page has", async () => {
    // Compiled as the site compiles a page: JSX in MDX is not an ordinary element of the tree.
    const transform = mdx({ rehypePlugins: [rehypeHeadingIds] }).transform as (
      code: string,
      id: string,
    ) => Promise<{ code: string }>;
    const { code } = await transform(
      '<div id="foo" />\n\n## Foo\n\nA place <a id="bar" /> in a line.\n\n## Bar\n\n## Baz\n',
      "/page.mdx",
    );
    expect(code).toMatch(/id:\s*"foo-1"/);
    expect(code).toMatch(/id:\s*"bar-1"/);
    expect(code).toMatch(/id:\s*"baz"/);
  });

  it("counts a picture in a heading by its alternative text, on the site and in Markdown", async () => {
    // A picture written as Markdown, one written as a tag, and a heading that is only a picture.
    const source =
      '## Build ![passing](badge.png) today\n\n## <img alt="Status" src="status.png" />\n\n## ![Only a picture](picture.png)\n';
    const ids = ["build-passing-today", "status", "only-a-picture"];
    const transform = mdx({ rehypePlugins: [rehypeHeadingIds] }).transform as (
      code: string,
      id: string,
    ) => Promise<{ code: string }>;
    const { code } = await transform(source, "/page.mdx");
    for (const id of ids) expect(code).toContain(`id: "${id}"`);
    expect([...readMarkdown(source).anchors]).toEqual(ids);
  });
});

describe("coverage", () => {
  const root = write(path.join(temp, "coverage"), {
    "reference/spec/inventory.json": JSON.stringify({
      components: [
        { id: "box", name: "Box", category: "containers", status: "present", batch: "B4" },
        {
          id: "material",
          name: "Materials",
          category: "foundations",
          status: "present",
          batch: "T0",
        },
        { id: "drawer", name: "Drawer", category: "windows", status: "not seen", batch: "B8" },
      ],
    }),
    "src/components/box/box.mdx": "",
    "src/components/extra/extra.mdx": "",
    "src/components/unbuilt/unbuilt.mdx": "",
    "demos/desktop/desktop.mdx": "",
    "docs/content/theming.mdx": "---\ntitle: Theming\ninventory: material\n---\n",
  });
  const example = `<figure class="docs-example" data-example="basic"><div class="docs-preview"><b>x</b></div></figure>`;
  const lead = `<p class="docs-lead">What it is.</p>`;
  const props = `<table class="docs-table"><thead><tr><th>Prop</th></tr></thead></table>`;
  const outDir = write(path.join(root, "docs/dist"), {
    "index.html": shell("/", "", ["/components/box", "/theming", "/demos/desktop"]),
    "components/index.html": shell(
      "/components",
      `<ul class="docs-gallery"><li><a href="/components/box">Box</a></li></ul>`,
    ),
    "demos/index.html": shell("/demos", `<ul class="docs-gallery"></ul>`),
    "components/box/index.html": shell("/components/box", lead + example + props),
    "components/extra/index.html": shell("/components/extra", lead + example),
    "demos/desktop/index.html": shell("/demos/desktop", lead + example),
    "theming/index.html": shell("/theming", lead),
  });

  it("accounts for every inventory row, component folder and demo", () => {
    const browser = new Map([
      [
        "/components/box",
        { light: [], dark: ["example basic rendered nothing visible"], errors: [] },
      ],
      // Every example painted, and the page threw: that is not rendering either.
      ["/demos/desktop", { light: [], dark: [], errors: ["boom"] }],
    ]);
    const report = coverage({
      root,
      site: readSite(outDir),
      browser,
      screenshots: new Set(["/components/box"]),
    });
    const issues = (entry: { id: string; issues: string[] }) => [entry.id, entry.issues];

    expect(report.components.map((entry) => [entry.id, entry.kind, entry.route])).toEqual([
      ["box", "component", "/components/box"],
      ["material", "foundation", "/theming"],
      ["drawer", "missing", null],
    ]);
    expect(report.components.map(issues)).toEqual([
      ["box", ["dark: example basic rendered nothing visible"]],
      ["material", []],
      ["drawer", ["no component folder and no guide documents it"]],
    ]);
    expect(report.components[0]).toMatchObject({ light: "ok", dark: "fails", screenshots: true });
    // A folder the inventory does not list still needs a complete page.
    expect(report.extras.map(issues)).toEqual([
      [
        "extra",
        [
          "no props table",
          "not linked from the sidebar",
          "not linked from the index page",
          "no light and dark screenshot",
        ],
      ],
      ["unbuilt", ["no page in the built site"]],
    ]);
    expect(report.demos.map(issues)).toEqual([
      [
        "desktop",
        ["not linked from the index page", "browser error: boom", "no light and dark screenshot"],
      ],
    ]);
    expect(report.demos[0]).toMatchObject({ light: "fails", dark: "fails" });
    // The report's links carry the base path, so they hold on a site served under one.
    expect(renderCoverage(report, { base: "/mac/" })).toContain("[box](/mac/components/box)");
    expect(report.summary).toMatchObject({ inventory: 3, inventoryDocumented: 2, withIssues: 5 });

    // A folder without a built page is a gap the report names, not a link that leads nowhere:
    // the report is link-checked with the site, and it must pass.
    const site = readSite(outDir);
    const text = renderCoverage(report);
    expect(text).toMatch(/^\| unbuilt \| \*\*no\*\* /m);
    site.files.add("coverage.md");
    site.markdown.set("coverage.md", readMarkdown(text));
    expect(checkLinks(site).filter(({ file }) => file === "coverage.md")).toEqual([]);
  });
});
