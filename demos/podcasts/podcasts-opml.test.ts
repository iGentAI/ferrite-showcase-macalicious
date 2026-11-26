import { describe, expect, it } from "vitest";
import { feedsOfOpml, opmlOf, showsWith } from "./podcasts-opml";

describe("Podcasts OPML", () => {
  it("round-trips the shows, with their titles escaped", () => {
    const text = opmlOf([
      { title: 'Q&A <"live">', feed: "https://feeds.npr.org/1?a=1&b=2" },
      { title: "Other", feed: "https://feeds.npr.org/2" },
    ]);
    expect(text).toContain('text="Q&amp;A &lt;&quot;live&quot;&gt;"');
    expect(feedsOfOpml(text)).toEqual([
      "https://feeds.npr.org/1?a=1&b=2",
      "https://feeds.npr.org/2",
    ]);
  });

  it("reads other apps' lists: folders, a lower-case attribute, http, and a feed listed twice", () => {
    const text = `<opml version="1.1"><body><outline text="Folder">
      <outline xmlUrl="http://Feeds.NPR.org/1"/><outline xmlurl="https://feeds.npr.org/2"/>
      <outline xmlUrl="https://feeds.npr.org/1"/></outline></body></opml>`;
    expect(feedsOfOpml(text)).toEqual(["https://feeds.npr.org/1", "https://feeds.npr.org/2"]);
  });

  it("adds what fits the limit as the list stands, and nothing twice", () => {
    const show = (n: number) => ({ id: `s${n}`, feed: `https://feeds.npr.org/${n}` });
    expect(showsWith([show(1)], [show(2), show(3)], 2)).toEqual([show(1), show(2)]);
    expect(showsWith([show(1), show(2)], [show(3)], 2)).toEqual([show(1), show(2)]);
    expect(showsWith([show(1)], [show(1), { id: "other", feed: show(1).feed }], 5)).toEqual([
      show(1),
    ]);
  });

  it("finds no feeds in a file that is not OPML", () => {
    expect(feedsOfOpml("not xml at all")).toEqual([]);
    expect(feedsOfOpml('<rss><outline xmlUrl="https://a.test/"/></rss>')).toEqual([]);
  });
});
