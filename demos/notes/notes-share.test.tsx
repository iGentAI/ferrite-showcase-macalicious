import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { shareLink, takeSharedLinks } from "../desktop/desktop-share-link";
import { Notes } from "./notes";

/*
 * Share > Notes (Safari, News and Stocks: `desktop-share-link.tsx`): a shared link becomes a new
 * note, its title then its address, selected in the folder shown. On the desktop it is saved like
 * any other note (`notes-sync.ts`); `e2e/share-links-journey.mjs` checks that on the server.
 */

const PAGE = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const rows = () => within(screen.getByRole("listbox", { name: "Notes" })).queryAllByRole("option");

afterEach(() => {
  takeSharedLinks("notes");
});

describe("a link shared with Notes", () => {
  it("makes a note of a link shared before Notes opened, and of one shared while it is open", async () => {
    act(() => {
      shareLink("notes", PAGE, "macOS Catalina - Wikipedia", "safari");
    });
    render(<Notes />);
    const before = rows().length;
    await waitFor(() => expect(rows()[0]).toHaveTextContent("macOS Catalina - Wikipedia"));
    expect(rows()[0]).toHaveTextContent(PAGE);
    expect(takeSharedLinks("notes"), "taken, not kept as well").toEqual([]);
    act(() => {
      shareLink("notes", "https://www.npr.org/2", "", "news");
    });
    // A link without a title is titled by its address.
    await waitFor(() => expect(rows()[0]).toHaveTextContent("https://www.npr.org/2"));
    expect(rows()[1]).toHaveTextContent("macOS Catalina - Wikipedia");
    expect(rows()).toHaveLength(before + 1);
    // A headline with a line break is one title line, with the address after it.
    act(() => {
      shareLink(
        "notes",
        "https://www.theguardian.com/politics/live",
        "Barclays boss … and backs\nHealey – UK politics live",
        "news",
      );
    });
    await waitFor(() =>
      expect(rows()[0]).toHaveTextContent("Barclays boss … and backs Healey – UK politics live"),
    );
    expect(rows()[0]).toHaveTextContent("https://www.theguardian.com/politics/live");
  });
});
