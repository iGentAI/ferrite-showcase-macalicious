import { describe, expect, it } from "vitest";
import { feedAddress, showIdOfFeed } from "./podcasts-add-show";

describe("Add a Show by URL", () => {
  it("reads http as https, and takes an address with no scheme", () => {
    expect(feedAddress(" https://feeds.npr.org/510289/podcast.xml ")).toBe(
      "https://feeds.npr.org/510289/podcast.xml",
    );
    expect(feedAddress("HTTP://feeds.npr.org/1")).toBe("https://feeds.npr.org/1");
    expect(feedAddress("HTTPS://feeds.npr.org/1")).toBe("https://feeds.npr.org/1");
    expect(feedAddress("https://Feeds.NPR.org/Show?Id=A")).toBe("https://feeds.npr.org/Show?Id=A");
    expect(feedAddress("feeds.npr.org/1")).toBe("https://feeds.npr.org/1");
  });

  it("gives one feed one plain id, and two feeds two", () => {
    const id = showIdOfFeed("https://feeds.npr.org/1");
    expect(id).toBe(showIdOfFeed("https://feeds.npr.org/1"));
    expect(id).not.toBe(showIdOfFeed("https://feeds.npr.org/2"));
    expect(id).toMatch(/^feed-[0-9a-f]{1,8}$/);
  });
});
