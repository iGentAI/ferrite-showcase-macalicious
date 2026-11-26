import { afterEach, describe, expect, it } from "vitest";
import { DESKTOP_EFFECTS_EVENT, type DesktopEffect } from "./desktop-effects";
import {
  linkAddress,
  MAX_LINK_LENGTH,
  MAX_PENDING,
  OPEN_URL_EVENT,
  type OpenUrlRequest,
  onOpenUrlRequest,
  openUrl,
  takeOpenUrlRequests,
} from "./desktop-open-url";

/*
 * Links from other applications into Safari, through real window events: what is refused, the
 * queue a Safari window that opens later takes, one taken request per window, the desktop asked to
 * open Safari, and News's older `{ url }` event.
 */

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  takeOpenUrlRequests();
});

/** The `open` effects the desktop is asked for while `run` runs. */
function opened(run: () => void): string[] {
  const seen: string[] = [];
  const hear = (event: Event) => {
    for (const effect of (event as CustomEvent<DesktopEffect[]>).detail) {
      if ("open" in effect) seen.push(effect.open);
    }
  };
  window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
  try {
    run();
  } finally {
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
  }
  return seen;
}

function listen(listener: (request: OpenUrlRequest) => void) {
  cleanups.push(onOpenUrlRequest(listener));
}

describe("linkAddress", () => {
  it("keeps absolute http(s) addresses, normalised", () => {
    expect(linkAddress("https://Example.COM")).toBe("https://example.com/");
    expect(linkAddress("  http://en.wikipedia.org/wiki/Mac OS\n")).toBe(
      "http://en.wikipedia.org/wiki/Mac%20OS",
    );
    expect(linkAddress("HTTPS://bücher.example/a?b=c#d")).toBe(
      "https://xn--bcher-kva.example/a?b=c#d",
    );
  });

  it("refuses what would run, carry content, reach the machine or hide its host", () => {
    for (const text of [
      "javascript:alert(1)",
      " JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "blob:https://example.com/1",
      "file:///etc/passwd",
      "mailto:someone@example.com",
      "about:blank",
      "https://apple.com@evil.example/",
      "https://user:pass@example.com/",
    ]) {
      expect(linkAddress(text), text).toBeNull();
    }
  });

  it("refuses relative, malformed, empty and over-long text", () => {
    for (const text of [
      "",
      "   ",
      "example.com",
      "//example.com/",
      "/wiki/Mac",
      "https://",
      "http://exa mple.com/",
      "https://[::1",
      `https://example.com/${"a".repeat(MAX_LINK_LENGTH)}`,
      42,
      null,
      { url: "https://example.com/" },
    ]) {
      expect(linkAddress(text), String(text)).toBeNull();
    }
  });
});

describe("openUrl", () => {
  it("asks nothing, and opens nothing, for a refused address", () => {
    let request: OpenUrlRequest | null = null;
    const effects = opened(() => {
      request = openUrl("javascript:alert(document.cookie)", "mail");
    });
    expect(request).toBeNull();
    expect(effects).toEqual([]);
    expect(takeOpenUrlRequests()).toEqual([]);
  });

  it("queues requests for a Safari window that opens later, oldest first, and opens Safari", () => {
    const effects = opened(() => {
      openUrl("https://en.wikipedia.org/wiki/MacOS_Catalina", "mail");
      openUrl("https://text.npr.org/", "notes");
    });
    expect(effects).toEqual(["safari", "safari"]);
    // The window opens, its kept tabs load, and only then does it take the queue.
    expect(takeOpenUrlRequests()).toEqual([
      { url: "https://en.wikipedia.org/wiki/MacOS_Catalina", from: "mail" },
      { url: "https://text.npr.org/", from: "notes" },
    ]);
    expect(takeOpenUrlRequests()).toEqual([]);
  });

  it("keeps at most MAX_PENDING requests, dropping the oldest", () => {
    for (let n = 0; n < MAX_PENDING + 3; n += 1) openUrl(`https://example.com/${n}`, "news");
    const taken = takeOpenUrlRequests();
    expect(taken).toHaveLength(MAX_PENDING);
    expect(taken[0]?.url).toBe("https://example.com/3");
  });

  it("hands a request to the one open window that hears it, which cancels the event", () => {
    const first: OpenUrlRequest[] = [];
    const second: OpenUrlRequest[] = [];
    listen((request) => first.push(request));
    listen((request) => second.push(request));
    let cancelled = false;
    const watch = (event: Event) => {
      // Runs after both windows' listeners, which were added first.
      cancelled = event.defaultPrevented;
    };
    window.addEventListener(OPEN_URL_EVENT, watch);
    cleanups.push(() => window.removeEventListener(OPEN_URL_EVENT, watch));
    openUrl("https://lite.cnn.com/", "messages");
    expect(first).toEqual([{ url: "https://lite.cnn.com/", from: "messages" }]);
    expect(second).toEqual([]);
    expect(cancelled).toBe(true);
    // Taken, so a window that opens later does not open it again.
    expect(takeOpenUrlRequests()).toEqual([]);
  });

  it("leaves a request queued while no window listens, and stops hearing after cleanup", () => {
    const heard: OpenUrlRequest[] = [];
    const stop = onOpenUrlRequest((request) => heard.push(request));
    stop();
    openUrl("https://go.dev/", "spotlight");
    expect(heard).toEqual([]);
    expect(takeOpenUrlRequests()).toEqual([{ url: "https://go.dev/", from: "spotlight" }]);
  });
});

describe("News's older event", () => {
  /** What `openStoryLink` (news-live.ts) dispatches: `{ url }`, cancelable, nothing queued. */
  const story = (url: unknown) =>
    window.dispatchEvent(new CustomEvent(OPEN_URL_EVENT, { cancelable: true, detail: { url } }));

  it("is taken by an open window, which cancels it so News opens no browser tab", () => {
    const heard: OpenUrlRequest[] = [];
    listen((request) => heard.push(request));
    const unhandled = story("https://www.bbc.com/news");
    expect(unhandled).toBe(false);
    expect(heard).toEqual([{ url: "https://www.bbc.com/news", from: "unknown" }]);
  });

  it("is left alone, uncancelled, when it names no web address or no window listens", () => {
    const heard: OpenUrlRequest[] = [];
    expect(story("https://www.bbc.com/news")).toBe(true);
    listen((request) => heard.push(request));
    expect(story("javascript:alert(1)")).toBe(true);
    expect(story(undefined)).toBe(true);
    expect(heard).toEqual([]);
  });
});
