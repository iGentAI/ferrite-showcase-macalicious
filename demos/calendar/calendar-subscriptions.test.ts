import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedProblem, feedAddress, feedEntries, readFeed } from "./calendar-subscriptions";

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "X-WR-CALNAME:Club",
  "BEGIN:VEVENT",
  "UID:one@example.com",
  "DTSTART:20310305T100000Z",
  "DTEND:20310305T110000Z",
  "SUMMARY:Meeting",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

afterEach(() => vi.unstubAllGlobals());

describe("feedAddress", () => {
  it("takes webcal as the web and refuses what is not a web address", () => {
    expect(feedAddress(" webcal://example.com/a.ics ")).toBe("https://example.com/a.ics");
    expect(feedAddress("http://example.com/a.ics")).toBe("http://example.com/a.ics");
    expect(feedAddress("javascript:alert(1)")).toBeNull();
    expect(feedAddress("not an address")).toBeNull();
  });
});

describe("readFeed", () => {
  it("reads the feed's events, without the person's cookies", async () => {
    const fetched = vi.fn(async () => new Response(FEED));
    vi.stubGlobal("fetch", fetched);
    const read = await readFeed("https://example.com/a.ics");
    expect(read.name).toBe("Club");
    expect(fetched.mock.calls[0]).toMatchObject([
      "https://example.com/a.ics",
      { credentials: "omit" },
    ]);
    const entries = feedEntries(
      { id: "sub-1", name: "Club", color: "blue", url: "https://example.com/a.ics" },
      read,
    );
    expect(entries.map(({ title, calendar }) => [title, calendar])).toEqual([["Meeting", "sub-1"]]);
  });

  it("says why when the site refuses, answers an error, or holds no events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toThrow(
      /does not let other pages read/,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toThrow(/status 404/);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html></html>")),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toBeInstanceOf(FeedProblem);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("BEGIN:VCALENDAR\r\nBEGIN:VCALENDAR\r\nEND:VCALENDAR\r\nEND:VCALENDAR"),
      ),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toThrow(/no whole calendar/);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            FEED.replace("SUMMARY:Meeting", "SUMMARY:Meeting\r\nDESCRIPTION:x\r\n BEGIN:VEVENT"),
          ),
      ),
    );
    expect((await readFeed("https://example.com/a.ics")).events).toHaveLength(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")),
    );
    expect((await readFeed("https://example.com/a.ics")).events).toEqual([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("BEGIN:VCALENDARgarbage\r\n")),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toBeInstanceOf(FeedProblem);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toBeInstanceOf(FeedProblem);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(FEED.replace("END:VCALENDAR", ""))),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toThrow(/no whole calendar/);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nBEGIN:VTIMEZONE\r\nEND:VCALENDAR\r\n")),
    );
    await expect(readFeed("https://example.com/a.ics")).rejects.toThrow(/no whole calendar/);
  });
});
