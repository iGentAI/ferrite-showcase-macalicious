import { describe, expect, it } from "vitest";
import {
  addressOfLinkFile,
  bookmarksFromHtml,
  bookmarksToHtml,
  isLinkFile,
  pageFileName,
} from "./safari-files";

describe("Safari's files", () => {
  it("writes bookmarks a browser can read, and reads them back", () => {
    const html = bookmarksToHtml([
      {
        title: "Favorites",
        links: [{ title: 'A "quoted" <name>', url: "https://a.test/?x=1&y=2" }],
      },
      { title: "Bookmarks", links: [{ title: "B", url: "https://b.test/" }] },
    ]);
    expect(html.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")).toBe(true);
    expect(bookmarksFromHtml(html)).toEqual([
      { title: 'A "quoted" <name>', url: "https://a.test/?x=1&y=2" },
      { title: "B", url: "https://b.test/" },
    ]);
  });

  it("imports only http(s) links, each once", () => {
    expect(
      bookmarksFromHtml(
        '<a href="javascript:alert(1)">x</a><a href="https://a.test/">A</a><a href="https://a.test/">A2</a><a href="https://b.test/"></a>',
      ),
    ).toEqual([
      { title: "A", url: "https://a.test/" },
      { title: "https://b.test/", url: "https://b.test/" },
    ]);
  });

  it("reads the address of a .webloc and of a .url, refusing other schemes", () => {
    expect(
      addressOfLinkFile(
        "<plist><dict><key>URL</key><string>https://a.test/?x=1&amp;y=2</string></dict></plist>",
      ),
    ).toBe("https://a.test/?x=1&y=2");
    expect(addressOfLinkFile("[InternetShortcut]\r\nURL=https://b.test/\r\n")).toBe(
      "https://b.test/",
    );
    expect(addressOfLinkFile("URL=file:///etc/passwd")).toBeNull();
    expect(addressOfLinkFile("nothing here")).toBeNull();
  });

  it("names a file for a page", () => {
    expect(pageFileName('A/B: "c"', "html")).toBe("A B c.html");
    expect(pageFileName("  ", "html")).toBe("Untitled.html");
    expect(isLinkFile({ name: "x.WEBLOC" })).toBe(true);
    expect(isLinkFile({ name: "x.html" })).toBe(false);
  });
});
