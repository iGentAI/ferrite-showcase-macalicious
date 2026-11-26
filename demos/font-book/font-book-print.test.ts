import { describe, expect, it } from "vitest";
import { families } from "./font-book-data";
import { reportHtml } from "./font-book-print";

describe("Font Book's printed reports", () => {
  const courier = families.find((family) => family.name === "Courier");
  if (!courier) throw new Error("no Courier");

  it("lists every style of a family in the Catalog, in its own font", () => {
    const html = reportHtml("catalog", [courier]);
    expect(html).toContain(">Courier<");
    for (const style of courier.styles) expect(html).toContain(`>${style.name}<`);
    expect(html).toContain("font-family:");
  });

  it("has the family's characters in the Repertoire, written safely", () => {
    const html = reportHtml("repertoire", [courier]);
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain(" < ");
  });

  it("has the sample at growing sizes in the Waterfall", () => {
    const html = reportHtml("waterfall", [courier]);
    expect(html).toContain(">9 pt<");
    expect(html).toContain("font-size:48px");
  });

  it("brings a font added from a file along in the page", () => {
    const html = reportHtml(
      "catalog",
      [courier],
      [{ name: 'My "</style>Font', dataUrl: "data:font/ttf;base64,AAAA" }],
    );
    expect(html).toContain("@font-face");
    expect(html).toContain("src:url(data:font/ttf;base64,AAAA)");
    expect(html).not.toContain("</style>Font");
  });

  it("keeps a name's markup out of the page", () => {
    const named = { ...courier, name: "<img src=x onerror=1>" };
    expect(reportHtml("catalog", [named])).not.toContain("<img");
  });
});
