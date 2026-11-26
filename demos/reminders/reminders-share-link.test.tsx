import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { shareLink, shareTargets, takeSharedLinks } from "../desktop/desktop-share-link";
import { Reminders } from "./reminders";

/*
 * Share > Reminders (desktop-share-link.tsx): a link shared with Reminders becomes a reminder of
 * its own, titled with the link's title, its address in the URL field. `shareLink` is given the
 * receivers it would have once Reminders is listed in `SHARE_RECEIVERS`.
 */

const RECEIVERS: ReadonlySet<string> = new Set(["reminders"]);
const ARTICLE = "https://en.wikipedia.org/wiki/MacOS_Catalina";

afterEach(() => {
  // Nothing kept for a window of another test.
  takeSharedLinks("reminders");
});

const row = (title: string) =>
  screen
    .getAllByRole("option")
    .find((option) => option.querySelector(".mac-reminders-text")?.textContent === title);

describe("a link shared with Reminders", () => {
  it("becomes a reminder in the list shown, titled with the link, its address in the URL field", async () => {
    const user = userEvent.setup();
    render(<Reminders today="2019-10-03" />);
    expect(row("macOS Catalina - Wikipedia")).toBeUndefined();
    act(() => {
      shareLink("reminders", ARTICLE, "macOS Catalina - Wikipedia", "safari", RECEIVERS);
    });
    const made = row("macOS Catalina - Wikipedia");
    expect(made).toBeDefined();
    expect(made).toHaveAttribute("aria-selected", "true");
    // In the list shown (iMac Colors, the window's first view), as the title over it says.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("iMac Colors");
    await user.click(made?.querySelector("[data-reminder-info]") as HTMLElement);
    const info = await screen.findByRole("dialog");
    expect(within(info).getByDisplayValue(ARTICLE)).toBeInTheDocument();
  });

  it("takes the links shared while it was closed as its window opens, each once", () => {
    shareLink("reminders", "https://www.apple.com/macos/catalina/", "Catalina", "news", RECEIVERS);
    shareLink("reminders", "https://www.cnbc.com/quotes/AAPL", "AAPL", "stocks", RECEIVERS);
    // A link for another app is not Reminders'.
    shareLink("notes", "https://example.org/", "For Notes", "safari", new Set(["notes"]));
    const { unmount } = render(<Reminders today="2019-10-03" />);
    expect(row("Catalina")).toBeDefined();
    expect(row("AAPL")).toBeDefined();
    expect(row("For Notes")).toBeUndefined();
    unmount();
    // Taken: a window opened again does not add them twice.
    render(<Reminders today="2019-10-03" />);
    expect(row("Catalina")).toBeUndefined();
    takeSharedLinks("notes");
  });

  it("is titled with its address when it has no title", () => {
    render(<Reminders today="2019-10-03" />);
    act(() => {
      shareLink("reminders", ARTICLE, "   ", "safari", RECEIVERS);
    });
    expect(row(ARTICLE)).toBeDefined();
  });

  it("is offered in every Share menu: Reminders is among the apps that take a link", () => {
    // `SHARE_RECEIVERS` as the desktop has it, not a test's own: the row is not dimmed.
    expect(shareTargets().find((target) => target.app === "reminders")?.reason).toBeNull();
  });
});
