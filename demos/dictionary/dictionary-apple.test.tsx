import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appleTermsFor, withAppleTerm } from "./dictionary-apple";
import { DesktopDictionary } from "./dictionary-desktop";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the Apple scope's terms", () => {
  it("lists the terms a word begins, in any case, and none for an empty field", () => {
    expect(appleTermsFor("airp")).toEqual(["AirPlay", "AirPods"]);
    expect(appleTermsFor("MACOS")).toEqual(["macOS"]);
    expect(appleTermsFor("")).toEqual([]);
    expect(appleTermsFor(null)).toEqual([]);
    expect(appleTermsFor("serendipity")).toEqual([]);
  });

  it("adds its paragraph, in place of a word no source knows or that is being looked up", () => {
    const entry = withAppleTerm({ word: "siri", status: "Looking up…" });
    expect(entry.status).toBeUndefined();
    expect(entry.apple).toMatch(/voice assistant/);
    const other = { word: "serendipity", status: "Looking up…" };
    expect(withAppleTerm(other)).toBe(other);
  });

  it("shows a term under Apple on the desktop, with the other sources' words beside it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const { pathname, searchParams } = new URL(url, "http://desktop.test");
        const body = pathname.endsWith("/suggest")
          ? { words: [] }
          : pathname.endsWith("/entry")
            ? { word: searchParams.get("word"), found: false }
            : { words: [], rev: 0, session: "s1" };
        return { ok: true, status: 200, json: async () => body };
      }),
    );
    render(<DesktopDictionary defaultQuery="" defaultScope="apple" />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "Spotlight");
    const shown = await screen.findByRole("region", { name: /Entry for Spotlight/i });
    await waitFor(() =>
      expect(within(shown).getByText(/opened by Command-Space/)).toBeInTheDocument(),
    );
  });
});
