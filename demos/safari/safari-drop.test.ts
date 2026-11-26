import { describe, expect, it } from "vitest";
import { droppedLink, droppedText } from "./safari-drop";

const drop = (values: Record<string, string>) => ({
  types: Object.keys(values),
  getData: (type: string) => values[type] ?? "",
});

describe("what a drop carries", () => {
  it("takes the first address of a list, passing over comments", () => {
    expect(
      droppedText(drop({ "text/uri-list": "# a note\r\nhttps://a.org/\r\nhttps://b.org/" })),
    ).toBe("https://a.org/");
  });

  it("falls back to text, which is not a link", () => {
    const words = drop({ "text/plain": "  catalina wallpaper " });
    expect(droppedText(words)).toBe("catalina wallpaper");
    expect(droppedLink(words)).toBeNull();
  });

  it("names a link by the text of what was dragged, else its address", () => {
    expect(
      droppedLink(
        drop({ "text/uri-list": "https://a.org/", "text/html": '<a href="x"> Apple </a>' }),
      ),
    ).toEqual({ title: "Apple", url: "https://a.org/" });
    expect(droppedLink(drop({ "text/uri-list": "https://a.org/" }))).toEqual({
      title: "https://a.org/",
      url: "https://a.org/",
    });
  });

  it("takes no address that is not on the web", () => {
    expect(droppedLink(drop({ "text/uri-list": "javascript:alert(1)" }))).toBeNull();
  });
});
