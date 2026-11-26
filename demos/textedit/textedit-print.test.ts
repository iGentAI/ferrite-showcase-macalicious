import { describe, expect, it } from "vitest";
import { printPage } from "./textedit-drive";

describe("the page a document prints as", () => {
  const page = (ruler?: { first: number; head: number; tail: number; tab: number }) =>
    printPage({ name: "Letter", html: "<div>Text</div>", lines: ["Text"], plain: false, ruler });

  it("carries the ruler's indents and tab width", () => {
    const html = page({ first: 36, head: 18, tail: 9, tab: 54 });
    expect(html).toContain("body{tab-size:54px}");
    expect(html).toContain("body>*{margin:0 9px 0 18px;text-indent:18px}");
    expect(html).toContain("margin-left:46px");
  });

  it("adds nothing for a document with no ruler", () => {
    expect(page()).not.toContain("tab-size");
  });

  it("prints on the paper chosen, turned and scaled, once per copy", () => {
    const html = printPage({
      name: "Letter",
      html: "<div>Text</div>",
      lines: ["Text"],
      plain: false,
      page: { paper: "a4", orientation: "landscape", scale: 80, copies: 2 },
    });
    expect(html).toContain("@page{size:A4 landscape;margin:1in}");
    expect(html).toContain("html{zoom:0.8}");
    expect(html).toContain(
      '<body><div>Text</div><div data-page-break=""></div><div>Text</div></body>',
    );
  });

  it("adds nothing to the page at 100%, on one copy", () => {
    const html = printPage({
      name: "Letter",
      html: "<div>Text</div>",
      lines: ["Text"],
      plain: false,
      page: { paper: "letter", orientation: "portrait", scale: 100, copies: 1 },
    });
    expect(html).toContain("@page{size:Letter portrait;margin:1in}");
    expect(html).not.toContain("zoom");
    expect(html).toContain("<body><div>Text</div></body>");
  });

  const setup = { paper: "letter", orientation: "portrait", scale: 100 } as const;
  const lines = Array.from({ length: 100 }, (_, at) => `Line ${at + 1}`);

  it("prints only the sheet's Pages of a plain document, as its preview counts them", () => {
    const html = printPage({
      name: "Long",
      lines,
      plain: true,
      page: { ...setup, range: { from: 2, to: 2 } },
    });
    expect(html).toContain("<pre>Line 47\n");
    expect(html).toContain("\nLine 92</pre>");
    expect(html).not.toContain("Line 46\n");
    expect(html).not.toContain("Line 93");
  });

  it("prints only the sheet's Pages of a rich document, its paragraphs whole", () => {
    const html = printPage({
      name: "Long",
      html: lines.map((line) => `<div><b>${line}</b></div>`).join(""),
      lines,
      plain: false,
      page: { ...setup, range: { from: 3, to: 9 } },
    });
    expect(html).toContain("<body><div><b>Line 93</b></div>");
    expect(html).toContain("<div><b>Line 100</b></div></body>");
    expect(html).not.toContain("Line 92<");
  });

  it("reads a range the wrong way round as its first page", () => {
    const html = printPage({
      name: "Long",
      lines,
      plain: true,
      page: { ...setup, range: { from: 3, to: 1 } },
    });
    expect(html).toContain("<pre>Line 93\n");
    expect(html).not.toContain("Line 92");
  });

  it("leaves the back of a copy's last sheet blank when printed two-sided", () => {
    const page = (count: number, twoSided: boolean) =>
      printPage({
        name: "Letter",
        lines: Array.from({ length: count }, () => "T"),
        plain: false,
        html: "<div>T</div>",
        page: { ...setup, copies: 2, twoSided },
      });
    const BREAK = '<div data-page-break=""></div>';
    expect(page(1, true)).toContain(`<body><div>T</div>${BREAK}${BREAK}<div>T</div></body>`);
    expect(page(47, true)).toContain(`<body><div>T</div>${BREAK}<div>T</div></body>`);
    expect(page(93, true)).toContain(`<body><div>T</div>${BREAK}${BREAK}<div>T</div></body>`);
    expect(page(1, false)).toContain(`<body><div>T</div>${BREAK}<div>T</div></body>`);
  });

  it("counts a two-sided copy's pages from the range it prints", () => {
    const html = printPage({
      name: "Long",
      lines,
      plain: true,
      page: { ...setup, copies: 2, twoSided: true, range: { from: 1, to: 2 } },
    });
    expect(html).toContain('Line 92</pre><div data-page-break=""></div><pre>Line 1\n');
  });

  it("starts a new printed page at a form feed in plain text", () => {
    const html = printPage({ name: "Note", lines: ["One\fTwo"], plain: true });
    expect(html).toContain('<pre>One</pre><pre style="break-before:page">Two</pre>');
  });
});
