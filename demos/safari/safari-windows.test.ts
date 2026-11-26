import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_EFFECTS_EVENT } from "../desktop/desktop-effects";
import {
  claimTabs,
  hasClosedWindow,
  hasLastSession,
  type LiveSafariWindow,
  mergeWindows,
  openSafariWindow,
  otherWindows,
  readSafariOpening,
  registerSafariWindow,
  reopenClosedWindow,
  reopenLastSession,
  tabsHaveKeeper,
} from "./safari-windows";

const seed = (url: string) => ({ history: [url], index: 0 });
const forgetEarlierWindows = () => {
  while (hasClosedWindow()) reopenClosedWindow();
  if (hasLastSession()) reopenLastSession();
};
const windows: (() => void)[] = [];
const make = (part: Partial<LiveSafariWindow> = {}) => {
  const made: LiveSafariWindow = {
    isPrivate: false,
    keepsTabs: false,
    seeds: () => [seed("https://a.test/")],
    adopt: vi.fn(),
    close: vi.fn(),
    ...part,
  };
  const stop = registerSafariWindow(made);
  windows.push(stop);
  return { made, stop };
};

afterEach(() => {
  for (const stop of windows.splice(0)) stop();
  while (hasClosedWindow()) reopenClosedWindow();
});

describe("Safari's windows", () => {
  it("asks the desktop for a window with what it is to be", () => {
    const asked = vi.fn((event: Event) => (event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, asked);
    openSafariWindow({ isPrivate: true });
    openSafariWindow({ seeds: [seed("https://d.test/")] });
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, asked);
    expect(asked.mock.results.map(({ value }) => value)).toEqual([
      [{ newWindow: "safari", opening: { isPrivate: true, seeds: [] } }],
      [{ newWindow: "safari", opening: { isPrivate: false, seeds: [seed("https://d.test/")] } }],
    ]);
  });

  it("reads an opening that came through the desktop as anything", () => {
    const good = seed("https://e.test/");
    expect(readSafariOpening(undefined)).toBeNull();
    expect(readSafariOpening(null)).toBeNull();
    expect(readSafariOpening(false)).toBeNull();
    expect(readSafariOpening("private")).toBeNull();
    expect(readSafariOpening({ isPrivate: true })).toEqual({ isPrivate: true, seeds: [] });
    expect(readSafariOpening({ isPrivate: "yes", seeds: null })).toEqual({
      isPrivate: false,
      seeds: [],
    });
    expect(
      readSafariOpening({
        seeds: [good, null, { history: [], index: 0 }, { history: ["a"], index: 1 }],
      }),
    ).toEqual({ isPrivate: false, seeds: [good] });
  });

  it("has one keeper of the tabs, and the oldest plain window takes over when it closes", () => {
    expect(tabsHaveKeeper()).toBe(false);
    const { stop } = make({ keepsTabs: true });
    const { made: secret } = make({ isPrivate: true });
    const { made: older } = make();
    const { made: newer } = make();
    expect(tabsHaveKeeper()).toBe(true);
    expect(claimTabs(older)).toBe(false);
    stop();
    expect(tabsHaveKeeper()).toBe(false);
    expect(claimTabs(secret)).toBe(false);
    expect(claimTabs(newer)).toBe(false);
    expect(claimTabs(older)).toBe(true);
    expect(claimTabs(newer)).toBe(false);
  });

  it("merges only windows of the same kind, and a merged window cannot be reopened", () => {
    const { made: front } = make();
    const { made: other } = make({ seeds: () => [seed("https://b.test/")] });
    const { made: secret } = make({ isPrivate: true });
    expect(otherWindows(front)).toEqual([other]);
    other.close = vi.fn(() => windows.splice(1, 1)[0]?.());
    mergeWindows(front);
    expect(front.adopt).toHaveBeenCalledWith([seed("https://b.test/")]);
    expect(other.close).toHaveBeenCalled();
    expect(secret.close).not.toHaveBeenCalled();
    expect(hasClosedWindow()).toBe(false);
  });

  it("reopens the last closed window with its tabs, but never a private one", () => {
    make({ isPrivate: true }).stop();
    expect(hasClosedWindow()).toBe(false);
    make({ seeds: () => [seed("https://c.test/")] }).stop();
    expect(hasClosedWindow()).toBe(true);
    reopenClosedWindow();
    expect(hasClosedWindow()).toBe(false);
  });

  it("reopens the windows that went together last, leaving out the one that keeps the tabs", () => {
    forgetEarlierWindows();
    const kept = make({ keepsTabs: true, seeds: () => [seed("https://kept.test/")] });
    const other = make({ seeds: () => [seed("https://other.test/")] });
    expect(hasLastSession()).toBe(false);
    kept.stop();
    expect(hasLastSession()).toBe(false);
    other.stop();
    expect(hasLastSession()).toBe(true);

    const opened: unknown[] = [];
    const hear = (event: Event) => opened.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    reopenLastSession();
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    expect(JSON.stringify(opened)).toContain("https://other.test/");
    expect(JSON.stringify(opened)).not.toContain("https://kept.test/");
    expect(hasLastSession()).toBe(false);

    // Its window is no longer among those Reopen Last Closed Window can bring back.
    reopenClosedWindow();
    expect(hasClosedWindow()).toBe(false);
  });

  it("has nothing to reopen for a window whose registration only ran again", () => {
    forgetEarlierWindows();
    const opened = make({ seeds: () => [seed("https://open.test/")] });
    opened.stop();
    expect(hasLastSession()).toBe(true);
    windows.push(registerSafariWindow(opened.made));
    expect(hasClosedWindow()).toBe(false);
    expect(hasLastSession()).toBe(false);
  });

  it("has no session to reopen after a window closed before the last one, however soon", async () => {
    forgetEarlierWindows();
    const earlier = make({ seeds: () => [seed("https://earlier.test/")] });
    const last = make({ seeds: () => [seed("https://last.test/")] });
    earlier.stop();
    await Promise.resolve();
    const opened: string[] = [];
    const hear = (event: Event) => opened.push(JSON.stringify((event as CustomEvent).detail));
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    last.stop();
    reopenLastSession();
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    expect(opened.some((each) => each.includes("last.test"))).toBe(true);
    expect(opened.some((each) => each.includes("earlier.test"))).toBe(false);
    reopenClosedWindow();
    expect(hasClosedWindow()).toBe(false);
  });

  it("has nothing left to reopen after a session reopened in the same commit", () => {
    forgetEarlierWindows();
    make({ seeds: () => [seed("https://reopened.test/")] }).stop();
    reopenLastSession();
    make({ isPrivate: true }).stop();
    expect(hasLastSession()).toBe(false);
    expect(hasClosedWindow()).toBe(false);
  });

  it("has no session when only a private window closes last", async () => {
    forgetEarlierWindows();
    const earlier = make({ seeds: () => [seed("https://earlier.test/")] });
    const secret = make({ isPrivate: true });
    earlier.stop();
    await Promise.resolve();
    secret.stop();
    expect(hasLastSession()).toBe(false);
    reopenClosedWindow();
    expect(hasClosedWindow()).toBe(false);
  });

  it("keeps ten older windows however many close, a private window closing last included", async () => {
    forgetEarlierWindows();
    for (let at = 0; at < 14; at++) {
      make({ seeds: () => [seed(`https://old.test/${at}/`)] }).stop();
      await Promise.resolve();
    }
    make({ isPrivate: true }).stop();
    const opened: string[] = [];
    const hear = (event: Event) => opened.push(JSON.stringify((event as CustomEvent).detail));
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    forgetEarlierWindows();
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    // The last of the fourteen closes with an older list of ten behind it.
    expect(opened).toHaveLength(11);
    expect(opened.some((each) => each.includes("old.test/2/"))).toBe(false);
    expect(opened.some((each) => each.includes("old.test/13/"))).toBe(true);
  });

  it("reopens every window of a session, and keeps the older windows besides", async () => {
    forgetEarlierWindows();
    for (let at = 0; at < 10; at++) {
      make({ seeds: () => [seed(`https://older.test/${at}/`)] }).stop();
      await Promise.resolve();
    }
    const keeper = make({ keepsTabs: true });
    const others = Array.from({ length: 11 }, (_, at) =>
      make({ seeds: () => [seed(`https://many.test/${at}/`)] }),
    );
    keeper.stop();
    for (const other of others) other.stop();
    const opened: string[] = [];
    const hear = (event: Event) => opened.push(JSON.stringify((event as CustomEvent).detail));
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    reopenLastSession();
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    for (let at = 0; at < 11; at++) {
      expect(opened.filter((each) => each.includes(`many.test/${at}/`))).toHaveLength(1);
    }
    expect(opened.some((each) => each.includes("older.test"))).toBe(false);

    opened.length = 0;
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    forgetEarlierWindows();
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    for (let at = 0; at < 10; at++) {
      expect(opened.filter((each) => each.includes(`older.test/${at}/`))).toHaveLength(1);
    }
  });

  it("opens each window at most once, however it is reopened", () => {
    forgetEarlierWindows();
    const opened: unknown[] = [];
    const hear = (event: Event) => opened.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    const count = () => opened.filter((each) => JSON.stringify(each).includes("once.test")).length;

    // Reopened by itself, its session has nothing left to bring back.
    make({ seeds: () => [seed("https://once.test/")] }).stop();
    expect(hasLastSession()).toBe(true);
    reopenClosedWindow();
    expect(hasLastSession()).toBe(false);
    expect(count()).toBe(1);

    // Closed and reopened just before Quit: its earlier closing is no part of that session.
    opened.length = 0;
    const keeper = make({ keepsTabs: true, seeds: () => [seed("https://keeper.test/")] });
    const reopened = make({ seeds: () => [seed("https://once.test/")] });
    reopened.stop();
    reopenClosedWindow();
    expect(count()).toBe(1);
    const again = make({ seeds: () => [seed("https://once.test/")] });
    keeper.stop();
    again.stop();
    opened.length = 0;
    reopenLastSession();
    expect(count()).toBe(1);

    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    forgetEarlierWindows();
  });
});
